/**
 * Tool: manage_collaborator_rates
 * Gestisce le tariffe per collaboratore di un progetto
 */

import { loadTimesheet } from './helpers.js';

export const definition = {
  name: 'manage_collaborator_rates',
  description: 'Gestisce le tariffe giornaliere per collaboratore. Azioni: list (elenca), set (imposta), delete (rimuove)',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Percorso al file JSON dei timesheet o alla directory workspace'
      },
      projectId: {
        type: 'string',
        description: 'ID del progetto'
      },
      action: {
        type: 'string',
        enum: ['list', 'set', 'delete'],
        description: 'Azione: "list" per elencare, "set" per impostare, "delete" per rimuovere'
      },
      name: {
        type: 'string',
        description: 'Nome del collaboratore (richiesto per set/delete)'
      },
      rate: {
        type: 'number',
        description: 'Tariffa giornaliera in EUR (richiesto per set)'
      }
    },
    required: ['filePath', 'projectId', 'action']
  }
};

export async function handler({ filePath, projectId, action, name, rate }, { TimesheetData }) {
  const ts = await loadTimesheet(filePath, TimesheetData);

  try {
    const result = ts.manageCollaboratorRates(projectId, action, name, rate);
    await ts.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, result })
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
