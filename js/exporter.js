/**
 * App.Exporter - Export dati in vari formati
 */
App.Exporter = {
    /**
     * Esporta dati in formato JSON
     */
    toJSON() {
        const data = App.state.processedData;
        const project = App.state.currentProject;

        const exportData = data.map(row => {
            const out = {
                Cliente: row.Cliente,
                Incarico: row.Incarico,
                Data: row.Data,
                Collaboratore: row.Collaboratore,
                Causale: row.Causale,
                Descrizione: row.Descrizione,
                Tempo: row.Tempo,
                ImportoOriginale: row.ImportoOriginale,
                Importo: row.Importo,
                GiornateEquiv: row.GiornateEquiv,
                OreEquiv: row.OreEquiv
            };
            const cluster = project.clusters.find(c => c.id === row._clusterId);
            out.Cluster = cluster?.name || null;
            if (row._modified) {
                out.Arrotondato = true;
                out.ValoriOriginali = {
                    giornate: row._originalGiornate,
                    importo: row._originalImporto
                };
            }
            return out;
        });

        // Riepilogo per cluster
        const clusterSummary = {};
        data.forEach(row => {
            const clusterName = project.clusters.find(c => c.id === row._clusterId)?.name || 'Non assegnato';
            if (!clusterSummary[clusterName]) {
                clusterSummary[clusterName] = { attivita: 0, giornate: 0, importo: 0 };
            }
            clusterSummary[clusterName].attivita++;
            clusterSummary[clusterName].giornate += row.GiornateEquiv;
            clusterSummary[clusterName].importo += row.Importo;
        });

        const output = {
            progetto: project.name,
            dataExport: new Date().toISOString(),
            configurazione: {
                tariffa: project.tariffa,
                oreGiornata: project.oreGiornata
            },
            riepilogo: {
                totaleAttivita: data.length,
                totaleImporto: data.reduce((s, r) => s + r.Importo, 0),
                totaleGiornate: data.reduce((s, r) => s + r.GiornateEquiv, 0),
                perCluster: clusterSummary
            },
            attivita: exportData
        };

        const monthKey = App.getWorkingMonthKey();
        const fileName = `${project.name}_${monthKey}_export.json`.replace(/[^a-z0-9_\-\.]/gi, '_');
        App.Utils.downloadFile(JSON.stringify(output, null, 2), fileName, 'application/json');
        App.Utils.toastSuccess('File JSON esportato con successo');
    },

    /**
     * Esporta dati in formato CSV
     */
    toCSV() {
        const data = App.state.processedData;
        const project = App.state.currentProject;

        const headers = ['Cliente', 'Incarico', 'Data', 'Collaboratore', 'Causale', 'Descrizione', 'Tempo', 'Cluster', 'ImportoOriginale', 'Importo', 'Giornate', 'Ore', 'Arrotondato'];
        let csv = headers.join(';') + '\n';

        data.forEach(row => {
            const cluster = project.clusters.find(c => c.id === row._clusterId)?.name || '';
            const values = [
                row.Cliente, row.Incarico, row.Data, row.Collaboratore, row.Causale, row.Descrizione, row.Tempo,
                cluster,
                row.ImportoOriginale.toString().replace('.', ','),
                row.Importo.toFixed(2).replace('.', ','),
                row.GiornateEquiv.toFixed(2).replace('.', ','),
                row.OreEquiv.toFixed(1).replace('.', ','),
                row._modified ? 'Si' : 'No'
            ];
            csv += values.map(v => {
                v = String(v);
                if (v.includes(';') || v.includes('"') || v.includes('\n')) {
                    v = '"' + v.replace(/"/g, '""') + '"';
                }
                return v;
            }).join(';') + '\n';
        });

        const monthKey = App.getWorkingMonthKey();
        const fileName = `${project.name}_${monthKey}_export.csv`.replace(/[^a-z0-9_\-\.]/gi, '_');
        App.Utils.downloadFile(csv, fileName, 'text/csv;charset=utf-8');
        App.Utils.toastSuccess('File CSV esportato con successo');
    },

    /**
     * Carica il logo da App.LOGO_BASE64 (definito in js/logo.js)
     */
    async _loadLogo() {
        // Usa il logo embedded in base64
        if (App.LOGO_BASE64) {
            try {
                const binaryString = atob(App.LOGO_BASE64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Ottieni dimensioni reali dell'immagine
                const dimensions = await this._getImageDimensions('data:image/png;base64,' + App.LOGO_BASE64);

                return {
                    buffer: bytes.buffer,
                    extension: 'png',
                    width: dimensions.width,
                    height: dimensions.height
                };
            } catch (e) {
                console.error('Errore caricamento logo embedded:', e);
            }
        }

        // Fallback: chiedi all'utente di selezionare il file
        return this._selectLogoFile();
    },

    /**
     * Ottiene le dimensioni reali di un'immagine
     */
    _getImageDimensions(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 200, height: 80 }); // default
            img.src = src;
        });
    },

    /**
     * Chiede all'utente di selezionare un file immagine PNG/JPEG per il logo
     */
    _selectLogoFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/jpg';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    // Ottieni dimensioni reali dell'immagine
                    const dataUrl = await this._arrayBufferToDataUrl(evt.target.result, file.type);
                    const dimensions = await this._getImageDimensions(dataUrl);
                    resolve({
                        buffer: evt.target.result,
                        extension: file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg',
                        width: dimensions.width,
                        height: dimensions.height
                    });
                };
                reader.onerror = () => resolve(null);
                reader.readAsArrayBuffer(file);
            };
            input.click();
        });
    },

    /**
     * Converte ArrayBuffer in Data URL per ottenere dimensioni immagine
     */
    _arrayBufferToDataUrl(buffer, mimeType) {
        return new Promise((resolve) => {
            const blob = new Blob([buffer], { type: mimeType });
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },

    /**
     * Esporta report Excel formattato con ExcelJS (supporta logo da file)
     */
    async toExcelReport() {
        const currentProject = App.state.currentProject;
        const processedData = App.state.processedData;

        if (!currentProject || processedData.length === 0) {
            App.Utils.toastWarning('Nessun dato da esportare');
            return;
        }

        // Carica logo da asset o chiedi selezione
        const logoData = await this._loadLogo();

        // Estrai info dal primo record per header
        const cliente = processedData[0]?.Cliente || currentProject.name;
        const pratica = processedData[0]?.Incarico || '';

        // Trova range date
        const dates = processedData.map(r => {
            if (!r.Data) return null;
            const parts = String(r.Data).split('/');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
            return null;
        }).filter(d => d);

        const minDate = dates.length ? new Date(Math.min(...dates)) : new Date();
        const maxDate = dates.length ? new Date(Math.max(...dates)) : new Date();

        const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                     'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

        let periodoAttivita;
        if (minDate.getMonth() === maxDate.getMonth() && minDate.getFullYear() === maxDate.getFullYear()) {
            periodoAttivita = `${mesi[minDate.getMonth()]} ${minDate.getFullYear()}`;
        } else {
            periodoAttivita = `${mesi[minDate.getMonth()]} - ${mesi[maxDate.getMonth()]} ${maxDate.getFullYear()}`;
        }

        // Crea workbook con ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dettaglio Attività');

        // Larghezze colonne
        worksheet.columns = [
            { width: 28 },  // A - Incarico
            { width: 12 },  // B - Data
            { width: 20 },  // C - Collaboratore
            { width: 45 },  // D - Descrizione
            { width: 35 },  // E - Attività
            { width: 10 },  // F - GG
            { width: 12 }   // G - Valore
        ];

        // Aggiungi logo se disponibile (mantiene proporzioni)
        if (logoData) {
            const logoId = workbook.addImage({
                buffer: logoData.buffer,
                extension: logoData.extension
            });

            // Calcola dimensioni proporzionali (max altezza 70px per stare nelle 4 righe)
            const maxHeight = 70;
            const maxWidth = 250;
            let finalWidth, finalHeight;

            if (logoData.width && logoData.height) {
                const ratio = logoData.width / logoData.height;
                finalHeight = Math.min(maxHeight, logoData.height);
                finalWidth = finalHeight * ratio;

                // Se troppo largo, ridimensiona in base alla larghezza
                if (finalWidth > maxWidth) {
                    finalWidth = maxWidth;
                    finalHeight = finalWidth / ratio;
                }
            } else {
                finalWidth = 180;
                finalHeight = 70;
            }

            worksheet.addImage(logoId, {
                tl: { col: 0, row: 0 },
                ext: { width: finalWidth, height: finalHeight }
            });
        }

        // Righe vuote per il logo (altezza aumentata)
        worksheet.addRow([]);
        worksheet.getRow(1).height = 22;
        worksheet.addRow([]);
        worksheet.getRow(2).height = 22;
        worksheet.addRow([]);
        worksheet.getRow(3).height = 22;
        worksheet.addRow([]);
        worksheet.getRow(4).height = 22;

        // Riga 5: CLIENTE
        const rowCliente = worksheet.addRow(['CLIENTE:', cliente]);
        rowCliente.getCell(1).font = { bold: true, size: 11, name: 'Arial' };
        rowCliente.getCell(2).font = { size: 11, name: 'Arial' };

        // Riga 6: PRATICA
        const rowPratica = worksheet.addRow(['PRATICA:', pratica]);
        rowPratica.getCell(1).font = { bold: true, size: 11, name: 'Arial' };
        rowPratica.getCell(2).font = { size: 11, name: 'Arial' };

        // Riga 7: Periodo
        const rowPeriodo = worksheet.addRow(['Periodo attività:', periodoAttivita]);
        rowPeriodo.getCell(1).font = { bold: true, size: 11, name: 'Arial' };
        rowPeriodo.getCell(2).font = { size: 11, name: 'Arial' };

        // Riga 8: vuota
        worksheet.addRow([]);

        // Riga 9: Titolo
        const rowTitolo = worksheet.addRow(['Dettaglio Attività']);
        rowTitolo.getCell(1).font = { bold: true, size: 14, name: 'Arial' };
        worksheet.mergeCells(`A${rowTitolo.number}:G${rowTitolo.number}`);

        // Riga 10: vuota
        worksheet.addRow([]);

        // Riga 11: Header tabella
        const headerRow = worksheet.addRow(['Incarico', 'Data', 'Collaboratore', 'Descrizione Attività', 'Attività', 'GG', 'Valore']);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF808080' } },
                bottom: { style: 'thin', color: { argb: 'FF808080' } },
                left: { style: 'thin', color: { argb: 'FF808080' } },
                right: { style: 'thin', color: { argb: 'FF808080' } }
            };
        });
        headerRow.height = 20;

        // Dati ordinati per data
        const sortedData = [...processedData].sort((a, b) => {
            const parseDate = App.Utils.parseItalianDate;
            const dateA = parseDate(a.Data);
            const dateB = parseDate(b.Data);
            return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
        });

        // Righe dati
        let totaleGG = 0;
        let totaleValore = 0;
        sortedData.forEach((row) => {
            const gg = row.GiornateEquiv;
            const valore = row.Importo || 0;
            const cluster = currentProject.clusters.find(c => c.id === row._clusterId)?.name || '';

            totaleGG += gg;
            totaleValore += valore;

            const dataRow = worksheet.addRow([
                row.Incarico || '',
                row.Data || '',
                row.Collaboratore || '',
                row.Descrizione || '',
                cluster,
                gg,
                valore
            ]);

            dataRow.eachCell((cell, colNumber) => {
                cell.font = { size: 10, name: 'Arial' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                };
                // Centrato per Data, GG, Valore
                if (colNumber === 2 || colNumber === 6 || colNumber === 7) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                // Formato numerico per GG e Valore
                if (colNumber === 6 || colNumber === 7) {
                    cell.numFmt = '0.00';
                }
            });
            dataRow.height = 18;
        });

        // Riga totale
        const totalRow = worksheet.addRow(['Totale', '', '', '', '', totaleGG, totaleValore]);
        totalRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
            cell.alignment = { horizontal: colNumber >= 6 ? 'center' : 'left', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF808080' } },
                bottom: { style: 'thin', color: { argb: 'FF808080' } },
                left: { style: 'thin', color: { argb: 'FF808080' } },
                right: { style: 'thin', color: { argb: 'FF808080' } }
            };
            if (colNumber === 6 || colNumber === 7) {
                cell.numFmt = '0.00';
            }
        });

        // Scarica file con mese nel nome
        const monthKey = App.getWorkingMonthKey();
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name.replace(/[^a-z0-9]/gi, '_')}_${monthKey}_TimeReport.xlsx`;
        a.click();
        URL.revokeObjectURL(url);

        App.Utils.toastSuccess('Report Excel esportato con successo');
    }
};
