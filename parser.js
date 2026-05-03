function parseEvents(eventsData) {
  const tasks = [];

  for (const event of eventsData) {
    const { title, url, date } = event;
    if (!title) continue;

    let course = 'General';
    if (url) {
      const match = url.match(/course=(\d+)/);
      if (match) {
        course = `Curso ID: ${match[1]}`;
      }
    }

    let eventId = '';
    if (url) {
      const idMatch = url.match(/event_(\d+)/);
      if (idMatch) {
        eventId = idMatch[1];
      }
    }

    if (!eventId) {
      eventId = Buffer.from(title + url).toString('base64').substring(0, 10);
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

function extractFromPage() {
  return Array.from(document.querySelectorAll('.event')).map(el => {
    const titleEl = el.querySelector('h4 a.text-truncate') || el.querySelector('h4 a');
    const title = titleEl?.textContent?.trim() || '';
    const url = titleEl?.href || '';
    const date = el.querySelector('.date')?.textContent?.trim() || '';

    return { title, url, date };
  });
}

module.exports = { parseEvents, extractFromPage };
