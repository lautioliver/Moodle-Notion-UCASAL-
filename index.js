require('dotenv').config();
const puppeteer = require('puppeteer');
const parser = require('./parser');
const storage = require('./storage');
const notionSync = require('./notionSync');
const auth = require('./auth');

async function scrapeCampus() {
  const { MOODLE_USER, MOODLE_PASS } = process.env;

  if (!MOODLE_USER || !MOODLE_PASS) {
    throw new Error('MOODLE_USER y MOODLE_PASS deben estar definidos en el archivo .env');
  }

  console.log('Iniciando navegador...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await auth.loginIfNeeded(page);

  console.log('Navegando a la línea de tiempo (/my/)...');
  await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/my/', {
    waitUntil: 'networkidle2'
  });

  try {
    await page.waitForSelector('.block_timeline', { timeout: 10000 });
  } catch (error) {
    console.log('No se encontró .block_timeline rápidamente, continuando...');
  }

  console.log('Esperando carga de eventos...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Extrayendo eventos directamente del DOM...');
  const eventsData = await page.evaluate(() => {
    const selectors = ['.event', '.timeline-event', '[data-region="event"]', '.card.event'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        console.log('Selector usado:', sel, 'con', els.length, 'elementos');
        return Array.from(els).map(el => {
          const titleEl = el.querySelector('h4 a') || el.querySelector('.event-title a') || el.querySelector('a[href*="event"]');
          const title = titleEl?.textContent?.trim() || el.textContent.trim().split('\n')[0];
          const url = titleEl?.href || '';
          const date = el.querySelector('.date')?.textContent?.trim() || el.querySelector('[data-full-date]')?.textContent?.trim() || '';

          return { title, url, date };
        });
      }
    }
    console.log('No se encontró ningún selector de eventos-known');
    return [];
  });

  if (eventsData.length === 0) {
    console.log('DEBUG: Guardando HTML para análisis...');
    const html = await page.content();
    require('fs').writeFileSync('debug.html', html);
    console.log('HTML guardado en debug.html');
  }
  await browser.close();

  return eventsData;
}

(async () => {
  try {
    const eventsData = await scrapeCampus();

    console.log('Procesando eventos...');
    const tasks = parser.parseEvents(eventsData);
    console.log(`Se encontraron ${tasks.length} tareas.`);

    console.log('Calculando diferencias con db.json...');
    const { newTasksToSync, updatedTasksToSync, state } = storage.diff(tasks);

    console.log(`Nuevas: ${newTasksToSync.length}, Modificadas: ${updatedTasksToSync.length}`);

    const allToSync = [...newTasksToSync, ...updatedTasksToSync];

    if (!process.env.DATABASE_ID) {
      console.log('WARNING: DATABASE_ID no definido, se actualizará el estado local sin enviar a Notion.');
    } else {
      for (const task of allToSync) {
        await notionSync.syncTaskToNotion(task);
      }
    }

    storage.save(state);
    console.log('Sincronización completada.');

  } catch (error) {
    console.error('Error general:', error);
  }
})();