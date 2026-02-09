/**
 * Tool: apply_rounding
 * Applica arrotondamento proporzionale alle attivita selezionate
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'apply_rounding',
  description: 'Applica arrotondamento proporzionale: ridistribuisce le giornate per raggiungere un totale target, mantenendo le proporzioni originali',
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
      },
      activityHashes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array di hash delle attività su cui applicare l\'arrotondamento'
      },
      targetTotal: {
        type: 'number',
        description: 'Totale giornate desiderato'
      }
    },
    required: ['filePath', 'projectId', 'month', 'activityHashes', 'targetTotal']
  }
};

export async function handler({ filePath, projectId, month, activityHashes, targetTotal }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const result = ts.applyProportionalRounding(projectId, month, activityHashes, targetTotal);
    await ts.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, ...result })
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
