/**
 * Storage & History layer.
 *
 * SOURCE OF TRUTH = Cloudflare D1 via the Functions API (js/api.js).
 * `localStorage` is only an OFFLINE CACHE / mirror, namespaced per user
 * (`<userId>::<key>`, or `anon::<key>` when logged out). Every read is served
 * from the cache so the UI stays synchronous; every write is mirrored to D1
 * asynchronously and reconciled when the server responds.
 */

const STORAGE_KEYS = {
  CURRENT_DRAFT: 'invoice_current_draft',
  SAVED_INVOICES: 'invoice_history_list',
  SAVED_CLIENTS: 'invoice_saved_clients',
  APP_SETTINGS: 'invoice_app_settings',
  CURRENT_KWITANSI_DRAFT: 'kwitansi_current_draft',
  SAVED_KWITANSIS: 'kwitansi_history_list',
  CURRENT_SURAT_JALAN_DRAFT: 'surat_jalan_current_draft',
  SAVED_SURAT_JALANS: 'surat_jalan_history_list'
};

/* Fields allowed through backup import (defence-in-depth allow-list, #13). */
const IMPORT_ALLOW_FIELDS = new Set([
  'id', 'number', 'referenceNumber', 'title', 'date', 'dueDate', 'showDueDate',
  'paymentTerms', 'showPaymentTerms', 'status', 'showStatus', 'useDecimals',
  'template', 'accentColor', 'currency', 'language', 'logo', 'signature', 'signatureData',
  'senderName', 'senderEmail', 'senderPhone', 'senderAddress', 'senderTaxId', 'senderWebsite',
  'clientName', 'clientEmail', 'clientPhone', 'clientAddress', 'clientTaxId',
  'discountType', 'discountValue', 'enableDiscount', 'taxRate', 'enableTax', 'shippingFee',
  'downPayment', 'notes', 'terms', 'signerName', 'signerTitle', 'qrPayload', 'showQrCode',
  'items', 'banks', 'subtotal', 'taxAmount', 'grandTotal', 'balanceDue', 'hasWatermark',
  // kwitansi / surat-jalan extras
  'paymentFor', 'amount', 'method', 'meteraiFee', 'stampColor', 'showTerbilang', 'showRefNumber',
  'showSignature', 'recipientName', 'recipientAddress', 'recipientPic', 'recipientPhone',
  'senderPic', 'driverName', 'driverSignerName', 'warehouseOfficerName', 'vehicle', 'poNumber',
  'sealNumber', 'deliveryInstructions', 'paperSize', 'showSkuColumn', 'showItemCondition',
  'showSealNumber', 'showPoNumber', 'showSignatures'
]);

const StorageManager = {
  _userId: 'anon',

  /** Called after auth resolves so the cache is namespaced to the right user (#23). */
  setUser(userId) {
    this._userId = userId || 'anon';
    this._migrateLegacy();
  },

  /** One-time copy of pre-namespacing keys into the current user's namespace. */
  _migrateLegacy() {
    try {
      Object.values(STORAGE_KEYS).forEach(base => {
        const namespaced = this._ns(base);
        if (localStorage.getItem(namespaced) === null && localStorage.getItem(base) !== null) {
          localStorage.setItem(namespaced, localStorage.getItem(base));
        }
      });
    } catch { /* ignore */ }
  },

  _ns(base) {
    return `${this._userId}::${base}`;
  },

  /** Safe localStorage write with quota pruning (#22). */
  persist(baseKey, value) {
    const json = JSON.stringify(value);
    const attempt = () => localStorage.setItem(this._ns(baseKey), json);
    try {
      attempt();
      return true;
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        // Trim the oldest half of the largest history list, then retry once.
        try {
          const hist = this._readList(STORAGE_KEYS.SAVED_INVOICES);
          if (hist.length > 4) {
            this._writeList(STORAGE_KEYS.SAVED_INVOICES, hist.slice(0, Math.ceil(hist.length / 2)));
            attempt();
            if (window.showToast) window.showToast('Penyimpanan lokal penuh — entri lama dipangkas.', 'warn');
            return true;
          }
        } catch { /* ignore */ }
      }
      console.error('Gagal menyimpan ke cache lokal:', e);
      return false;
    }
  },

  _readRaw(baseKey) {
    try { return localStorage.getItem(this._ns(baseKey)); } catch { return null; }
  },

  _readObj(baseKey) {
    try { const d = this._readRaw(baseKey); return d ? JSON.parse(d) : null; } catch { return null; }
  },

  _readList(baseKey) {
    const d = this._readObj(baseKey);
    return Array.isArray(d) ? d : [];
  },

  _writeList(baseKey, list) {
    return this.persist(baseKey, Array.isArray(list) ? list : []);
  },

  /** Normalize a loaded history record so `items` is always an array (#29). */
  _norm(inv) {
    if (inv && !Array.isArray(inv.items)) inv.items = [];
    return inv;
  },

  /* ================= DRAFTS (local only) ================= */
  saveDraft(invoice) { this.persist(STORAGE_KEYS.CURRENT_DRAFT, invoice); },
  loadDraft() { return this._readObj(STORAGE_KEYS.CURRENT_DRAFT); },
  saveKwitansiDraft(k) { this.persist(STORAGE_KEYS.CURRENT_KWITANSI_DRAFT, k); },
  loadKwitansiDraft() { return this._readObj(STORAGE_KEYS.CURRENT_KWITANSI_DRAFT); },
  saveSuratJalanDraft(sj) { this.persist(STORAGE_KEYS.CURRENT_SURAT_JALAN_DRAFT, sj); },
  loadSuratJalanDraft() { return this._readObj(STORAGE_KEYS.CURRENT_SURAT_JALAN_DRAFT); },

  /* ================= INVOICES ================= */
  getAllInvoices() { return this._readList(STORAGE_KEYS.SAVED_INVOICES).map(this._norm); },

  saveInvoiceToHistory(invoice) {
    const doc = this._norm({ ...invoice, updatedAt: new Date().toISOString() });
    const list = this.getAllInvoices();
    const i = list.findIndex(x => x.id === doc.id);
    if (i >= 0) list[i] = doc; else list.unshift(doc);
    this._writeList(STORAGE_KEYS.SAVED_INVOICES, list);
    this._syncSave('invoice', doc);
    return doc;
  },

  deleteInvoice(id) {
    const list = this.getAllInvoices().filter(x => x.id !== id);
    this._writeList(STORAGE_KEYS.SAVED_INVOICES, list);
    this._syncDelete('invoice', id);
    return list;
  },

  getHistorySummary() {
    let totalPaid = 0, totalPending = 0, totalAmount = 0;
    this.getAllInvoices().forEach(inv => {
      const totals = calculateInvoiceTotals(inv);
      totalAmount += totals.grandTotal;
      if (inv.status === 'paid') totalPaid += totals.grandTotal;
      else totalPending += totals.balanceDue;
    });
    return { totalCount: this.getAllInvoices().length, totalPaid, totalPending, totalAmount };
  },

  /* ================= KWITANSIS ================= */
  getAllKwitansis() { return this._readList(STORAGE_KEYS.SAVED_KWITANSIS).map(this._norm); },

  saveKwitansiToHistory(kwitansi) {
    const doc = this._norm({ ...kwitansi, updatedAt: new Date().toISOString() });
    const list = this.getAllKwitansis();
    const i = list.findIndex(x => x.id === doc.id);
    if (i >= 0) list[i] = doc; else list.unshift(doc);
    this._writeList(STORAGE_KEYS.SAVED_KWITANSIS, list);
    this._syncSave('kwitansi', doc);
    return doc;
  },

  deleteKwitansi(id) {
    const list = this.getAllKwitansis().filter(x => x.id !== id);
    this._writeList(STORAGE_KEYS.SAVED_KWITANSIS, list);
    this._syncDelete('kwitansi', id);
    return list;
  },

  getKwitansiSummary() {
    let totalPaid = 0, totalAmount = 0;
    const list = this.getAllKwitansis();
    list.forEach(k => {
      const amount = Number(k.amount) || 0;
      totalAmount += amount;
      if (k.status === 'paid' || !k.status) totalPaid += amount;
    });
    return { totalCount: list.length, totalPaid, totalAmount };
  },

  /* ================= SURAT JALANS ================= */
  getAllSuratJalans() { return this._readList(STORAGE_KEYS.SAVED_SURAT_JALANS).map(this._norm); },

  saveSuratJalanToHistory(suratJalan) {
    const doc = this._norm({ ...suratJalan, updatedAt: new Date().toISOString() });
    const list = this.getAllSuratJalans();
    const i = list.findIndex(x => x.id === doc.id);
    if (i >= 0) list[i] = doc; else list.unshift(doc);
    this._writeList(STORAGE_KEYS.SAVED_SURAT_JALANS, list);
    this._syncSave('surat-jalan', doc);
    return doc;
  },

  deleteSuratJalan(id) {
    const list = this.getAllSuratJalans().filter(x => x.id !== id);
    this._writeList(STORAGE_KEYS.SAVED_SURAT_JALANS, list);
    this._syncDelete('surat-jalan', id);
    return list;
  },

  getSuratJalanSummary() {
    const list = this.getAllSuratJalans();
    let totalDelivered = 0, totalInTransit = 0;
    list.forEach(sj => {
      if (sj.status === 'delivered') totalDelivered++;
      if (sj.status === 'in_transit') totalInTransit++;
    });
    return { totalCount: list.length, totalDelivered, totalInTransit };
  },

  /* ================= CLIENTS (local mirror + server later) ================= */
  getSavedClients() { return this._readList(STORAGE_KEYS.SAVED_CLIENTS); },
  saveClient(client) {
    if (!client.name) return;
    const clients = this.getSavedClients();
    const idx = clients.findIndex(c => (c.name || '').toLowerCase() === client.name.toLowerCase());
    if (idx >= 0) clients[idx] = { ...clients[idx], ...client }; else clients.push(client);
    this._writeList(STORAGE_KEYS.SAVED_CLIENTS, clients);
  },

  /* ================= SERVER SYNC + HYDRATION ================= */
  _listKey(type) {
    return { invoice: STORAGE_KEYS.SAVED_INVOICES, kwitansi: STORAGE_KEYS.SAVED_KWITANSIS, 'surat-jalan': STORAGE_KEYS.SAVED_SURAT_JALANS }[type];
  },

  async _syncSave(type, doc) {
    if (type === 'invoice' && !window.Api?.saveInvoice) return;
    try {
      const fn = { invoice: 'saveInvoice', kwitansi: 'saveKwitansi', 'surat-jalan': 'saveSuratJalan' }[type];
      const saved = await window.Api[fn](doc);
      if (saved && saved.id) {
        const list = this._readList(this._listKey(type));
        const i = list.findIndex(x => x.id === saved.id || x.id === doc.id);
        if (i >= 0) list[i] = saved; else list.unshift(saved);
        this._writeList(this._listKey(type), list);
        window.dispatchEvent(new CustomEvent('storage:change', { detail: { type, doc: saved } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('storage:error', { detail: { type, action: 'save', message: e.message } }));
    }
  },

  async _syncDelete(type, id) {
    try {
      const fn = { invoice: 'deleteInvoice', kwitansi: 'deleteKwitansi', 'surat-jalan': 'deleteSuratJalan' }[type];
      await window.Api[fn](id);
      window.dispatchEvent(new CustomEvent('storage:change', { detail: { type, deletedId: id } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('storage:error', { detail: { type, action: 'delete', message: e.message } }));
    }
  },

  /** Pull the authoritative list from D1 and refresh the namespaced cache. */
  async syncFromServer(type) {
    if (this._userId === 'anon') return this._readList(this._listKey(type));
    const fn = { invoice: 'listInvoices', kwitansi: 'listKwitansis', 'surat-jalan': 'listSuratJalans' }[type];
    try {
      const docs = await window.Api[fn]();
      if (Array.isArray(docs)) {
        this._writeList(this._listKey(type), docs);
        window.dispatchEvent(new CustomEvent('storage:change', { detail: { type, hydrated: true } }));
      }
    } catch (e) {
      console.warn('Gagal sinkron dari server (pakai cache lokal):', e.message);
    }
    return this._readList(this._listKey(type)).map(this._norm);
  },

  /* ================= BACKUP ================= */
  exportBackupJSON() {
    const backupData = {
      version: '2.0', userId: this._userId, exportedAt: new Date().toISOString(),
      invoices: this.getAllInvoices(), currentDraft: this.loadDraft(), clients: this.getSavedClients()
    };
    this._download(JSON.stringify(backupData, null, 2), `invoice_backup_${new Date().toISOString().slice(0, 10)}.json`);
  },

  exportKwitansiBackupJSON() {
    const backupData = { version: '2.0', type: 'kwitansi', userId: this._userId, exportedAt: new Date().toISOString(), kwitansis: this.getAllKwitansis(), currentDraft: this.loadKwitansiDraft() };
    this._download(JSON.stringify(backupData, null, 2), `kwitansi_backup_${new Date().toISOString().slice(0, 10)}.json`);
  },

  exportSuratJalanBackupJSON() {
    const backupData = { version: '2.0', type: 'surat_jalan', userId: this._userId, exportedAt: new Date().toISOString(), suratJalans: this.getAllSuratJalans(), currentDraft: this.loadSuratJalanDraft() };
    this._download(JSON.stringify(backupData, null, 2), `surat_jalan_backup_${new Date().toISOString().slice(0, 10)}.json`);
  },

  _download(contentStr, filename) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(contentStr);
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  /** Strip unknown fields and validate per-record before importing (#13). */
  _sanitizeRecord(rec) {
    if (!rec || typeof rec !== 'object') return null;
    if (!rec.number && !rec.clientName && !rec.recipientName && !rec.paymentFor) return null;
    const out = {};
    for (const k of Object.keys(rec)) {
      if (IMPORT_ALLOW_FIELDS.has(k)) out[k] = rec[k];
    }
    if (!Array.isArray(out.items)) out.items = [];
    if (!out.id) out.id = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return out;
  },

  importBackupJSON(jsonString) {
    return this._importGeneric(jsonString, 'invoices', STORAGE_KEYS.SAVED_INVOICES);
  },
  importKwitansiBackupJSON(jsonString) {
    return this._importGeneric(jsonString, 'kwitansis', STORAGE_KEYS.SAVED_KWITANSIS);
  },
  importSuratJalanBackupJSON(jsonString) {
    return this._importGeneric(jsonString, 'suratJalans', STORAGE_KEYS.SAVED_SURAT_JALANS);
  },

  _importGeneric(jsonString, arrKey, storageKey) {
    try {
      const data = JSON.parse(jsonString);
      const incoming = Array.isArray(data[arrKey]) ? data[arrKey] : null;
      if (!incoming) return { ok: false, error: 'Format backup tidak dikenali.' };
      const clean = incoming.map(this._sanitizeRecord).filter(Boolean);
      if (clean.length === 0) return { ok: false, error: 'Tidak ada record valid untuk diimpor.' };

      const existing = this._readList(storageKey);
      // Merge by id (import wins), never blind-overwrite the whole list.
      const byId = new Map(existing.map(x => [x.id, x]));
      let added = 0, updated = 0;
      clean.forEach(rec => {
        if (byId.has(rec.id)) { byId.set(rec.id, { ...byId.get(rec.id), ...rec }); updated++; }
        else { byId.set(rec.id, rec); added++; }
      });
      this._writeList(storageKey, Array.from(byId.values()));
      clean.forEach(rec => this._syncSave(this._arrToType(arrKey), rec));
      return { ok: true, added, updated };
    } catch (e) {
      console.error('Failed to import backup:', e);
      return { ok: false, error: 'File JSON tidak valid.' };
    }
  },

  _arrToType(arrKey) {
    return { invoices: 'invoice', kwitansis: 'kwitansi', suratJalans: 'surat-jalan' }[arrKey];
  }
};

window.StorageManager = StorageManager;
