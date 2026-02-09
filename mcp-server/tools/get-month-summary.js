/**
 * Tool: get_month_summary
 * Riepilogo mensile per cluster
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'get_month_summary',
  description: 'Genera un riepilogo mensile raggruppato per cluster, con totali giornate e importi',
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

export async function handler({ filePath, projectId, month }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const result = ts.getMonthSummary(projectId, month);
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
