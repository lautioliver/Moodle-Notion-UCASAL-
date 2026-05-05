const fs = require('fs');
const path = require('path');

/**
 * Parser de eventos de Moodle.
 * Transforma los datos crudos del DOM en tareas estructuradas.
 */

let courseMap = {};
try {
  const mapPath = path.join(__dirname, 'courses.json');
  if (fs.existsSync(mapPath)) {
    courseMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }
} catch (e) {
  console.warn('No se pudo cargar courses.json', e.message);
}

function parseEvents(eventsData) {
  const tasks = [];

  for (const event of eventsData) {
    const { title, url, date, eventId: rawEventId, courseId } = event;
    if (!title) continue;

    // Extraer curso ID de la URL si no viene en el evento
    let extractedCourseId = courseId;
    if (!extractedCourseId && url) {
      const match = url.match(/course=(\d+)/);
      if (match) {
        extractedCourseId = match[1];
      }
    }

    // Usar el mapa de cursos o el ID por defecto
    let course = 'General';
    if (extractedCourseId) {
      course = courseMap[extractedCourseId] || `Curso ID: ${extractedCourseId}`;
    }

    // Usar el event ID extraído directamente del DOM (data-event-id)
    // o del hash de la URL (#event_XXXXX)
    let eventId = rawEventId || '';
    if (!eventId && url) {
      const hashMatch = url.match(/#event_(\d+)/);
      if (hashMatch) {
        eventId = hashMatch[1];
      }
    }
    // Fallback: generar un ID basado en el contenido
    if (!eventId) {
      eventId = Buffer.from(title + url).toString('base64').substring(0, 16);
    }

    tasks.push({
      id: eventId,
      title,
      course,
      due_date: date,
      url: url || '',
      last_updated: Date.now()
    });
  }

  return tasks;
}

// Esta función se puede usar directamente en page.evaluate() si es necesario
function extractFromPage() {
  return Array.from(document.querySelectorAll('.event')).map(el => {
    const titleEl = el.querySelector('h4 a[data-type="event"]')
      || el.querySelector('h4 a.text-truncate')
      || el.querySelector('h4 a');
    const title = titleEl?.textContent?.trim() || '';
    const url = titleEl?.href || '';
    const date = el.querySelector('.date')?.textContent?.trim() || '';

    let eventId = '';
    if (titleEl?.dataset?.eventId) {
      eventId = titleEl.dataset.eventId;
    }

    let courseId = '';
    const courseMatch = url.match(/course=(\d+)/);
    if (courseMatch) courseId = courseMatch[1];

    return { title, url, date, eventId, courseId };
  });
}

module.exports = { parseEvents, extractFromPage };
