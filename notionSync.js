require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.DATABASE_ID;

/**
 * Normaliza la fecha de Moodle a un formato ISO aceptado por Notion.
 * Moodle da fechas como "Mañana, 23:59" o "lunes, 4 mayo, 22:00".
 * Este es un parser muy básico. Se requerirá mejorar con moment o date-fns según la exactitud deseada.
 */
function normalizeDate(moodleDate) {
  // Por ahora, como es prueba de concepto, si dice mañana, usamos la fecha de mañana.
  // Si no se puede parsear bien, devolvemos la fecha de hoy.
  const today = new Date();
  if (moodleDate.toLowerCase().includes('mañana')) {
    today.setDate(today.getDate() + 1);
  }
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
      console.log(`[UPDATED] Notion: ${task.title}`);
    } else {
      // Crear nueva página
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: properties
      });
      task.notion_page_id = response.id;
      console.log(`[CREATED] Notion: ${task.title}`);
    }
    
    return task;
  } catch (error) {
    console.error('Error sincronizando con Notion:', error.body || error.message);
    throw error;
  }
}

module.exports = { syncTaskToNotion };
