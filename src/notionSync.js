require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.DATABASE_ID;

/**
 * Normaliza la fecha de Moodle a un formato ISO aceptado por Notion.
 * Moodle da fechas como:
 *   - "Mañana, 23:59"
 *   - "lunes, 4 mayo, 22:00"
 *   - "martes, 5 mayo, 14:00 » 16:22"
 *   - "domingo, 10 mayo, 23:59"
 */
function normalizeDate(moodleDate) {
  if (!moodleDate) {
    return new Date().toISOString().split('T')[0];
  }

  const today = new Date();
  const lower = moodleDate.toLowerCase();

  // Handle "Hoy, HH:MM"
  if (lower.includes('hoy')) {
    return today.toISOString().split('T')[0];
  }

  // Handle "Mañana, HH:MM"
  if (lower.includes('mañana')) {
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  }

  // Handle "Ayer, HH:MM"
  if (lower.includes('ayer')) {
    today.setDate(today.getDate() - 1);
    return today.toISOString().split('T')[0];
  }

  // Handle format: "dayOfWeek, DD month, HH:MM" or "dayOfWeek, DD month, HH:MM » HH:MM"
  // Examples: "lunes, 4 mayo, 22:00", "martes, 5 mayo, 14:00 » 16:22"
  const months = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
    'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
    'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
  };

  // Try to extract day and month: "4 mayo" or "10 mayo"
  const dateMatch = lower.match(/(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = months[dateMatch[2]];
    const year = today.getFullYear();

    // Create the date
    const parsed = new Date(year, month, day);

    // If the date is in the past by more than 6 months, it's probably next year
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (parsed < sixMonthsAgo) {
      parsed.setFullYear(year + 1);
    }

    return parsed.toISOString().split('T')[0];
  }

  // Fallback: return today's date
  console.warn(`No se pudo parsear la fecha "${moodleDate}", usando fecha actual.`);
  return today.toISOString().split('T')[0];
}

async function syncTaskToNotion(task) {
  if (!DATABASE_ID) {
    console.error('DATABASE_ID no definido, omitiendo sincronización de:', task.title);
    return;
  }

  try {
    const isoDate = normalizeDate(task.due_date);

    const properties = {
      // Reemplaza los nombres de propiedades ("Name", "Course", "Date", "Link") 
      // por los nombres EXACTOS de tus columnas en Notion.
      'Name': {
        title: [
          {
            text: {
              content: task.title
            }
          }
        ]
      },
      'Course': {
        rich_text: [
          {
            text: {
              content: task.course
            }
          }
        ]
      },
      'Date': {
        date: {
          start: isoDate
        }
      },
      'Link': {
        url: task.url || null
      }
    };

    if (task.notion_page_id) {
      // Actualizar página existente
      await notion.pages.update({
        page_id: task.notion_page_id,
        properties: properties
      });
      console.log(`  [UPDATED] ${task.title}`);
    } else {
      // Crear nueva página
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: properties
      });
      task.notion_page_id = response.id;
      console.log(`  [CREATED] ${task.title}`);
    }
    
    return task;
  } catch (error) {
    console.error(`Error sincronizando "${task.title}" con Notion:`, error.body || error.message);
    throw error;
  }
}

module.exports = { syncTaskToNotion, normalizeDate };
