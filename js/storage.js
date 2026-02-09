/**
 * App.Storage - Gestione persistenza dati
 * Supporta workspace con cartelle per progetto (v3) e localStorage come fallback
 */
App.Storage = {
    /**
     * Verifica se File System Access API e' supportato
     * @returns {boolean}
     */
    isFileSystemSupported() {
        return 'showDirectoryPicker' in window;
    },

    /**
     * Aggiorna lo stato del file nella UI (header)
     * Delega a App.Workspace se disponibile
     */
    updateFileStatus() {
        // Usa il nuovo sistema workspace
        if (App.Workspace && App.Workspace.updateWorkspaceStatus) {
            App.Workspace.updateWorkspaceStatus();
            return;
        }

        // Fallback legacy
        const status = document.getElementById('headerFileStatus');
        if (!status) return;

        if (!App.Storage.isFileSystemSupported()) {
            status.className = 'app-file-status-header';
            status.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--danger);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span style="color:var(--danger);">Browser non supportato</span>
            `;
            return;
        }

        status.className = 'app-file-status-header';
        status.innerHTML = `
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
            </svg>
            <span>Nessun workspace</span>
        `;
    },

    /**
     * Salva il progetto corrente
     * Se workspace attivo -> salva nella cartella progetto
     * Altrimenti -> solo localStorage
     */
    save() {
        // Salva sempre in localStorage come backup
        localStorage.setItem('timesheet_projects', JSON.stringify(App.state.projects));

        // Se workspace attivo, salva il progetto corrente nella sua cartella
        if (App.state.workspaceHandle && App.state.currentProject) {
            App.state.unsavedChanges = true;
            App.Storage.updateFileStatus();
            // Auto-save dopo 2 secondi di inattivita'
            clearTimeout(window.autoSaveTimeout);
            window.autoSaveTimeout = setTimeout(() => {
                App.Storage.saveCurrentProject();
            }, 2000);
        }
    },

    /**
     * Salva il progetto corrente nel workspace
     */
    async saveCurrentProject() {
        if (!App.state.workspaceHandle || !App.state.currentProject) {
            return;
        }

        const success = await App.Workspace.saveProjectData(App.state.currentProject);
        if (success) {
            App.state.unsavedChanges = false;
            App.Storage.updateFileStatus();
        }
    },

    /**
     * Carica progetti da localStorage (solo fallback)
     */
    loadFromLocalStorage() {
        try {
            App.state.projects = JSON.parse(localStorage.getItem('timesheet_projects') || '[]');
            if (!Array.isArray(App.state.projects)) App.state.projects = [];
        } catch (e) {
            console.error('Errore lettura localStorage:', e);
            App.state.projects = [];
        }
    },

    // ==================== LEGACY FILE OPERATIONS (Deprecate) ====================
    // Mantenute per retrocompatibilita' ma non piu' usate nell'UI

    /**
     * @deprecated Usa App.Workspace.openWorkspace()
     */
    async openDataFile() {
        console.warn('openDataFile() e deprecato. Usa openWorkspace()');
        return await App.Workspace.openWorkspace();
    },

    /**
     * @deprecated Non piu' necessario con sistema workspace
     */
    async createNewDataFile() {
        console.warn('createNewDataFile() e deprecato. Usa openWorkspace() e createProject()');
    },

    /**
     * @deprecated I dati vengono caricati dal workspace
     */
    async loadFromFile() {
        console.warn('loadFromFile() e deprecato. I dati vengono caricati dal workspace');
    },

    /**
     * @deprecated Usa App.Storage.saveCurrentProject()
     */
    async saveToFile() {
        console.warn('saveToFile() e deprecato. Usa saveCurrentProject()');
        await App.Storage.saveCurrentProject();
    },

    // ==================== MONTHLY REPORTS MIGRATION ====================

    /**
     * Migra un progetto dalla struttura vecchia (activities flat) a quella nuova (monthlyReports)
     * @param {Object} project - Progetto da migrare
     * @returns {boolean} True se la migrazione è stata eseguita
     */
    migrateProjectToMonthlyReports(project) {
        // Se già migrato (ha monthlyReports e activities è vuoto), salta
        if (project.monthlyReports && Object.keys(project.monthlyReports).length > 0) {
            // Verifica se la vecchia struttura activities è stata svuotata
            const oldActivitiesCount = Object.values(project.activities || {}).filter(a => a.originalData).length;
            if (oldActivitiesCount === 0) {
                return false; // Già migrato
            }
        }

        // Se non ci sono attività da migrare, inizializza solo la struttura
        if (!project.activities || Object.keys(project.activities).length === 0) {
            project.monthlyReports = project.monthlyReports || {};
            project.currentMonth = App.Utils.getCurrentMonthKey();
            return false;
        }

        console.log(`Migrazione progetto "${project.name}" al formato monthlyReports...`);

        // Inizializza monthlyReports se non esiste
        if (!project.monthlyReports) {
            project.monthlyReports = {};
        }

        const currentMonthKey = App.Utils.getCurrentMonthKey();
        const activitiesByMonth = {};

        // Raggruppa le attività per mese
        Object.entries(project.activities).forEach(([hash, activityData]) => {
            if (!activityData.originalData) return; // Salta attività senza dati originali

            // Estrai il mese dalla data dell'attività
            const dateStr = activityData.originalData.Data;
            let monthKey = App.Utils.extractMonthFromDate(dateStr);

            // Se non riusciamo a determinare il mese, usa il mese corrente
            if (!monthKey) {
                monthKey = currentMonthKey;
            }

            if (!activitiesByMonth[monthKey]) {
                activitiesByMonth[monthKey] = {};
            }

            activitiesByMonth[monthKey][hash] = activityData;
        });

        // Crea i report mensili
        Object.entries(activitiesByMonth).forEach(([monthKey, activities]) => {
            // Se il mese non esiste nei report, crealo
            if (!project.monthlyReports[monthKey]) {
                project.monthlyReports[monthKey] = {
                    status: App.Utils.isMonthInPast(monthKey) ? 'closed' : 'open',
                    activities: {},
                    history: []
                };
            }

            // Copia le attività nel mese
            Object.assign(project.monthlyReports[monthKey].activities, activities);
        });

        // Migra lo storico nel mese più recente con dati
        if (project.history && project.history.length > 0) {
            const sortedMonths = Object.keys(activitiesByMonth).sort();
            const latestMonth = sortedMonths[sortedMonths.length - 1] || currentMonthKey;

            if (project.monthlyReports[latestMonth]) {
                project.monthlyReports[latestMonth].history = project.history;
            }
        }

        // Imposta il mese corrente
        project.currentMonth = currentMonthKey;

        // Svuota la vecchia struttura activities (mantieni la proprietà ma vuota)
        project.activities = {};

        // Svuota lo storico globale
        project.history = [];

        console.log(`Migrazione completata: ${Object.keys(activitiesByMonth).length} mesi migrati`);
        return true;
    },

    /**
     * Migra tutti i progetti al nuovo formato
     */
    migrateAllProjects() {
        let migratedCount = 0;

        App.state.projects.forEach(project => {
            if (App.Storage.migrateProjectToMonthlyReports(project)) {
                migratedCount++;
            }
        });

        if (migratedCount > 0) {
            console.log(`Migrati ${migratedCount} progetti al formato monthlyReports`);
            App.Storage.save();
            App.Utils.toastInfo(`Migrazione completata: ${migratedCount} progetti aggiornati al nuovo formato mensile`);
        }

        return migratedCount;
    }
};
