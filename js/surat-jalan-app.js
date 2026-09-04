/**
 * Surat Jalan Generator Pro Application Controller
 * Manages full Indonesian delivery order generation, 15 synchronized enable/disable checkboxes,
 * live preview rendering, mobile auto-fit zoom, signature canvas, and export utilities.
 */

function getInitialSuratJalan() {
  return {
    id: 'sj_' + Date.now().toString(36),
    number: 'SJ-2026-001',
    poNumber: 'PO-2026-088',
    invoiceRef: 'INV-2026-042',
    date: new Date().toISOString().slice(0, 10),
    senderCity: 'Jakarta',
    status: 'in_transit', // delivered, in_transit, ready, completed, partial, draft
    template: 'warehouse', // warehouse, corporate, minimalist, cargo
    paperFormat: 'a4', // a4 (portrait) or a5-landscape (slip pengiriman)
    accentColor: '#f59e0b',

    // 15 Toggles (Kotak Centang)
    showCompanyHeader: true,
    showStatus: true,
    showPoNumber: true,
    showInvNumber: true,
    showShippingInfo: true,
    showSealNumber: true,
    showSkuColumn: true,
    showItemCondition: true,
    showSenderContact: true,
    showRecipientContact: true,
    showMultiSignature: true, // true = 4 kolom, false = 3 kolom
    showDigitalSign: true,
    showStamp: true,
    showQrCode: true,
    showNotes: true,

    // Pengirim (Gudang/Asal)
    senderName: 'PT TEKNOLOGI DIGITAL ABADI',
    senderAddress: 'Kawasan Pergudangan Pantai Indah Kapuk Blok C No. 8, Jakarta Utara',
    senderPhone: '0812-3456-7890',
    senderPic: 'Hendro Gunawan (Kepala Gudang)',
    logo: '',

    // Penerima (Tujuan)
    recipientName: 'PT SINAR BERKAH LOGISTIK',
    recipientAddress: 'Jl. Rungkut Industri Raya No. 45, Kawasan Industri SIER, Surabaya, Jawa Timur',
    recipientPhone: '0821-9876-5432',
    recipientPic: 'Bpk. Ahmad Fauzi (Site Manager)',
    deliveryInstructions: 'Harap hubungi PIC 1 jam sebelum tiba untuk koordinasi forklift & unboxing.',
    recipientSignerName: '',

    // Detail Armada / Pengiriman
    driverName: 'Rahmat Hidayat',
    vehicleType: 'Truk Box Isuzu Giga (CDD Long)',
    plateNumber: 'B 9182 UXT',
    trackingNumber: 'AWB-LOG-982104',
    estimatedArrival: '2026-09-06',
    sealNumber: 'SEAL-JKT-88219',

    // Items
    items: [
      { sku: 'SRV-DL-01', name: 'Server Rackmount 2U Dell PowerEdge R750', description: 'Intel Xeon Silver 4314, 64GB RAM, 2x 960GB SSD Enterprise', quantity: 2, unit: 'Unit', condition: 'Segel Pabrik Utuh' },
      { sku: 'SW-CS-48', name: 'Cisco Catalyst 48-Port Gigabit PoE+ Switch', description: 'Model WS-C2960X-48FPS-L, Termasuk Mounting Kit', quantity: 4, unit: 'Unit', condition: 'Baru & Segel' },
      { sku: 'UPS-APC-3K', name: 'APC Smart-UPS On-Line 3000VA / 2700W', description: 'Model SRT3000XLI 230V, Termasuk Kabel Power', quantity: 2, unit: 'Unit', condition: 'Baru dalam Dus' },
      { sku: 'CAB-CAT6-BL', name: 'Kabel UTP Belden Cat6 1000ft (305m)', description: 'Original USA Roll, Warna Abu-abu', quantity: 5, unit: 'Roll', condition: 'Dus Utuh' }
    ],

    // Stempel & Otorisasi
    stampText: 'DIKIRIM',
    stampColor: 'amber', // amber, emerald, blue, red
    authorizerName: 'Budi Santoso, S.Kom',
    authorizerTitle: 'Logistics Operations Director',
    signatureData: '',

    // QR & Catatan
    qrPayload: 'https://digitalabadi.co.id/tracking/SJ-2026-001',
    notes: '1. Barang telah diperiksa dan diserahkan dalam kondisi baik, lengkap, dan segel utuh.\n2. Mohon lakukan pengecekan fisik saat serah terima barang.\n3. Komplain kekurangan atau kerusakan barang maksimal 2x24 jam setelah barang diterima dengan melampirkan video unboxing dan bukti Surat Jalan ini.'
  };
}

class SuratJalanApp {
  constructor() {
    this.suratJalan = StorageManager.loadSuratJalanDraft() || getInitialSuratJalan();
    this.zoomLevel = 1.0;
    this.signatureManager = null;
    this.currentTab = 'editor'; // mobile view

    this.init();
  }

  init() {
    this.initSignaturePad();
    this.populateForm();
    this.updateAllCheckboxStates();
    this.renderSuratJalan();
    this.renderHistoryTable();
    this.attachEventListeners();
    this.initTheme();
    this.updateStatsCards();
    this.updateAuthNavUI();

    window.addEventListener('auth:change', () => {
      this.updateAuthNavUI();
      this.renderSuratJalan();
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('invoice_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('invoice_theme', isDark ? 'dark' : 'light');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  initSignaturePad() {
    this.signatureManager = new SignaturePadManager('signature-canvas', (dataUrl) => {
      this.suratJalan.signatureData = dataUrl;
      this.renderSuratJalan();
      this.autoSaveDraft();
    });
  }

  /* ================= POPULATE FORM ================= */
  populateForm() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    const setCheck = (id, checked) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!checked;
    };

    // Design & Template
    setVal('select-template', this.suratJalan.template);
    setVal('select-paper-format', this.suratJalan.paperFormat);
    setVal('input-accent-color', this.suratJalan.accentColor);

    // Identifiers
    setVal('input-number', this.suratJalan.number);
    setVal('input-date', this.suratJalan.date);
    setVal('input-city', this.suratJalan.senderCity);
    setVal('select-status', this.suratJalan.status);
    setCheck('toggle-show-status', this.suratJalan.showStatus);

    setVal('input-po-number', this.suratJalan.poNumber);
    setCheck('toggle-show-po-number', this.suratJalan.showPoNumber);
    setVal('input-invoice-ref', this.suratJalan.invoiceRef);
    setCheck('toggle-show-inv-number', this.suratJalan.showInvNumber);

    // Sender
    setCheck('toggle-show-company-header', this.suratJalan.showCompanyHeader);
    setVal('input-sender-name', this.suratJalan.senderName);
    setVal('input-sender-address', this.suratJalan.senderAddress);
    setCheck('toggle-show-sender-contact', this.suratJalan.showSenderContact);
    setVal('input-sender-pic', this.suratJalan.senderPic);
    setVal('input-sender-phone', this.suratJalan.senderPhone);

    // Recipient
    setVal('input-recipient-name', this.suratJalan.recipientName);
    setVal('input-recipient-address', this.suratJalan.recipientAddress);
    setCheck('toggle-show-recipient-contact', this.suratJalan.showRecipientContact);
    setVal('input-recipient-pic', this.suratJalan.recipientPic);
    setVal('input-recipient-phone', this.suratJalan.recipientPhone);
    setVal('input-delivery-instructions', this.suratJalan.deliveryInstructions);
    setVal('input-recipient-signer', this.suratJalan.recipientSignerName);

    // Shipping & Armada
    setCheck('toggle-show-shipping-info', this.suratJalan.showShippingInfo);
    setVal('input-driver-name', this.suratJalan.driverName);
    setVal('input-vehicle-type', this.suratJalan.vehicleType);
    setVal('input-plate-number', this.suratJalan.plateNumber);
    setVal('input-tracking-number', this.suratJalan.trackingNumber);
    setVal('input-estimated-arrival', this.suratJalan.estimatedArrival);
    setCheck('toggle-show-seal-number', this.suratJalan.showSealNumber);
    setVal('input-seal-number', this.suratJalan.sealNumber);

    // Items config
    setCheck('toggle-show-sku-column', this.suratJalan.showSkuColumn);
    setCheck('toggle-show-item-condition', this.suratJalan.showItemCondition);
    this.renderItemsList();

    // Signatures & Stamp
    setCheck('toggle-show-multi-signature', this.suratJalan.showMultiSignature);
    setCheck('toggle-show-digital-sign', this.suratJalan.showDigitalSign);
    setVal('input-authorizer-name', this.suratJalan.authorizerName);
    setVal('input-authorizer-title', this.suratJalan.authorizerTitle);

    setCheck('toggle-show-stamp', this.suratJalan.showStamp);
    setVal('input-stamp-text', this.suratJalan.stampText);
    setVal('select-stamp-color', this.suratJalan.stampColor);

    // QR & Notes
    setCheck('toggle-show-qr', this.suratJalan.showQrCode);
    setVal('input-qr-payload', this.suratJalan.qrPayload);
    setCheck('toggle-show-notes', this.suratJalan.showNotes);
    setVal('input-notes', this.suratJalan.notes);
  }

  /* ================= SYNC ALL 15 CHECKBOX STATES ================= */
  updateAllCheckboxStates() {
    this.updateCompanyHeaderState();
    this.updateStatusState();
    this.updatePoNumberState();
    this.updateInvNumberState();
    this.updateSenderContactState();
    this.updateRecipientContactState();
    this.updateShippingInfoState();
    this.updateSealNumberState();
    this.updateSkuColumnState();
    this.updateItemConditionState();
    this.updateMultiSignatureState();
    this.updateDigitalSignState();
    this.updateStampState();
    this.updateQrState();
    this.updateNotesState();
  }

  updateCompanyHeaderState() {
    const isEnabled = this.suratJalan.showCompanyHeader !== false;
    const group = document.getElementById('company-header-fields-group');
    const inputs = ['input-sender-name', 'input-sender-address', 'input-logo-file', 'btn-remove-logo'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });
    if (group) {
      if (isEnabled) group.classList.remove('opacity-40', 'pointer-events-none');
      else group.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateStatusState() {
    const isEnabled = this.suratJalan.showStatus !== false;
    const select = document.getElementById('select-status');
    if (select) {
      select.disabled = !isEnabled;
      if (isEnabled) select.classList.remove('opacity-40', 'pointer-events-none');
      else select.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updatePoNumberState() {
    const isEnabled = this.suratJalan.showPoNumber !== false;
    const input = document.getElementById('input-po-number');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) input.classList.remove('opacity-40', 'pointer-events-none');
      else input.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateInvNumberState() {
    const isEnabled = this.suratJalan.showInvNumber !== false;
    const input = document.getElementById('input-invoice-ref');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) input.classList.remove('opacity-40', 'pointer-events-none');
      else input.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateSenderContactState() {
    const isEnabled = this.suratJalan.showSenderContact !== false;
    const inputs = ['input-sender-pic', 'input-sender-phone'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = !isEnabled;
        if (isEnabled) el.classList.remove('opacity-40', 'pointer-events-none');
        else el.classList.add('opacity-40', 'pointer-events-none');
      }
    });
  }

  updateRecipientContactState() {
    const isEnabled = this.suratJalan.showRecipientContact !== false;
    const inputs = ['input-recipient-pic', 'input-recipient-phone'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = !isEnabled;
        if (isEnabled) el.classList.remove('opacity-40', 'pointer-events-none');
        else el.classList.add('opacity-40', 'pointer-events-none');
      }
    });
  }

  updateShippingInfoState() {
    const isEnabled = this.suratJalan.showShippingInfo !== false;
    const group = document.getElementById('shipping-info-fields-group');
    const inputs = ['input-driver-name', 'input-vehicle-type', 'input-plate-number', 'input-tracking-number', 'input-estimated-arrival'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });
    if (group) {
      if (isEnabled) group.classList.remove('opacity-40', 'pointer-events-none');
      else group.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateSealNumberState() {
    const isEnabled = this.suratJalan.showSealNumber !== false;
    const input = document.getElementById('input-seal-number');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) input.classList.remove('opacity-40', 'pointer-events-none');
      else input.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateSkuColumnState() {
    // Handled in renderSuratJalan & renderItemsList
  }

  updateItemConditionState() {
    // Handled in renderSuratJalan & renderItemsList
  }

  updateMultiSignatureState() {
    const isEnabled = !!this.suratJalan.showMultiSignature;
    const authGroup = document.getElementById('authorizer-fields-group');
    const inputs = ['input-authorizer-name', 'input-authorizer-title'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });
    if (authGroup) {
      if (isEnabled) authGroup.classList.remove('opacity-40', 'pointer-events-none');
      else authGroup.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateDigitalSignState() {
    const isEnabled = this.suratJalan.showDigitalSign !== false;
    const group = document.getElementById('digital-signature-box');
    const clearBtn = document.getElementById('btn-clear-signature');
    if (clearBtn) clearBtn.disabled = !isEnabled;
    if (group) {
      if (isEnabled) group.classList.remove('opacity-40', 'pointer-events-none');
      else group.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateStampState() {
    const isEnabled = this.suratJalan.showStamp !== false;
    const group = document.getElementById('stamp-fields-group');
    const inputs = ['input-stamp-text', 'select-stamp-color'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });
    if (group) {
      if (isEnabled) group.classList.remove('opacity-40', 'pointer-events-none');
      else group.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateQrState() {
    const isEnabled = !!this.suratJalan.showQrCode;
    const input = document.getElementById('input-qr-payload');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) input.classList.remove('opacity-40', 'pointer-events-none');
      else input.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  updateNotesState() {
    const isEnabled = this.suratJalan.showNotes !== false;
    const input = document.getElementById('input-notes');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) input.classList.remove('opacity-40', 'pointer-events-none');
      else input.classList.add('opacity-40', 'pointer-events-none');
    }
  }

  /* ================= ITEMS LIST CONTROLS ================= */
  renderItemsList() {
    const container = document.getElementById('items-form-container');
    if (!container) return;
    container.innerHTML = '';

    (this.suratJalan.items || []).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs relative animate-fade-in';
      row.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-400 font-mono">Barang #${index + 1}</span>
          <button type="button" class="btn-delete-item p-1 text-slate-400 hover:text-rose-500 rounded-md transition" data-index="${index}" title="Hapus Barang">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          ${this.suratJalan.showSkuColumn ? `
            <div>
              <label class="text-[10px] text-slate-400 font-medium block">Kode / SKU</label>
              <input type="text" class="item-sku w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs" data-index="${index}" placeholder="SKU-001" value="${item.sku || ''}" />
            </div>
          ` : ''}
          <div class="${this.suratJalan.showSkuColumn ? 'sm:col-span-2' : 'sm:col-span-3'}">
            <label class="text-[10px] text-slate-400 font-medium block">Nama Barang</label>
            <input type="text" class="item-name w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-xs" data-index="${index}" placeholder="Nama & Spesifikasi Barang" value="${item.name || ''}" />
          </div>
        </div>
        <div>
          <input type="text" class="item-desc w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300" data-index="${index}" placeholder="Deskripsi tambahan / serial number (opsional)" value="${item.description || ''}" />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-[10px] text-slate-400 font-medium block">Qty Dikirim</label>
            <input type="number" min="0" step="any" class="item-qty w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono font-bold" data-index="${index}" value="${item.quantity || 1}" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400 font-medium block">Satuan</label>
            <input type="text" class="item-unit w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" data-index="${index}" placeholder="Unit/Pcs/Dus" value="${item.unit || 'Pcs'}" />
          </div>
          ${this.suratJalan.showItemCondition ? `
            <div>
              <label class="text-[10px] text-slate-400 font-medium block">Kondisi / Keterangan</label>
              <input type="text" class="item-condition w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-medium text-[11px]" data-index="${index}" placeholder="Baik / Segel Utuh" value="${item.condition || 'Baik & Utuh'}" />
            </div>
          ` : ''}
        </div>
      `;
      container.appendChild(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  addItem() {
    if (!this.suratJalan.items) this.suratJalan.items = [];
    this.suratJalan.items.push({
      sku: 'PRD-00' + (this.suratJalan.items.length + 1),
      name: 'Item Barang Tambahan',
      description: 'Spesifikasi atau nomor seri barang',
      quantity: 1,
      unit: 'Pcs',
      condition: 'Baik & Utuh'
    });
    this.renderItemsList();
    this.renderSuratJalan();
    this.autoSaveDraft();
  }

  deleteItem(index) {
    if (!this.suratJalan.items) return;
    this.suratJalan.items.splice(index, 1);
    this.renderItemsList();
    this.renderSuratJalan();
    this.autoSaveDraft();
  }

  /* ================= LIVE PREVIEW RENDERER ================= */
  renderSuratJalan() {
    const previewPaper = document.getElementById('surat-jalan-paper-preview');
    if (!previewPaper) return;

    const templateName = this.suratJalan.template || 'warehouse';
    const renderer = SuratJalanTemplates[templateName] || SuratJalanTemplates.warehouse;

    // Paper Format
    const format = this.suratJalan.paperFormat || 'a4';
    previewPaper.className = `surat-jalan-paper ${format === 'a5-landscape' ? 'format-a5-landscape' : 'format-a4'}`;

    // Render Template HTML
    previewPaper.innerHTML = renderer.call(SuratJalanTemplates, this.suratJalan);

    // QR Code
    if (this.suratJalan.showQrCode && this.suratJalan.qrPayload) {
      setTimeout(() => {
        ExportManager.generateQrCode('surat-jalan-qr-code', this.suratJalan.qrPayload);
      }, 30);
    }

    // Quick Stats Bar in Sidebar
    const countEl = document.getElementById('summary-total-items');
    const qtyEl = document.getElementById('summary-total-qty');
    const totalQty = (this.suratJalan.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    if (countEl) countEl.textContent = `${(this.suratJalan.items || []).length} Baris`;
    if (qtyEl) qtyEl.textContent = `${totalQty} Unit`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /* ================= EVENT LISTENERS ================= */
  attachEventListeners() {
    const form = document.getElementById('editor-form');

    form?.addEventListener('input', (e) => this.handleFormChange(e));
    form?.addEventListener('change', (e) => this.handleFormChange(e));

    // Dynamic Items
    document.getElementById('btn-add-item')?.addEventListener('click', () => this.addItem());
    document.getElementById('items-form-container')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-item');
      if (btn) {
        const idx = Number(btn.dataset.index);
        this.deleteItem(idx);
      }
    });

    // Logo Upload & Remove
    document.getElementById('input-logo-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.suratJalan.logo = event.target?.result;
          this.renderSuratJalan();
          this.autoSaveDraft();
          this.showToast('Logo berhasil diunggah', 'success');
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('btn-remove-logo')?.addEventListener('click', () => {
      this.suratJalan.logo = '';
      const input = document.getElementById('input-logo-file');
      if (input) input.value = '';
      this.renderSuratJalan();
      this.autoSaveDraft();
      this.showToast('Logo dihapus', 'info');
    });

    // Clear Signature
    document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
      this.signatureManager?.clear();
      this.suratJalan.signatureData = '';
      this.renderSuratJalan();
      this.autoSaveDraft();
    });

    // Color Swatches
    document.querySelectorAll('.btn-color-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        if (color) {
          this.suratJalan.accentColor = color;
          const colorInput = document.getElementById('input-accent-color');
          if (colorInput) colorInput.value = color;
          this.renderSuratJalan();
          this.autoSaveDraft();
        }
      });
    });

    // Top Header Actions
    document.getElementById('btn-sample-data')?.addEventListener('click', () => this.loadSampleData());
    document.getElementById('btn-new-surat-jalan')?.addEventListener('click', () => this.createNewSuratJalan());
    document.getElementById('btn-save-surat-jalan')?.addEventListener('click', () => this.saveToHistory());
    document.getElementById('btn-history-modal')?.addEventListener('click', () => this.openHistoryModal());
    document.getElementById('btn-close-history-modal')?.addEventListener('click', () => this.closeHistoryModal());
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());

    // Export Actions
    document.getElementById('btn-print-surat-jalan')?.addEventListener('click', () => ExportManager.printInvoice());
    document.getElementById('btn-share-whatsapp')?.addEventListener('click', () => this.shareViaWhatsApp());
    document.getElementById('btn-download-pdf')?.addEventListener('click', () => this.downloadPdf());

    // Zoom Controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.adjustZoom(0.1));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.adjustZoom(-0.1));
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => this.setZoom(1.0));

    // Mobile Switcher Tabs
    document.getElementById('tab-btn-editor')?.addEventListener('click', () => this.switchMobileTab('editor'));
    document.getElementById('tab-btn-preview')?.addEventListener('click', () => this.switchMobileTab('preview'));
    document.getElementById('btn-mobile-sample')?.addEventListener('click', () => this.loadSampleData());
    document.getElementById('btn-mobile-history')?.addEventListener('click', () => this.openHistoryModal());

    // Mobile Bottom Sticky Action Bar
    document.getElementById('btn-mobile-save')?.addEventListener('click', () => this.saveToHistory());
    document.getElementById('btn-mobile-print')?.addEventListener('click', () => ExportManager.printInvoice());
    document.getElementById('btn-mobile-whatsapp')?.addEventListener('click', () => this.shareViaWhatsApp());
    document.getElementById('btn-mobile-pdf')?.addEventListener('click', () => this.downloadPdf());

    // Window Resize Responsive Handler
    window.addEventListener('resize', () => this.handleWindowResize());

    // History Search & Export/Import
    document.getElementById('history-search-input')?.addEventListener('input', (e) => this.filterHistoryTable(e.target.value));
    document.getElementById('btn-export-backup')?.addEventListener('click', () => StorageManager.exportSuratJalanBackupJSON());
    document.getElementById('input-import-backup')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = StorageManager.importSuratJalanBackupJSON(event.target?.result);
          if (success) {
            this.renderHistoryTable();
            this.updateStatsCards();
            this.showToast('Data surat jalan berhasil diimpor', 'success');
          } else {
            this.showToast('Gagal mengimpor file backup JSON', 'error');
          }
        };
        reader.readAsText(file);
      }
    });

    // Logout
    document.getElementById('btn-user-logout')?.addEventListener('click', () => {
      if (window.AuthManager) {
        window.AuthManager.logout();
        this.updateAuthNavUI();
        this.renderSuratJalan();
        this.showToast('Berhasil keluar dari akun', 'info');
      }
    });
  }

  /* ================= HANDLE FORM CHANGES ================= */
  handleFormChange(e) {
    const target = e.target;
    const id = target.id;

    // Design & Format
    if (id === 'select-template') this.suratJalan.template = target.value;
    if (id === 'select-paper-format') this.suratJalan.paperFormat = target.value;
    if (id === 'input-accent-color') this.suratJalan.accentColor = target.value;

    // Identifiers
    if (id === 'input-number') this.suratJalan.number = target.value;
    if (id === 'input-date') this.suratJalan.date = target.value;
    if (id === 'input-city') this.suratJalan.senderCity = target.value;
    if (id === 'select-status') this.suratJalan.status = target.value;
    if (id === 'toggle-show-status') {
      this.suratJalan.showStatus = target.checked;
      this.updateStatusState();
    }

    if (id === 'input-po-number') this.suratJalan.poNumber = target.value;
    if (id === 'toggle-show-po-number') {
      this.suratJalan.showPoNumber = target.checked;
      this.updatePoNumberState();
    }

    if (id === 'input-invoice-ref') this.suratJalan.invoiceRef = target.value;
    if (id === 'toggle-show-inv-number') {
      this.suratJalan.showInvNumber = target.checked;
      this.updateInvNumberState();
    }

    // Sender
    if (id === 'toggle-show-company-header') {
      this.suratJalan.showCompanyHeader = target.checked;
      this.updateCompanyHeaderState();
    }
    if (id === 'input-sender-name') this.suratJalan.senderName = target.value;
    if (id === 'input-sender-address') this.suratJalan.senderAddress = target.value;
    if (id === 'toggle-show-sender-contact') {
      this.suratJalan.showSenderContact = target.checked;
      this.updateSenderContactState();
    }
    if (id === 'input-sender-pic') this.suratJalan.senderPic = target.value;
    if (id === 'input-sender-phone') this.suratJalan.senderPhone = target.value;

    // Recipient
    if (id === 'input-recipient-name') this.suratJalan.recipientName = target.value;
    if (id === 'input-recipient-address') this.suratJalan.recipientAddress = target.value;
    if (id === 'toggle-show-recipient-contact') {
      this.suratJalan.showRecipientContact = target.checked;
      this.updateRecipientContactState();
    }
    if (id === 'input-recipient-pic') this.suratJalan.recipientPic = target.value;
    if (id === 'input-recipient-phone') this.suratJalan.recipientPhone = target.value;
    if (id === 'input-delivery-instructions') this.suratJalan.deliveryInstructions = target.value;
    if (id === 'input-recipient-signer') this.suratJalan.recipientSignerName = target.value;

    // Shipping & Armada
    if (id === 'toggle-show-shipping-info') {
      this.suratJalan.showShippingInfo = target.checked;
      this.updateShippingInfoState();
    }
    if (id === 'input-driver-name') this.suratJalan.driverName = target.value;
    if (id === 'input-vehicle-type') this.suratJalan.vehicleType = target.value;
    if (id === 'input-plate-number') this.suratJalan.plateNumber = target.value;
    if (id === 'input-tracking-number') this.suratJalan.trackingNumber = target.value;
    if (id === 'input-estimated-arrival') this.suratJalan.estimatedArrival = target.value;

    if (id === 'toggle-show-seal-number') {
      this.suratJalan.showSealNumber = target.checked;
      this.updateSealNumberState();
    }
    if (id === 'input-seal-number') this.suratJalan.sealNumber = target.value;

    // Item Table Toggles
    if (id === 'toggle-show-sku-column') {
      this.suratJalan.showSkuColumn = target.checked;
      this.renderItemsList();
    }
    if (id === 'toggle-show-item-condition') {
      this.suratJalan.showItemCondition = target.checked;
      this.renderItemsList();
    }

    // Dynamic Items Line
    if (target.dataset.index !== undefined) {
      const idx = Number(target.dataset.index);
      const item = this.suratJalan.items[idx];
      if (item) {
        if (target.classList.contains('item-sku')) item.sku = target.value;
        if (target.classList.contains('item-name')) item.name = target.value;
        if (target.classList.contains('item-desc')) item.description = target.value;
        if (target.classList.contains('item-qty')) item.quantity = Number(target.value) || 0;
        if (target.classList.contains('item-unit')) item.unit = target.value;
        if (target.classList.contains('item-condition')) item.condition = target.value;
      }
    }

    // Signatures & Stamp
    if (id === 'toggle-show-multi-signature') {
      this.suratJalan.showMultiSignature = target.checked;
      this.updateMultiSignatureState();
    }
    if (id === 'input-authorizer-name') this.suratJalan.authorizerName = target.value;
    if (id === 'input-authorizer-title') this.suratJalan.authorizerTitle = target.value;

    if (id === 'toggle-show-digital-sign') {
      this.suratJalan.showDigitalSign = target.checked;
      this.updateDigitalSignState();
    }

    if (id === 'toggle-show-stamp') {
      this.suratJalan.showStamp = target.checked;
      this.updateStampState();
    }
    if (id === 'input-stamp-text') this.suratJalan.stampText = target.value;
    if (id === 'select-stamp-color') this.suratJalan.stampColor = target.value;

    // QR & Notes
    if (id === 'toggle-show-qr') {
      this.suratJalan.showQrCode = target.checked;
      this.updateQrState();
    }
    if (id === 'input-qr-payload') this.suratJalan.qrPayload = target.value;

    if (id === 'toggle-show-notes') {
      this.suratJalan.showNotes = target.checked;
      this.updateNotesState();
    }
    if (id === 'input-notes') this.suratJalan.notes = target.value;

    // Re-render and save
    this.renderSuratJalan();
    this.autoSaveDraft();
  }

  autoSaveDraft() {
    StorageManager.saveSuratJalanDraft(this.suratJalan);
  }

  /* ================= SAMPLE & NEW DATA ================= */
  loadSampleData() {
    this.suratJalan = {
      ...getInitialSuratJalan(),
      id: 'sj_' + Date.now().toString(36),
      number: 'SJ-2026-088',
      poNumber: 'PO-2026-042',
      invoiceRef: 'INV-2026-042',
      date: new Date().toISOString().slice(0, 10),
      senderCity: 'Jakarta Utara',
      status: 'in_transit',
      driverName: 'Bambang Supriyanto',
      vehicleType: 'Truk Box CDD Long (Isuzu Giga)',
      plateNumber: 'B 9283 UXZ',
      trackingNumber: 'LOG-TRK-77821',
      recipientName: 'PT SINAR BERKAH LOGISTIK & DISTRIBUSI',
      recipientAddress: 'Kompleks Pergudangan Margomulyo Permai Blok D-14, Tandes, Surabaya',
      recipientPhone: '0813-8877-6655',
      recipientPic: 'Bpk. Irfan Maulana (Gudang Surabaya)',
      sealNumber: 'SEAL-JKT-88910'
    };

    this.populateForm();
    this.updateAllCheckboxStates();
    this.renderSuratJalan();
    this.autoSaveDraft();
    this.showToast('Contoh data surat jalan logistik berhasil dimuat!', 'success');
  }

  createNewSuratJalan() {
    if (confirm('Buat surat jalan baru? Perubahan saat ini yang belum tersimpan di riwayat akan hilang.')) {
      this.suratJalan = getInitialSuratJalan();
      this.populateForm();
      this.updateAllCheckboxStates();
      this.signatureManager?.clear();
      this.renderSuratJalan();
      this.autoSaveDraft();
      this.showToast('Surat jalan baru siap diisi', 'info');
    }
  }

  /* ================= HISTORY & STATS ================= */
  saveToHistory() {
    StorageManager.saveSuratJalanToHistory(this.suratJalan);
    this.renderHistoryTable();
    this.updateStatsCards();
    this.showToast(`Surat Jalan ${this.suratJalan.number} berhasil disimpan ke riwayat!`, 'success');
    if (typeof confetti === 'function') {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    }
  }

  renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const list = StorageManager.getAllSuratJalans();
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400 text-xs">
            Belum ada surat jalan tersimpan di riwayat. Klik "Simpan" di bar atas untuk menyimpan dokumen.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const totalQty = (item.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition">
          <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">${item.number || '-'}</td>
          <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">${item.recipientName || '-'}</td>
          <td class="py-3 px-4 text-slate-500 font-mono">${item.date || '-'}</td>
          <td class="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">${(item.items || []).length} Item (${totalQty} Unit)</td>
          <td class="py-3 px-4">${SuratJalanTemplates.renderStatusBadge(item.status)}</td>
          <td class="py-3 px-4 text-right">
            <button type="button" class="btn-load-history px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold rounded-lg hover:bg-amber-100 transition mr-1" data-id="${item.id}">Buka</button>
            <button type="button" class="btn-del-history p-1 text-slate-400 hover:text-rose-500 rounded-lg transition" data-id="${item.id}" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i></button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-load-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.loadSuratJalanById(id);
      });
    });

    tbody.querySelectorAll('.btn-del-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Hapus surat jalan ini dari riwayat?')) {
          StorageManager.deleteSuratJalan(id);
          this.renderHistoryTable();
          this.updateStatsCards();
          this.showToast('Surat jalan dihapus dari riwayat', 'info');
        }
      });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  loadSuratJalanById(id) {
    const item = StorageManager.getAllSuratJalans().find(sj => sj.id === id);
    if (item) {
      this.suratJalan = { ...item };
      this.populateForm();
      this.updateAllCheckboxStates();
      this.renderSuratJalan();
      this.autoSaveDraft();
      this.closeHistoryModal();
      this.showToast(`Surat Jalan ${this.suratJalan.number} dibuka`, 'success');
    }
  }

  filterHistoryTable(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#history-table-body tr');
    rows.forEach(row => {
      const text = row.textContent?.toLowerCase() || '';
      row.style.display = text.includes(q) ? '' : 'none';
    });
  }

  updateStatsCards() {
    const summary = StorageManager.getSuratJalanSummary();
    const countEl = document.getElementById('stat-total-surat-jalans');
    const deliveredEl = document.getElementById('stat-total-delivered');
    const inTransitEl = document.getElementById('stat-total-transit');

    if (countEl) countEl.textContent = summary.totalCount;
    if (deliveredEl) deliveredEl.textContent = summary.totalDelivered;
    if (inTransitEl) inTransitEl.textContent = summary.totalInTransit;
  }

  openHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.renderHistoryTable();
      this.updateStatsCards();
    }
  }

  closeHistoryModal() {
    document.getElementById('history-modal')?.classList.add('hidden');
  }

  /* ================= EXPORT & SHARE ================= */
  async downloadPdf() {
    const element = document.getElementById('surat-jalan-paper-preview');
    if (!element) return;

    const isLandscape = this.suratJalan.paperFormat === 'a5-landscape';
    const filename = `Surat_Jalan_${this.suratJalan.number || '001'}_${(this.suratJalan.recipientName || 'Klien').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Save previous transform to prevent mobile zoom scaling artifacts
    const prevTransform = element.style.transform;
    element.style.transform = 'none';

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          windowWidth: 1024
        },
        jsPDF: {
          unit: 'mm',
          format: isLandscape ? 'a5' : 'a4',
          orientation: isLandscape ? 'landscape' : 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      try {
        this.showToast('Memproses dokumen PDF Surat Jalan...', 'info');
        await html2pdf().set(opt).from(element).save();
        this.showToast('PDF Surat Jalan berhasil diunduh!', 'success');
      } catch (e) {
        console.error('PDF error, fallback to print:', e);
        window.print();
      } finally {
        element.style.transform = prevTransform;
      }
    } else {
      element.style.transform = prevTransform;
      window.print();
    }
  }

  shareViaWhatsApp() {
    const hasWatermark = typeof window.AuthManager !== 'undefined' ? window.AuthManager.shouldShowWatermark() : true;

    let text = '';
    if (hasWatermark) {
      text += `⚠️ *[CONTOH SURAT JALAN / SAMPLE]* ⚠️\n`;
      text += `_(Dibuat via InvoicePro - Belum Berlangganan Pro)_\n\n`;
    }

    text += `*SURAT JALAN / DELIVERY ORDER*\n`;
    text += `--------------------------------\n`;
    text += `*No. Surat Jalan:* ${this.suratJalan.number || '-'}\n`;
    text += `*Tanggal:* ${this.suratJalan.date || '-'}\n`;
    if (this.suratJalan.showPoNumber && this.suratJalan.poNumber) {
      text += `*No. PO:* ${this.suratJalan.poNumber}\n`;
    }
    if (this.suratJalan.showInvNumber && this.suratJalan.invoiceRef) {
      text += `*No. Faktur:* ${this.suratJalan.invoiceRef}\n`;
    }
    text += `*Status:* ${(this.suratJalan.status || 'DALAM PENGIRIMAN').toUpperCase()}\n\n`;

    text += `*Tujuan Pengiriman:*\n`;
    text += `${this.suratJalan.recipientName || '-'}\n`;
    text += `${this.suratJalan.recipientAddress || '-'}\n`;
    if (this.suratJalan.recipientPic) {
      text += `PIC: ${this.suratJalan.recipientPic} (${this.suratJalan.recipientPhone || '-'})\n`;
    }
    text += `\n`;

    if (this.suratJalan.showShippingInfo) {
      text += `*Armada & Pengemudi:*\n`;
      text += `- Pengemudi: ${this.suratJalan.driverName || '-'}\n`;
      text += `- Kendaraan: ${this.suratJalan.vehicleType || '-'} (${this.suratJalan.plateNumber || '-'})\n`;
      if (this.suratJalan.trackingNumber) {
        text += `- No. Resi: ${this.suratJalan.trackingNumber}\n`;
      }
      text += `\n`;
    }

    text += `*Daftar Barang Dikirim:*\n`;
    (this.suratJalan.items || []).forEach((it, idx) => {
      const skuStr = it.sku ? `[${it.sku}] ` : '';
      text += `${idx + 1}. ${skuStr}${it.name} - ${it.quantity} ${it.unit || 'Pcs'}\n`;
    });

    if (this.suratJalan.notes) {
      text += `\n*Catatan:* ${this.suratJalan.notes}\n`;
    }

    text += `\nTerima kasih atas kerja samanya! 🙏\n_${this.suratJalan.senderName || 'Logistik'}_`;

    let phone = (this.suratJalan.recipientPhone || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const waUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  }

  /* ================= ZOOM & MOBILE VIEW ================= */
  adjustZoom(delta) {
    this.setZoom(Math.min(1.5, Math.max(0.4, this.zoomLevel + delta)));
  }

  setZoom(level) {
    this.zoomLevel = Math.round(level * 10) / 10;
    const paper = document.getElementById('surat-jalan-paper-preview');
    const zoomText = document.getElementById('zoom-percentage-text');
    if (paper) {
      paper.style.transform = `scale(${this.zoomLevel})`;
      paper.style.transformOrigin = 'top center';
    }
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  switchMobileTab(tab) {
    this.currentTab = tab;
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');
    const tabBtnEditor = document.getElementById('tab-btn-editor');
    const tabBtnPreview = document.getElementById('tab-btn-preview');

    if (tab === 'editor') {
      if (editorPane) {
        editorPane.classList.remove('hidden');
        editorPane.classList.add('flex');
      }
      if (previewPane) {
        previewPane.classList.add('hidden');
        previewPane.classList.remove('flex');
      }
      if (tabBtnEditor) {
        tabBtnEditor.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs flex items-center justify-center gap-1.5 transition-all';
      }
      if (tabBtnPreview) {
        tabBtnPreview.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-all';
      }
    } else {
      if (editorPane) {
        editorPane.classList.add('hidden');
        editorPane.classList.remove('flex');
      }
      if (previewPane) {
        previewPane.classList.remove('hidden');
        previewPane.classList.add('flex');
      }
      if (tabBtnPreview) {
        tabBtnPreview.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs flex items-center justify-center gap-1.5 transition-all';
      }
      if (tabBtnEditor) {
        tabBtnEditor.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-all';
      }
      // On mobile screens, auto-scale preview so document fits the viewport nicely
      if (window.innerWidth < 768) {
        const targetZoom = Math.min(1.0, Math.max(0.4, (window.innerWidth - 32) / 800));
        this.setZoom(targetZoom);
      }
      this.renderSuratJalan();
    }
  }

  handleWindowResize() {
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');
    if (window.innerWidth >= 1024) {
      if (editorPane) {
        editorPane.classList.remove('hidden');
        editorPane.classList.add('flex');
      }
      if (previewPane) {
        previewPane.classList.remove('hidden');
        previewPane.classList.add('flex');
      }
      this.setZoom(1.0);
    } else {
      this.switchMobileTab(this.currentTab || 'editor');
    }
  }

  /* ================= AUTH NAV UI ================= */
  updateAuthNavUI() {
    const user = window.AuthManager ? window.AuthManager.getUser() : null;
    const loginBtn = document.getElementById('btn-header-login');
    const userBadge = document.getElementById('user-profile-badge');
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const avatarEl = document.getElementById('user-avatar-initials');
    const superadminLink = document.getElementById('btn-header-superadmin');

    if (user) {
      loginBtn?.classList.add('hidden');
      userBadge?.classList.remove('hidden');
      userBadge?.classList.add('flex');

      if (nameEl) nameEl.textContent = user.name || user.email.split('@')[0];
      if (roleEl) {
        const isSuper = window.AuthManager.isSuperadmin();
        roleEl.textContent = isSuper ? 'Superadmin' : (user.plan ? user.plan.toUpperCase() : 'Pro');
      }
      if (avatarEl) {
        avatarEl.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
      }

      if (window.AuthManager.isSuperadmin()) {
        superadminLink?.classList.remove('hidden');
      } else {
        superadminLink?.classList.add('hidden');
      }
    } else {
      loginBtn?.classList.remove('hidden');
      userBadge?.classList.add('hidden');
      userBadge?.classList.remove('flex');
      superadminLink?.classList.add('hidden');
    }
  }

  /* ================= TOAST NOTIFICATION ================= */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-amber-600 text-white' : (type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white');
    toast.className = `${bgClass} px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-fade-in pointer-events-auto`;
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-triangle' : 'info')}" class="w-4 h-4"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.suratJalanApp = new SuratJalanApp();
});
