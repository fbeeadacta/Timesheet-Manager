#!/usr/bin/env node
/**
 * MCP Server per Timesheet
 *
 * Server Model Context Protocol che permette all'AI di operare
 * sui dati dei timesheet aziendali.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import http from 'http';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { TimesheetData } from './timesheet.js';

// Import tool definitions e handlers
import { definition as listProjectsDef, handler as listProjectsHandler } from './tools/list-projects.js';
import { definition as getProjectDef, handler as getProjectHandler } from './tools/get-project.js';
import { definition as getActivitiesDef, handler as getActivitiesHandler } from './tools/get-activities.js';
import { definition as assignClusterDef, handler as assignClusterHandler } from './tools/assign-cluster.js';
import { definition as applyRoundingDef, handler as applyRoundingHandler } from './tools/apply-rounding.js';
import { definition as getMonthSummaryDef, handler as getMonthSummaryHandler } from './tools/get-month-summary.js';
import { closeDefinition, reopenDefinition, closeHandler, reopenHandler } from './tools/close-month.js';
import { definition as createClusterDef, handler as createClusterHandler } from './tools/create-cluster.js';
import { definition as manageCollaboratorRatesDef, handler as manageCollaboratorRatesHandler } from './tools/manage-collaborator-rates.js';

// Mappa tool -> handler
const tools = new Map([
  ['list_projects', { definition: listProjectsDef, handler: listProjectsHandler }],
  ['get_project', { definition: getProjectDef, handler: getProjectHandler }],
  ['get_activities', { definition: getActivitiesDef, handler: getActivitiesHandler }],
  ['assign_cluster', { definition: assignClusterDef, handler: assignClusterHandler }],
  ['apply_rounding', { definition: applyRoundingDef, handler: applyRoundingHandler }],
  ['get_month_summary', { definition: getMonthSummaryDef, handler: getMonthSummaryHandler }],
  ['close_month', { definition: closeDefinition, handler: closeHandler }],
  ['reopen_month', { definition: reopenDefinition, handler: reopenHandler }],
  ['create_cluster', { definition: createClusterDef, handler: createClusterHandler }],
  ['manage_collaborator_rates', { definition: manageCollaboratorRatesDef, handler: manageCollaboratorRatesHandler }]
]);

// Crea server MCP
const server = new Server(
  {
    name: 'timesheet-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handler: lista dei tool disponibili
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolList = [];
  for (const [name, { definition }] of tools) {
    toolList.push(definition);
  }
  return { tools: toolList };
});

// Handler: esecuzione tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools.get(name);
  if (!tool) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Tool sconosciuto: ${name}` })
      }],
      isError: true
    };
  }

  try {
    // Passa TimesheetData come dipendenza
    const result = await tool.handler(args, { TimesheetData });
    return result;
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: err.message, stack: err.stack })
      }],
      isError: true
    };
  }
});

// ==================== Health Check HTTP Server ====================
const HEALTH_PORT = 3847;
const startTime = Date.now();

const healthServer = http.createServer((req, res) => {
  // CORS headers per permettere richieste da file:// e localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
      server: 'timesheet-mcp-server'
    }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Avvia server su stdio
async function main() {
  // Avvia health check server HTTP
  healthServer.listen(HEALTH_PORT, () => {
    console.error(`Health server attivo su http://localhost:${HEALTH_PORT}/health`);
  });

  // Avvia server MCP su stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Timesheet MCP Server avviato');
}

main().catch((err) => {
  console.error('Errore avvio server:', err);
  process.exit(1);
});
