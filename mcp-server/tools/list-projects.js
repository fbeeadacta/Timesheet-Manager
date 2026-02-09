/**
 * Tool: list_projects
 * Elenca tutti i progetti con statistiche
 */
import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'list_projects',
  description: 'Elenca tutti i progetti nel file timesheet con statistiche (numero mesi, attivita totali)',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Percorso al file JSON dei timesheet'
      }
    },
    required: ['filePath']
  }
};

export async function handler({ filePath }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);
  const projects = ts.listProjects();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ projects }, null, 2)
    }]
  };
}
