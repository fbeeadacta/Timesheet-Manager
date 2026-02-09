/**
 * App.Utils - Funzioni pure di utilità
 */
App.Utils = {
    /**
     * Toast notification system
     * @param {string} message - Messaggio da mostrare
     * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Durata in ms (default 3000)
     */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            error: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            warning: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
            info: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        toast.innerHTML = `
            ${icons[type] || icons.info}
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;

        container.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    },

    /**
     * Shortcut per toast di successo
     */
    toastSuccess(message, duration) {
        App.Utils.toast(message, 'success', duration);
    },

    /**
     * Shortcut per toast di errore
     */
    toastError(message, duration) {
        App.Utils.toast(message, 'error', duration);
    },

    /**
     * Shortcut per toast di warning
     */
    toastWarning(message, duration) {
        App.Utils.toast(message, 'warning', duration);
    },

    /**
     * Shortcut per toast informativo
     */
    toastInfo(message, duration) {
        App.Utils.toast(message, 'info', duration);
    },

    /**
     * Genera hash univoco per identificare l'attività
     * @param {Object} row - Riga con Data, Collaboratore, Descrizione, ImportoOriginale
     * @returns {string} Hash univoco (es. 'act_abc123')
     */
    generateActivityHash(row) {
        const key = `${row.Data}|${row.Collaboratore}|${row.Descrizione}|${row.ImportoOriginale}`;
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'act_' + Math.abs(hash).toString(36);
    },

    /**
     * Parse tempo in formato HH:MM o decimale e ritorna ore decimali
     * @param {string|number} tempo - Tempo in formato HH:MM o decimale
     * @returns {number} Ore decimali
     */
    parseTempoToHours(tempo) {
        if (!tempo) return 0;
        const str = String(tempo).trim();

        // Formato HH:MM o H:MM
        if (str.includes(':')) {
            const parts = str.split(':');
            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            return hours + (minutes / 60);
        }

        // Formato decimale (es. 2.5 o 2,5)
        return parseFloat(str.replace(',', '.')) || 0;
    },

    /**
     * Scarica un file
     * @param {string} content - Contenuto del file
     * @param {string} filename - Nome del file
     * @param {string} type - MIME type
     */
    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Escape valori per attributi HTML
     * @param {string} str - Stringa da escapare
     * @returns {string} Stringa escapata
     */
    escapeAttr(str) {
        return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    /**
     * Parse data italiana (gg/mm/aaaa) in oggetto Date
     * @param {string} d - Data in formato italiano
     * @returns {Date|null} Oggetto Date o null se invalida
     */
    parseItalianDate(d) {
        if (!d) return null;
        const parts = String(d).split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return null;
    },

    // ==================== MONTH UTILITIES ====================

    /**
     * Nomi dei mesi in italiano
     */
    MONTH_NAMES: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],

    /**
     * Nomi brevi dei mesi in italiano
     */
    MONTH_NAMES_SHORT: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
                        'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],

    /**
     * Estrae il mese in formato YYYY-MM da una data italiana (dd/mm/yyyy)
     * @param {string} dateStr - Data in formato italiano (es. "15/02/2026")
     * @returns {string|null} Mese in formato YYYY-MM (es. "2026-02") o null se invalida
     */
    extractMonthFromDate(dateStr) {
        if (!dateStr) return null;
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}`;
        }
        return null;
    },

    /**
     * Formatta una chiave mese (YYYY-MM) in formato leggibile
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {string} Formato leggibile (es. "Febbraio 2026")
     */
    formatMonthKey(monthKey) {
        if (!monthKey || !monthKey.includes('-')) return monthKey || '';
        const [year, month] = monthKey.split('-');
        const monthIdx = parseInt(month, 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return monthKey;
        return `${this.MONTH_NAMES[monthIdx]} ${year}`;
    },

    /**
     * Formatta una chiave mese in formato breve
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {string} Formato breve (es. "Feb 2026")
     */
    formatMonthKeyShort(monthKey) {
        if (!monthKey || !monthKey.includes('-')) return monthKey || '';
        const [year, month] = monthKey.split('-');
        const monthIdx = parseInt(month, 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return monthKey;
        return `${this.MONTH_NAMES_SHORT[monthIdx]} ${year}`;
    },

    /**
     * Verifica se un mese è nel passato rispetto al mese corrente
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {boolean} True se il mese è nel passato
     */
    isMonthInPast(monthKey) {
        if (!monthKey) return false;
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return monthKey < currentMonthKey;
    },

    /**
     * Verifica se un mese è quello corrente
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {boolean} True se è il mese corrente
     */
    isCurrentMonth(monthKey) {
        if (!monthKey) return false;
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === currentMonthKey;
    },

    /**
     * Ottiene la chiave del mese corrente
     * @returns {string} Chiave mese corrente (es. "2026-02")
     */
    getCurrentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Genera un array di chiavi mese per gli ultimi N mesi (incluso quello corrente)
     * @param {number} count - Numero di mesi da generare (default 12)
     * @returns {Array<string>} Array di chiavi mese in ordine cronologico
     */
    generateMonthRange(count = 12) {
        const months = [];
        const now = new Date();

        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push(key);
        }

        return months;
    },

    /**
     * Ottiene il mese precedente rispetto a una chiave mese
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {string} Chiave mese precedente (es. "2026-01")
     */
    getPreviousMonth(monthKey) {
        if (!monthKey || !monthKey.includes('-')) return null;
        const [year, month] = monthKey.split('-').map(Number);
        const d = new Date(year, month - 2, 1); // month - 1 per 0-based, -1 per precedente
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Ottiene il mese successivo rispetto a una chiave mese
     * @param {string} monthKey - Chiave mese (es. "2026-02")
     * @returns {string} Chiave mese successivo (es. "2026-03")
     */
    getNextMonth(monthKey) {
        if (!monthKey || !monthKey.includes('-')) return null;
        const [year, month] = monthKey.split('-').map(Number);
        const d = new Date(year, month, 1); // month - 1 + 1 = month
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
};
