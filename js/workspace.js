/**
 * App.Workspace - Gestione workspace e directory projects
 *
 * Struttura workspace:
 * /workspace/
 * ├── .timesheet-workspace.json    # Config workspace
 * ├── Progetto 1/
 * │   └── project.json             # Dati singolo progetto (v3)
 * └── Progetto 2/
 *     └── project.json
 */
App.Workspace = {
    // Nome del file di configurazione workspace
    WORKSPACE_CONFIG_FILE: '.timesheet-workspace.json',
    // Nome del file progetto
    PROJECT_FILE: 'project.json',
    // Nome del database IndexedDB
    DB_NAME: 'TimesheetWorkspaceDB',
    DB_VERSION: 1,
    DB_STORE: 'handles',

    // ==================== IndexedDB ====================

    /**
     * Apre il database IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(App.Workspace.DB_NAME, App.Workspace.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(App.Workspace.DB_STORE)) {
                    db.createObjectStore(App.Workspace.DB_STORE);
                }
            };
        });
    },

    /**
     * Salva un handle nel database IndexedDB
     * @param {string} key - Chiave
     * @param {FileSystemDirectoryHandle} handle - Handle da salvare
     */
    async saveHandle(key, handle) {
        const db = await App.Workspace.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(App.Workspace.DB_STORE, 'readwrite');
            const store = tx.objectStore(App.Workspace.DB_STORE);
            const request = store.put(handle, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Recupera un handle dal database IndexedDB
     * @param {string} key - Chiave
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    async getHandle(key) {
        const db = await App.Workspace.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(App.Workspace.DB_STORE, 'readonly');
            const store = tx.objectStore(App.Workspace.DB_STORE);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Rimuove un handle dal database IndexedDB
     * @param {string} key - Chiave
     */
    async removeHandle(key) {
        const db = await App.Workspace.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(App.Workspace.DB_STORE, 'readwrite');
            const store = tx.objectStore(App.Workspace.DB_STORE);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ==================== Workspace Operations ====================

    /**
     * Verifica se File System Access API e' supportato
     * @returns {boolean}
     */
    isSupported() {
        return 'showDirectoryPicker' in window;
    },

    /**
     * Apre un workspace (cartella contenente i progetti)
     * @returns {Promise<boolean>} True se aperto con successo
     */
    async openWorkspace() {
        if (!App.Workspace.isSupported()) {
            App.Utils.toastError('Il tuo browser non supporta File System API. Usa Chrome o Edge.');
            return false;
        }

        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });

            App.state.workspaceHandle = handle;
            App.state.workspacePath = handle.name;

            // Salva l'handle in IndexedDB per riconnessione futura
            await App.Workspace.saveHandle('workspace', handle);
            localStorage.setItem('workspace_name', handle.name);

            // Carica i progetti dal workspace
            await App.Workspace.loadWorkspace();

            App.Workspace.updateWorkspaceStatus();
            App.Utils.toastSuccess('Workspace aperto', handle.name);

            return true;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Errore apertura workspace:', err);
                App.Utils.toastError('Errore nell\'apertura del workspace');
            }
            return false;
        }
    },

    /**
     * Tenta di riconnettersi al workspace salvato
     * @returns {Promise<'granted'|'prompt'|'denied'|null>} Stato del permesso
     */
    async tryReconnect() {
        if (!App.Workspace.isSupported()) {
            return null;
        }

        try {
            const handle = await App.Workspace.getHandle('workspace');
            if (!handle) {
                return null;
            }

            // Verifica lo stato del permesso
            const permission = await handle.queryPermission({ mode: 'readwrite' });

            if (permission === 'granted') {
                // Permesso gia' concesso, riconnetti automaticamente
                App.state.workspaceHandle = handle;
                App.state.workspacePath = handle.name;
                await App.Workspace.loadWorkspace();
                App.Workspace.updateWorkspaceStatus();

                // Ripristina ultimo progetto aperto
                const lastProjectId = localStorage.getItem('last_opened_project');
                if (lastProjectId) {
                    const project = App.state.projects.find(p => p.id === lastProjectId);
                    if (project) {
                        setTimeout(() => App.Actions.openProject(lastProjectId), 100);
                    }
                }

                return 'granted';
            } else {
                // Permesso richiede prompt - salva l'handle per dopo
                App.state._pendingWorkspaceHandle = handle;
                return permission;
            }
        } catch (err) {
            console.error('Errore durante tryReconnect:', err);
            return null;
        }
    },

    /**
     * Richiede il permesso per riconnettersi (da chiamare dopo azione utente)
     * @returns {Promise<boolean>} True se riconnesso con successo
     */
    async requestReconnect() {
        const handle = App.state._pendingWorkspaceHandle;
        if (!handle) {
            return await App.Workspace.openWorkspace();
        }

        try {
            const permission = await handle.requestPermission({ mode: 'readwrite' });

            if (permission === 'granted') {
                App.state.workspaceHandle = handle;
                App.state.workspacePath = handle.name;
                delete App.state._pendingWorkspaceHandle;

                await App.Workspace.loadWorkspace();
                App.Workspace.updateWorkspaceStatus();
                App.Workspace.hideReconnectBanner();

                // Ripristina ultimo progetto aperto
                const lastProjectId = localStorage.getItem('last_opened_project');
                if (lastProjectId) {
                    const project = App.state.projects.find(p => p.id === lastProjectId);
                    if (project) {
                        App.Actions.openProject(lastProjectId);
                    }
                }

                App.Utils.toastSuccess('Workspace riconnesso', handle.name);
                return true;
            } else {
                App.Utils.toastWarning('Permesso non concesso');
                return false;
            }
        } catch (err) {
            console.error('Errore riconnessione:', err);
            App.Utils.toastError('Errore nella riconnessione');
            return false;
        }
    },

    /**
     * Disconnette il workspace corrente
     */
    async disconnectWorkspace() {
        App.state.workspaceHandle = null;
        App.state.workspacePath = null;
        App.state.projects = [];
        App.state.currentProject = null;
        App.state.processedData = [];

        await App.Workspace.removeHandle('workspace');
        localStorage.removeItem('workspace_name');
        localStorage.removeItem('last_opened_project');

        App.Workspace.updateWorkspaceStatus();
        App.UI.renderProjectList();

        // Mostra empty state
        document.getElementById('noProjectCard')?.classList.remove('hidden');
        document.getElementById('projectView')?.classList.add('hidden');
    },

    /**
     * Carica tutti i progetti dal workspace
     */
    async loadWorkspace() {
        const handle = App.state.workspaceHandle;
        if (!handle) return;

        App.state.projects = [];

        try {
            // Controlla se esiste un file dati vecchio da migrare
            let hasOldFile = false;
            for await (const entry of handle.values()) {
                if (entry.kind === 'file' && entry.name === 'timesheet_data.json') {
                    hasOldFile = true;
                    break;
                }
            }

            if (hasOldFile) {
                // Offri migrazione
                App.Workspace.showMigrationModal();
                return;
            }

            // Scansiona le cartelle per trovare i progetti
            for await (const entry of handle.values()) {
                if (entry.kind === 'directory') {
                    // Ignora cartelle che iniziano con .
                    if (entry.name.startsWith('.')) continue;

                    try {
                        // Cerca project.json nella cartella
                        const projectHandle = await entry.getFileHandle(App.Workspace.PROJECT_FILE);
                        const file = await projectHandle.getFile();
                        const content = await file.text();
                        const projectData = JSON.parse(content);

                        if (projectData._type === 'timesheet_project') {
                            // Assicurati che folderName sia corretto
                            projectData.folderName = entry.name;
                            projectData._folderHandle = entry;
                            App.state.projects.push(projectData);
                        }
                    } catch (e) {
                        // Cartella senza project.json, ignora
                        console.log(`Cartella "${entry.name}" ignorata (nessun project.json)`);
                    }
                }
            }

            // Ordina progetti per nome
            App.state.projects.sort((a, b) => a.name.localeCompare(b.name));

            // Aggiorna UI
            App.UI.renderProjectList();
            console.log(`Workspace caricato: ${App.state.projects.length} progetti`);

        } catch (err) {
            console.error('Errore caricamento workspace:', err);
            App.Utils.toastError('Errore nel caricamento del workspace');
        }
    },

    // ==================== Project Operations ====================

    /**
     * Crea una nuova cartella progetto
     * @param {string} name - Nome del progetto (sara' anche nome cartella)
     * @returns {Promise<FileSystemDirectoryHandle|null>} Handle della cartella creata
     */
    async createProjectFolder(name) {
        const handle = App.state.workspaceHandle;
        if (!handle) {
            App.Utils.toastError('Nessun workspace aperto');
            return null;
        }

        // Sanifica il nome per usarlo come nome cartella
        const folderName = App.Workspace.sanitizeFolderName(name);

        try {
            // Crea la cartella (create: true la crea se non esiste)
            const folderHandle = await handle.getDirectoryHandle(folderName, { create: true });
            return folderHandle;
        } catch (err) {
            console.error('Errore creazione cartella:', err);
            App.Utils.toastError('Errore nella creazione della cartella progetto');
            return null;
        }
    },

    /**
     * Carica i dati di un progetto dalla sua cartella
     * @param {string} folderName - Nome della cartella
     * @returns {Promise<Object|null>} Dati del progetto
     */
    async loadProjectData(folderName) {
        const handle = App.state.workspaceHandle;
        if (!handle) return null;

        try {
            const folderHandle = await handle.getDirectoryHandle(folderName);
            const fileHandle = await folderHandle.getFileHandle(App.Workspace.PROJECT_FILE);
            const file = await fileHandle.getFile();
            const content = await file.text();
            const data = JSON.parse(content);
            data._folderHandle = folderHandle;
            return data;
        } catch (err) {
            console.error(`Errore caricamento progetto "${folderName}":`, err);
            return null;
        }
    },

    /**
     * Salva i dati di un progetto nella sua cartella
     * @param {Object} project - Progetto da salvare
     * @returns {Promise<boolean>} True se salvato con successo
     */
    async saveProjectData(project) {
        const handle = App.state.workspaceHandle;
        if (!handle || !project) return false;

        const folderName = project.folderName;
        if (!folderName) {
            console.error('Progetto senza folderName:', project.name);
            return false;
        }

        try {
            // Ottieni o crea la cartella
            const folderHandle = await handle.getDirectoryHandle(folderName, { create: true });

            // Prepara i dati da salvare (rimuovi riferimenti interni)
            const dataToSave = App.Workspace.prepareProjectForSave(project);

            // Scrivi il file
            const fileHandle = await folderHandle.getFileHandle(App.Workspace.PROJECT_FILE, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(dataToSave, null, 2));
            await writable.close();

            console.log(`Progetto "${project.name}" salvato in ${folderName}/`);
            return true;
        } catch (err) {
            console.error('Errore salvataggio progetto:', err);
            App.Utils.toastError('Errore nel salvataggio del progetto');
            return false;
        }
    },

    /**
     * Elimina una cartella progetto
     * @param {string} folderName - Nome della cartella da eliminare
     * @returns {Promise<boolean>} True se eliminato con successo
     */
    async deleteProjectFolder(folderName) {
        const handle = App.state.workspaceHandle;
        if (!handle || !folderName) return false;

        try {
            await handle.removeEntry(folderName, { recursive: true });
            console.log(`Cartella "${folderName}" eliminata`);
            return true;
        } catch (err) {
            console.error('Errore eliminazione cartella:', err);
            App.Utils.toastError('Errore nell\'eliminazione della cartella');
            return false;
        }
    },

    /**
     * Rinomina una cartella progetto
     * @param {string} oldName - Nome attuale
     * @param {string} newName - Nuovo nome
     * @returns {Promise<boolean>} True se rinominato con successo
     */
    async renameProjectFolder(oldName, newName) {
        // File System Access API non supporta rename diretto
        // Bisogna creare nuova cartella, copiare contenuto, eliminare vecchia
        const handle = App.state.workspaceHandle;
        if (!handle) return false;

        const sanitizedNewName = App.Workspace.sanitizeFolderName(newName);
        if (sanitizedNewName === oldName) return true; // Stesso nome

        try {
            // Carica dati dal vecchio
            const oldData = await App.Workspace.loadProjectData(oldName);
            if (!oldData) return false;

            // Aggiorna folderName
            oldData.folderName = sanitizedNewName;

            // Crea nuova cartella e salva
            await App.Workspace.createProjectFolder(sanitizedNewName);
            await App.Workspace.saveProjectData(oldData);

            // Elimina vecchia cartella
            await App.Workspace.deleteProjectFolder(oldName);

            return true;
        } catch (err) {
            console.error('Errore rinomina cartella:', err);
            return false;
        }
    },

    // ==================== Migration ====================

    /**
     * Mostra il modal di migrazione
     */
    showMigrationModal() {
        const modal = document.getElementById('migrationModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    /**
     * Nasconde il modal di migrazione
     */
    hideMigrationModal() {
        const modal = document.getElementById('migrationModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    /**
     * Esegue la migrazione dal vecchio formato (file singolo) al nuovo (cartelle)
     * @returns {Promise<number>} Numero di progetti migrati
     */
    async migrateFromV2() {
        const handle = App.state.workspaceHandle;
        if (!handle) return 0;

        try {
            // Leggi il vecchio file
            const fileHandle = await handle.getFileHandle('timesheet_data.json');
            const file = await fileHandle.getFile();
            const content = await file.text();
            const oldData = JSON.parse(content);

            if (oldData._type !== 'timesheet_data' || !Array.isArray(oldData.projects)) {
                App.Utils.toastError('File dati non valido');
                return 0;
            }

            const projects = oldData.projects;
            let migratedCount = 0;

            for (const project of projects) {
                // Sanifica nome per cartella
                const folderName = App.Workspace.sanitizeFolderName(project.name);
                project.folderName = folderName;

                // Migra struttura se necessario
                App.Storage.migrateProjectToMonthlyReports(project);

                // Salva nella nuova cartella
                const saved = await App.Workspace.saveProjectData(project);
                if (saved) {
                    migratedCount++;
                    console.log(`Migrato: ${project.name} -> ${folderName}/`);
                }
            }

            // Rinomina vecchio file come backup
            try {
                // Non possiamo rinominare, ma possiamo creare backup e poi l'utente puo' eliminare
                const backupHandle = await handle.getFileHandle('timesheet_data.json.bak', { create: true });
                const writable = await backupHandle.createWritable();
                await writable.write(content);
                await writable.close();

                // Elimina il file originale
                await handle.removeEntry('timesheet_data.json');
                console.log('File originale spostato in timesheet_data.json.bak');
            } catch (e) {
                console.warn('Impossibile creare backup:', e);
            }

            // Ricarica workspace
            await App.Workspace.loadWorkspace();
            App.Workspace.hideMigrationModal();

            App.Utils.toastSuccess(`Migrazione completata`, `${migratedCount} progetti migrati`);
            return migratedCount;

        } catch (err) {
            console.error('Errore migrazione:', err);
            App.Utils.toastError('Errore durante la migrazione');
            return 0;
        }
    },

    // ==================== UI Helpers ====================

    /**
     * Aggiorna lo stato del workspace nell'header
     */
    updateWorkspaceStatus() {
        const status = document.getElementById('headerFileStatus');
        if (!status) return;

        if (App.state.workspaceHandle) {
            status.className = 'app-file-status-header connected';
            const unsavedIcon = App.state.unsavedChanges
                ? `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--warning);"><circle cx="12" cy="12" r="4" fill="currentColor"></circle></svg>`
                : `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            status.innerHTML = `${unsavedIcon}<span>${App.state.workspacePath}</span>`;
        } else {
            status.className = 'app-file-status-header';
            status.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
                <span>Nessun workspace</span>
            `;
        }
    },

    /**
     * Mostra il banner di riconnessione
     */
    showReconnectBanner() {
        const banner = document.getElementById('reconnectBanner');
        if (banner) {
            const workspaceName = localStorage.getItem('workspace_name') || 'workspace';
            const nameSpan = banner.querySelector('.workspace-name');
            if (nameSpan) nameSpan.textContent = workspaceName;
            banner.classList.remove('hidden');
        }
    },

    /**
     * Nasconde il banner di riconnessione
     */
    hideReconnectBanner() {
        const banner = document.getElementById('reconnectBanner');
        if (banner) {
            banner.classList.add('hidden');
        }
    },

    // ==================== Utility ====================

    /**
     * Sanifica una stringa per usarla come nome cartella
     * @param {string} name - Nome originale
     * @returns {string} Nome sanificato
     */
    sanitizeFolderName(name) {
        // Rimuovi caratteri non validi per nomi cartella Windows/Mac/Linux
        return name
            .replace(/[<>:"/\\|?*]/g, '') // Caratteri non validi
            .replace(/\s+/g, ' ')          // Spazi multipli -> singolo
            .trim()
            .substring(0, 100);            // Limita lunghezza
    },

    /**
     * Prepara un progetto per il salvataggio (rimuove riferimenti interni)
     * @param {Object} project - Progetto originale
     * @returns {Object} Progetto pulito
     */
    prepareProjectForSave(project) {
        // Crea una copia senza riferimenti interni
        const clean = { ...project };

        // Rimuovi handle e altri riferimenti runtime
        delete clean._folderHandle;

        // Aggiungi metadata
        clean._type = 'timesheet_project';
        clean._version = 3;
        clean._lastSaved = new Date().toISOString();

        return clean;
    }
};
