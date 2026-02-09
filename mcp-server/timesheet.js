/**
 * TimesheetData - Classe per manipolare i dati dei timesheet
 * Replica la logica dell'app web per garantire compatibilita'
 *
 * Supporta due formati:
 * - v2: File singolo con array di progetti (timesheet_data.json)
 * - v3: Cartelle per progetto con project.json singolo
 */

import { readFile, writeFile, copyFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';

export class TimesheetData {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
    this.mode = 'v2'; // 'v2' = file singolo, 'v3' = progetto singolo
  }

  /**
   * Carica i dati dal file JSON (supporta v2 e v3)
   */
  static async load(filePath) {
    const instance = new TimesheetData(filePath);
    const content = await readFile(filePath, 'utf-8');
    instance.data = JSON.parse(content);

    // Determina il formato
    if (instance.data._type === 'timesheet_data') {
      // Formato v2: file singolo con array progetti
      instance.mode = 'v2';
      if (instance.data._version !== 2) {
        throw new Error(`Versione non supportata: ${instance.data._version}. Richiesta versione 2.`);
      }
    } else if (instance.data._type === 'timesheet_project') {
      // Formato v3: singolo progetto
      instance.mode = 'v3';
      // Converte in struttura compatibile con v2 per uniformita' interna
      const project = instance.data;
      project.folderName = project.folderName || basename(dirname(filePath));
      instance.data = {
        _type: 'timesheet_data',
        _version: 2,
        projects: [project]
      };
    } else {
      throw new Error('File non valido: _type deve essere "timesheet_data" o "timesheet_project"');
    }

    return instance;
  }

  /**
   * Carica progetti da una directory workspace (v3)
   * Scansiona le sottocartelle cercando project.json
   */
  static async loadWorkspace(workspacePath) {
    const instance = new TimesheetData(workspacePath);
    instance.mode = 'workspace';
    instance.data = {
      _type: 'timesheet_data',
      _version: 2,
      projects: []
    };

    const entries = await readdir(workspacePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const projectFile = join(workspacePath, entry.name, 'project.json');
        if (existsSync(projectFile)) {
          try {
            const content = await readFile(projectFile, 'utf-8');
            const project = JSON.parse(content);
            if (project._type === 'timesheet_project') {
              project.folderName = entry.name;
              project._projectFile = projectFile;
              instance.data.projects.push(project);
            }
          } catch (e) {
            console.error(`Errore caricamento ${projectFile}:`, e.message);
          }
        }
      }
    }

    // Ordina per nome
    instance.data.projects.sort((a, b) => a.name.localeCompare(b.name));

    return instance;
  }

  /**
   * Salva i dati su file con backup automatico
   */
  async save() {
    if (this.mode === 'v3') {
      // Salva il singolo progetto
      await this.saveProject(this.data.projects[0]);
    } else if (this.mode === 'workspace') {
      // Salva ogni progetto modificato
      for (const project of this.data.projects) {
        if (project._projectFile) {
          await this.saveProject(project);
        }
      }
    } else {
      // v2: salva tutto nel file singolo
      if (existsSync(this.filePath)) {
        const backupPath = this.filePath + '.bak';
        await copyFile(this.filePath, backupPath);
      }

      const content = JSON.stringify(this.data, null, 2);
      await writeFile(this.filePath, content, 'utf-8');
    }
  }

  /**
   * Salva un singolo progetto (per v3/workspace)
   */
  async saveProject(project) {
    const filePath = project._projectFile || this.filePath;

    // Crea backup
    if (existsSync(filePath)) {
      const backupPath = filePath + '.bak';
      await copyFile(filePath, backupPath);
    }

    // Prepara dati (rimuovi campi interni)
    const toSave = { ...project };
    delete toSave._projectFile;
    toSave._type = 'timesheet_project';
    toSave._version = 3;
    toSave._lastSaved = new Date().toISOString();

    const content = JSON.stringify(toSave, null, 2);
    await writeFile(filePath, content, 'utf-8');
  }

  // ============= PROGETTI =============

  /**
   * Elenca tutti i progetti con statistiche
   */
  listProjects() {
    return this.data.projects.map(proj => {
      const monthKeys = Object.keys(proj.monthlyReports || {});
      let totalActivities = 0;

      for (const month of monthKeys) {
        const report = proj.monthlyReports[month];
        totalActivities += Object.keys(report.activities || {}).length;
      }

      return {
        id: proj.id,
        name: proj.name,
        tariffa: proj.tariffa,
        oreGiornata: proj.oreGiornata,
        calcMode: proj.calcMode || 'tariffa',
        collaboratorRatesCount: Object.keys(proj.collaboratorRates || {}).length,
        currentMonth: proj.currentMonth,
        totalMonths: monthKeys.length,
        totalActivities
      };
    });
  }

  /**
   * Ottiene un progetto per ID
   */
  getProject(projectId) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) return null;

    // Costruisce lista mesi con statistiche
    const months = [];
    for (const [month, report] of Object.entries(proj.monthlyReports || {})) {
      months.push({
        month,
        status: report.status || 'open',
        activitiesCount: Object.keys(report.activities || {}).length,
        closedAt: report.closedAt || null
      });
    }
    months.sort((a, b) => b.month.localeCompare(a.month)); // Più recenti prima

    return {
      id: proj.id,
      name: proj.name,
      tariffa: proj.tariffa,
      oreGiornata: proj.oreGiornata,
      calcMode: proj.calcMode || 'tariffa',
      collaboratorRates: proj.collaboratorRates || {},
      currentMonth: proj.currentMonth,
      clusters: proj.clusters || [],
      months
    };
  }

  // ============= ATTIVITÀ =============

  /**
   * Ottiene le attività di un mese specifico
   */
  getMonthActivities(projectId, month) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) {
      return {
        month,
        status: 'open',
        activities: [],
        totals: { count: 0, giornate: 0, importo: 0 }
      };
    }

    const activities = [];
    let totalGiornate = 0;
    let totalImporto = 0;

    for (const [hash, act] of Object.entries(report.activities || {})) {
      const orig = act.originalData || {};
      const giornate = act.giornateModificate ?? this.computeGiornate(orig.ImportoOriginale, proj.tariffa, proj.oreGiornata, orig.Tempo, proj.calcMode, proj.collaboratorRates, orig.Collaboratore);
      const importo = this.computeImporto(giornate, proj.tariffa, proj.calcMode, proj.collaboratorRates, orig.Collaboratore);

      // Trova nome cluster
      let clusterName = null;
      if (act.clusterId) {
        const cluster = (proj.clusters || []).find(c => c.id === act.clusterId);
        clusterName = cluster?.name || null;
      }

      activities.push({
        hash,
        data: orig.Data || '',
        collaboratore: orig.Collaboratore || '',
        descrizione: orig.Descrizione || '',
        incarico: orig.Incarico || '',
        tempo: orig.Tempo || '',
        importoOriginale: orig.ImportoOriginale || 0,
        giornate,
        importo,
        clusterId: act.clusterId || null,
        cluster: clusterName,
        modified: act.giornateModificate !== undefined
      });

      totalGiornate += giornate;
      totalImporto += importo;
    }

    // Ordina per data
    activities.sort((a, b) => {
      const dateA = this.parseDate(a.data);
      const dateB = this.parseDate(b.data);
      return dateA - dateB;
    });

    return {
      month,
      status: report.status || 'open',
      activities,
      totals: {
        count: activities.length,
        giornate: Math.round(totalGiornate * 100) / 100,
        importo: Math.round(totalImporto * 100) / 100
      }
    };
  }

  /**
   * Ottiene una singola attività
   */
  getActivity(projectId, month, hash) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) return null;

    const report = proj.monthlyReports?.[month];
    if (!report) return null;

    return report.activities?.[hash] || null;
  }

  // ============= MODIFICHE =============

  /**
   * Assegna cluster a una o più attività
   */
  assignCluster(projectId, month, hashes, clusterId) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) throw new Error(`Mese non trovato: ${month}`);

    if (report.status === 'closed') {
      throw new Error(`Mese ${month} è chiuso. Riaprirlo prima di modificare.`);
    }

    // Verifica che il cluster esista (se specificato)
    if (clusterId) {
      const cluster = (proj.clusters || []).find(c => c.id === clusterId);
      if (!cluster) throw new Error(`Cluster non trovato: ${clusterId}`);
    }

    let updated = 0;
    for (const hash of hashes) {
      const activity = report.activities?.[hash];
      if (activity) {
        activity.clusterId = clusterId || null;
        updated++;
      }
    }

    return updated;
  }

  /**
   * Aggiorna le giornate di un'attività
   */
  updateGiornate(projectId, month, hash, giornate) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) throw new Error(`Mese non trovato: ${month}`);

    if (report.status === 'closed') {
      throw new Error(`Mese ${month} è chiuso. Riaprirlo prima di modificare.`);
    }

    const activity = report.activities?.[hash];
    if (!activity) throw new Error(`Attività non trovata: ${hash}`);

    activity.giornateModificate = giornate;
    return true;
  }

  /**
   * Applica arrotondamento proporzionale alle attività selezionate
   */
  applyProportionalRounding(projectId, month, hashes, targetTotal) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) throw new Error(`Mese non trovato: ${month}`);

    if (report.status === 'closed') {
      throw new Error(`Mese ${month} è chiuso. Riaprirlo prima di modificare.`);
    }

    // Raccogli attività e calcola totale attuale
    const activities = [];
    let currentTotal = 0;

    for (const hash of hashes) {
      const act = report.activities?.[hash];
      if (act) {
        const orig = act.originalData || {};
        const giornate = act.giornateModificate ?? this.computeGiornate(orig.ImportoOriginale, proj.tariffa, proj.oreGiornata, orig.Tempo, proj.calcMode, proj.collaboratorRates, orig.Collaboratore);
        activities.push({ hash, act, giornate });
        currentTotal += giornate;
      }
    }

    if (activities.length === 0) {
      throw new Error('Nessuna attività valida trovata');
    }

    const oldTotal = Math.round(currentTotal * 100) / 100;

    if (currentTotal === 0) {
      throw new Error('Totale attuale è zero, impossibile distribuire proporzionalmente');
    }

    // Distribuisce proporzionalmente
    const ratio = targetTotal / currentTotal;
    let distributed = 0;

    for (let i = 0; i < activities.length; i++) {
      const { hash, act, giornate } = activities[i];

      if (i === activities.length - 1) {
        // Ultimo elemento: assegna il resto per evitare errori di arrotondamento
        act.giornateModificate = Math.round((targetTotal - distributed) * 100) / 100;
      } else {
        const newGiornate = Math.round(giornate * ratio * 100) / 100;
        act.giornateModificate = newGiornate;
        distributed += newGiornate;
      }
    }

    return { oldTotal, newTotal: targetTotal };
  }

  // ============= MESI =============

  /**
   * Chiude un mese
   */
  closeMonth(projectId, month) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) throw new Error(`Mese non trovato: ${month}`);

    report.status = 'closed';
    report.closedAt = new Date().toISOString();

    return 'closed';
  }

  /**
   * Riapre un mese
   */
  reopenMonth(projectId, month) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) throw new Error(`Mese non trovato: ${month}`);

    report.status = 'open';
    delete report.closedAt;

    return 'open';
  }

  // ============= CLUSTERS =============

  /**
   * Crea un nuovo cluster
   */
  createCluster(projectId, name, color) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    if (!proj.clusters) {
      proj.clusters = [];
    }

    // Verifica nome duplicato
    const existing = proj.clusters.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      throw new Error(`Cluster "${name}" già esistente`);
    }

    const id = 'cl_' + Date.now();
    proj.clusters.push({ id, name, color });

    return id;
  }

  // ============= SUMMARY =============

  /**
   * Riepilogo mensile per cluster
   */
  getMonthSummary(projectId, month) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    const report = proj.monthlyReports?.[month];
    if (!report) {
      return {
        month,
        byCluster: [],
        totals: { giornate: 0, importo: 0 }
      };
    }

    // Raggruppa per cluster
    const clusterMap = new Map(); // clusterId -> { giornate, importo }

    for (const [hash, act] of Object.entries(report.activities || {})) {
      const orig = act.originalData || {};
      const giornate = act.giornateModificate ?? this.computeGiornate(orig.ImportoOriginale, proj.tariffa, proj.oreGiornata, orig.Tempo, proj.calcMode, proj.collaboratorRates, orig.Collaboratore);
      const importo = this.computeImporto(giornate, proj.tariffa, proj.calcMode, proj.collaboratorRates, orig.Collaboratore);
      const clusterId = act.clusterId || null;

      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, { giornate: 0, importo: 0 });
      }
      const entry = clusterMap.get(clusterId);
      entry.giornate += giornate;
      entry.importo += importo;
    }

    // Costruisce array risultato
    const byCluster = [];
    let totalGiornate = 0;
    let totalImporto = 0;

    for (const [clusterId, data] of clusterMap) {
      let clusterName = null;
      if (clusterId) {
        const cluster = (proj.clusters || []).find(c => c.id === clusterId);
        clusterName = cluster?.name || clusterId;
      }

      byCluster.push({
        clusterId,
        cluster: clusterName,
        giornate: Math.round(data.giornate * 100) / 100,
        importo: Math.round(data.importo * 100) / 100
      });

      totalGiornate += data.giornate;
      totalImporto += data.importo;
    }

    // Ordina: cluster nominati prima, poi "Non assegnate" (null)
    byCluster.sort((a, b) => {
      if (a.clusterId === null) return 1;
      if (b.clusterId === null) return -1;
      return (a.cluster || '').localeCompare(b.cluster || '');
    });

    return {
      month,
      byCluster,
      totals: {
        giornate: Math.round(totalGiornate * 100) / 100,
        importo: Math.round(totalImporto * 100) / 100
      }
    };
  }

  // ============= CALCOLI =============

  /**
   * Calcola giornate equivalenti
   * @param {number} importo
   * @param {number} tariffa - Tariffa progetto
   * @param {number} oreGiornata
   * @param {string} tempo
   * @param {string} calcMode
   * @param {Object} [collaboratorRates] - Mappa nome->tariffa
   * @param {string} [collaboratorName] - Nome collaboratore
   */
  computeGiornate(importo, tariffa, oreGiornata, tempo, calcMode, collaboratorRates, collaboratorName) {
    if (calcMode === 'ore' && tempo) {
      // Parsing tempo "HH:MM"
      const parts = String(tempo).split(':');
      const hours = parseInt(parts[0] || 0) + parseInt(parts[1] || 0) / 60;
      return hours / (oreGiornata || 8);
    }
    if (calcMode === 'tariffa_collaboratore' && collaboratorRates && collaboratorName) {
      const rate = collaboratorRates[collaboratorName];
      if (rate && rate > 0) {
        return (importo || 0) / rate;
      }
      return 0; // No rate = 0 giornate
    }
    // Default: calcolo per tariffa
    return (importo || 0) / (tariffa || 1);
  }

  /**
   * Calcola importo da giornate
   * @param {number} giornate
   * @param {number} tariffa - Tariffa progetto (fallback)
   * @param {string} [calcMode]
   * @param {Object} [collaboratorRates]
   * @param {string} [collaboratorName]
   */
  computeImporto(giornate, tariffa, calcMode, collaboratorRates, collaboratorName) {
    let rate = tariffa || 0;
    if (calcMode === 'tariffa_collaboratore' && collaboratorRates && collaboratorName) {
      const collabRate = collaboratorRates[collaboratorName];
      if (collabRate && collabRate > 0) {
        rate = collabRate;
      }
    }
    return (giornate || 0) * rate;
  }

  /**
   * Gestisce le tariffe collaboratori
   */
  manageCollaboratorRates(projectId, action, name, rate) {
    const proj = this.data.projects.find(p => p.id === projectId);
    if (!proj) throw new Error(`Progetto non trovato: ${projectId}`);

    if (!proj.collaboratorRates) proj.collaboratorRates = {};

    if (action === 'list') {
      return proj.collaboratorRates;
    } else if (action === 'set') {
      if (!name) throw new Error('Nome collaboratore richiesto');
      proj.collaboratorRates[name] = rate || 0;
      return { name, rate: proj.collaboratorRates[name] };
    } else if (action === 'delete') {
      if (!name) throw new Error('Nome collaboratore richiesto');
      delete proj.collaboratorRates[name];
      return { name, deleted: true };
    } else {
      throw new Error(`Azione non valida: ${action}. Usa "list", "set" o "delete".`);
    }
  }

  /**
   * Parse data italiana (DD/MM/YYYY) in Date
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
  }
}
