/**
 * Tool: get_project
 * Dettagli completi di un progetto
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'get_project',
  description: 'Ottiene i dettagli completi di un progetto: configurazione, clusters e lista mesi disponibili',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Percorso al file JSON dei timesheet'
      },
      projectId: {
        type: 'string',
        description: 'ID del progetto (es. "proj_1234567890")'
      }
    },
    required: ['filePath', 'projectId']
  }
};

export async function handler({ filePath, projectId }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);
  const project = ts.getProject(projectId);

  if (!project) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Progetto non trovato: ${projectId}` })
      }],
      isError: true
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ project }, null, 2)
    }]
  };
}
