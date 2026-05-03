const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies.json');
const SESSION_FILE = path.join(__dirname, 'session.json');

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

function loadSession() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveSession(sessionData) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
}

async function loginIfNeeded(page) {
  const { MOODLE_USER, MOODLE_PASS } = process.env;
  const cookies = loadCookies();
  const session = loadSession();

  await page.setViewport({ width: 1280, height: 800 });

  if (cookies && cookies.length > 0) {
    console.log('Restaurando sesión desde cookies guardadas...');
    await page.setCookie(...cookies);

    await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/my/', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    const onLoginPage = await page.$('#username') !== null;
    const url = page.url();
    if (!onLoginPage && !url.includes('login')) {
      console.log('Sesión válida, omitiendo login.');
      return true;
    }
    console.log('Sesión expirada o inválida, iniciando login...');
  }

  console.log('Navegando a la página de login de UCASAL...');
  await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/login/index.php', {
    waitUntil: 'networkidle2'
  });

  console.log('Completando credenciales...');
  await page.type('#username', MOODLE_USER, { delay: 10 });
  await page.type('#password', MOODLE_PASS, { delay: 10 });

  console.log('Iniciando sesión...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#loginbtn'),
  ]);

  const newCookies = await page.cookies();
  saveCookies(newCookies);

  console.log('Cookies guardadas para próximas ejecuciones.');
  return true;
}

module.exports = {
  loadCookies,
  saveCookies,
  loginIfNeeded
};