/**
 * Tool: create_cluster
 * Crea un nuovo cluster nel progetto
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'create_cluster',
  description: 'Crea un nuovo cluster nel progetto per categorizzare le attività',
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
      name: {
        type: 'string',
        description: 'Nome del cluster (es. "Sviluppo", "Analisi")'
      },
      color: {
        type: 'string',
        description: 'Colore esadecimale (es. "#3498db")'
      }
    },
    required: ['filePath', 'projectId', 'name', 'color']
  }
};

export async function handler({ filePath, projectId, name, color }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const clusterId = ts.createCluster(projectId, name, color);
    await ts.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, clusterId })
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
