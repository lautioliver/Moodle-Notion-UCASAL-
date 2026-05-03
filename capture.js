require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const { MOODLE_USER, MOODLE_PASS } = process.env;

  if (!MOODLE_USER || !MOODLE_PASS) {
    console.error('Error: MOODLE_USER y MOODLE_PASS deben estar definidos en el archivo .env');
    process.exit(1);
  }

  console.log('Iniciando navegador...');
  // headless: false for debugging, later can be changed to 'new' or true
  const browser = await puppeteer.launch({ headless: false }); 
  const page = await browser.newPage();

  // Set a reasonable viewport
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navegando a la página de login de UCASAL...');
  await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/login/index.php', { waitUntil: 'networkidle2' });

  console.log('Completando credenciales...');
  await page.type('#username', MOODLE_USER, { delay: 50 });
  await page.type('#password', MOODLE_PASS, { delay: 50 });

  console.log('Iniciando sesión...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#loginbtn'),
  ]);

  console.log('Navegando a la línea de tiempo (/my/)...');
  await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/my/', { waitUntil: 'networkidle2' });

  console.log('Esperando a que cargue la sección del Timeline / Eventos...');
  // Adjust this selector if the timeline takes more time to render
  // Moodle timelines are usually block instances, e.g. .block_timeline
  try {
    await page.waitForSelector('.block_timeline', { timeout: 10000 });
  } catch (error) {
    console.log('No se encontró .block_timeline rápidamente, esperando un poco más...');
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('Guardando el HTML de la página...');
  const html = await page.content();
  fs.writeFileSync('campus_source.html', html, 'utf8');

  console.log('HTML guardado exitosamente en campus_source.html');

  await browser.close();
})();
