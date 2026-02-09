# Timesheet MCP Server

Server MCP (Model Context Protocol) per la gestione dei timesheet aziendali.
Permette all'AI di operare direttamente sui file JSON dei timesheet.

## Installazione

```bash
cd mcp-server
npm install
```

## Configurazione Claude Code

Aggiungi al file `.claude/settings.local.json` nella home utente o nel progetto:

```json
{
  "mcpServers": {
    "timesheet": {
      "command": "node",
      "args": ["C:/Users/f.bee/OneDrive - ADACTA/Desktop/Elaborazione Timesheet/mcp-server/index.js"]
    }
  }
}
```

## Tool Disponibili

### list_projects
Elenca tutti i progetti con statistiche.
```json
{ "filePath": "path/to/timesheet_data.json" }
```

### get_project
Dettagli completi di un progetto.
```json
{ "filePath": "...", "projectId": "proj_123" }
```

### get_activities
Attività di un mese specifico.
```json
{ "filePath": "...", "projectId": "proj_123", "month": "2026-02" }
```

### assign_cluster
Assegna un cluster a una o più attività.
```json
{
  "filePath": "...",
  "projectId": "proj_123",
  "month": "2026-02",
  "activityHashes": ["hash1", "hash2"],
  "clusterId": "cl_123"
}
```

### apply_rounding
Applica arrotondamento proporzionale.
```json
{
  "filePath": "...",
  "projectId": "proj_123",
  "month": "2026-02",
  "activityHashes": ["hash1", "hash2"],
  "targetTotal": 10.0
}
```

### get_month_summary
Riepilogo mensile per cluster.
```json
{ "filePath": "...", "projectId": "proj_123", "month": "2026-02" }
```

### close_month
Chiude un mese.
```json
{ "filePath": "...", "projectId": "proj_123", "month": "2026-02" }
```

### reopen_month
Riapre un mese chiuso.
```json
{ "filePath": "...", "projectId": "proj_123", "month": "2026-02" }
```

### create_cluster
Crea un nuovo cluster.
```json
{
  "filePath": "...",
  "projectId": "proj_123",
  "name": "Sviluppo",
  "color": "#3498db"
}
```

## Note

- Il server e l'app web condividono lo stesso file JSON
- Ogni scrittura crea automaticamente un backup `.bak`
- I mesi chiusi non possono essere modificati (usare `reopen_month` prima)
