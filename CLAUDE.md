# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web app statica per l'elaborazione di timesheet aziendali. Legge file Excel con rilevazioni attività, permette di clusterizzare le attività, convertire importi in giornate equivalenti con tre modalita di calcolo (tariffa, ore, tariffa per consulente), applicare arrotondamenti e generare report.

**Live:** https://fbeeadacta.github.io/Timesheet-Manager/
**Repo:** https://github.com/fbeeadacta/Timesheet-Manager (pubblico, licenza MIT)

## Development

**Nessun build step richiesto** - Aprire `index.html` direttamente in Chrome o Edge (richiesto per File System Access API).

**Quick start (Windows):**
- `start-app.bat` / `start-app.ps1` — Avvia il server MCP (porta 3847, finestra minimizzata) e apre l'app nel browser
- `stop-server.bat` — Ferma il server MCP

**Test manuale:**
1. Aprire `index.html` nel browser
2. Cliccare "Workspace" per selezionare una cartella dove salvare i progetti (la cartella `projects/` contiene dati di esempio)
3. Creare un nuovo progetto (verra creata una cartella dedicata)
4. Caricare un file Excel di timesheet nel formato "ElencoAttivitaSpeseXCliente"

**Deploy:** Ogni push su `main` triggera il deploy automatico su GitHub Pages via `.github/workflows/deploy.yml`.

**Note:** Non ci sono test automatici ne linting. Il frontend non ha `package.json` — le dipendenze sono caricate via CDN.

## Git Workflow

### Branching Strategy

- **`main`** — Branch stabile. Contiene sempre codice funzionante e rilasciabile.
- **`feature/*`** — Branch per nuove funzionalita. Creare sempre un branch dedicato prima di iniziare a lavorare.

**Flusso per ogni modifica:**
1. Creare branch da main: `git checkout -b feature/nome-funzionalita`
2. Lavorare sul branch con commit incrementali
3. Testare manualmente nel browser
4. Merge su main: `git checkout main && git merge feature/nome-funzionalita`
5. Eliminare il branch: `git branch -d feature/nome-funzionalita`
6. Push e release se appropriato

**IMPORTANTE:** Non committare mai direttamente su `main`. Usare sempre un feature branch.

### Versioning (Semantic Versioning)

Formato: **vMAJOR.MINOR.PATCH**

| Tipo | Quando | Esempio |
|------|--------|---------|
| **PATCH** (v1.0.x) | Bug fix, correzioni piccole | Fix calcolo arrotondamento |
| **MINOR** (v1.x.0) | Nuova funzionalita retrocompatibile | Aggiunta export PDF |
| **MAJOR** (vX.0.0) | Breaking change, nuovo formato dati | Nuovo formato project.json |

### Release

Dopo il merge su main, creare tag e release GitHub:
```bash
git tag v1.x.0
gh release create v1.x.0 --title "v1.x.0 - Titolo" --generate-notes
```

Il flag `--generate-notes` genera automaticamente le note dai commit inclusi nella release.

### Commit Messages

Usare messaggi descrittivi che indicano il tipo di modifica:
- `Add ...` — Nuova funzionalita
- `Fix ...` — Bug fix
- `Update ...` — Miglioramento a funzionalita esistente
- `Refactor ...` — Ristrutturazione senza cambio di comportamento
- `Remove ...` — Rimozione codice/funzionalita

## Architecture

### File Structure
```
index.html                    # HTML + markup
css/styles.css                # Stili (colore primario: #5c88da)
js/app.js                     # App namespace + state iniziale
js/utils.js                   # App.Utils - Funzioni pure (hash, toast, date parsing)
js/workspace.js               # App.Workspace - Gestione workspace e IndexedDB
js/storage.js                 # App.Storage - Persistenza (delega a Workspace)
js/calculator.js              # App.Calculator - Calcoli, statistiche, arrotondamenti
js/ui.js                      # App.UI - Rendering componenti
js/exporter.js                # App.Exporter - Export JSON/CSV/Excel
js/actions.js                 # App.Actions - Coordinatore azioni utente
js/main.js                    # Init + handler globali (funzioni window-scope)
js/logo.js                    # Logo SVG rendering
.github/workflows/deploy.yml  # GitHub Pages deploy (auto su push a main)
```

Dipendenze esterne (CDN, no package.json frontend):
- **SheetJS (xlsx)** v0.18.5 - Lettura/scrittura file Excel
- **xlsx-js-style** v1.2.0 - Formattazione Excel con stili
- **ExcelJS** v4.4.0 - Generazione report Excel avanzati

### Global Namespace
Tutto lo stato e la logica sono organizzati sotto il namespace `App`:
```javascript
App.state           // Stato centralizzato
App.Utils           // Funzioni pure
App.Workspace       // Gestione workspace e cartelle
App.Storage         // Persistenza (delega a Workspace)
App.Calculator      // Calcoli
App.UI              // Rendering
App.Exporter        // Export
App.Actions         // Azioni utente
```

### State (`App.state`)
- `projects` - Array di tutti i progetti
- `currentProject` - Progetto selezionato
- `processedData` - Attivita caricate dal timesheet corrente
- `selectedRows` - Set di indici righe selezionate
- `workspaceHandle` - DirectoryHandle del workspace (v3)
- `workspacePath` - Nome/path del workspace
- `unsavedChanges` - Flag modifiche non salvate
- `workingMonth` - Mese di lavoro corrente (es. "2026-02")

### Data Persistence (v3 - Workspace con Cartelle)

**Struttura workspace:**
```
/workspace/                              # Cartella selezionata dall'utente
├── .timesheet-workspace.json            # (futuro) Config workspace
├── Progetto 1/
│   └── project.json                     # Dati progetto (formato v3)
├── Progetto 2/
│   └── project.json
└── ...
```

**Flusso:**
1. Utente seleziona una cartella come "Workspace"
2. Ogni progetto ha la sua sottocartella con `project.json`
3. Handle salvato in IndexedDB per riconnessione automatica
4. Auto-save dopo 2 secondi di inattivita
5. localStorage usato come fallback

**Riconnessione automatica:**
- Al caricamento, l'app tenta di riconnettersi al workspace precedente
- Se permesso gia concesso: caricamento automatico
- Se serve conferma: mostra banner "Clicca per riconnetere"

### Key Functions
- `parseAndMergeData()` (main.js) - Parser Excel, genera hash, ripristina modifiche salvate
- `loadFromHistory()` (main.js) - Ricarica attività salvate senza re-importare Excel
- `saveActivityState()` (main.js) - Salva stato attività nel progetto
- `App.Utils.generateActivityHash()` - Crea ID univoco: `Data|Collaboratore|Descrizione|ImportoOriginale`
- `App.Calculator.applyRounding()` - Distribuisce proporzionalmente la differenza
- `App.Calculator.applyUniformDistribution()` - Distribuisce totale equamente sulle righe selezionate
- `App.Calculator.redistributeExcess()` - Sposta eccedenze (>1gg) su altre righe selezionate
- `App.Calculator.restoreRow()` - Ripristina valori originali di una riga
- `App.Calculator.computeByMode()` - Calcola giornate/ore in base a calcMode (tariffa/ore/tariffa_collaboratore)
- `App.Calculator.getRateForRow()` - Ritorna tariffa corretta per riga (collaboratore o progetto)
- `App.Exporter.toExcelReport()` - Genera report Excel formattato stile Adacta
- `App.UI.getFilteredData()` - Applica tutti i filtri e restituisce righe filtrate
- `App.UI.populateFilterDropdowns()` - Popola dinamicamente i select filtri

### Data Structures

**File progetto** (`project.json` - v3):
```json
{
  "_type": "timesheet_project",
  "_version": 3,
  "_lastSaved": "2026-02-04T10:00:00Z",
  "id": "proj_1234567890",
  "name": "Cliente ABC",
  "folderName": "Cliente ABC",
  "tariffa": 600,
  "oreGiornata": 8,
  "calcMode": "tariffa",
  "collaboratorRates": {},
  "clusters": [{ "id": "cl_123", "name": "Sviluppo", "color": "#3498db" }],
  "currentMonth": "2026-02",
  "monthlyReports": {
    "2026-01": {
      "status": "closed",
      "closedAt": "2026-02-01T10:00:00Z",
      "activities": { "hash123": { "clusterId": "cl_123", "giornateModificate": 1.5, "originalData": {...} } },
      "history": [{ "date": "...", "fileName": "...", "loaded": 10, "new": 5 }]
    },
    "2026-02": {
      "status": "open",
      "activities": {...},
      "history": [...]
    }
  }
}
```

**Vecchio formato** (v2 - file singolo, deprecato ma ancora supportato):
```json
{
  "_type": "timesheet_data",
  "_version": 2,
  "projects": [/* array di progetti */]
}
```

L'app migra automaticamente dal formato v2 al v3 quando si apre un workspace contenente un file `timesheet_data.json`.

## Formulas

- **Giornate equivalenti** (calcMode=tariffa): `Importo / Tariffa`
- **Giornate equivalenti** (calcMode=ore): `Ore / OreGiornata`
- **Giornate equivalenti** (calcMode=tariffa_collaboratore): `Importo / TariffaCollaboratore`
- **Ore equivalenti**: `Giornate × Ore per giornata`
- **Valore**: `Giornate × Tariffa` (si aggiorna automaticamente modificando le giornate; usa tariffa collaboratore se calcMode=tariffa_collaboratore)

### Tariffa per Consulente (calcMode `tariffa_collaboratore`)

Terza modalita di calcolo con tariffa specifica per ogni collaboratore:
- `project.collaboratorRates` — mappa `{ "Nome Cognome": tariffaGiornaliera }`
- Auto-popolamento collaboratori all'importazione Excel (rate=0, l'utente deve impostarla)
- Se un collaboratore ha rate=0 o mancante: `giornate=0` + warning icon nella tabella (`_rateError`)
- `App.Calculator.getRateForRow(row, project)` — helper che ritorna la tariffa corretta per calcMode
- Modal impostazioni con 3 tab: Generale, Cluster, Tariffe Consulenti
- Funzioni window-scope: `switchSettingsTab()`, `renderCollaboratorRatesList()`, `updateCollaboratorRate()`, `deleteCollaboratorRate()`, `addCollaboratorRate()`

## UI Components

### Pannello Filtri Collassabile
Pannello espandibile sopra la tabella attività (chiuso di default). Contiene:

| Filtro | Tipo | Campo | Logica |
|--------|------|-------|--------|
| Data Da/A | date inputs | `Data` | Range inclusivo |
| Cerca | text input | `Descrizione` | Contiene (case-insensitive) |
| Cluster | select | `_clusterId` | Include "Non assegnate" |
| Collaboratore | select | `Collaboratore` | Valori unici dai dati |
| Giornate min/max | number inputs | `GiornateEquiv` | Range inclusivo |
| Solo modificate | checkbox | `_modified` | Boolean |

Tutti i filtri operano in **AND**. I dropdown si popolano automaticamente dopo il caricamento dati.

Funzioni correlate:
- `toggleFiltersPanel()` - Apre/chiude pannello
- `clearFilters()` - Resetta tutti i filtri
- `App.UI.getFilteredData()` - Restituisce `[{idx, row}]` filtrati
- `App.UI.populateFilterDropdowns()` - Popola select con valori unici

### Strumenti di Modifica (Accordion)

Tre tool card collassabili in `dataPanel`:

1. **Arrotondamento proporzionale** - Applica nuovo totale giornate, distribuisce diff proporzionalmente
2. **Distribuzione uniforme** - Divide totale equamente tra righe selezionate
3. **Redistribuisci eccedenze** - Sposta giornate >1 su altre righe selezionate
4. **Ripristina valori** - Annulla modifiche tornando ai valori originali

Gli strumenti operano solo sulle righe **selezionate E visibili** (rispettano i filtri).

### Tabella Attività
Colonne: Checkbox | Data | Cluster | Incarico | Collaboratore | Descrizione | Tempo | Giornate | Valore

**Riga Totali**: Prima riga dopo l'header, sticky durante scroll. Mostra:
- Conteggio attività filtrate
- Somma giornate
- Somma valori (EUR)

I totali si ricalcolano automaticamente in base ai filtri attivi.

## Excel Input Format

Il parser si aspetta file Excel esportati come "ElencoAttivitaSpeseXCliente" con struttura:
- Riga con `CLIENTE: NomeCliente` per identificare il cliente
- Colonne: `[0]Incarico, [1]Data, [2]Collaboratore, [3]Causale, [4]Descrizione, [5]Tempo, ..., [8]Importo`
- Righe con `TOTALE` vengono ignorate

## Browser Requirements

File System Access API richiede Chrome/Edge e contesto sicuro (HTTPS o localhost/file://).

## Window-Scope Functions (main.js)

Le funzioni chiamate dagli onclick HTML sono esposte a livello window in `main.js`:
- Progetti: `showNewProjectModal()`, `createProject()`, `openProject()`, `deleteProject()`
- Cluster: `addCluster()`, `deleteCluster()`, `assignCluster()`, `showClusterDropdown()`
- Selezione: `selectAll()`, `selectNone()`, `selectByCluster()`, `toggleRow()`
- Strumenti: `applyRounding()`, `applyUniformDistribution()`, `redistributeExcess()`, `restoreSelectedRows()`
- Filtri: `toggleFiltersPanel()`, `applyFilters()`, `clearFilters()`
- Export: `exportJSON()`, `exportCSV()`, `exportReportExcel()`
- Storage: `openDataFile()`, `createNewDataFile()`, `saveDataFile()`
- Mesi: `selectWorkingMonth()`, `closeMonth()`, `reopenMonth()`, `closeCurrentMonth()`
- Impostazioni: `switchSettingsTab()`, `renderCollaboratorRatesList()`, `updateCollaboratorRate()`, `deleteCollaboratorRate()`, `addCollaboratorRate()`

## Monthly Reports System

Ogni progetto organizza le attività per mese. Il sistema:

- **Navigazione mesi**: Mini-calendario visuale nella sidebar mostra gli ultimi 12 mesi
- **Indicatori**: Pallino verde = ha dati, Lucchetto = chiuso, Bordo blu = mese corrente
- **Avvisi automatici**: Warning quando si lavora su mesi passati, conferma per riaprire mesi chiusi
- **Migrazione automatica**: Progetti esistenti vengono migrati al nuovo formato all'apertura

### Funzioni correlate
- `App.getWorkingMonthKey()` - Ritorna chiave mese corrente (YYYY-MM)
- `App.getCurrentMonthReport()` - Ritorna/crea report del mese selezionato
- `App.countMonthActivities(report)` - Conta attività in un report
- `App.UI.renderMonthSelector()` - Renderizza griglia calendario
- `App.Storage.migrateProjectToMonthlyReports()` - Migra struttura dati

## MCP Server

Server Model Context Protocol che permette all'AI di operare direttamente sui dati dei timesheet.

### Struttura
```
mcp-server/
├── package.json      # Dipendenze Node.js
├── index.js          # Entry point server MCP
├── timesheet.js      # Classe TimesheetData (supporta v2 e v3)
└── tools/            # Tool MCP individuali
    ├── helpers.js                    # loadTimesheet() - carica file o workspace
    ├── list-projects.js
    ├── get-project.js
    ├── get-activities.js
    ├── assign-cluster.js
    ├── apply-rounding.js
    ├── get-month-summary.js
    ├── close-month.js                # Include anche reopen_month
    ├── create-cluster.js
    └── manage-collaborator-rates.js  # Gestione tariffe per consulente
```

### Installazione
```bash
cd mcp-server && npm install
```

Il server MCP usa ES modules (`"type": "module"` in package.json).

### Health Check
Il server espone un endpoint HTTP su porta **3847** per verificarne lo stato:
- `GET http://localhost:3847/health` — Ritorna `{ status: 'ok', uptime, version, server }`
- Ha CORS abilitato, usato dall'app web per verificare che il server sia attivo

### Configurazione Claude Code

**Opzione A (consigliata):** Creare `.mcp.json` nella root del progetto:
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

**Opzione B:** Aggiungere a `~/.claude/settings.local.json`:
```json
{
  "mcpServers": {
    "timesheet": {
      "command": "node",
      "args": ["C:/percorso/progetto/mcp-server/index.js"]
    }
  }
}
```

**Nota Windows:** Usare `node.exe` invece di `node` per evitare problemi di path.

### Tool Disponibili

| Tool | Input | Descrizione |
|------|-------|-------------|
| `list_projects` | `filePath` | Elenca progetti con statistiche |
| `get_project` | `filePath`, `projectId` | Dettagli progetto, clusters, mesi |
| `get_activities` | `filePath`, `projectId`, `month` | Attività di un mese con totali |
| `assign_cluster` | `filePath`, `projectId`, `month`, `activityHashes`, `clusterId` | Assegna cluster ad attività |
| `apply_rounding` | `filePath`, `projectId`, `month`, `activityHashes`, `targetTotal` | Arrotondamento proporzionale |
| `get_month_summary` | `filePath`, `projectId`, `month` | Riepilogo per cluster |
| `close_month` | `filePath`, `projectId`, `month` | Chiude un mese |
| `reopen_month` | `filePath`, `projectId`, `month` | Riapre un mese chiuso |
| `create_cluster` | `filePath`, `projectId`, `name`, `color` | Crea nuovo cluster |
| `manage_collaborator_rates` | `filePath`, `projectId`, `action`, `name?`, `rate?` | Gestisce tariffe per consulente (list/set/delete) |

### Formati Supportati
- **v2 (file singolo):** `timesheet_data.json` con array di progetti
- **v3 (workspace):** Cartelle per progetto con `project.json` singolo
- **Directory workspace:** Scansiona sottocartelle cercando `project.json`

Il parametro `filePath` può essere:
- Path a file `.json` (v2 o v3)
- Path a directory workspace (scansiona tutti i progetti)

### Note
- Il server MCP e l'app web **condividono gli stessi file**
- Ogni scrittura crea automaticamente un backup `.bak`
- I mesi chiusi non possono essere modificati (usare `reopen_month` prima)
- Richiede Node.js >= 18
- Guida configurazione disponibile nell'app: pulsante "MCP" in alto a destra

## Design System

### Colori
- **Primario**: `#5c88da` (hover: `#4a73c4`, light: `#e0e9f7`)
- **Warning**: `#ffc000` (usato per pulsante "Riapri Mese")
- **Success**: `#10b981`
- **Danger**: `#ef4444`
- **Pulsante MCP**: gradiente `#5c88da` → `#00b0f0`
- **MCP modal header**: stesso gradiente del pulsante MCP

Le stat-box del Riepilogo e le tool-card degli strumenti derivano tutte dal colore primario con `color-mix()` per mantenere coerenza visiva. Modificando `--primary` in `:root` si aggiornano automaticamente tutti i componenti.

## GitHub CLI

Il progetto usa `gh` (GitHub CLI) per release e gestione repo. Installato in `C:\Program Files\GitHub CLI\gh.exe`.

```bash
"C:\Program Files\GitHub CLI\gh.exe" release create v1.x.0 --title "Titolo" --generate-notes
```
