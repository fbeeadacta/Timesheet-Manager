/**
 * App - Namespace principale dell'applicazione Elaborazione Timesheet
 *
 * Struttura:
 * - App.state: Stato centralizzato dell'applicazione
 * - App.Utils: Funzioni pure di utilità
 * - App.Storage: Gestione persistenza (localStorage + File System API)
 * - App.Calculator: Calcoli e statistiche
 * - App.UI: Rendering componenti
 * - App.Exporter: Export JSON/CSV/Excel
 * - App.Actions: Coordinatore azioni utente
 */
const App = {
    // ==================== STATE ====================
    state: {
        projects: [],
        currentProject: null,
        processedData: [],
        selectedRows: new Set(),
        clusterDropdown: null,
        fileHandle: null,           // Legacy: handle file singolo (deprecato)
        unsavedChanges: false,
        workingMonth: null,         // Mese di lavoro selezionato (es. "2026-02")
        // Nuovo sistema workspace
        workspaceHandle: null,      // DirectoryHandle workspace
        workspacePath: null,        // Nome/path workspace per riferimento
        lastOpenedProject: null     // ID ultimo progetto aperto (per ripristino)
    },

    /**
     * Inizializzazione dell'applicazione
     */
    init() {
        // Carica da localStorage come fallback iniziale
        try {
            App.state.projects = JSON.parse(localStorage.getItem('timesheet_projects') || '[]');
            if (!Array.isArray(App.state.projects)) App.state.projects = [];
        } catch (e) {
            console.error('Errore lettura localStorage:', e);
            App.state.projects = [];
        }
    },

    // ==================== MONTHLY REPORT HELPERS ====================

    /**
     * Ottiene la chiave del mese di lavoro corrente
     * Se non impostato, usa il mese corrente
     * @returns {string} Chiave mese (es. "2026-02")
     */
    getWorkingMonthKey() {
        if (App.state.workingMonth) {
            return App.state.workingMonth;
        }
        // Default: mese corrente
        return App.Utils.getCurrentMonthKey();
    },

    /**
     * Imposta il mese di lavoro corrente
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     */
    setWorkingMonth(monthKey) {
        App.state.workingMonth = monthKey;
    },

    /**
     * Ottiene il report del mese di lavoro corrente per il progetto attuale
     * Se non esiste, lo crea
     * @returns {Object|null} Report mensile o null se nessun progetto selezionato
     */
    getCurrentMonthReport() {
        const project = App.state.currentProject;
        if (!project) return null;

        const monthKey = App.getWorkingMonthKey();

        // Assicurati che monthlyReports esista
        if (!project.monthlyReports) {
            project.monthlyReports = {};
        }

        // Crea il report del mese se non esiste
        if (!project.monthlyReports[monthKey]) {
            project.monthlyReports[monthKey] = {
                status: 'open',
                activities: {},
                history: []
            };
        }

        return project.monthlyReports[monthKey];
    },

    /**
     * Ottiene il report di uno specifico mese
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {Object|null} Report mensile o null se non esiste
     */
    getMonthReport(monthKey) {
        const project = App.state.currentProject;
        if (!project || !project.monthlyReports) return null;
        return project.monthlyReports[monthKey] || null;
    },

    /**
     * Verifica se il mese di lavoro è chiuso
     * @returns {boolean} True se il mese è chiuso
     */
    isWorkingMonthClosed() {
        const report = App.getCurrentMonthReport();
        return report ? report.status === 'closed' : false;
    },

    /**
     * Verifica se il mese di lavoro è nel passato
     * @returns {boolean} True se il mese è nel passato
     */
    isWorkingMonthInPast() {
        return App.Utils.isMonthInPast(App.getWorkingMonthKey());
    },

    /**
     * Conta le attività in un report mensile
     * @param {Object} report - Report mensile
     * @returns {number} Numero di attività
     */
    countMonthActivities(report) {
        if (!report || !report.activities) return 0;
        return Object.values(report.activities).filter(a => a.originalData).length;
    },

    /**
     * Ottiene tutti i mesi con dati per il progetto corrente
     * @returns {Array<string>} Array di chiavi mese ordinate
     */
    getMonthsWithData() {
        const project = App.state.currentProject;
        if (!project || !project.monthlyReports) return [];

        return Object.keys(project.monthlyReports)
            .filter(key => App.countMonthActivities(project.monthlyReports[key]) > 0)
            .sort();
    }
};

// I moduli vengono aggiunti nei file successivi:
// - js/utils.js -> App.Utils
// - js/storage.js -> App.Storage
// - js/calculator.js -> App.Calculator
// - js/ui.js -> App.UI
// - js/exporter.js -> App.Exporter
// - js/actions.js -> App.Actions
