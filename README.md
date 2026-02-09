# Timesheet Manager

Web app per l'elaborazione di timesheet aziendali. Importa file Excel con rilevazioni di attivita, permette di clusterizzarle, convertire importi in giornate equivalenti con tre modalita di calcolo, applicare arrotondamenti e generare report.

**Zero build step** — aprire `index.html` in Chrome/Edge e iniziare a lavorare.

## Quick Start

### Windows (consigliato)

```
start-app.bat
```

Avvia il server MCP sulla porta 3847 (finestra minimizzata) e apre l'app nel browser.
Per fermare il server: `stop-server.bat`.

### Manuale

1. Aprire `index.html` in Chrome o Edge
2. Cliccare **Workspace** per selezionare una cartella dove salvare i progetti
3. Creare un nuovo progetto
4. Caricare un file Excel di timesheet (formato *ElencoAttivitaSpeseXCliente*)

## Funzionalita

### Importazione e gestione dati
- Importa file Excel esportati come *ElencoAttivitaSpeseXCliente*
- Ogni attivita e identificata da un hash univoco, le re-importazioni non duplicano i dati
- Organizzazione per progetto e per mese con navigazione a calendario
- Mesi apribili e chiudibili per impedire modifiche accidentali

### Tre modalita di calcolo giornate

| Modalita | Formula | Uso tipico |
|----------|---------|------------|
| **Adeguamento tariffa** | Giornate = Importo / Tariffa progetto | Tariffa unica per progetto |
| **Conversione ore** | Giornate = Ore / Ore per giornata | Quando si hanno le ore lavorate |
| **Tariffa per consulente** | Giornate = Importo / Tariffa consulente | Tariffe differenziate per persona |

La modalita *Tariffa per consulente* permette di assegnare una tariffa giornaliera diversa ad ogni collaboratore. I collaboratori vengono auto-popolati all'importazione del file Excel.

### Strumenti di arrotondamento
- **Arrotondamento proporzionale** — Distribuisce la differenza tra totale attuale e totale desiderato sulle righe selezionate
- **Distribuzione uniforme** — Divide un totale equamente tra le righe selezionate
- **Redistribuzione eccedenze** — Porta le attivita con piu di 1 giornata a 1gg e redistribuisce il surplus
- **Ripristina valori** — Annulla le modifiche tornando ai valori originali

Tutti gli strumenti operano sulle righe **selezionate e visibili** (rispettano i filtri attivi).

### Clustering
- Crea cluster personalizzati (es. Sviluppo, Analisi, Supporto) con colori
- Assegna cluster singolarmente o in batch
- Seleziona righe per cluster
- Riepilogo per cluster nel report

### Filtri
Pannello collassabile con filtri combinabili (AND): data, descrizione, cluster, collaboratore, range giornate, solo modificate.

### Export
- **Report Excel** — Formattato stile Adacta con raggruppamento per cluster
- **JSON** — Dati grezzi filtrati
- **CSV** — Per import in altri strumenti

## Architettura

```
index.html              # Markup
css/styles.css          # Stili
js/
  app.js                # Namespace App + stato iniziale
  utils.js              # Funzioni pure (hash, toast, date parsing)
  workspace.js          # Gestione workspace e IndexedDB
  storage.js            # Persistenza (delega a workspace)
  calculator.js         # Calcoli, statistiche, arrotondamenti
  ui.js                 # Rendering componenti
  exporter.js           # Export JSON/CSV/Excel
  actions.js            # Coordinatore azioni utente
  main.js               # Init + handler globali
  logo.js               # Logo SVG
mcp-server/
  index.js              # Entry point server MCP
  timesheet.js          # Classe TimesheetData
  tools/                # 10 tool MCP individuali
```

### Dipendenze frontend (CDN)

- [SheetJS](https://sheetjs.com/) v0.18.5 — Lettura/scrittura Excel
- [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) v1.2.0 — Formattazione Excel con stili
- [ExcelJS](https://github.com/exceljs/exceljs) v4.4.0 — Generazione report Excel avanzati

Nessun `package.json` frontend, nessun bundler.

### Persistenza

L'app usa la [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) per salvare direttamente su disco:

```
workspace/
  Progetto A/
    project.json        # Dati progetto (formato v3)
  Progetto B/
    project.json
```

- Auto-save dopo 2 secondi di inattivita
- Handle persistente in IndexedDB per riconnessione automatica
- localStorage come fallback
- Migrazione automatica dal vecchio formato v2 (file singolo)

## Server MCP

Il server [Model Context Protocol](https://modelcontextprotocol.io/) permette a Claude (o altri LLM compatibili) di operare direttamente sui dati dei timesheet.

### Setup

```bash
cd mcp-server && npm install
```

Richiede Node.js >= 18.

### Configurazione per Claude Code

Creare `.mcp.json` nella root del progetto (gia incluso nel repo):

```json
{
  "mcpServers": {
    "timesheet": {
      "command": "node.exe",
      "args": ["./mcp-server/index.js"]
    }
  }
}
```

> Su sistemi non-Windows usare `node` al posto di `node.exe`.

### Tool disponibili

| Tool | Descrizione |
|------|-------------|
| `list_projects` | Elenca progetti con statistiche |
| `get_project` | Dettagli progetto, cluster, mesi |
| `get_activities` | Attivita di un mese con totali |
| `assign_cluster` | Assegna cluster ad attivita |
| `apply_rounding` | Arrotondamento proporzionale |
| `get_month_summary` | Riepilogo per cluster |
| `close_month` | Chiude un mese |
| `reopen_month` | Riapre un mese chiuso |
| `create_cluster` | Crea nuovo cluster |
| `manage_collaborator_rates` | Gestisce tariffe per consulente |

Il server e l'app web **condividono gli stessi file** — le modifiche fatte via AI sono visibili ricaricando l'app.

### Health check

Il server espone `GET http://localhost:3847/health` con CORS abilitato. L'app web lo usa per mostrare lo stato di connessione nell'header.

## Requisiti

- **Browser**: Chrome o Edge (richiesto per File System Access API)
- **Server MCP**: Node.js >= 18 (opzionale, solo per integrazione AI)
