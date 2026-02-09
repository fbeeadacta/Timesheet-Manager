/**
 * App.Calculator - Calcoli, statistiche e arrotondamenti
 */
App.Calculator = {
    /**
     * Restituisce gli indici delle righe attualmente visibili (filtrate)
     * @returns {Set} Set di indici visibili
     */
    getVisibleIndices() {
        const filtered = App.UI.getFilteredData();
        return new Set(filtered.map(item => item.idx));
    },

    /**
     * Restituisce gli indici delle righe selezionate E visibili
     * @returns {Set} Set di indici selezionati e visibili
     */
    getSelectedVisibleIndices() {
        const visible = this.getVisibleIndices();
        const selected = App.state.selectedRows;
        const result = new Set();
        selected.forEach(idx => {
            if (visible.has(idx)) {
                result.add(idx);
            }
        });
        return result;
    },

    /**
     * Calcola giornate equivalenti da importo
     * @param {number} importo - Importo in EUR
     * @param {number} tariffa - Tariffa giornaliera
     * @returns {number} Giornate equivalenti
     */
    computeGiornate(importo, tariffa) {
        return importo / tariffa;
    },

    /**
     * Calcola ore equivalenti da giornate
     * @param {number} giornate - Numero di giornate
     * @param {number} oreGiornata - Ore per giornata
     * @returns {number} Ore equivalenti
     */
    computeOre(giornate, oreGiornata) {
        return giornate * oreGiornata;
    },

    /**
     * Calcola importo da giornate
     * @param {number} giornate - Numero di giornate
     * @param {number} tariffa - Tariffa giornaliera
     * @returns {number} Importo in EUR
     */
    computeImporto(giornate, tariffa) {
        return giornate * tariffa;
    },

    /**
     * Calcola i totali delle attività (filtrate)
     * @returns {Object} Totali { importo, giornate, nuove, righe }
     */
    computeTotals() {
        const filtered = App.UI.getFilteredData();
        return {
            importo: filtered.reduce((s, item) => s + item.row.Importo, 0),
            giornate: filtered.reduce((s, item) => s + item.row.GiornateEquiv, 0),
            nuove: filtered.filter(item => item.row._isNew).length,
            righe: filtered.length
        };
    },

    /**
     * Calcola i totali delle righe selezionate (tra quelle visibili/filtrate)
     * @returns {Object} Totali { count, giornate }
     */
    computeSelectedTotals() {
        const data = App.state.processedData;
        const selectedVisible = this.getSelectedVisibleIndices();
        let count = 0;
        let giornate = 0;
        selectedVisible.forEach(idx => {
            count++;
            giornate += data[idx].GiornateEquiv;
        });
        return { count, giornate };
    },

    /**
     * Aggiorna le statistiche nella UI
     */
    updateStats() {
        const totals = App.Calculator.computeTotals();
        document.getElementById('statRighe').textContent = totals.righe;
        document.getElementById('statImporto').textContent = totals.importo.toLocaleString('it-IT', { maximumFractionDigits: 0 });
        document.getElementById('statGiornate').textContent = totals.giornate.toFixed(2);
        document.getElementById('statNuove').textContent = totals.nuove;
    },

    /**
     * Aggiorna le info di selezione nella UI
     */
    updateSelectionInfo() {
        const totals = App.Calculator.computeTotals();
        const selectedTotals = App.Calculator.computeSelectedTotals();

        document.getElementById('grandTotal').textContent = totals.giornate.toFixed(2);
        document.getElementById('selectedCount').textContent = selectedTotals.count;
        document.getElementById('selectedTotal').textContent = selectedTotals.giornate.toFixed(2);
        document.getElementById('applyRoundingBtn').disabled = selectedTotals.count === 0;

        App.Calculator.updateDiffDisplay();
        App.Calculator.updateToolsUI();
    },

    /**
     * Aggiorna il display della differenza
     */
    updateDiffDisplay() {
        const input = document.getElementById('newTotal');
        const display = document.getElementById('diffDisplay');
        const totals = App.Calculator.computeTotals();

        if (input.value) {
            const newTotal = parseFloat(input.value);
            const diff = newTotal - totals.giornate;
            const sign = diff >= 0 ? '+' : '';
            display.innerHTML = `<span class="${diff >= 0 ? 'diff-positive' : 'diff-negative'}">${sign}${diff.toFixed(2)}</span>`;
        } else {
            display.textContent = '-';
        }
    },

    /**
     * Ottiene la tariffa corretta per una riga in base al calcMode
     * @param {Object} row - Riga attività (deve avere .Collaboratore)
     * @param {Object} project - Progetto
     * @returns {number|null} Tariffa o null se non disponibile (errore)
     */
    getRateForRow(row, project) {
        if (project.calcMode === 'tariffa_collaboratore') {
            const rates = project.collaboratorRates || {};
            const rate = rates[row.Collaboratore];
            return (rate !== undefined && rate !== null && rate > 0) ? rate : null;
        }
        return project.tariffa;
    },

    /**
     * Calcola giornate in base al calcMode del progetto
     * @param {Object} row - Riga attività
     * @param {Object} project - Progetto
     * @returns {Object} { giornate, ore, _rateError }
     */
    computeByMode(row, project) {
        const calcMode = project.calcMode || 'tariffa';
        const oreGiornata = project.oreGiornata;

        if (calcMode === 'ore') {
            const ore = App.Utils.parseTempoToHours(row.Tempo);
            return {
                giornate: ore / oreGiornata,
                ore: ore
            };
        } else if (calcMode === 'tariffa_collaboratore') {
            const rate = this.getRateForRow(row, project);
            if (rate === null) {
                return { giornate: 0, ore: 0, _rateError: true };
            }
            const giornate = row.ImportoOriginale / rate;
            return {
                giornate: giornate,
                ore: giornate * oreGiornata
            };
        } else {
            const giornate = row.ImportoOriginale / project.tariffa;
            return {
                giornate: giornate,
                ore: giornate * oreGiornata
            };
        }
    },

    /**
     * Ricalcola tutti i valori dopo cambio tariffa/ore/calcMode
     */
    recalculateAll() {
        const project = App.state.currentProject;
        if (!project) return;

        const oreGiornata = project.oreGiornata;

        App.state.processedData.forEach(row => {
            const rate = App.Calculator.getRateForRow(row, project) || project.tariffa;
            if (row._modified && row._originalGiornate !== undefined) {
                // Mantieni le giornate modificate, ricalcola importo e ore
                row.OreEquiv = App.Calculator.computeOre(row.GiornateEquiv, oreGiornata);
                row.Importo = App.Calculator.computeImporto(row.GiornateEquiv, rate);

                // Ricalcola anche i valori originali in base al nuovo calcMode
                const origCalc = App.Calculator.computeByMode(row, project);
                row._originalGiornate = origCalc.giornate;
                row._originalOre = origCalc.ore;
                row._originalImporto = row.ImportoOriginale;
            } else {
                // Ricalcola in base al calcMode
                const calc = App.Calculator.computeByMode(row, project);
                row.GiornateEquiv = calc.giornate;
                row.OreEquiv = calc.ore;
                row.Importo = row.ImportoOriginale;
                row._rateError = calc._rateError || false;
            }
        });

        App.Calculator.updateStats();
        App.UI.renderTable();
        App.Calculator.updateSelectionInfo();
    },

    /**
     * Applica arrotondamento top-down alle righe selezionate (tra quelle visibili)
     * @param {number} newGrandTotal - Nuovo totale desiderato (per le righe filtrate)
     */
    applyRounding(newGrandTotal) {
        const project = App.state.currentProject;
        const selectedVisible = this.getSelectedVisibleIndices();
        if (!project || isNaN(newGrandTotal) || selectedVisible.size === 0) return;

        const oreGiornata = project.oreGiornata;
        const data = App.state.processedData;

        // Calcola il totale corrente delle righe FILTRATE (non tutte)
        const currentGrandTotal = this.computeTotals().giornate;
        const diff = newGrandTotal - currentGrandTotal;

        const selectedIndices = Array.from(selectedVisible);
        const selectedTotal = selectedIndices.reduce((s, i) => s + data[i].GiornateEquiv, 0);
        if (selectedTotal === 0) return;

        const newSelectedTotal = selectedTotal + diff;
        const ratio = newSelectedTotal / selectedTotal;

        selectedIndices.forEach(i => {
            const row = data[i];
            if (!row._modified) {
                const origCalc = App.Calculator.computeByMode(row, project);
                row._originalGiornate = origCalc.giornate;
                row._originalOre = origCalc.ore;
                row._originalImporto = row.ImportoOriginale;
            }

            const rate = App.Calculator.getRateForRow(row, project) || project.tariffa;
            row.GiornateEquiv = row.GiornateEquiv * ratio;
            row.OreEquiv = App.Calculator.computeOre(row.GiornateEquiv, oreGiornata);
            row.Importo = App.Calculator.computeImporto(row.GiornateEquiv, rate);
            row._modified = true;

            // Salva nel progetto
            saveActivityState(row);
        });

        App.Storage.save();
        App.Calculator.updateStats();
        App.UI.renderTable();
        App.Calculator.updateSelectionInfo();
    },

    /**
     * Reset alle giornate originali (usa restoreAllRows internamente)
     */
    resetToOriginal() {
        App.Calculator.restoreAllRows();
    },

    // ==================== NUOVI STRUMENTI ====================

    /**
     * Aggiorna l'interfaccia di tutti gli strumenti
     */
    updateToolsUI() {
        App.Calculator.updateUniformToolUI();
        App.Calculator.updateRestoreToolUI();
        App.Calculator.updateExcessToolUI();
    },

    /**
     * Aggiorna UI strumento distribuzione uniforme
     */
    updateUniformToolUI() {
        const selectedVisibleCount = this.getSelectedVisibleIndices().size;
        const uniformTotalInput = document.getElementById('uniformTotal');
        const uniformSelectedCount = document.getElementById('uniformSelectedCount');
        const uniformValueEach = document.getElementById('uniformValueEach');
        const applyUniformBtn = document.getElementById('applyUniformBtn');

        if (!uniformSelectedCount) return;

        uniformSelectedCount.textContent = selectedVisibleCount;

        if (selectedVisibleCount > 0 && uniformTotalInput && uniformTotalInput.value) {
            const total = parseFloat(uniformTotalInput.value) || 0;
            const valueEach = total / selectedVisibleCount;
            uniformValueEach.textContent = valueEach.toFixed(2) + ' gg';
            applyUniformBtn.disabled = false;
        } else {
            uniformValueEach.textContent = '-';
            applyUniformBtn.disabled = true;
        }
    },

    /**
     * Aggiorna UI strumento ripristina valori
     */
    updateRestoreToolUI() {
        const modifiedTotalCount = document.getElementById('modifiedTotalCount');
        const modifiedSelectedCount = document.getElementById('modifiedSelectedCount');
        const modifiedList = document.getElementById('modifiedList');
        const restoreSelectedBtn = document.getElementById('restoreSelectedBtn');
        const restoreAllBtn = document.getElementById('restoreAllBtn');

        if (!modifiedTotalCount) return;

        const data = App.state.processedData;
        const visible = this.getVisibleIndices();
        const selectedVisible = this.getSelectedVisibleIndices();

        // Trova le righe modificate tra quelle VISIBILI
        const visibleModified = [];
        visible.forEach(idx => {
            if (data[idx]._modified) {
                visibleModified.push({ idx, row: data[idx] });
            }
        });

        // Trova le righe modificate tra le selezionate E visibili
        const selectedModified = [];
        selectedVisible.forEach(idx => {
            if (data[idx]._modified) {
                selectedModified.push({ idx, row: data[idx] });
            }
        });

        modifiedTotalCount.textContent = visibleModified.length;
        modifiedSelectedCount.textContent = selectedModified.length;

        // Abilita/disabilita pulsanti
        restoreSelectedBtn.disabled = selectedModified.length === 0;
        restoreAllBtn.disabled = visibleModified.length === 0;

        // Mostra lista delle righe modificate visibili (max 5, poi "e altre N...")
        if (visibleModified.length === 0) {
            modifiedList.innerHTML = '<div class="tool-message empty">Nessuna attività modificata (tra quelle filtrate)</div>';
        } else {
            const displayItems = visibleModified.slice(0, 5);
            let html = '';
            displayItems.forEach(item => {
                const row = item.row;
                const originalGg = row._originalGiornate !== undefined ? row._originalGiornate.toFixed(2) : '?';
                html += `<div class="modified-item">
                    <span class="modified-label" title="${row.Descrizione}">${row.Collaboratore} - ${row.Descrizione.substring(0, 20)}${row.Descrizione.length > 20 ? '...' : ''}</span>
                    <span class="modified-values">
                        <span class="modified-original">${originalGg}gg</span>
                        <span class="modified-arrow">&rarr;</span>
                        <span class="modified-current">${row.GiornateEquiv.toFixed(2)}gg</span>
                    </span>
                </div>`;
            });
            if (visibleModified.length > 5) {
                html += `<div class="tool-message info">...e altre ${visibleModified.length - 5} righe modificate</div>`;
            }
            modifiedList.innerHTML = html;
        }
    },

    /**
     * Aggiorna UI strumento redistribuzione eccedenze
     */
    updateExcessToolUI() {
        const excessItems = App.Calculator.findExcessActivities();
        const excessCount = document.getElementById('excessCount');
        const excessTotal = document.getElementById('excessTotal');
        const excessList = document.getElementById('excessList');
        const redistributeBtn = document.getElementById('redistributeExcessBtn');

        if (!excessCount) return;

        const totalExcess = excessItems.reduce((sum, item) => sum + item.excess, 0);

        excessCount.textContent = excessItems.length;
        excessTotal.textContent = totalExcess.toFixed(2);

        if (excessItems.length === 0) {
            excessList.innerHTML = '<div class="tool-message empty">Nessuna attività selezionata con eccedenza (&gt;1gg)</div>';
            redistributeBtn.disabled = true;
        } else {
            // Verifica che ci siano altre righe selezionate (e visibili) su cui redistribuire
            const selectedVisibleCount = this.getSelectedVisibleIndices().size;
            const otherSelected = selectedVisibleCount - excessItems.length;

            if (otherSelected <= 0) {
                excessList.innerHTML = '<div class="tool-message warning">Seleziona altre righe su cui redistribuire l\'eccedenza</div>';
                redistributeBtn.disabled = true;
            } else {
                let html = '';
                excessItems.forEach(item => {
                    html += `<div class="excess-item">
                        <span class="excess-label" title="${item.row.Descrizione}">${item.row.Collaboratore} - ${item.row.Descrizione.substring(0, 25)}${item.row.Descrizione.length > 25 ? '...' : ''}</span>
                        <span class="excess-value">${item.row.GiornateEquiv.toFixed(2)}gg</span>
                        <span class="excess-excess">(+${item.excess.toFixed(2)})</span>
                    </div>`;
                });
                excessList.innerHTML = html;
                redistributeBtn.disabled = false;
            }
        }
    },

    /**
     * Trova le attività selezionate (e visibili) con GiornateEquiv > 1
     * @returns {Array} Array di { idx, row, excess }
     */
    findExcessActivities() {
        const data = App.state.processedData;
        const selectedVisible = this.getSelectedVisibleIndices();
        const result = [];

        selectedVisible.forEach(idx => {
            const row = data[idx];
            if (row.GiornateEquiv > 1) {
                result.push({
                    idx: idx,
                    row: row,
                    excess: row.GiornateEquiv - 1
                });
            }
        });

        return result;
    },

    /**
     * Applica distribuzione uniforme alle righe selezionate (tra quelle visibili)
     * @param {number} total - Totale da distribuire
     */
    applyUniformDistribution(total) {
        const project = App.state.currentProject;
        const selectedVisible = this.getSelectedVisibleIndices();
        if (!project || isNaN(total) || selectedVisible.size === 0) return;

        const oreGiornata = project.oreGiornata;
        const data = App.state.processedData;
        const valueEach = total / selectedVisible.size;

        selectedVisible.forEach(idx => {
            const row = data[idx];
            if (!row._modified) {
                const origCalc = App.Calculator.computeByMode(row, project);
                row._originalGiornate = origCalc.giornate;
                row._originalOre = origCalc.ore;
                row._originalImporto = row.ImportoOriginale;
            }

            const rate = App.Calculator.getRateForRow(row, project) || project.tariffa;
            row.GiornateEquiv = valueEach;
            row.OreEquiv = App.Calculator.computeOre(row.GiornateEquiv, oreGiornata);
            row.Importo = App.Calculator.computeImporto(row.GiornateEquiv, rate);
            row._modified = true;

            saveActivityState(row);
        });

        App.Storage.save();
        App.Calculator.updateStats();
        App.UI.renderTable();
        App.Calculator.updateSelectionInfo();
    },

    /**
     * Ripristina i valori originali delle righe selezionate (e visibili) modificate
     */
    restoreSelectedRows() {
        const project = App.state.currentProject;
        if (!project) return;

        const data = App.state.processedData;
        const selectedVisible = this.getSelectedVisibleIndices();
        let restoredCount = 0;

        selectedVisible.forEach(idx => {
            const row = data[idx];
            if (row._modified) {
                App.Calculator.restoreRow(row, project);
                restoredCount++;
            }
        });

        if (restoredCount > 0) {
            App.Storage.save();
            App.Calculator.updateStats();
            App.UI.renderTable();
            App.Calculator.updateSelectionInfo();
        }

        return restoredCount;
    },

    /**
     * Ripristina i valori originali di tutte le righe modificate (tra quelle visibili)
     */
    restoreAllRows() {
        const project = App.state.currentProject;
        if (!project) return;

        const data = App.state.processedData;
        const visible = this.getVisibleIndices();
        let restoredCount = 0;

        visible.forEach(idx => {
            const row = data[idx];
            if (row._modified) {
                App.Calculator.restoreRow(row, project);
                restoredCount++;
            }
        });

        if (restoredCount > 0) {
            App.Storage.save();
            App.Calculator.updateStats();
            App.UI.renderTable();
            App.Calculator.updateSelectionInfo();
        }

        return restoredCount;
    },

    /**
     * Ripristina una singola riga ai valori originali
     * @param {Object} row - Riga da ripristinare
     * @param {Object} project - Progetto corrente
     */
    restoreRow(row, project) {
        // Reset giornate in base al calcMode
        const calc = App.Calculator.computeByMode(row, project);
        row.GiornateEquiv = calc.giornate;
        row.OreEquiv = calc.ore;
        row.Importo = row.ImportoOriginale;
        row._rateError = calc._rateError || false;

        // Reset text fields
        if (row._originalData !== undefined) {
            row.Data = row._originalData;
            delete row._originalData;
        }
        if (row._originalIncarico !== undefined) {
            row.Incarico = row._originalIncarico;
            delete row._originalIncarico;
        }
        if (row._originalCollaboratore !== undefined) {
            row.Collaboratore = row._originalCollaboratore;
            delete row._originalCollaboratore;
        }
        if (row._originalDescrizione !== undefined) {
            row.Descrizione = row._originalDescrizione;
            delete row._originalDescrizione;
        }
        if (row._originalTempo !== undefined) {
            row.Tempo = row._originalTempo;
            delete row._originalTempo;
        }

        row._modified = false;
        delete row._originalGiornate;
        delete row._originalOre;
        delete row._originalImporto;

        // Rimuovi tutte le modifiche dal progetto
        if (project.activities[row._hash]) {
            const saved = project.activities[row._hash];
            delete saved.giornateModificate;
            delete saved.Data;
            delete saved.Incarico;
            delete saved.Collaboratore;
            delete saved.Descrizione;
            delete saved.Tempo;
        }
    },

    /**
     * Redistribuisce le eccedenze (>1gg) sulle altre righe selezionate (tra quelle visibili)
     */
    redistributeExcess() {
        const project = App.state.currentProject;
        if (!project) return;

        const oreGiornata = project.oreGiornata;
        const data = App.state.processedData;
        const selectedVisible = this.getSelectedVisibleIndices();

        const excessItems = App.Calculator.findExcessActivities();
        if (excessItems.length === 0) return;

        // Calcola eccedenza totale
        const totalExcess = excessItems.reduce((sum, item) => sum + item.excess, 0);

        // Trova righe selezionate (e visibili) senza eccedenza (quelle che riceveranno la redistribuzione)
        const excessIndices = new Set(excessItems.map(item => item.idx));
        const recipientIndices = [];
        selectedVisible.forEach(idx => {
            if (!excessIndices.has(idx)) {
                recipientIndices.push(idx);
            }
        });

        if (recipientIndices.length === 0) return;

        // Calcola il totale attuale delle righe recipient
        const recipientTotal = recipientIndices.reduce((sum, idx) => sum + data[idx].GiornateEquiv, 0);
        const newRecipientTotal = recipientTotal + totalExcess;

        // Imposta le righe con eccedenza a 1gg
        excessItems.forEach(item => {
            const row = item.row;
            if (!row._modified) {
                const origCalc = App.Calculator.computeByMode(row, project);
                row._originalGiornate = origCalc.giornate;
                row._originalOre = origCalc.ore;
                row._originalImporto = row.ImportoOriginale;
            }

            const rate = App.Calculator.getRateForRow(row, project) || project.tariffa;
            row.GiornateEquiv = 1;
            row.OreEquiv = App.Calculator.computeOre(1, oreGiornata);
            row.Importo = App.Calculator.computeImporto(1, rate);
            row._modified = true;

            saveActivityState(row);
        });

        // Distribuisci proporzionalmente l'eccedenza sulle recipient
        if (recipientTotal > 0) {
            const ratio = newRecipientTotal / recipientTotal;
            recipientIndices.forEach(idx => {
                const row = data[idx];
                if (!row._modified) {
                    const origCalc = App.Calculator.computeByMode(row, project);
                    row._originalGiornate = origCalc.giornate;
                    row._originalOre = origCalc.ore;
                    row._originalImporto = row.ImportoOriginale;
                }

                const rate = App.Calculator.getRateForRow(row, project) || project.tariffa;
                row.GiornateEquiv = row.GiornateEquiv * ratio;
                row.OreEquiv = App.Calculator.computeOre(row.GiornateEquiv, oreGiornata);
                row.Importo = App.Calculator.computeImporto(row.GiornateEquiv, rate);
                row._modified = true;

                saveActivityState(row);
            });
        } else {
            // Se le recipient sono a 0, distribuisci uniformemente
            const valueEach = totalExcess / recipientIndices.length;
            recipientIndices.forEach(idx => {
                const row = data[idx];
                if (!row._modified) {
                    const origCalc = App.Calculator.computeByMode(row, project);
                    row._originalGiornate = origCalc.giornate;
                    row._originalOre = origCalc.ore;
                    row._originalImporto = row.ImportoOriginale;
                }

                const rate = App.Calculator.getRateForRow(row, project) || project.tariffa;
                row.GiornateEquiv = valueEach;
                row.OreEquiv = App.Calculator.computeOre(row.GiornateEquiv, oreGiornata);
                row.Importo = App.Calculator.computeImporto(row.GiornateEquiv, rate);
                row._modified = true;

                saveActivityState(row);
            });
        }

        App.Storage.save();
        App.Calculator.updateStats();
        App.UI.renderTable();
        App.Calculator.updateSelectionInfo();
    }
};
