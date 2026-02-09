/**
 * Tool: close_month / reopen_month
 * Gestisce lo stato del mese
 */

import { loadTimesheet } from './helpers.js';

export const closeDefinition = {
  name: 'close_month',
  description: 'Chiude un mese, impedendo ulteriori modifiche alle attività',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Percorso al file JSON dei timesheet'
      },
      projectId: {
        type: 'string',
        description: 'ID del progetto'
      },
      month: {
        type: 'string',
        description: 'Mese nel formato YYYY-MM'
      }
    },
    required: ['filePath', 'projectId', 'month']
  }
};

export const reopenDefinition = {
  name: 'reopen_month',
  description: 'Riapre un mese chiuso, permettendo di nuovo modifiche alle attività',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Percorso al file JSON dei timesheet'
      },
      projectId: {
        type: 'string',
        description: 'ID del progetto'
      },
      month: {
        type: 'string',
        description: 'Mese nel formato YYYY-MM'
      }
    },
    required: ['filePath', 'projectId', 'month']
  }
};

export async function closeHandler({ filePath, projectId, month }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const newStatus = ts.closeMonth(projectId, month);
    await ts.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, newStatus })
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: err.message })
      }],
      isError: true
    };
  }
}

export async function reopenHandler({ filePath, projectId, month }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const newStatus = ts.reopenMonth(projectId, month);
    await ts.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, newStatus })
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: err.message })
      }],
      isError: true
    };
  }
}
