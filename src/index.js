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
    // Usar headless: false para depuración si Moodle bloquea el acceso.
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await auth.loginIfNeeded(page);

    console.log('Navegando a la línea de tiempo (/my/)...');
    await page.goto('https://ingenieria.campusvirtual.ucasal.edu.ar/my/', {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    // Los eventos de Moodle se cargan dinámicamente via AJAX.
    // Necesitamos esperar a que aparezcan en el DOM.
    console.log('Esperando a que carguen los eventos...');
    
    let eventsFound = false;
    
    // Strategy 1: Wait for .event elements (Próximos Eventos block)
    try {
      await page.waitForSelector('.event', { timeout: 15000 });
      eventsFound = true;
      console.log('Eventos (.event) encontrados.');
    } catch (_) {
      console.log('.event no apareció en 15s, intentando con block_calendar_upcoming...');
    }

    // Strategy 2: Wait for block_calendar_upcoming to have content
    if (!eventsFound) {
      try {
        await page.waitForSelector('.block_calendar_upcoming .event', { timeout: 10000 });
        eventsFound = true;
        console.log('Eventos en block_calendar_upcoming encontrados.');
      } catch (_) {
        console.log('block_calendar_upcoming sin eventos.');
      }
    }

    // Strategy 3: Extra wait for lazy-loaded content
    if (!eventsFound) {
      console.log('Esperando 8 segundos extra para carga dinámica...');
      await new Promise(r => setTimeout(r, 8000));
    } else {
      // Small extra wait for remaining events to render
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Extrayendo eventos del DOM...');
    const eventsData = await page.evaluate(() => {
      const events = document.querySelectorAll('.event');
      if (events.length === 0) {
        return [];
      }

      return Array.from(events).map(el => {
        // Title: inside h4 > a
        const titleEl = el.querySelector('h4 a[data-type="event"]')
          || el.querySelector('h4 a.text-truncate')
          || el.querySelector('h4 a')
          || el.querySelector('a');
        const title = titleEl ? titleEl.textContent.trim() : '';
        const url = titleEl ? titleEl.href : '';

        // Date: inside .date div
        const dateEl = el.querySelector('.date');
        const date = dateEl ? dateEl.textContent.trim() : '';

        // Event ID
        let eventId = '';
        if (titleEl && titleEl.dataset && titleEl.dataset.eventId) {
          eventId = titleEl.dataset.eventId;
        } else if (url) {
          const hashMatch = url.match(/#event_(\d+)/);
          if (hashMatch) eventId = hashMatch[1];
        }

        // Course ID from URL
        let courseId = '';
        if (url) {
          const courseMatch = url.match(/course=(\d+)/);
          if (courseMatch) courseId = courseMatch[1];
        }

        return { title, url, date, eventId, courseId };
      });
    });

    console.log(`Se extrajeron ${eventsData.length} eventos del DOM.`);

    if (eventsData.length === 0) {
      console.log('DEBUG: Guardando HTML para análisis...');
      const html = await page.content();
      require('fs').writeFileSync('debug.html', html);
      console.log('HTML guardado en debug.html (revísalo para ver la estructura).');
    }

    await browser.close();
    return eventsData;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function runSync() {
  try {
    const eventsData = await scrapeCampus();

    console.log('Procesando eventos...');
    const tasks = parser.parseEvents(eventsData);
    console.log(`Se encontraron ${tasks.length} tareas.`);

    if (tasks.length > 0) {
      console.log('\nTareas encontradas:');
      tasks.forEach((t, i) => {
        console.log(`  ${i + 1}. [${t.id}] ${t.title} | Fecha: ${t.due_date} | Curso: ${t.course}`);
      });
    }

    console.log('\nCalculando diferencias con db.json...');
    const { newTasksToSync, updatedTasksToSync, state } = storage.diff(tasks);

    console.log(`Nuevas: ${newTasksToSync.length}, Modificadas: ${updatedTasksToSync.length}`);

    const allToSync = [...newTasksToSync, ...updatedTasksToSync];

    if (!process.env.DATABASE_ID) {
      console.log('WARNING: DATABASE_ID no definido, se actualizará el estado local sin enviar a Notion.');
    } else if (allToSync.length === 0) {
      console.log('No hay tareas nuevas ni modificadas para sincronizar.');
    } else {
      console.log(`\nSincronizando ${allToSync.length} tareas con Notion...`);
      for (const task of allToSync) {
        try {
          await notionSync.syncTaskToNotion(task);
        } catch (err) {
          console.error(`  Error sincronizando "${task.title}":`, err.message);
        }
      }
    }

    storage.save(state);
    console.log('\nSincronización completada.');
    return { success: true, newTasks: newTasksToSync.length, updatedTasks: updatedTasksToSync.length };

  } catch (error) {
    console.error('Error general:', error);
    throw error;
  }
}

if (require.main === module) {
  runSync().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runSync, scrapeCampus };