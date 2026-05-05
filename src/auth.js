const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, '../data/cookies.json');

function loadCookies() {
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveCookies(cookies) {
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8');
}

/**
 * Intenta restaurar la sesión con cookies guardadas.
 * Si falla, hace login completo con usuario y contraseña.
 * 
 * @param {import('puppeteer').Page} page
 * @returns {Promise<boolean>} true si el login fue exitoso
 */
async function loginIfNeeded(page) {
  const { MOODLE_USER, MOODLE_PASS } = process.env;

  await page.setViewport({ width: 1280, height: 800 });

  // Set a realistic user-agent to avoid bot detection
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  const cookies = loadCookies();

  if (cookies && cookies.length > 0) {
    console.log('Restaurando sesión desde cookies guardadas...');
    const validCookies = cookies.map(c => {
      // Las cookies de sesión suelen tener expires: -1, lo que causa problemas
      // en Puppeteer al usar setCookie. Le asignamos 30 días en el futuro.
      if (c.expires === -1) {
        c.expires = (Date.now() / 1000) + (86400 * 30);
      }
      return c;
    });
    await page.setCookie(...validCookies);

    await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/my/', {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const currentUrl = page.url();
    const hasLoginForm = await page.$('#username') !== null;

    if (!hasLoginForm && !currentUrl.includes('/login/')) {
      console.log('Sesión válida, omitiendo login.');
      return true;
    }
    console.log('Sesión expirada o inválida, iniciando login fresco...');
  }

  // Fresh login
  console.log('Navegando a la página de login de UCASAL...');
  await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/login/index.php', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });

  // Clear any pre-filled values
  await page.evaluate(() => {
    const user = document.querySelector('#username');
    const pass = document.querySelector('#password');
    if (user) user.value = '';
    if (pass) pass.value = '';
  });

  console.log('Completando credenciales...');
  await page.type('#username', MOODLE_USER, { delay: 30 });
  await page.type('#password', MOODLE_PASS, { delay: 30 });

  console.log('Iniciando sesión...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
    page.click('#loginbtn'),
  ]);

  // Verify login was successful
  const afterLoginUrl = page.url();
  const stillOnLogin = await page.$('#username') !== null;

  if (stillOnLogin || afterLoginUrl.includes('/login/')) {
    console.error('ERROR: Login falló. Verifica usuario y contraseña en .env');
    console.error('URL actual:', afterLoginUrl);
    throw new Error('Login fallido - credenciales inválidas o Moodle bloqueó el acceso');
  }

  // Save cookies for next time
  const newCookies = await page.cookies();
  saveCookies(newCookies);
  console.log('Login exitoso. Cookies guardadas para próximas ejecuciones.');

  return true;
}

module.exports = {
  loadCookies,
  saveCookies,
  loginIfNeeded
};