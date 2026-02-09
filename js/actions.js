/**
 * App.Actions - Coordinatore azioni utente
 */
App.Actions = {
    /**
     * Crea un nuovo progetto
     * Se workspace attivo, crea anche la cartella
     * @param {string} name - Nome del progetto
     * @param {number} tariffa - Tariffa giornaliera
     * @returns {Promise<Object>} Il progetto creato
     */
    async createProject(name, tariffa = 600) {
        const currentMonthKey = App.Utils.getCurrentMonthKey();

        // Genera nome cartella sanificato
        const folderName = App.state.workspaceHandle
            ? App.Workspace.sanitizeFolderName(name)
            : null;

        const project = {
            id: 'proj_' + Date.now(),
            name,
            folderName,  // Nome cartella nel workspace
            tariffa,
            oreGiornata: 8,
            calcMode: 'tariffa', // 'tariffa' = Importo/Tariffa, 'ore' = Ore/OreGiornata, 'tariffa_collaboratore' = Importo/TariffaCollaboratore
            collaboratorRates: {}, // { "Nome Cognome": tariffaGiornaliera }
            clusters: [],
            // Nuova struttura per report mensili
            currentMonth: currentMonthKey,
            monthlyReports: {},
            // Mantieni per retrocompatibilita (vuote)
            activities: {},
            history: []
        };

        // Se workspace attivo, crea la cartella e salva
        if (App.state.workspaceHandle) {
            const folderHandle = await App.Workspace.createProjectFolder(name);
            if (folderHandle) {
                project._folderHandle = folderHandle;
                await App.Workspace.saveProjectData(project);
            } else {
                App.Utils.toastError('Errore creazione cartella progetto');
                return null;
            }
        }

        App.state.projects.push(project);
        App.Storage.save();
        return project;
    },

    /**
     * Apre un progetto esistente
     * @param {string} id - ID del progetto
     */
    openProject(id) {
        const project = App.state.projects.find(p => p.id === id);
        if (!project) return;

        // Migra il progetto se necessario (formato vecchio -> nuovo)
        App.Storage.migrateProjectToMonthlyReports(project);

        App.state.currentProject = project;
        App.state.processedData.length = 0;
        App.state.selectedRows.clear();

        // Salva come ultimo progetto aperto (per ripristino automatico)
        localStorage.setItem('last_opened_project', id);

        // Inizializza il mese di lavoro
        // Usa il mese salvato nel progetto, oppure il mese corrente
        const workingMonth = project.currentMonth || App.Utils.getCurrentMonthKey();
        App.setWorkingMonth(workingMonth);
        project.currentMonth = workingMonth;

        // Mostra project view, nascondi empty state
        document.getElementById('noProjectCard').classList.add('hidden');
        document.getElementById('projectView').classList.remove('hidden');

        // Espandi sezione mese
        document.getElementById('monthSection').classList.remove('collapsed');

        // Aggiorna header progetto
        App.UI.updateProjectHeader();
        App.UI.updateBadges();

        // Aggiorna badge mese nella sidebar
        const monthBadge = document.getElementById('monthBadge');
        if (monthBadge) {
            monthBadge.textContent = App.Utils.formatMonthKeyShort(workingMonth);
        }

        App.UI.renderProjectList();
        App.UI.renderClusterList();
        App.UI.renderHistory();
        App.UI.renderMonthSelector();

        // Reset drop zone con indicazione mese
        const monthLabel = App.Utils.formatMonthKey(workingMonth);
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.innerHTML = `
                <svg class="drop-zone-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p>Mese: <strong>${monthLabel}</strong><br>Trascina file Excel o <strong>clicca per selezionare</strong></p>
            `;
        }

        // Torna al tab upload
        App.UI.switchTab('upload');

        App.UI.updateHistoryCount();
    },

    /**
     * Elimina un progetto
     * Se workspace attivo, elimina anche la cartella
     * @param {string} id - ID del progetto
     */
    async deleteProject(id) {
        const project = App.state.projects.find(p => p.id === id);

        // Se workspace attivo ed esiste una cartella, eliminala
        if (App.state.workspaceHandle && project?.folderName) {
            const deleted = await App.Workspace.deleteProjectFolder(project.folderName);
            if (!deleted) {
                // Se non riesce a eliminare la cartella, avvisa ma continua
                console.warn('Impossibile eliminare cartella:', project.folderName);
            }
        }

        App.state.projects = App.state.projects.filter(p => p.id !== id);
        App.Storage.save();

        if (App.state.currentProject?.id === id) {
            App.state.currentProject = null;
            App.state.processedData.length = 0;
            App.state.workingMonth = null;
            localStorage.removeItem('last_opened_project');

            // Nascondi project view, mostra empty state
            document.getElementById('noProjectCard').classList.remove('hidden');
            document.getElementById('projectView').classList.add('hidden');

            // Collassa sezione mese
            document.getElementById('monthSection').classList.add('collapsed');

            // Reset badges
            document.getElementById('monthBadge').textContent = '-';
            document.getElementById('dataCountBadge').textContent = '0';
        }
        App.UI.renderProjectList();
    },

    /**
     * Aggiunge un cluster al progetto corrente
     * @param {string} name - Nome del cluster
     * @param {string} color - Colore del cluster (hex)
     */
    addCluster(name, color) {
        const project = App.state.currentProject;
        if (!project || !name) return;

        project.clusters.push({
            id: 'cl_' + Date.now(),
            name,
            color
        });
        App.Storage.save();
        App.UI.renderClusterList();
    },

    /**
     * Elimina un cluster
     * @param {string} id - ID del cluster
     */
    deleteCluster(id) {
        const project = App.state.currentProject;
        if (!project) return;

        project.clusters = project.clusters.filter(c => c.id !== id);

        // Rimuovi assegnazioni da tutti i report mensili
        if (project.monthlyReports) {
            Object.values(project.monthlyReports).forEach(report => {
                if (report.activities) {
                    Object.values(report.activities).forEach(a => {
                        if (a.clusterId === id) a.clusterId = null;
                    });
                }
            });
        }

        // Rimuovi anche dai dati visualizzati
        App.state.processedData.forEach(r => {
            if (r._clusterId === id) r._clusterId = null;
        });

        App.Storage.save();
        App.UI.renderClusterList();
        // Aggiorna lista nel modal se aperto
        if (typeof renderSettingsClusterList === 'function') {
            renderSettingsClusterList();
        }
        if (App.state.processedData.length > 0) App.UI.renderTable();
    },

    /**
     * Assegna un cluster a un'attività
     * @param {number} rowIdx - Indice della riga
     * @param {string|null} clusterId - ID del cluster o null
     */
    assignCluster(rowIdx, clusterId) {
        const row = App.state.processedData[rowIdx];
        if (!row) return;

        row._clusterId = clusterId;
        saveActivityState(row);
        App.Storage.save();
        App.UI.renderTable();
        App.UI.renderClusterList();
    },

    /**
     * Salva la configurazione del progetto (dal modal settings)
     */
    saveProjectConfig() {
        const project = App.state.currentProject;
        if (!project) return;

        const name = document.getElementById('settingsProjectName').value.trim();
        const tariffa = parseFloat(document.getElementById('settingsTariffa').value) || 600;
        const oreGiornata = parseFloat(document.getElementById('settingsOreGiornata').value) || 8;
        const calcMode = document.querySelector('input[name="settingsCalcMode"]:checked')?.value || 'tariffa';

        if (name) project.name = name;
        project.tariffa = tariffa;
        project.oreGiornata = oreGiornata;
        project.calcMode = calcMode;

        App.Storage.save();

        // Aggiorna UI
        App.UI.updateProjectHeader();
        App.UI.renderProjectList();

        // Ricalcola se ci sono dati
        if (App.state.processedData.length > 0) {
            App.Calculator.recalculateAll();
        }
    }
};
