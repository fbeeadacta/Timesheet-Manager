/**
 * Main.js - Inizializzazione e handler globali
 * Questo file coordina l'avvio dell'applicazione e fornisce le funzioni globali
 * chiamate dagli handler onclick nell'HTML
 */

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Inizializza App
    App.init();

    // Assicurati che i modal siano chiusi all'avvio
    document.getElementById('selectClusterModal').classList.add('hidden');
    document.getElementById('newProjectModal').classList.add('hidden');
    document.getElementById('settingsModal').classList.add('hidden');
    document.getElementById('migrationModal')?.classList.add('hidden');

    // Setup UI base
    App.UI.setupDropZone();

    // Tenta riconnessione automatica al workspace
    const reconnectStatus = await App.Workspace.tryReconnect();

    if (reconnectStatus === 'granted') {
        // Workspace riconnesso automaticamente
        console.log('Workspace riconnesso automaticamente');
    } else if (reconnectStatus === 'prompt') {
        // Serve azione utente per riconnettersi
        App.Workspace.showReconnectBanner();
        // Carica da localStorage nel frattempo
        App.Storage.loadFromLocalStorage();
        App.Storage.migrateAllProjects();
    } else {
        // Nessun workspace salvato, usa localStorage
        App.Storage.loadFromLocalStorage();
        App.Storage.migrateAllProjects();
    }

    // Render iniziale
    App.UI.renderProjectList();
    App.Storage.updateFileStatus();

    // Event listeners
    document.getElementById('newTotal').addEventListener('input', () => {
        App.Calculator.updateDiffDisplay();
    });

    // Event listeners per nuovi strumenti
    document.getElementById('uniformTotal').addEventListener('input', () => {
        App.Calculator.updateUniformToolUI();
    });

    // Import progetto handler
    document.getElementById('importProjectInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);

                // Verifica che sia un file valido
                if (data._exportType !== 'timesheet_project' || !data.project) {
                    App.Utils.toastError('File non valido. Seleziona un file di backup progetto.');
                    return;
                }

                const importedProject = data.project;

                // Controlla se esiste già un progetto con lo stesso ID
                const existingIdx = App.state.projects.findIndex(p => p.id === importedProject.id);

                if (existingIdx >= 0) {
                    if (confirm(`Il progetto "${importedProject.name}" esiste già. Vuoi sovrascriverlo?`)) {
                        App.state.projects[existingIdx] = importedProject;
                    } else {
                        // Crea con nuovo ID
                        importedProject.id = 'proj_' + Date.now();
                        importedProject.name = importedProject.name + ' (importato)';
                        App.state.projects.push(importedProject);
                    }
                } else {
                    App.state.projects.push(importedProject);
                }

                App.Storage.save();
                App.UI.renderProjectList();
                App.Utils.toastSuccess(`Progetto "${importedProject.name}" importato con successo!`);
                openProject(importedProject.id);

            } catch (err) {
                console.error('Errore import:', err);
                App.Utils.toastError('Errore nel leggere il file. Assicurati che sia un JSON valido.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset per permettere reimport stesso file
    });

    // Avviso se ci sono modifiche non salvate alla chiusura
    window.addEventListener('beforeunload', (e) => {
        if (App.state.unsavedChanges && App.state.fileHandle) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// ==================== PROJECT HANDLERS ====================
function showNewProjectModal() {
    App.UI.showModal('newProjectModal');
    document.getElementById('newProjectName').focus();
}

function hideNewProjectModal() {
    App.UI.hideModal('newProjectModal');
}

async function createProject() {
    const name = document.getElementById('newProjectName').value.trim();
    const tariffa = parseFloat(document.getElementById('newProjectTariffa').value) || 600;
    if (!name) {
        App.Utils.toastWarning('Inserisci un nome per il progetto');
        return;
    }

    // Verifica che ci sia un workspace aperto
    if (!App.state.workspaceHandle) {
        App.Utils.toastWarning('Apri prima un workspace per creare progetti');
        hideNewProjectModal();
        return;
    }

    const project = await App.Actions.createProject(name, tariffa);
    if (project) {
        hideNewProjectModal();
        openProject(project.id);
        App.Utils.toastSuccess(`Progetto "${name}" creato con successo!`);
    }
}

function openProject(id) {
    App.Actions.openProject(id);
}

function deleteProject(id) {
    if (!confirm('Eliminare questo progetto e tutti i suoi dati?')) return;
    App.Actions.deleteProject(id);
}

function saveProjectConfig() {
    App.Actions.saveProjectConfig();
}

// ==================== SIDEBAR HANDLERS ====================
function toggleSection(sectionName) {
    App.UI.toggleSection(sectionName);
}

// ==================== TABS HANDLERS ====================
function switchTab(tabName) {
    App.UI.switchTab(tabName);
}

// ==================== SETTINGS MODAL ====================
function showSettingsModal() {
    const project = App.state.currentProject;
    if (!project) return;

    // Popola i campi
    document.getElementById('settingsProjectName').value = project.name;
    document.getElementById('settingsTariffa').value = project.tariffa;
    document.getElementById('settingsOreGiornata').value = project.oreGiornata;

    // Seleziona il radio button corretto per calcMode
    const calcMode = project.calcMode || 'tariffa';
    document.getElementById('calcModeTariffa').checked = (calcMode === 'tariffa');
    document.getElementById('calcModeOre').checked = (calcMode === 'ore');
    document.getElementById('calcModeCollaboratore').checked = (calcMode === 'tariffa_collaboratore');

    // Renderizza la lista cluster nel modal
    renderSettingsClusterList();

    // Renderizza la lista tariffe collaboratori
    renderCollaboratorRatesList();

    // Reset tab a "generale"
    switchSettingsTab('generale');

    App.UI.showModal('settingsModal');
}

function renderSettingsClusterList() {
    const list = document.getElementById('settingsClusterList');
    const project = App.state.currentProject;

    if (!project?.clusters?.length) {
        list.innerHTML = '<div class="settings-cluster-empty">Nessun cluster definito</div>';
        return;
    }

    const data = App.state.processedData;
    list.innerHTML = project.clusters.map(c => {
        const count = data.filter(r => r._clusterId === c.id).length;
        const escapedName = App.Utils.escapeAttr(c.name);
        return `
            <div class="settings-cluster-item">
                <input type="color" class="cluster-color" value="${c.color}"
                       onchange="updateClusterColor('${c.id}', this.value)" title="Cambia colore">
                <input type="text" class="cluster-name-input" value="${escapedName}"
                       onchange="updateClusterName('${c.id}', this.value)"
                       title="Modifica nome">
                <span class="cluster-count">${count}</span>
                <button class="small danger icon-only" onclick="deleteCluster('${c.id}')" title="Elimina">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-tab-panel').forEach(p => p.classList.remove('active'));

    const tab = document.querySelector(`.settings-tab[data-settings-tab="${tabName}"]`);
    const panel = document.getElementById(`settings${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Panel`);

    if (tab) tab.classList.add('active');
    if (panel) panel.classList.add('active');
}

function renderCollaboratorRatesList() {
    const list = document.getElementById('collaboratorRatesList');
    const project = App.state.currentProject;
    if (!list || !project) return;

    if (!project.collaboratorRates) project.collaboratorRates = {};
    const rates = project.collaboratorRates;
    const names = Object.keys(rates).sort();

    if (names.length === 0) {
        list.innerHTML = '<div class="settings-cluster-empty">Nessun collaboratore. Importa un file Excel per popolare la lista automaticamente.</div>';
        return;
    }

    list.innerHTML = names.map(name => {
        const rate = rates[name];
        const hasWarning = rate === 0 || rate === null || rate === undefined;
        const escapedName = App.Utils.escapeAttr(name);
        const jsName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
            <div class="collaborator-rate-item ${hasWarning ? 'rate-warning' : ''}">
                <span class="collaborator-name" title="${escapedName}">${escapedName}</span>
                <div class="input-with-suffix">
                    <input type="number" class="collaborator-rate-input" value="${rate || ''}" min="0" step="10"
                           placeholder="0"
                           onchange="updateCollaboratorRate('${jsName}', this.value)">
                    <span>EUR/gg</span>
                </div>
                ${hasWarning ? '<span class="collaborator-rate-badge">!</span>' : ''}
                <button class="small danger icon-only" onclick="deleteCollaboratorRate('${jsName}')" title="Rimuovi">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

function updateCollaboratorRate(name, value) {
    const project = App.state.currentProject;
    if (!project) return;

    if (!project.collaboratorRates) project.collaboratorRates = {};
    project.collaboratorRates[name] = parseFloat(value) || 0;

    App.Storage.save();

    // Ricalcola se calcMode attivo e ci sono dati
    if (project.calcMode === 'tariffa_collaboratore' && App.state.processedData.length > 0) {
        App.Calculator.recalculateAll();
    }

    renderCollaboratorRatesList();
}

function deleteCollaboratorRate(name) {
    const project = App.state.currentProject;
    if (!project || !project.collaboratorRates) return;

    delete project.collaboratorRates[name];
    App.Storage.save();

    if (project.calcMode === 'tariffa_collaboratore' && App.state.processedData.length > 0) {
        App.Calculator.recalculateAll();
    }

    renderCollaboratorRatesList();
}

function addCollaboratorRate() {
    const input = document.getElementById('newCollaboratorName');
    const name = input?.value?.trim();
    if (!name) {
        App.Utils.toastWarning('Inserisci il nome del collaboratore');
        return;
    }

    const project = App.state.currentProject;
    if (!project) return;

    if (!project.collaboratorRates) project.collaboratorRates = {};
    if (project.collaboratorRates[name] !== undefined) {
        App.Utils.toastWarning('Collaboratore già presente nella lista');
        return;
    }

    project.collaboratorRates[name] = 0;
    input.value = '';
    App.Storage.save();
    renderCollaboratorRatesList();
}

function hideSettingsModal() {
    App.UI.hideModal('settingsModal');
}

// ==================== MCP GUIDE MODAL ====================
function showMcpGuide() {
    // Calcola il percorso del server MCP basato sulla posizione attuale
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const serverPath = basePath + '/mcp-server/index.js';

    // Aggiorna il placeholder con un percorso di esempio
    const pathEl = document.getElementById('mcpServerPath');
    if (pathEl) {
        // Mostra un percorso generico che l'utente deve adattare
        pathEl.textContent = 'C:/percorso/progetto/mcp-server/index.js';
    }

    App.UI.showModal('mcpGuideModal');
}

function hideMcpGuide() {
    App.UI.hideModal('mcpGuideModal');
}

function copyMcpCode(btn) {
    const codeBlock = btn.parentElement;
    const code = codeBlock.querySelector('code').textContent;

    navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
    });
}

function copyMcpConfig() {
    const config = {
        mcpServers: {
            timesheet: {
                command: "node",
                args: ["C:/percorso/progetto/mcp-server/index.js"]
            }
        }
    };

    const configStr = JSON.stringify(config, null, 2);

    navigator.clipboard.writeText(configStr).then(() => {
        const btn = document.querySelector('.mcp-code-json .mcp-copy-btn');
        if (btn) {
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
        }
        App.Utils.toastSuccess('Configurazione copiata', 'Modifica il percorso prima di incollare');
    });
}

// ==================== MCP HEALTH CHECK ====================
const MCP_HEALTH_URL = 'http://localhost:3847/health';
const MCP_CHECK_INTERVAL = 10000; // 10 secondi

async function checkMcpStatus() {
    const indicator = document.getElementById('mcpStatusIndicator');
    if (!indicator) return;

    indicator.className = 'mcp-status-indicator checking';
    indicator.title = 'Verifica stato server...';

    try {
        const response = await fetch(MCP_HEALTH_URL, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });

        if (response.ok) {
            const data = await response.json();
            indicator.className = 'mcp-status-indicator online';
            indicator.title = `Server MCP attivo (uptime: ${data.uptime}s)`;
        } else {
            indicator.className = 'mcp-status-indicator offline';
            indicator.title = 'Server MCP non risponde';
        }
    } catch (e) {
        indicator.className = 'mcp-status-indicator offline';
        indicator.title = 'Server MCP non raggiungibile';
    }
}

// Avvia polling health check
setInterval(checkMcpStatus, MCP_CHECK_INTERVAL);
// Check immediato al caricamento
setTimeout(checkMcpStatus, 500);

function saveSettings() {
    App.Actions.saveProjectConfig();
    hideSettingsModal();
    App.Utils.toastSuccess('Impostazioni salvate');
}

function deleteCurrentProject() {
    const project = App.state.currentProject;
    if (!project) return;

    if (confirm(`Eliminare il progetto "${project.name}" e tutti i suoi dati?`)) {
        hideSettingsModal();
        App.Actions.deleteProject(project.id);
        App.Utils.toastSuccess('Progetto eliminato');
    }
}

// ==================== WORKSPACE HANDLERS ====================
async function openWorkspace() {
    await App.Workspace.openWorkspace();
}

async function reconnectWorkspace() {
    await App.Workspace.requestReconnect();
}

function dismissReconnectBanner() {
    App.Workspace.hideReconnectBanner();
}

async function saveCurrentProject() {
    if (!App.state.workspaceHandle) {
        App.Utils.toastWarning('Nessun workspace aperto');
        return;
    }
    if (!App.state.currentProject) {
        App.Utils.toastWarning('Nessun progetto selezionato');
        return;
    }

    const success = await App.Workspace.saveProjectData(App.state.currentProject);
    if (success) {
        App.state.unsavedChanges = false;
        App.Storage.updateFileStatus();
        App.Utils.toastSuccess('Progetto salvato');
    }
}

// ==================== MIGRATION HANDLERS ====================
async function runMigration() {
    const count = await App.Workspace.migrateFromV2();
    if (count > 0) {
        App.UI.renderProjectList();
    }
}

function skipMigration() {
    App.Workspace.hideMigrationModal();
    // Carica comunque i progetti se possibile
    App.Workspace.loadWorkspace();
}

// ==================== LEGACY STORAGE HANDLERS (Deprecati) ====================
async function openDataFile() {
    console.warn('openDataFile() deprecato - usa openWorkspace()');
    await openWorkspace();
}

async function createNewDataFile() {
    console.warn('createNewDataFile() deprecato - usa openWorkspace()');
    await openWorkspace();
}

async function saveDataFile() {
    console.warn('saveDataFile() deprecato - usa saveCurrentProject()');
    await saveCurrentProject();
}

// ==================== IMPORT/EXPORT PROGETTI ====================
function exportCurrentProject() {
    const currentProject = App.state.currentProject;
    if (!currentProject) return;

    const exportData = {
        _exportType: 'timesheet_project',
        _exportDate: new Date().toISOString(),
        _version: 1,
        project: currentProject
    };

    App.Utils.downloadFile(
        JSON.stringify(exportData, null, 2),
        `${currentProject.name.replace(/[^a-z0-9]/gi, '_')}_backup.json`,
        'application/json'
    );
    App.Utils.toastSuccess(`Backup del progetto "${currentProject.name}" esportato`);
}

function importProject() {
    document.getElementById('importProjectInput').click();
}

// ==================== CLUSTER HANDLERS ====================
function addCluster() {
    const name = document.getElementById('newClusterName').value.trim();
    const color = document.getElementById('newClusterColor').value;
    if (!name) {
        App.Utils.toastWarning('Inserisci un nome per il cluster');
        return;
    }
    App.Actions.addCluster(name, color);
    document.getElementById('newClusterName').value = '';
    renderSettingsClusterList(); // Aggiorna lista nel modal
}

function updateClusterColor(id, color) {
    const project = App.state.currentProject;
    const cluster = project?.clusters.find(c => c.id === id);
    if (cluster) {
        cluster.color = color;
        App.Storage.save();
        if (App.state.processedData.length > 0) App.UI.renderTable();
    }
}

function updateClusterName(id, name) {
    const project = App.state.currentProject;
    const cluster = project?.clusters.find(c => c.id === id);
    if (!cluster) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
        App.Utils.toastWarning('Il nome del cluster non può essere vuoto');
        App.UI.renderClusterList();
        renderSettingsClusterList();
        return;
    }

    if (cluster.name === trimmedName) return; // Nessuna modifica

    cluster.name = trimmedName;
    App.Storage.save();
    App.UI.renderClusterList();
    App.UI.populateFilterDropdowns();
    if (App.state.processedData.length > 0) App.UI.renderTable();
}

function deleteCluster(id) {
    if (!confirm('Eliminare questo cluster?')) return;
    App.Actions.deleteCluster(id);
}

// ==================== FILE UPLOAD ====================
function handleFile(file) {
    const currentProject = App.state.currentProject;
    if (!currentProject) {
        App.Utils.toastWarning('Seleziona prima un progetto');
        return;
    }

    // Blocca caricamento se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per caricare nuovi dati.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        parseAndMergeData(jsonData, file.name);
    };
    reader.readAsArrayBuffer(file);
}

function parseAndMergeData(jsonData, fileName) {
    if (jsonData.length < 2) {
        App.Utils.toastWarning('Il file sembra essere vuoto');
        return;
    }

    const project = App.state.currentProject;
    const oreGiornata = project.oreGiornata;
    let currentCliente = '';
    let newCount = 0;
    let loadedCount = 0;

    // Ottieni il report del mese corrente
    const monthReport = App.getCurrentMonthReport();
    if (!monthReport) {
        App.Utils.toastError('Errore: nessun progetto selezionato');
        return;
    }

    // Svuota l'array esistente
    App.state.processedData.length = 0;

    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const incarico = String(row[0] || '').trim();
        if (incarico.startsWith('CLIENTE:')) {
            currentCliente = incarico.replace('CLIENTE:', '').trim();
            continue;
        }
        if (incarico.startsWith('TOTALE')) continue;
        if (!row[1]) continue; // No data = skip

        const importoOriginale = parseFloat(row[8]) || 0;
        const tempo = row[5] || '';

        // Calcola giornate usando computeByMode
        const tempRow = { ImportoOriginale: importoOriginale, Tempo: tempo, Collaboratore: row[2] || '' };
        const calc = App.Calculator.computeByMode(tempRow, project);
        let giornateEquiv = calc.giornate;
        let oreEquiv = calc.ore;

        const activity = {
            Cliente: currentCliente,
            Incarico: incarico,
            Data: row[1],
            Collaboratore: row[2] || '',
            Causale: row[3] || '',
            Descrizione: row[4] || '',
            Tempo: tempo,
            ImportoOriginale: importoOriginale,
            Importo: importoOriginale,
            GiornateEquiv: giornateEquiv,
            OreEquiv: oreEquiv,
            _clusterId: null,
            _isNew: true,
            _modified: false,
            _rateError: calc._rateError || false
        };

        // Genera hash
        activity._hash = App.Utils.generateActivityHash(activity);

        // Controlla se esiste già nel report mensile corrente
        const saved = monthReport.activities[activity._hash];
        if (saved) {
            activity._isNew = false;
            activity._clusterId = saved.clusterId || null;

            // Restore modified giornate
            if (saved.giornateModificate !== undefined) {
                activity._originalGiornate = activity.GiornateEquiv;
                activity._originalOre = activity.OreEquiv;
                activity._originalImporto = activity.Importo;
                activity.GiornateEquiv = saved.giornateModificate;
                activity.OreEquiv = saved.giornateModificate * oreGiornata;
                const rate = App.Calculator.getRateForRow(activity, project) || project.tariffa;
                activity.Importo = saved.giornateModificate * rate;
                activity._modified = true;
            }

            // Restore modified text fields
            if (saved.Data !== undefined) {
                activity._originalData = activity.Data;
                activity.Data = saved.Data;
                activity._modified = true;
            }
            if (saved.Incarico !== undefined) {
                activity._originalIncarico = activity.Incarico;
                activity.Incarico = saved.Incarico;
                activity._modified = true;
            }
            if (saved.Collaboratore !== undefined) {
                activity._originalCollaboratore = activity.Collaboratore;
                activity.Collaboratore = saved.Collaboratore;
                activity._modified = true;
            }
            if (saved.Descrizione !== undefined) {
                activity._originalDescrizione = activity.Descrizione;
                activity.Descrizione = saved.Descrizione;
                activity._modified = true;
            }
            if (saved.Tempo !== undefined) {
                activity._originalTempo = activity.Tempo;
                activity.Tempo = saved.Tempo;
                activity._modified = true;
            }
        } else {
            newCount++;
        }

        App.state.processedData.push(activity);
        loadedCount++;

        // Salva i dati originali nel report mensile
        saveActivityState(activity);
    }

    // Auto-popolamento collaboratori per calcMode tariffa_collaboratore
    if (!project.collaboratorRates) project.collaboratorRates = {};
    const missingRates = [];
    const collaborators = new Set(App.state.processedData.map(r => r.Collaboratore).filter(Boolean));
    collaborators.forEach(name => {
        if (project.collaboratorRates[name] === undefined) {
            project.collaboratorRates[name] = 0;
            missingRates.push(name);
        }
    });
    if (project.calcMode === 'tariffa_collaboratore' && missingRates.length > 0) {
        App.Utils.toastWarning(`${missingRates.length} collaborator${missingRates.length === 1 ? 'e' : 'i'} senza tariffa: ${missingRates.join(', ')}`);
    }

    // Aggiungi allo storico del mese corrente
    monthReport.history.unshift({
        date: new Date().toISOString(),
        fileName,
        loaded: loadedCount,
        new: newCount
    });
    if (monthReport.history.length > 20) monthReport.history.pop();
    App.Storage.save();

    // Update UI
    const monthLabel = App.Utils.formatMonthKey(App.getWorkingMonthKey());
    document.getElementById('dropZone').innerHTML = `
        <svg class="drop-zone-icon" style="color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p><strong>${fileName}</strong><br>${loadedCount} attivita caricate, ${newCount} nuove<br><small>Mese: ${monthLabel}</small></p>
    `;

    App.state.selectedRows.clear();
    App.Calculator.updateStats();
    App.Utils.toastSuccess(`${loadedCount} attivita caricate con successo`);
    App.UI.populateFilterDropdowns(); // Popola i dropdown filtri con i nuovi dati
    App.UI.renderTable();
    App.UI.renderClusterList();
    App.UI.renderHistory();
    App.Calculator.updateSelectionInfo();
    App.UI.updateHistoryCount();
    App.UI.updateBadges();
    App.UI.updateMonthSelector(); // Aggiorna il selettore mesi

    // Passa al tab dati
    App.UI.switchTab('data');
}

// ==================== HISTORY ====================
function loadFromHistory() {
    const project = App.state.currentProject;
    if (!project) return;

    // Ottieni il report del mese corrente
    const monthReport = App.getCurrentMonthReport();
    if (!monthReport) {
        App.Utils.toastError('Errore: nessun report mensile disponibile');
        return;
    }

    const activities = monthReport.activities || {};
    const savedActivities = Object.entries(activities).filter(([hash, data]) => data.originalData);

    if (savedActivities.length === 0) {
        App.Utils.toastWarning('Nessuna attivita salvata per questo mese');
        return;
    }

    const oreGiornata = project.oreGiornata;

    // Svuota l'array esistente e riempilo con i nuovi dati
    App.state.processedData.length = 0;

    savedActivities.forEach(([hash, saved]) => {
        const orig = saved.originalData;
        const importoOriginale = orig.ImportoOriginale || 0;
        const tempo = orig.Tempo || '';

        // Calcola giornate usando computeByMode
        const tempRow = { ImportoOriginale: importoOriginale, Tempo: tempo, Collaboratore: orig.Collaboratore || '' };
        const calc = App.Calculator.computeByMode(tempRow, project);
        let giornateEquiv = calc.giornate;
        let oreEquiv = calc.ore;

        const activity = {
            Cliente: orig.Cliente || '',
            Incarico: orig.Incarico || '',
            Data: orig.Data || '',
            Collaboratore: orig.Collaboratore || '',
            Causale: orig.Causale || '',
            Descrizione: orig.Descrizione || '',
            Tempo: tempo,
            ImportoOriginale: importoOriginale,
            Importo: importoOriginale,
            GiornateEquiv: giornateEquiv,
            OreEquiv: oreEquiv,
            _clusterId: saved.clusterId || null,
            _isNew: false,
            _modified: false,
            _hash: hash,
            _rateError: calc._rateError || false
        };

        // Applica modifiche salvate
        if (saved.giornateModificate !== undefined) {
            activity._originalGiornate = activity.GiornateEquiv;
            activity._originalOre = activity.OreEquiv;
            activity._originalImporto = activity.Importo;
            activity.GiornateEquiv = saved.giornateModificate;
            activity.OreEquiv = saved.giornateModificate * oreGiornata;
            const rate = App.Calculator.getRateForRow(activity, project) || project.tariffa;
            activity.Importo = saved.giornateModificate * rate;
            activity._modified = true;
        }

        // Applica modifiche ai campi testuali
        if (saved.Data !== undefined) {
            activity._originalData = orig.Data;
            activity.Data = saved.Data;
            activity._modified = true;
        }
        if (saved.Incarico !== undefined) {
            activity._originalIncarico = orig.Incarico;
            activity.Incarico = saved.Incarico;
            activity._modified = true;
        }
        if (saved.Collaboratore !== undefined) {
            activity._originalCollaboratore = orig.Collaboratore;
            activity.Collaboratore = saved.Collaboratore;
            activity._modified = true;
        }
        if (saved.Descrizione !== undefined) {
            activity._originalDescrizione = orig.Descrizione;
            activity.Descrizione = saved.Descrizione;
            activity._modified = true;
        }
        if (saved.Tempo !== undefined) {
            activity._originalTempo = orig.Tempo;
            activity.Tempo = saved.Tempo;
            activity._modified = true;
        }

        App.state.processedData.push(activity);
    });

    // Ordina per data
    App.state.processedData.sort((a, b) => {
        const dateA = App.Utils.parseItalianDate(a.Data);
        const dateB = App.Utils.parseItalianDate(b.Data);
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });

    // Update UI
    const monthLabel = App.Utils.formatMonthKey(App.getWorkingMonthKey());
    document.getElementById('dropZone').innerHTML = `
        <svg class="drop-zone-icon" style="color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p><strong>Storico caricato</strong><br>${App.state.processedData.length} attivita<br><small>Mese: ${monthLabel}</small></p>
    `;

    App.state.selectedRows.clear();
    App.Calculator.updateStats();
    App.UI.populateFilterDropdowns(); // Popola i dropdown filtri con i nuovi dati
    App.UI.renderTable();
    App.UI.renderClusterList();
    App.Calculator.updateSelectionInfo();
    App.UI.updateBadges();
    App.Utils.toastSuccess(`${App.state.processedData.length} attivita caricate dallo storico`);

    // Passa al tab dati
    App.UI.switchTab('data');
}

// ==================== SELECTION ====================
function selectAll() {
    App.state.processedData.forEach((_, i) => App.state.selectedRows.add(i));
    App.UI.renderTable();
    App.Calculator.updateSelectionInfo();
}

function selectNone() {
    App.state.selectedRows.clear();
    App.UI.renderTable();
    App.Calculator.updateSelectionInfo();
}

function selectByCluster() {
    const modal = document.getElementById('selectClusterModal');
    const list = document.getElementById('selectClusterList');
    const currentProject = App.state.currentProject;
    const processedData = App.state.processedData;

    let html = `<div class="cluster-item" onclick="selectClusterItems(null); hideSelectClusterModal();">
        <span class="cluster-color" style="background:#bdc3c7;"></span>
        <span class="cluster-name">Non assegnate</span>
        <span class="cluster-count">${processedData.filter(r => !r._clusterId).length}</span>
    </div>`;

    currentProject.clusters.forEach(c => {
        const count = processedData.filter(r => r._clusterId === c.id).length;
        html += `<div class="cluster-item" onclick="selectClusterItems('${c.id}'); hideSelectClusterModal();">
            <span class="cluster-color" style="background:${c.color};"></span>
            <span class="cluster-name">${c.name}</span>
            <span class="cluster-count">${count}</span>
        </div>`;
    });

    list.innerHTML = html;
    modal.classList.remove('hidden');
}

function hideSelectClusterModal() {
    App.UI.hideModal('selectClusterModal');
}

function selectClusterItems(clusterId) {
    App.state.selectedRows.clear();
    App.state.processedData.forEach((row, i) => {
        if (clusterId === null && !row._clusterId) App.state.selectedRows.add(i);
        else if (row._clusterId === clusterId) App.state.selectedRows.add(i);
    });
    App.UI.renderTable();
    App.Calculator.updateSelectionInfo();
}

function toggleRow(idx, checked) {
    if (checked) App.state.selectedRows.add(idx);
    else App.state.selectedRows.delete(idx);
    App.Calculator.updateSelectionInfo();
}

// ==================== ROUNDING ====================
function applyRounding() {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        return;
    }
    const newGrandTotal = parseFloat(document.getElementById('newTotal').value);
    App.Calculator.applyRounding(newGrandTotal);
    document.getElementById('newTotal').value = '';
}

function resetToOriginal() {
    App.Calculator.resetToOriginal();
}

// ==================== NUOVI STRUMENTI ====================
function toggleTool(toolId) {
    const tool = document.getElementById(toolId);
    if (!tool) return;

    // Chiudi gli altri strumenti (accordion behavior)
    document.querySelectorAll('.tool-card').forEach(card => {
        if (card.id !== toolId) {
            card.classList.add('collapsed');
        }
    });

    // Toggle quello cliccato
    tool.classList.toggle('collapsed');
}

function updateUniformPreview() {
    App.Calculator.updateUniformToolUI();
}

function applyUniformDistribution() {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        return;
    }
    const total = parseFloat(document.getElementById('uniformTotal').value);
    if (isNaN(total) || total <= 0) {
        App.Utils.toastWarning('Inserisci un totale valido');
        return;
    }
    App.Calculator.applyUniformDistribution(total);
    document.getElementById('uniformTotal').value = '';
    App.Utils.toastSuccess('Distribuzione uniforme applicata');
}

function restoreSelectedRows() {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        return;
    }
    const count = App.Calculator.restoreSelectedRows();
    if (count > 0) {
        App.Utils.toastSuccess(`${count} ${count === 1 ? 'riga ripristinata' : 'righe ripristinate'}`);
    } else {
        App.Utils.toastWarning('Nessuna riga modificata tra le selezionate');
    }
}

function restoreAllRows() {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        return;
    }

    const data = App.state.processedData;
    const modifiedCount = data.filter(r => r._modified).length;

    if (modifiedCount === 0) {
        App.Utils.toastWarning('Nessuna riga modificata da ripristinare');
        return;
    }

    if (confirm(`Ripristinare i valori originali di ${modifiedCount} ${modifiedCount === 1 ? 'riga' : 'righe'}?`)) {
        const count = App.Calculator.restoreAllRows();
        App.Utils.toastSuccess(`${count} ${count === 1 ? 'riga ripristinata' : 'righe ripristinate'}`);
    }
}

function redistributeExcess() {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        return;
    }

    const excessItems = App.Calculator.findExcessActivities();
    if (excessItems.length === 0) {
        App.Utils.toastWarning('Nessuna attività con eccedenza');
        return;
    }

    const selectedTotals = App.Calculator.computeSelectedTotals();
    const otherSelected = selectedTotals.count - excessItems.length;
    if (otherSelected <= 0) {
        App.Utils.toastWarning('Seleziona altre righe su cui redistribuire');
        return;
    }

    App.Calculator.redistributeExcess();
    App.Utils.toastSuccess('Eccedenze redistribuite');
}

function refreshExcessList() {
    App.Calculator.updateExcessToolUI();
}

// ==================== CLUSTER ASSIGNMENT ====================
let clusterDropdown = null;

function showClusterDropdown(event, rowIdx) {
    event.stopPropagation();
    hideClusterDropdown();

    const currentProject = App.state.currentProject;
    const rect = event.target.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'cluster-dropdown';
    dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
    dropdown.style.left = rect.left + 'px';

    let html = `<div class="cluster-dropdown-item" onclick="assignCluster(${rowIdx}, null)">
        <span class="cluster-color" style="background:#bdc3c7; width:14px; height:14px;"></span>
        Nessuno
    </div>`;

    currentProject.clusters.forEach(c => {
        html += `<div class="cluster-dropdown-item" onclick="assignCluster(${rowIdx}, '${c.id}')">
            <span class="cluster-color" style="background:${c.color}; width:14px; height:14px;"></span>
            ${c.name}
        </div>`;
    });

    dropdown.innerHTML = html;
    document.body.appendChild(dropdown);
    clusterDropdown = dropdown;

    document.addEventListener('click', hideClusterDropdown, { once: true });
}

function hideClusterDropdown() {
    if (clusterDropdown) {
        clusterDropdown.remove();
        clusterDropdown = null;
    }
}

function assignCluster(rowIdx, clusterId) {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        hideClusterDropdown();
        return;
    }
    App.Actions.assignCluster(rowIdx, clusterId);
    hideClusterDropdown();
}

function assignClusterToSelected(clusterId) {
    App.state.selectedRows.forEach(i => {
        App.state.processedData[i]._clusterId = clusterId;
        saveActivityState(App.state.processedData[i]);
    });
    App.Storage.save();
    App.UI.renderTable();
    App.UI.renderClusterList();
}

// ==================== ACTIVITY STATE ====================
function saveActivityState(row) {
    const currentProject = App.state.currentProject;
    if (!currentProject) return;

    // Ottieni il report del mese corrente
    const monthReport = App.getCurrentMonthReport();
    if (!monthReport) return;

    if (!monthReport.activities[row._hash]) {
        monthReport.activities[row._hash] = {};
    }
    const saved = monthReport.activities[row._hash];

    // Salva sempre i dati originali completi per lo storico
    saved.originalData = {
        Cliente: row.Cliente,
        Incarico: row._originalIncarico !== undefined ? row._originalIncarico : row.Incarico,
        Data: row._originalData !== undefined ? row._originalData : row.Data,
        Collaboratore: row._originalCollaboratore !== undefined ? row._originalCollaboratore : row.Collaboratore,
        Causale: row.Causale,
        Descrizione: row._originalDescrizione !== undefined ? row._originalDescrizione : row.Descrizione,
        Tempo: row._originalTempo !== undefined ? row._originalTempo : row.Tempo,
        ImportoOriginale: row.ImportoOriginale
    };

    saved.clusterId = row._clusterId;
    if (row._modified) {
        saved.giornateModificate = row.GiornateEquiv;
        // Save all modified text fields
        if (row._originalData !== undefined) saved.Data = row.Data;
        if (row._originalIncarico !== undefined) saved.Incarico = row.Incarico;
        if (row._originalCollaboratore !== undefined) saved.Collaboratore = row.Collaboratore;
        if (row._originalDescrizione !== undefined) saved.Descrizione = row.Descrizione;
        if (row._originalTempo !== undefined) saved.Tempo = row.Tempo;
    }
}

// ==================== FIELD UPDATE ====================
function updateField(idx, field, value) {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        App.UI.renderTable(); // Ripristina valore originale nella UI
        return;
    }

    const row = App.state.processedData[idx];
    if (!row) return;

    // Save original value if not already saved
    if (row[`_original${field}`] === undefined) {
        row[`_original${field}`] = row[field];
    }

    row[field] = value;
    row._modified = true;

    saveActivityState(row);
    App.Storage.save();
    App.Calculator.updateStats();
    App.Calculator.updateSelectionInfo();
}

function updateFieldGiornate(idx, value) {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        App.UI.renderTable();
        return;
    }

    const row = App.state.processedData[idx];
    if (!row) return;

    const currentProject = App.state.currentProject;
    const oreGiornata = currentProject.oreGiornata;
    const rate = App.Calculator.getRateForRow(row, currentProject) || currentProject.tariffa;
    const newGiornate = parseFloat(value) || 0;

    // Save original values if not already saved
    if (!row._modified) {
        const origCalc = App.Calculator.computeByMode(row, currentProject);
        row._originalGiornate = origCalc.giornate;
        row._originalOre = origCalc.ore;
        row._originalImporto = row.ImportoOriginale;
    }

    row.GiornateEquiv = newGiornate;
    row.OreEquiv = newGiornate * oreGiornata;
    row.Importo = newGiornate * rate;
    row._modified = true;

    saveActivityState(row);
    App.Storage.save();
    App.Calculator.updateStats();
    App.UI.renderTable();
    App.Calculator.updateSelectionInfo();
}

function updateFieldTempo(idx, value) {
    // Blocca modifiche se mese chiuso
    if (App.isWorkingMonthClosed()) {
        App.Utils.toastWarning('Mese chiuso. Riapri il mese per modificarlo.');
        App.UI.renderTable();
        return;
    }

    const row = App.state.processedData[idx];
    if (!row) return;

    const currentProject = App.state.currentProject;
    const oreGiornata = currentProject.oreGiornata;
    const rate = App.Calculator.getRateForRow(row, currentProject) || currentProject.tariffa;

    // Save original values if not already saved
    if (row._originalTempo === undefined) {
        row._originalTempo = row.Tempo;
    }
    if (!row._modified || row._originalGiornate === undefined) {
        const origCalc = App.Calculator.computeByMode(row, currentProject);
        row._originalGiornate = origCalc.giornate;
        row._originalOre = origCalc.ore;
        row._originalImporto = row.ImportoOriginale;
    }

    // Calcola proporzione tra nuovo tempo e tempo originale
    const tempoOriginale = App.Utils.parseTempoToHours(row._originalTempo);
    const tempoNuovo = App.Utils.parseTempoToHours(value);

    row.Tempo = value;

    if (tempoOriginale > 0) {
        // Mantieni proporzione: se tempo raddoppia, giornate raddoppiano
        const ratio = tempoNuovo / tempoOriginale;
        row.GiornateEquiv = row._originalGiornate * ratio;
        row.OreEquiv = row.GiornateEquiv * oreGiornata;
        row.Importo = row.GiornateEquiv * rate;
    } else {
        // Se tempo originale era 0, usa calcolo diretto da ore
        row.OreEquiv = tempoNuovo;
        row.GiornateEquiv = tempoNuovo / oreGiornata;
        row.Importo = row.GiornateEquiv * rate;
    }

    row._modified = true;

    saveActivityState(row);
    App.Storage.save();
    App.Calculator.updateStats();
    App.UI.renderTable();
    App.Calculator.updateSelectionInfo();
}

// ==================== FILTERS ====================
function toggleFiltersPanel() {
    const panel = document.getElementById('filtersPanel');
    if (panel) {
        panel.classList.toggle('collapsed');
    }
}

function applyFilters() {
    App.UI.renderTable();
    App.Calculator.updateSelectionInfo(); // Aggiorna anche gli strumenti con i nuovi filtri
}

function clearFilters() {
    // Reset tutti i campi filtro
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const filterSearch = document.getElementById('filterSearch');
    const filterCluster = document.getElementById('filterCluster');
    const filterCollaboratore = document.getElementById('filterCollaboratore');
    const filterGiornateMin = document.getElementById('filterGiornateMin');
    const filterGiornateMax = document.getElementById('filterGiornateMax');
    const filterModified = document.getElementById('filterModified');

    if (filterDateFrom) filterDateFrom.value = '';
    if (filterDateTo) filterDateTo.value = '';
    if (filterSearch) filterSearch.value = '';
    if (filterCluster) filterCluster.value = '';
    if (filterCollaboratore) filterCollaboratore.value = '';
    if (filterGiornateMin) filterGiornateMin.value = '';
    if (filterGiornateMax) filterGiornateMax.value = '';
    if (filterModified) filterModified.checked = false;

    App.UI.renderTable();
    App.Calculator.updateSelectionInfo(); // Aggiorna anche gli strumenti
}

// ==================== EXPORT ====================
function exportJSON() {
    App.Exporter.toJSON();
}

function exportCSV() {
    App.Exporter.toCSV();
}

function exportReportExcel() {
    App.Exporter.toExcelReport();
}

// ==================== MONTH SELECTION ====================
/**
 * Seleziona un mese di lavoro
 * @param {string} monthKey - Chiave mese (es. "2026-02")
 */
function selectWorkingMonth(monthKey) {
    const project = App.state.currentProject;
    if (!project) return;

    const currentMonth = App.getWorkingMonthKey();
    if (monthKey === currentMonth) return; // Stesso mese, niente da fare

    // Verifica se il mese è nel passato
    const isPast = App.Utils.isMonthInPast(monthKey);
    const report = App.getMonthReport(monthKey);
    const isClosed = report?.status === 'closed';
    const hasData = report && App.countMonthActivities(report) > 0;

    // Mostra avviso solo per mesi passati aperti (non chiusi)
    if (isPast && !isClosed) {
        App.Utils.toastWarning(`Attenzione: stai lavorando su un mese passato (${App.Utils.formatMonthKey(monthKey)})`);
    }

    // Imposta il mese di lavoro
    App.setWorkingMonth(monthKey);
    project.currentMonth = monthKey;

    // Pulisci i dati caricati
    App.state.processedData.length = 0;
    App.state.selectedRows.clear();

    // Se il mese ha dati, carica automaticamente lo storico
    if (hasData) {
        // Carica lo storico silenziosamente
        loadMonthData(monthKey);

        if (isClosed) {
            App.Utils.toastInfo(`Mese ${App.Utils.formatMonthKey(monthKey)} (chiuso) - Sola lettura`);
        }
    }

    // Aggiorna UI
    App.UI.updateMonthSelector();
    App.UI.renderHistory();
    App.UI.updateHistoryCount();
    App.UI.updateBadges();
    App.UI.renderTable();
    App.UI.updateProjectHeader();

    // Aggiorna drop zone
    const monthLabel = App.Utils.formatMonthKey(monthKey);
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        if (isClosed) {
            dropZone.innerHTML = `
                <svg class="drop-zone-icon" style="color:var(--gray-400);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                <p><strong>${monthLabel}</strong> - Mese chiuso<br><small>Riapri il mese per modificarlo</small></p>
            `;
        } else if (hasData) {
            dropZone.innerHTML = `
                <svg class="drop-zone-icon" style="color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p><strong>${monthLabel}</strong><br>${App.state.processedData.length} attivita caricate</p>
            `;
        } else {
            dropZone.innerHTML = `
                <svg class="drop-zone-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p>Mese: <strong>${monthLabel}</strong><br>Trascina file Excel o <strong>clicca per selezionare</strong></p>
            `;
        }
    }

    App.Storage.save();
}

/**
 * Carica i dati di un mese specifico (usato internamente)
 * @param {string} monthKey - Chiave mese
 */
function loadMonthData(monthKey) {
    const project = App.state.currentProject;
    if (!project) return;

    const report = project.monthlyReports?.[monthKey];
    if (!report || !report.activities) return;

    const activities = report.activities;
    const savedActivities = Object.entries(activities).filter(([hash, data]) => data.originalData);

    if (savedActivities.length === 0) return;

    const oreGiornata = project.oreGiornata;

    savedActivities.forEach(([hash, saved]) => {
        const orig = saved.originalData;
        const importoOriginale = orig.ImportoOriginale || 0;
        const tempo = orig.Tempo || '';

        const tempRow = { ImportoOriginale: importoOriginale, Tempo: tempo, Collaboratore: orig.Collaboratore || '' };
        const calc = App.Calculator.computeByMode(tempRow, project);
        let giornateEquiv = calc.giornate;
        let oreEquiv = calc.ore;

        const activity = {
            Cliente: orig.Cliente || '',
            Incarico: orig.Incarico || '',
            Data: orig.Data || '',
            Collaboratore: orig.Collaboratore || '',
            Causale: orig.Causale || '',
            Descrizione: orig.Descrizione || '',
            Tempo: tempo,
            ImportoOriginale: importoOriginale,
            Importo: importoOriginale,
            GiornateEquiv: giornateEquiv,
            OreEquiv: oreEquiv,
            _clusterId: saved.clusterId || null,
            _isNew: false,
            _modified: false,
            _hash: hash,
            _rateError: calc._rateError || false
        };

        // Applica modifiche salvate
        if (saved.giornateModificate !== undefined) {
            activity._originalGiornate = activity.GiornateEquiv;
            activity._originalOre = activity.OreEquiv;
            activity._originalImporto = activity.Importo;
            activity.GiornateEquiv = saved.giornateModificate;
            activity.OreEquiv = saved.giornateModificate * oreGiornata;
            const rate = App.Calculator.getRateForRow(activity, project) || project.tariffa;
            activity.Importo = saved.giornateModificate * rate;
            activity._modified = true;
        }

        if (saved.Data !== undefined) {
            activity._originalData = orig.Data;
            activity.Data = saved.Data;
            activity._modified = true;
        }
        if (saved.Incarico !== undefined) {
            activity._originalIncarico = orig.Incarico;
            activity.Incarico = saved.Incarico;
            activity._modified = true;
        }
        if (saved.Collaboratore !== undefined) {
            activity._originalCollaboratore = orig.Collaboratore;
            activity.Collaboratore = saved.Collaboratore;
            activity._modified = true;
        }
        if (saved.Descrizione !== undefined) {
            activity._originalDescrizione = orig.Descrizione;
            activity.Descrizione = saved.Descrizione;
            activity._modified = true;
        }
        if (saved.Tempo !== undefined) {
            activity._originalTempo = orig.Tempo;
            activity.Tempo = saved.Tempo;
            activity._modified = true;
        }

        App.state.processedData.push(activity);
    });

    // Ordina per data
    App.state.processedData.sort((a, b) => {
        const dateA = App.Utils.parseItalianDate(a.Data);
        const dateB = App.Utils.parseItalianDate(b.Data);
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });

    App.Calculator.updateStats();
    App.UI.populateFilterDropdowns();
}

/**
 * Chiude un mese (impedisce modifiche accidentali)
 * @param {string} monthKey - Chiave mese (es. "2026-02")
 */
function closeMonth(monthKey) {
    const project = App.state.currentProject;
    if (!project) return;

    const report = App.getMonthReport(monthKey);
    if (!report) {
        App.Utils.toastWarning('Nessun report per questo mese');
        return;
    }

    if (report.status === 'closed') {
        App.Utils.toastInfo('Il mese e gia chiuso');
        return;
    }

    const activitiesCount = App.countMonthActivities(report);
    if (activitiesCount === 0) {
        App.Utils.toastWarning('Non ci sono attivita da chiudere in questo mese');
        return;
    }

    if (!confirm(`Chiudere il mese ${App.Utils.formatMonthKey(monthKey)}?\nIl mese contiene ${activitiesCount} attivita.\n\nPotrai sempre riaprirlo se necessario.`)) {
        return;
    }

    report.status = 'closed';
    report.closedAt = new Date().toISOString();

    App.Storage.save();
    App.UI.updateMonthSelector();
    App.Utils.toastSuccess(`Mese ${App.Utils.formatMonthKey(monthKey)} chiuso`);
}

/**
 * Riapre un mese chiuso
 * @param {string} monthKey - Chiave mese (es. "2026-02")
 */
function reopenMonth(monthKey) {
    const project = App.state.currentProject;
    if (!project) return;

    const report = App.getMonthReport(monthKey);
    if (!report || report.status !== 'closed') {
        App.Utils.toastInfo('Il mese non e chiuso');
        return;
    }

    report.status = 'open';
    delete report.closedAt;

    App.Storage.save();
    App.UI.updateMonthSelector();
    App.Utils.toastSuccess(`Mese ${App.Utils.formatMonthKey(monthKey)} riaperto`);
}

/**
 * Chiude il mese corrente dalla UI
 */
function closeCurrentMonth() {
    closeMonth(App.getWorkingMonthKey());
}

/**
 * Riapre il mese corrente dalla UI
 */
function reopenCurrentMonth() {
    const monthKey = App.getWorkingMonthKey();
    const report = App.getMonthReport(monthKey);

    if (!report || report.status !== 'closed') {
        App.Utils.toastInfo('Il mese non e chiuso');
        return;
    }

    if (!confirm(`Riaprire il mese ${App.Utils.formatMonthKey(monthKey)} per modificarlo?`)) {
        return;
    }

    report.status = 'open';
    delete report.closedAt;

    App.Storage.save();
    App.UI.updateMonthSelector();
    App.UI.updateProjectHeader();

    // Aggiorna drop zone
    const monthLabel = App.Utils.formatMonthKey(monthKey);
    const dropZone = document.getElementById('dropZone');
    if (dropZone && App.state.processedData.length > 0) {
        dropZone.innerHTML = `
            <svg class="drop-zone-icon" style="color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p><strong>${monthLabel}</strong><br>${App.state.processedData.length} attivita - Ora modificabile</p>
        `;
    }

    App.Utils.toastSuccess(`Mese ${App.Utils.formatMonthKey(monthKey)} riaperto`);
}
