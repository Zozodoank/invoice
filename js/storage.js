/**
 * LocalStorage & History Management Module
 */

const STORAGE_KEYS = {
  CURRENT_DRAFT: 'invoice_current_draft',
  SAVED_INVOICES: 'invoice_history_list',
  SAVED_CLIENTS: 'invoice_saved_clients',
  APP_SETTINGS: 'invoice_app_settings'
};

const StorageManager = {
  /**
   * Save current working draft
   */
  saveDraft(invoice) {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT, JSON.stringify(invoice));
    } catch (e) {
      console.error('Failed to save draft to localStorage:', e);
    }
  },

  /**
   * Load current draft or return null
   */
  loadDraft() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_DRAFT);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load draft:', e);
      return null;
    }
  },

  /**
   * Get all saved invoices from history
   */
  getAllInvoices() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_INVOICES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to get history:', e);
      return [];
    }
  },

  /**
   * Save or update an invoice in history
   */
  saveInvoiceToHistory(invoice) {
    const list = this.getAllInvoices();
    const index = list.findIndex(item => item.id === invoice.id);
    
    const invoiceToSave = {
      ...invoice,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      list[index] = invoiceToSave;
    } else {
      list.unshift(invoiceToSave);
    }

    localStorage.setItem(STORAGE_KEYS.SAVED_INVOICES, JSON.stringify(list));
    return invoiceToSave;
  },

  /**
   * Delete invoice from history by id
   */
  deleteInvoice(id) {
    const list = this.getAllInvoices().filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVED_INVOICES, JSON.stringify(list));
    return list;
  },

  /**
   * Calculate summary metrics from history
   */
  getHistorySummary() {
    const list = this.getAllInvoices();
    let totalCount = list.length;
    let totalPaid = 0;
    let totalPending = 0;
    let totalAmount = 0;

    list.forEach(inv => {
      const totals = calculateInvoiceTotals(inv);
      totalAmount += totals.grandTotal;
      if (inv.status === 'paid') {
        totalPaid += totals.grandTotal;
      } else {
        totalPending += totals.balanceDue;
      }
    });

    return {
      totalCount,
      totalPaid,
      totalPending,
      totalAmount
    };
  },

  /**
   * Export all data as downloadable JSON backup file
   */
  exportBackupJSON() {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      invoices: this.getAllInvoices(),
      currentDraft: this.loadDraft(),
      clients: this.getSavedClients()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `invoice_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Import data from JSON file
   */
  importBackupJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.invoices && Array.isArray(data.invoices)) {
        localStorage.setItem(STORAGE_KEYS.SAVED_INVOICES, JSON.stringify(data.invoices));
      }
      if (data.clients && Array.isArray(data.clients)) {
        localStorage.setItem(STORAGE_KEYS.SAVED_CLIENTS, JSON.stringify(data.clients));
      }
      return true;
    } catch (e) {
      console.error('Failed to import JSON backup:', e);
      return false;
    }
  },

  /**
   * Client Contacts Address Book
   */
  getSavedClients() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_CLIENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveClient(client) {
    if (!client.name) return;
    const clients = this.getSavedClients();
    const existingIndex = clients.findIndex(c => c.name.toLowerCase() === client.name.toLowerCase());
    
    if (existingIndex >= 0) {
      clients[existingIndex] = { ...clients[existingIndex], ...client };
    } else {
      clients.push(client);
    }
    localStorage.setItem(STORAGE_KEYS.SAVED_CLIENTS, JSON.stringify(clients));
  }
};
