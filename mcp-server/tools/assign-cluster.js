/**
 * Tool: assign_cluster
 * Assegna un cluster a una o piu attivita
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'assign_cluster',
  description: 'Assegna un cluster a una o più attività. Usa clusterId=null per rimuovere l\'assegnazione.',
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
        description: 'Array di hash delle attività da modificare'
      },
      clusterId: {
        type: ['string', 'null'],
        description: 'ID del cluster da assegnare (null per rimuovere)'
      }
    },
    required: ['filePath', 'projectId', 'month', 'activityHashes']
  }
};

export async function handler({ filePath, projectId, month, activityHashes, clusterId }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const updated = ts.assignCluster(projectId, month, activityHashes, clusterId || null);
    await ts.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, updated })
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
