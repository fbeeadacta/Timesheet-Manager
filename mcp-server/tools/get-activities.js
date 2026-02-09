/**
 * Tool: get_activities
 * Attivita di un mese specifico
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'get_activities',
  description: 'Ottiene tutte le attivita di un mese specifico con dettagli, cluster assegnato e totali',
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
        description: 'Mese nel formato YYYY-MM (es. "2026-02")'
      }
    },
    required: ['filePath', 'projectId', 'month']
  }
};

export async function handler({ filePath, projectId, month }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const result = ts.getMonthActivities(projectId, month);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: err.message })
      }],
      isError: true
    };
  }
}
