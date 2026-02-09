/**
 * Helpers condivisi per i tool MCP
 */
import { stat } from 'fs/promises';

/**
 * Carica TimesheetData da file o workspace
 * Supporta:
 * - File v2 (timesheet_data.json)
 * - File v3 singolo progetto (project.json)
 * - Directory workspace (cartella con sottocartelle progetto)
 */
export async function loadTimesheet(filePath, TimesheetData) {
  const stats = await stat(filePath);

  if (stats.isDirectory()) {
    // Workspace con cartelle per progetto
    return await TimesheetData.loadWorkspace(filePath);
  } else {
    // File singolo (v2) o project.json singolo (v3)
    return await TimesheetData.load(filePath);
  }
}
