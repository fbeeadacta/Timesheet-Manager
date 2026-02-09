/**
 * App.UI - Rendering componenti e gestione interfaccia
 */
App.UI = {
    // Tab corrente
    currentTab: 'upload',

    /**
     * Mostra un modal
     * @param {string} id - ID del modal
     */
    showModal(id) {
        document.getElementById(id).classList.remove('hidden');
    },

    /**
     * Nasconde un modal
     * @param {string} id - ID del modal
     */
    hideModal(id) {
        document.getElementById(id).classList.add('hidden');
    },

    /**
     * Toggle sezione sidebar collapsabile
     * @param {string} sectionName - Nome della sezione (projects, clusters, history)
     */
    toggleSection(sectionName) {
        const section = document.querySelector(`[data-section="${sectionName}"]`);
        if (section) {
            section.classList.toggle('collapsed');
        }
    },

    /**
     * Cambia tab attivo
     * @param {string} tabName - Nome del tab (upload, data, summary)
     */
    switchTab(tabName) {
        // Rimuovi active da tutti i tab e panel
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        // Attiva tab e panel selezionato
        const tab = document.querySelector(`[data-tab="${tabName}"]`);
        const panel = document.getElementById(`${tabName}Panel`);

        if (tab) tab.classList.add('active');
        if (panel) panel.classList.add('active');

        this.currentTab = tabName;

        // Se passiamo al tab dati e ci sono dati, forza il render della tabella
        if (tabName === 'data' && App.state.processedData.length > 0) {
            this.renderTable();
            App.Calculator.updateSelectionInfo();
        }
    },

    /**
     * Aggiorna l'header del progetto
     */
    updateProjectHeader() {
        const project = App.state.currentProject;
        if (!project) return;

        document.getElementById('projectTitle').textContent = project.name;

        const calcModeLabels = { 'ore': 'Ore', 'tariffa': 'Tariffa', 'tariffa_collaboratore': 'Tariffa/Consulente' };
        const calcModeLabel = calcModeLabels[project.calcMode] || 'Tariffa';
        document.getElementById('projectMeta').textContent =
            `${project.tariffa} EUR/gg - ${project.oreGiornata}h/gg - Calcolo: ${calcModeLabel}`;
    },

    /**
     * Aggiorna i badge nei tab e nelle sezioni
     */
    updateBadges() {
        const project = App.state.currentProject;
        const data = App.state.processedData;

        // Badge dati
        document.getElementById('dataCountBadge').textContent = data.length;

        if (project) {
            // Badge mese
            const monthBadge = document.getElementById('monthBadge');
            if (monthBadge) {
                monthBadge.textContent = App.Utils.formatMonthKeyShort(App.getWorkingMonthKey());
            }
        }
    },

    /**
     * Aggiorna il conteggio delle attività nello storico (dal mese corrente)
     */
    updateHistoryCount() {
        const project = App.state.currentProject;
        if (!project) return;

        // Conta le attività dal report mensile corrente
        const monthReport = App.getCurrentMonthReport();
        const count = App.countMonthActivities(monthReport);

        const btn = document.getElementById('loadHistoryBtn');
        const countSpan = document.getElementById('historyCount');

        if (count > 0) {
            btn.disabled = false;
            countSpan.textContent = `(${count} attività salvate)`;
        } else {
            btn.disabled = true;
            countSpan.textContent = '(nessuna attività salvata)';
        }
    },

    /**
     * Render della lista progetti
     */
    renderProjectList() {
        const list = document.getElementById('projectList');
        const projects = App.state.projects;
        const currentProject = App.state.currentProject;

        if (projects.length === 0) {
            list.innerHTML = '<li style="color:#7f8c8d; font-size:0.9em; padding:10px;">Nessun progetto</li>';
            return;
        }
        list.innerHTML = projects.map((p, i) => {
            // Conta le attività da tutti i report mensili
            let totalActivities = 0;
            if (p.monthlyReports) {
                Object.values(p.monthlyReports).forEach(report => {
                    totalActivities += Object.values(report.activities || {}).filter(a => a.originalData).length;
                });
            }
            // Fallback per progetti non ancora migrati
            if (totalActivities === 0 && p.activities) {
                totalActivities = Object.keys(p.activities).length;
            }

            return `
                <li class="project-item ${currentProject?.id === p.id ? 'active' : ''}" onclick="openProject('${p.id}')">
                    <div>
                        <div class="name">${p.name}</div>
                        <div class="meta">${p.clusters?.length || 0} cluster - ${totalActivities} attivita</div>
                    </div>
                    <div class="actions" onclick="event.stopPropagation()">
                        <button class="danger small" onclick="deleteProject('${p.id}')">X</button>
                    </div>
                </li>
            `;
        }).join('');
    },

    /**
     * Render della lista cluster (aggiorna filtri e badge)
     */
    renderClusterList() {
        this.updateBadges();
        this.populateFilterDropdowns();
    },

    /**
     * Render dello storico caricamenti (non più usato nella sidebar)
     */
    renderHistory() {
        // Storico rimosso dalla sidebar
        this.updateBadges();
    },

    /**
     * Applica i filtri ai dati e restituisce gli indici delle righe visibili
     * @returns {Array} Array di {idx, row} con indici originali e righe filtrate
     */
    getFilteredData() {
        const data = App.state.processedData;
        const project = App.state.currentProject;

        // Leggi tutti i filtri
        const dateFrom = document.getElementById('filterDateFrom')?.value;
        const dateTo = document.getElementById('filterDateTo')?.value;
        const search = document.getElementById('filterSearch')?.value?.toLowerCase().trim();
        const cluster = document.getElementById('filterCluster')?.value;
        const collaboratore = document.getElementById('filterCollaboratore')?.value;
        const giornateMin = parseFloat(document.getElementById('filterGiornateMin')?.value);
        const giornateMax = parseFloat(document.getElementById('filterGiornateMax')?.value);
        const onlyModified = document.getElementById('filterModified')?.checked;

        const filtered = [];

        data.forEach((row, idx) => {
            // Filtro solo modificate
            if (onlyModified && !row._modified) return;

            // Filtro cluster
            if (cluster) {
                if (cluster === '_unassigned') {
                    if (row._clusterId) return;
                } else if (row._clusterId !== cluster) {
                    return;
                }
            }

            // Filtro collaboratore
            if (collaboratore && row.Collaboratore !== collaboratore) return;

            // Filtro ricerca testo (descrizione)
            if (search && !row.Descrizione?.toLowerCase().includes(search)) return;

            // Filtro range giornate
            if (!isNaN(giornateMin) && row.GiornateEquiv < giornateMin) return;
            if (!isNaN(giornateMax) && row.GiornateEquiv > giornateMax) return;

            // Filtro date
            if (dateFrom || dateTo) {
                const rowDate = App.Utils.parseItalianDate(row.Data);
                if (rowDate) {
                    if (dateFrom) {
                        const from = new Date(dateFrom);
                        if (rowDate < from) return;
                    }
                    if (dateTo) {
                        const to = new Date(dateTo);
                        to.setHours(23, 59, 59, 999); // Include tutto il giorno
                        if (rowDate > to) return;
                    }
                }
            }

            filtered.push({ idx, row });
        });

        return filtered;
    },

    /**
     * Popola i dropdown dei filtri con valori unici dai dati
     */
    populateFilterDropdowns() {
        const data = App.state.processedData;
        const project = App.state.currentProject;

        // Popola select cluster
        const clusterSelect = document.getElementById('filterCluster');
        if (clusterSelect && project) {
            const currentValue = clusterSelect.value;
            clusterSelect.innerHTML = '<option value="">Tutti</option>';
            clusterSelect.innerHTML += '<option value="_unassigned">Non assegnate</option>';

            if (project.clusters) {
                project.clusters.forEach(c => {
                    clusterSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                });
            }

            // Ripristina valore se ancora valido
            if (currentValue && clusterSelect.querySelector(`option[value="${currentValue}"]`)) {
                clusterSelect.value = currentValue;
            }
        }

        // Popola select collaboratore
        const collabSelect = document.getElementById('filterCollaboratore');
        if (collabSelect) {
            const currentValue = collabSelect.value;
            const collaboratori = [...new Set(data.map(r => r.Collaboratore).filter(Boolean))].sort();

            collabSelect.innerHTML = '<option value="">Tutti</option>';
            collaboratori.forEach(c => {
                collabSelect.innerHTML += `<option value="${c}">${c}</option>`;
            });

            // Ripristina valore se ancora valido
            if (currentValue && collabSelect.querySelector(`option[value="${currentValue}"]`)) {
                collabSelect.value = currentValue;
            }
        }
    },

    /**
     * Aggiorna il badge del pannello filtri
     */
    updateFilterBadge() {
        const total = App.state.processedData.length;
        const filtered = this.getFilteredData().length;
        const badge = document.getElementById('filterBadge');

        if (!badge) return;

        if (filtered < total) {
            badge.textContent = `Visualizzate ${filtered} di ${total}`;
            badge.className = 'filter-badge active';
        } else {
            badge.textContent = `Tutti (${total})`;
            badge.className = 'filter-badge';
        }
    },

    /**
     * Verifica se ci sono filtri attivi
     * @returns {boolean}
     */
    hasActiveFilters() {
        const dateFrom = document.getElementById('filterDateFrom')?.value;
        const dateTo = document.getElementById('filterDateTo')?.value;
        const search = document.getElementById('filterSearch')?.value?.trim();
        const cluster = document.getElementById('filterCluster')?.value;
        const collaboratore = document.getElementById('filterCollaboratore')?.value;
        const giornateMin = document.getElementById('filterGiornateMin')?.value;
        const giornateMax = document.getElementById('filterGiornateMax')?.value;
        const onlyModified = document.getElementById('filterModified')?.checked;

        return !!(dateFrom || dateTo || search || cluster || collaboratore ||
                  giornateMin || giornateMax || onlyModified);
    },

    /**
     * Aggiorna il contatore dei filtri (supporta sia vecchio che nuovo formato)
     */
    updateFilterCount() {
        // Aggiorna il nuovo badge nel pannello collassabile
        this.updateFilterBadge();

        // Supporto retrocompatibile per il vecchio filter-count
        const total = App.state.processedData.length;
        const filtered = this.getFilteredData().length;
        const countEl = document.getElementById('filterCount');

        if (!countEl) return;

        if (filtered < total) {
            countEl.textContent = `Visualizzate ${filtered} di ${total}`;
            countEl.className = 'filter-count active';
        } else {
            countEl.textContent = '';
            countEl.className = 'filter-count';
        }
    },

    /**
     * Render della tabella attività
     */
    renderTable() {
        const container = document.getElementById('dataContent');
        const filteredData = this.getFilteredData();
        const selected = App.state.selectedRows;
        const project = App.state.currentProject;

        this.updateFilterCount();

        if (filteredData.length === 0 && App.state.processedData.length > 0) {
            container.innerHTML = `<div class="empty-state" style="padding:30px;">
                <p>Nessuna attivita corrisponde ai filtri selezionati</p>
            </div>`;
            return;
        }

        // Calcola i totali delle righe filtrate
        let totalGiornate = 0;
        let totalValore = 0;
        filteredData.forEach(({ row }) => {
            totalGiornate += row.GiornateEquiv || 0;
            totalValore += row.Importo || 0;
        });

        let html = `<div class="table-container"><table>
            <tr>
                <th class="checkbox-cell"><input type="checkbox" onchange="this.checked ? selectAll() : selectNone()"></th>
                <th>Data</th>
                <th>Cluster</th>
                <th>Incarico</th>
                <th>Collaboratore</th>
                <th>Descrizione</th>
                <th class="text-right">Tempo</th>
                <th class="text-right">Giornate</th>
                <th class="text-right">Valore</th>
            </tr>
            <tr class="totals-row">
                <td class="checkbox-cell"></td>
                <td colspan="6"><strong>TOTALE (${filteredData.length} attivita)</strong></td>
                <td class="text-right"><strong>${totalGiornate.toFixed(2)}</strong></td>
                <td class="text-right"><strong>${totalValore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</strong></td>
            </tr>`;

        filteredData.forEach(({ idx, row }) => {
            const isSelected = selected.has(idx);
            const cluster = project.clusters.find(c => c.id === row._clusterId);
            const clusterHtml = cluster
                ? `<span class="cluster-tag" style="background:${cluster.color}" onclick="showClusterDropdown(event, ${idx})">${cluster.name}</span>`
                : `<span class="cluster-tag unassigned" onclick="showClusterDropdown(event, ${idx})">+ Assegna</span>`;

            const badges = [];
            if (row._isNew) badges.push('<span class="badge-new">NUOVA</span>');
            if (row._modified) badges.push('<span class="badge-modified">MOD</span>');

            const escapeAttr = App.Utils.escapeAttr;
            const valore = row.Importo || 0;

            html += `<tr class="${row._modified ? 'modified' : ''}">
                <td class="checkbox-cell">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleRow(${idx}, this.checked)">
                </td>
                <td>
                    <input type="text" class="editable-input medium" value="${escapeAttr(row.Data)}"
                           onchange="updateField(${idx}, 'Data', this.value)" title="Data">
                    ${badges.join('')}
                </td>
                <td>${clusterHtml}</td>
                <td>
                    <input type="text" class="editable-input" value="${escapeAttr(row.Incarico)}"
                           onchange="updateField(${idx}, 'Incarico', this.value)" title="Incarico">
                </td>
                <td>
                    <input type="text" class="editable-input" value="${escapeAttr(row.Collaboratore)}"
                           onchange="updateField(${idx}, 'Collaboratore', this.value)" title="Collaboratore">
                </td>
                <td style="max-width:300px;">
                    <input type="text" class="editable-input" value="${escapeAttr(row.Descrizione)}"
                           onchange="updateField(${idx}, 'Descrizione', this.value)" title="${escapeAttr(row.Descrizione)}">
                </td>
                <td class="text-right">
                    <input type="text" class="editable-input text-right narrow" value="${escapeAttr(row.Tempo)}"
                           onchange="updateFieldTempo(${idx}, this.value)" title="Tempo (HH:MM o ore decimali) - modifica per ricalcolare giornate">
                </td>
                <td class="text-right">
                    <div class="editable-wrapper">
                        ${row._modified && row._originalGiornate !== undefined ? `<span class="original-value">${row._originalGiornate.toFixed(2)}</span>` : ''}
                        ${row._rateError ? '<span class="rate-error-icon" title="Tariffa collaboratore non impostata">&#9888;</span>' : ''}
                        <input type="number" class="editable-input text-right narrow" step="0.01"
                               value="${row.GiornateEquiv.toFixed(2)}"
                               onchange="updateFieldGiornate(${idx}, this.value)" title="Giornate">
                    </div>
                </td>
                <td class="text-right">
                    <div class="editable-wrapper">
                        ${row._modified && row._originalImporto !== undefined ? `<span class="original-value">${row._originalImporto.toFixed(2)}</span>` : ''}
                        <span class="value-display">${valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </td>
            </tr>`;
        });

        html += '</table></div>';
        container.innerHTML = html;
    },

    /**
     * Setup della drop zone per upload file
     */
    setupDropZone() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleFile(e.target.files[0]);
        });
    },

    // ==================== MONTH SELECTOR ====================

    /**
     * Render del selettore mesi (mini-calendario)
     */
    renderMonthSelector() {
        const container = document.getElementById('monthSelector');
        if (!container) return;

        const project = App.state.currentProject;
        if (!project) {
            container.innerHTML = '<div style="color:#7f8c8d; font-size:0.85em;">Seleziona un progetto</div>';
            return;
        }

        const workingMonth = App.getWorkingMonthKey();
        const months = App.Utils.generateMonthRange(12);
        const monthsWithData = App.getMonthsWithData();

        let html = '<div class="month-grid">';

        months.forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthIdx = parseInt(month, 10) - 1;
            const shortName = App.Utils.MONTH_NAMES_SHORT[monthIdx];

            const report = App.getMonthReport(monthKey);
            const hasData = monthsWithData.includes(monthKey);
            const isClosed = report?.status === 'closed';
            const isPast = App.Utils.isMonthInPast(monthKey);
            const isCurrent = App.Utils.isCurrentMonth(monthKey);
            const isSelected = monthKey === workingMonth;

            // Costruisci classi CSS
            let classes = ['month-cell'];
            if (isSelected) classes.push('selected');
            if (hasData) classes.push('has-data');
            if (isClosed) classes.push('closed');
            if (isPast) classes.push('past');
            if (isCurrent) classes.push('current');

            // Conta attività
            const actCount = hasData ? App.countMonthActivities(report) : 0;

            html += `
                <div class="${classes.join(' ')}" onclick="selectWorkingMonth('${monthKey}')" title="${App.Utils.formatMonthKey(monthKey)}${hasData ? ' - ' + actCount + ' attività' : ''}${isClosed ? ' (Chiuso)' : ''}">
                    <span class="month-name">${shortName}</span>
                    <span class="month-year">${year}</span>
                    ${hasData ? '<span class="month-dot"></span>' : ''}
                    ${isClosed ? '<span class="month-lock">🔒</span>' : ''}
                </div>
            `;
        });

        html += '</div>';

        // Pulsante chiudi/riapri mese
        const currentReport = App.getCurrentMonthReport();
        const hasActivities = currentReport && App.countMonthActivities(currentReport) > 0;
        const isClosed = currentReport?.status === 'closed';

        if (isClosed) {
            // Mese chiuso: mostra pulsante per riaprire
            html += `
                <div class="month-actions">
                    <button class="small warning" onclick="reopenCurrentMonth()">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                        </svg>
                        Riapri Mese
                    </button>
                </div>
            `;
        } else {
            // Mese aperto: mostra pulsante per chiudere
            const canClose = hasActivities;
            html += `
                <div class="month-actions">
                    <button class="small ${canClose ? '' : 'secondary'}" onclick="closeCurrentMonth()" ${canClose ? '' : 'disabled'}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        Chiudi Mese
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * Aggiorna il selettore mesi (wrapper per refresh)
     */
    updateMonthSelector() {
        this.renderMonthSelector();
    },

    /**
     * Aggiorna l'header del progetto con indicatore mese
     */
    updateProjectHeader() {
        const project = App.state.currentProject;
        if (!project) return;

        document.getElementById('projectTitle').textContent = project.name;

        const calcModeLabels = { 'ore': 'Ore', 'tariffa': 'Tariffa', 'tariffa_collaboratore': 'Tariffa/Consulente' };
        const calcModeLabel = calcModeLabels[project.calcMode] || 'Tariffa';
        const monthLabel = App.Utils.formatMonthKey(App.getWorkingMonthKey());

        // Verifica stato mese
        const report = App.getCurrentMonthReport();
        const isClosed = report?.status === 'closed';
        const isPast = App.Utils.isMonthInPast(App.getWorkingMonthKey());

        let monthStatus = '';
        if (isClosed) {
            monthStatus = ' <span class="month-status closed">🔒 Chiuso</span>';
        } else if (isPast) {
            monthStatus = ' <span class="month-status past">⚠️ Passato</span>';
        }

        document.getElementById('projectMeta').innerHTML =
            `${project.tariffa} EUR/gg - ${project.oreGiornata}h/gg - Calcolo: ${calcModeLabel} | <strong>${monthLabel}</strong>${monthStatus}`;
    }
};
