const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function load() {
  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parseando db.json:', e);
      return { last_check: null, tasks: [] };
    }
  }
  return { last_check: null, tasks: [] };
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Compara tareas nuevas con el estado anterior y devuelve los cambios.
 * @param {Array} newTasks 
 * @returns {Object} { newTasksToSync, updatedTasksToSync, state }
 */
function diff(newTasks) {
  const state = load();
  const newTasksToSync = [];
  const updatedTasksToSync = [];

  newTasks.forEach(task => {
    const existingIndex = state.tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex === -1) {
      // NUEVO
      state.tasks.push(task);
      newTasksToSync.push(task);
    } else {
      // EXISTENTE, verificar si cambió
      const existing = state.tasks[existingIndex];
      if (existing.due_date !== task.due_date || existing.title !== task.title) {
        // MODIFICADO
        state.tasks[existingIndex] = { ...existing, ...task, last_updated: Date.now() };
        updatedTasksToSync.push(state.tasks[existingIndex]);
      }
    }
  });

  state.last_check = new Date().toISOString();
  
  return { newTasksToSync, updatedTasksToSync, state };
}

module.exports = { load, save, diff };
