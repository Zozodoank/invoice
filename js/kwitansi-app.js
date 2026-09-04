/**
 * Kwitansi Generator Application Controller
 * Manages full Indonesian receipt generation, 14 synchronized enable/disable checkboxes,
 * live preview rendering, signature canvas, and export utilities.
 */

function getInitialKwitansi() {
  return {
    id: 'kwt_' + Date.now().toString(36),
    number: 'KWT-2026-001',
    referenceNumber: 'INV-2026-001',
    date: new Date().toISOString().slice(0, 10),
    senderCity: 'Jakarta',
    status: 'paid', // paid, dp, installment, partial, deposit, cancelled
    template: 'classic', // classic, modern, minimalist, detailed
    paperFormat: 'landscape', // landscape (slip kwitansi), a4 (formal A4)
    accentColor: '#2563eb',
    currency: 'IDR',
    useDecimals: false,

    // Toggles (Kotak Centang)
    showCompanyHeader: true,
    showRefNumber: true,
    showStatus: true,
    showTerbilang: true,
    enableItems: false,
    enableDiscount: false,
    enableTax: false,
    enableMeterai: true,
    addMeteraiFee: false,
    showPaymentMethod: true,
    showSignature: true,
    showStamp: true,
    showQrCode: true,
    showNotes: true,

    // Sender / Company
    senderName: 'PT TEKNOLOGI DIGITAL ABADI',
    senderAddress: 'Jl. Jenderal Sudirman Kav. 52-53, Senayan, Jakarta Selatan',
    senderPhone: '0812-3456-7890',
    senderEmail: 'billing@digitalabadi.co.id',
    logo: '',

    // Client / Received from
    clientName: 'Bapak Ahmad Fauzi (PT Sinar Berkah Mandiri)',
    clientPhone: '0821-9876-5432',
    clientAddress: 'Jl. Gatot Subroto No. 88, Jakarta',

    // Payment description & single amount (when items disabled)
    paymentFor: 'Pembayaran Pelunasan Pembuatan Website & Aplikasi Mobile sesuai SPK No. 042/SPK/IX/2026',
    amount: 15000000,
    customTerbilang: '',

    // Items (when enableItems = true)
    items: [
      { name: 'Uang Muka (DP) Pembuatan Aplikasi', quantity: 1, unit: 'Paket', price: 10000000 },
      { name: 'Biaya Konfigurasi Server Cloud & Lisensi', quantity: 1, unit: 'Paket', price: 5000000 }
    ],

    // Calculations
    discountType: 'percent',
    discountValue: 5,
    taxRate: 11,

    // Payment method
    paymentMethod: 'Transfer Bank', // Tunai, Transfer Bank, Cek / Bilyet Giro, QRIS
    bankName: 'Bank Central Asia (BCA)',
    bankAccount: '8830-1234-56',
    bankHolder: 'PT TEKNOLOGI DIGITAL ABADI',
    chequeNumber: '',

    // Stamp
    stampText: 'LUNAS',
    stampColor: 'red', // red, blue, emerald

    // Signer & Signature
    signerName: 'Budi Santoso, S.Kom',
    signerTitle: 'Finance & Accounting Manager',
    signatureData: '',

    // QR Code
    qrPayload: 'https://digitalabadi.co.id/verify/KWT-2026-001',

    // Notes
    notes: 'Pembayaran dianggap sah setelah cek/bilyet giro berhasil diuangkan. Kwitansi ini merupakan bukti penerimaan pembayaran yang sah.'
  };
}

class KwitansiApp {
  constructor() {
    this.kwitansi = StorageManager.loadKwitansiDraft() || getInitialKwitansi();
    this.zoomLevel = 1.0;
    this.signatureManager = null;
    this.currentTab = 'editor'; // mobile view

    this.init();
  }

  init() {
    this.initSignaturePad();
    this.populateForm();
    this.updateAllCheckboxStates();
    this.renderKwitansi();
    this.renderHistoryTable();
    this.attachEventListeners();
    this.initTheme();
    this.updateStatsCards();
    this.updateAuthNavUI();

    // Listen to global auth changes (login/logout) to refresh watermark
    window.addEventListener('auth:change', () => {
      this.updateAuthNavUI();
      this.renderKwitansi();
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
      this.kwitansi.signatureData = dataUrl;
      this.renderKwitansi();
      this.autoSaveDraft();
    });
  }

  /* ================= CALCULATIONS ================= */
  calculateTotals() {
    let subtotal = 0;
    if (this.kwitansi.enableItems && this.kwitansi.items && this.kwitansi.items.length > 0) {
      this.kwitansi.items.forEach(item => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        const price = Math.max(0, Number(item.price) || 0);
        subtotal += (qty * price);
      });
    } else {
      subtotal = Math.max(0, Number(this.kwitansi.amount) || 0);
    }

    let discountAmount = 0;
    if (this.kwitansi.enableDiscount) {
      if (this.kwitansi.discountType === 'percent') {
        discountAmount = subtotal * ((Number(this.kwitansi.discountValue) || 0) / 100);
      } else {
        discountAmount = Number(this.kwitansi.discountValue) || 0;
      }
      discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);

    let taxAmount = 0;
    if (this.kwitansi.enableTax && Number(this.kwitansi.taxRate) > 0) {
      taxAmount = taxableAmount * (Number(this.kwitansi.taxRate) / 100);
    }

    let meteraiFee = 0;
    if (this.kwitansi.enableMeterai && this.kwitansi.addMeteraiFee) {
      meteraiFee = 10000;
    }

    const finalAmount = Math.max(0, taxableAmount + taxAmount + meteraiFee);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      meteraiFee,
      finalAmount
    };
  }

  /* ================= POPULATE FORM CONTROLS ================= */
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
    setVal('select-template', this.kwitansi.template);
    setVal('select-paper-format', this.kwitansi.paperFormat);
    setVal('select-currency', this.kwitansi.currency);
    setVal('input-accent-color', this.kwitansi.accentColor);
    setCheck('toggle-use-decimals', this.kwitansi.useDecimals);

    // Identifiers
    setVal('input-number', this.kwitansi.number);
    setVal('input-date', this.kwitansi.date);
    setVal('input-city', this.kwitansi.senderCity);
    setVal('select-status', this.kwitansi.status);
    setCheck('toggle-show-status', this.kwitansi.showStatus);
    setVal('input-ref-number', this.kwitansi.referenceNumber);
    setCheck('toggle-show-ref-number', this.kwitansi.showRefNumber);

    // Company / Sender
    setCheck('toggle-show-company-header', this.kwitansi.showCompanyHeader);
    setVal('input-sender-name', this.kwitansi.senderName);
    setVal('input-sender-address', this.kwitansi.senderAddress);
    setVal('input-sender-phone', this.kwitansi.senderPhone);
    setVal('input-sender-email', this.kwitansi.senderEmail);

    // Client
    setVal('input-client-name', this.kwitansi.clientName);
    setVal('input-client-phone', this.kwitansi.clientPhone);
    setVal('input-client-address', this.kwitansi.clientAddress);

    // Payment For & Amount
    setVal('input-payment-for', this.kwitansi.paymentFor);
    setVal('input-single-amount', this.kwitansi.amount);
    setCheck('toggle-show-terbilang', this.kwitansi.showTerbilang);
    setVal('input-custom-terbilang', this.kwitansi.customTerbilang);

    // Multi-Item
    setCheck('toggle-enable-items', this.kwitansi.enableItems);
    this.renderItemsList();

    // Discount & Tax
    setCheck('toggle-enable-discount', this.kwitansi.enableDiscount);
    setVal('input-discount-value', this.kwitansi.discountValue);
    setVal('select-discount-type', this.kwitansi.discountType);

    setCheck('toggle-enable-tax', this.kwitansi.enableTax);
    setVal('input-tax-rate', this.kwitansi.taxRate);

    // Materai
    setCheck('toggle-enable-meterai', this.kwitansi.enableMeterai);
    setCheck('toggle-add-meterai-fee', this.kwitansi.addMeteraiFee);

    // Payment Method
    setCheck('toggle-show-payment-method', this.kwitansi.showPaymentMethod);
    setVal('select-payment-method', this.kwitansi.paymentMethod);
    setVal('input-bank-name', this.kwitansi.bankName);
    setVal('input-bank-account', this.kwitansi.bankAccount);
    setVal('input-bank-holder', this.kwitansi.bankHolder);
    setVal('input-cheque-number', this.kwitansi.chequeNumber);

    // Stamp
    setCheck('toggle-show-stamp', this.kwitansi.showStamp);
    setVal('input-stamp-text', this.kwitansi.stampText);
    setVal('select-stamp-color', this.kwitansi.stampColor);

    // Signature
    setCheck('toggle-show-signature', this.kwitansi.showSignature);
    setVal('input-signer-name', this.kwitansi.signerName);
    setVal('input-signer-title', this.kwitansi.signerTitle);

    // QR & Notes
    setCheck('toggle-show-qr', this.kwitansi.showQrCode);
    setVal('input-qr-payload', this.kwitansi.qrPayload);
    setCheck('toggle-show-notes', this.kwitansi.showNotes);
    setVal('input-notes', this.kwitansi.notes);
  }

  /* ================= SYNC ALL 14 CHECKBOX STATES ================= */
  updateAllCheckboxStates() {
    this.updateCompanyHeaderState();
    this.updateRefNumberState();
    this.updateStatusState();
    this.updateTerbilangState();
    this.updateItemsState();
    this.updateDiscountState();
    this.updateTaxState();
    this.updateMeteraiState();
    this.updatePaymentMethodState();
    this.updateSignatureState();
    this.updateStampState();
    this.updateQrState();
    this.updateNotesState();
  }

  updateCompanyHeaderState() {
    const isEnabled = this.kwitansi.showCompanyHeader !== false;
    const group = document.getElementById('company-header-fields-group');
    const inputs = ['input-sender-name', 'input-sender-address', 'input-sender-phone', 'input-sender-email', 'input-logo-file', 'btn-remove-logo'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });
    if (group) {
      if (isEnabled) {
        group.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        group.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateRefNumberState() {
    const isEnabled = this.kwitansi.showRefNumber !== false;
    const input = document.getElementById('input-ref-number');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) {
        input.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        input.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateStatusState() {
    const isEnabled = this.kwitansi.showStatus !== false;
    const select = document.getElementById('select-status');
    if (select) {
      select.disabled = !isEnabled;
      if (isEnabled) {
        select.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        select.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateTerbilangState() {
    const isEnabled = this.kwitansi.showTerbilang !== false;
    const input = document.getElementById('input-custom-terbilang');
    if (input) {
      input.disabled = !isEnabled;
      if (isEnabled) {
        input.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        input.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateItemsState() {
    const isItemsEnabled = !!this.kwitansi.enableItems;
    const singleAmountGroup = document.getElementById('single-amount-group');
    const itemsSection = document.getElementById('items-table-section');
    const singleAmountInput = document.getElementById('input-single-amount');

    if (singleAmountInput) singleAmountInput.disabled = isItemsEnabled;

    if (isItemsEnabled) {
      if (singleAmountGroup) singleAmountGroup.classList.add('hidden');
      if (itemsSection) itemsSection.classList.remove('hidden');
    } else {
      if (singleAmountGroup) singleAmountGroup.classList.remove('hidden');
      if (itemsSection) itemsSection.classList.add('hidden');
    }
  }

  updateDiscountState() {
    const isEnabled = !!this.kwitansi.enableDiscount;
    const group = document.getElementById('discount-input-group');
    const valInput = document.getElementById('input-discount-value');
    const typeSelect = document.getElementById('select-discount-type');

    if (valInput) valInput.disabled = !isEnabled;
    if (typeSelect) typeSelect.disabled = !isEnabled;

    if (group) {
      if (isEnabled) {
        group.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        group.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateTaxState() {
    const isEnabled = !!this.kwitansi.enableTax;
    const group = document.getElementById('tax-input-group');
    const taxInput = document.getElementById('input-tax-rate');
    const quickButtons = document.querySelectorAll('.btn-quick-tax');

    if (taxInput) taxInput.disabled = !isEnabled;
    quickButtons.forEach(btn => btn.disabled = !isEnabled);

    if (group) {
      if (isEnabled) {
        group.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        group.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateMeteraiState() {
    const isEnabled = !!this.kwitansi.enableMeterai;
    const feeToggle = document.getElementById('toggle-add-meterai-fee');
    const feeLabel = document.getElementById('meterai-fee-label');

    if (feeToggle) feeToggle.disabled = !isEnabled;
    if (feeLabel) {
      if (isEnabled) {
        feeLabel.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        feeLabel.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updatePaymentMethodState() {
    const isEnabled = this.kwitansi.showPaymentMethod !== false;
    const group = document.getElementById('payment-method-fields-group');
    const inputs = ['select-payment-method', 'input-bank-name', 'input-bank-account', 'input-bank-holder', 'input-cheque-number'];

    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });

    if (group) {
      if (isEnabled) {
        group.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        group.classList.add('opacity-40', 'pointer-events-none');
      }
    }

    // Toggle bank vs cheque fields depending on method
    const method = this.kwitansi.paymentMethod;
    const bankFields = document.getElementById('bank-details-fields');
    const chequeFields = document.getElementById('cheque-details-fields');
    if (bankFields) {
      if (isEnabled && method === 'Transfer Bank') {
        bankFields.classList.remove('hidden');
      } else {
        bankFields.classList.add('hidden');
      }
    }
    if (chequeFields) {
      if (isEnabled && method === 'Cek / Bilyet Giro') {
        chequeFields.classList.remove('hidden');
      } else {
        chequeFields.classList.add('hidden');
      }
    }
  }

  updateSignatureState() {
    const isEnabled = this.kwitansi.showSignature !== false;
    const group = document.getElementById('signature-fields-group');
    const inputs = ['input-signer-name', 'input-signer-title', 'btn-clear-signature'];

    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });

    if (group) {
      if (isEnabled) {
        group.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        group.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateStampState() {
    const isEnabled = !!this.kwitansi.showStamp;
    const group = document.getElementById('stamp-fields-group');
    const inputs = ['input-stamp-text', 'select-stamp-color'];

    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !isEnabled;
    });

    if (group) {
      if (isEnabled) {
        group.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        group.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateQrState() {
    const isEnabled = !!this.kwitansi.showQrCode;
    const qrInput = document.getElementById('input-qr-payload');
    if (qrInput) {
      qrInput.disabled = !isEnabled;
      if (isEnabled) {
        qrInput.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        qrInput.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateNotesState() {
    const isEnabled = this.kwitansi.showNotes !== false;
    const notesInput = document.getElementById('input-notes');
    if (notesInput) {
      notesInput.disabled = !isEnabled;
      if (isEnabled) {
        notesInput.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        notesInput.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  /* ================= RENDER ITEMS LIST ================= */
  renderItemsList() {
    const container = document.getElementById('items-form-container');
    if (!container) return;
    container.innerHTML = '';
    const curr = this.kwitansi.currency || 'IDR';

    (this.kwitansi.items || []).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs relative animate-fade-in';
      row.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-400 font-mono">Item #${index + 1}</span>
          <button type="button" class="btn-delete-item p-1 text-slate-400 hover:text-rose-500 rounded-md transition" data-index="${index}" title="Hapus Item">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <div class="grid grid-cols-1 gap-1.5">
          <input type="text" class="item-name w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-xs" data-index="${index}" placeholder="Nama Barang / Rincian Pembayaran" value="${item.name || ''}" />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-[10px] text-slate-400 font-medium block">Qty</label>
            <input type="number" min="0" step="any" class="item-qty w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono-num" data-index="${index}" value="${item.quantity || 1}" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400 font-medium block">Satuan</label>
            <input type="text" class="item-unit w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" data-index="${index}" placeholder="Paket/Bln" value="${item.unit || ''}" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400 font-medium block">Harga (${curr})</label>
            <input type="number" min="0" step="any" class="item-price w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono-num font-semibold" data-index="${index}" value="${item.price || 0}" />
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  addItem() {
    if (!this.kwitansi.items) this.kwitansi.items = [];
    this.kwitansi.items.push({
      name: 'Rincian Pembayaran Tambahan',
      quantity: 1,
      unit: 'Paket',
      price: 1000000
    });
    this.renderItemsList();
    this.renderKwitansi();
    this.autoSaveDraft();
  }

  deleteItem(index) {
    if (!this.kwitansi.items) return;
    this.kwitansi.items.splice(index, 1);
    this.renderItemsList();
    this.renderKwitansi();
    this.autoSaveDraft();
  }

  /* ================= LIVE PREVIEW RENDERER ================= */
  renderKwitansi() {
    const previewPaper = document.getElementById('kwitansi-paper-preview');
    if (!previewPaper) return;

    const templateName = this.kwitansi.template || 'classic';
    const renderer = KwitansiTemplates[templateName] || KwitansiTemplates.classic;
    const totals = this.calculateTotals();

    // Format Paper Size
    const paperFormat = this.kwitansi.paperFormat || 'landscape';
    previewPaper.className = `kwitansi-paper ${paperFormat === 'a4' ? 'format-a4' : 'format-landscape'}`;

    // Render HTML template
    previewPaper.innerHTML = renderer.call(KwitansiTemplates, this.kwitansi, totals);

    // Generate QR Code if enabled
    if (this.kwitansi.showQrCode && this.kwitansi.qrPayload) {
      setTimeout(() => {
        ExportManager.generateQrCode('kwitansi-qr-code', this.kwitansi.qrPayload);
      }, 30);
    }

    // Update Quick Sidebar Summary Card
    this.updateSummaryCard(totals);

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  updateSummaryCard(totals) {
    const curr = this.kwitansi.currency || 'IDR';
    const dec = this.kwitansi.useDecimals;

    const elSubtotal = document.getElementById('summary-subtotal');
    const elDiscount = document.getElementById('summary-discount');
    const elTax = document.getElementById('summary-tax');
    const elMeterai = document.getElementById('summary-meterai');
    const elFinal = document.getElementById('summary-final-total');

    if (elSubtotal) elSubtotal.textContent = formatCurrency(totals.subtotal, curr, dec);
    if (elDiscount) elDiscount.textContent = totals.discountAmount > 0 ? `-${formatCurrency(totals.discountAmount, curr, dec)}` : 'Rp 0';
    if (elTax) elTax.textContent = totals.taxAmount > 0 ? `+${formatCurrency(totals.taxAmount, curr, dec)}` : 'Rp 0';
    if (elMeterai) elMeterai.textContent = totals.meteraiFee > 0 ? `+${formatCurrency(totals.meteraiFee, curr, dec)}` : 'Rp 0';
    if (elFinal) elFinal.textContent = formatCurrency(totals.finalAmount, curr, dec);
  }

  /* ================= EVENT LISTENERS ================= */
  attachEventListeners() {
    const form = document.getElementById('editor-form');

    // Input changes
    form?.addEventListener('input', (e) => this.handleFormChange(e));
    form?.addEventListener('change', (e) => this.handleFormChange(e));

    // Dynamic Item Rows
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
          this.kwitansi.logo = event.target?.result;
          this.renderKwitansi();
          this.autoSaveDraft();
          this.showToast('Logo berhasil diunggah', 'success');
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('btn-remove-logo')?.addEventListener('click', () => {
      this.kwitansi.logo = '';
      const input = document.getElementById('input-logo-file');
      if (input) input.value = '';
      this.renderKwitansi();
      this.autoSaveDraft();
      this.showToast('Logo dihapus', 'info');
    });

    // Clear Signature
    document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
      this.signatureManager?.clear();
      this.kwitansi.signatureData = '';
      this.renderKwitansi();
      this.autoSaveDraft();
    });

    // Accent Color Presets
    document.querySelectorAll('.btn-color-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        if (color) {
          this.kwitansi.accentColor = color;
          const colorInput = document.getElementById('input-accent-color');
          if (colorInput) colorInput.value = color;
          this.renderKwitansi();
          this.autoSaveDraft();
        }
      });
    });

    // Header Actions
    document.getElementById('btn-sample-data')?.addEventListener('click', () => this.loadSampleData());
    document.getElementById('btn-new-kwitansi')?.addEventListener('click', () => this.createNewKwitansi());
    document.getElementById('btn-save-kwitansi')?.addEventListener('click', () => this.saveToHistory());
    document.getElementById('btn-history-modal')?.addEventListener('click', () => this.openHistoryModal());
    document.getElementById('btn-close-history-modal')?.addEventListener('click', () => this.closeHistoryModal());
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());

    // Export Actions
    document.getElementById('btn-print-kwitansi')?.addEventListener('click', () => ExportManager.printInvoice());
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
    document.getElementById('btn-export-backup')?.addEventListener('click', () => StorageManager.exportKwitansiBackupJSON());
    document.getElementById('input-import-backup')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = StorageManager.importKwitansiBackupJSON(event.target?.result);
          if (success) {
            this.renderHistoryTable();
            this.updateStatsCards();
            this.showToast('Data kwitansi berhasil diimpor', 'success');
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
        this.renderKwitansi();
        this.showToast('Berhasil keluar dari akun', 'info');
      }
    });
  }

  /* ================= HANDLE FORM CHANGES ================= */
  handleFormChange(e) {
    const target = e.target;
    const id = target.id;

    // Design & Template
    if (id === 'select-template') this.kwitansi.template = target.value;
    if (id === 'select-paper-format') this.kwitansi.paperFormat = target.value;
    if (id === 'select-currency') {
      this.kwitansi.currency = target.value;
      this.renderItemsList();
    }
    if (id === 'input-accent-color') this.kwitansi.accentColor = target.value;
    if (id === 'toggle-use-decimals') this.kwitansi.useDecimals = target.checked;

    // Identifiers
    if (id === 'input-number') this.kwitansi.number = target.value;
    if (id === 'input-date') this.kwitansi.date = target.value;
    if (id === 'input-city') this.kwitansi.senderCity = target.value;
    if (id === 'select-status') this.kwitansi.status = target.value;
    if (id === 'toggle-show-status') {
      this.kwitansi.showStatus = target.checked;
      this.updateStatusState();
    }
    if (id === 'input-ref-number') this.kwitansi.referenceNumber = target.value;
    if (id === 'toggle-show-ref-number') {
      this.kwitansi.showRefNumber = target.checked;
      this.updateRefNumberState();
    }

    // Company / Sender
    if (id === 'toggle-show-company-header') {
      this.kwitansi.showCompanyHeader = target.checked;
      this.updateCompanyHeaderState();
    }
    if (id === 'input-sender-name') this.kwitansi.senderName = target.value;
    if (id === 'input-sender-address') this.kwitansi.senderAddress = target.value;
    if (id === 'input-sender-phone') this.kwitansi.senderPhone = target.value;
    if (id === 'input-sender-email') this.kwitansi.senderEmail = target.value;

    // Client
    if (id === 'input-client-name') this.kwitansi.clientName = target.value;
    if (id === 'input-client-phone') this.kwitansi.clientPhone = target.value;
    if (id === 'input-client-address') this.kwitansi.clientAddress = target.value;

    // Payment For & Amount
    if (id === 'input-payment-for') this.kwitansi.paymentFor = target.value;
    if (id === 'input-single-amount') this.kwitansi.amount = Number(target.value) || 0;
    if (id === 'toggle-show-terbilang') {
      this.kwitansi.showTerbilang = target.checked;
      this.updateTerbilangState();
    }
    if (id === 'input-custom-terbilang') this.kwitansi.customTerbilang = target.value;

    // Multi-Item
    if (id === 'toggle-enable-items') {
      this.kwitansi.enableItems = target.checked;
      this.updateItemsState();
    }

    // Dynamic Items Line
    if (target.dataset.index !== undefined) {
      const idx = Number(target.dataset.index);
      const item = this.kwitansi.items[idx];
      if (item) {
        if (target.classList.contains('item-name')) item.name = target.value;
        if (target.classList.contains('item-qty')) item.quantity = Number(target.value) || 0;
        if (target.classList.contains('item-unit')) item.unit = target.value;
        if (target.classList.contains('item-price')) item.price = Number(target.value) || 0;
      }
    }

    // Discount & Tax
    if (id === 'toggle-enable-discount') {
      this.kwitansi.enableDiscount = target.checked;
      this.updateDiscountState();
    }
    if (id === 'input-discount-value') this.kwitansi.discountValue = Number(target.value) || 0;
    if (id === 'select-discount-type') this.kwitansi.discountType = target.value;

    if (id === 'toggle-enable-tax') {
      this.kwitansi.enableTax = target.checked;
      this.updateTaxState();
    }
    if (id === 'input-tax-rate') this.kwitansi.taxRate = Number(target.value) || 0;

    // Materai
    if (id === 'toggle-enable-meterai') {
      this.kwitansi.enableMeterai = target.checked;
      this.updateMeteraiState();
    }
    if (id === 'toggle-add-meterai-fee') this.kwitansi.addMeteraiFee = target.checked;

    // Payment Method
    if (id === 'toggle-show-payment-method') {
      this.kwitansi.showPaymentMethod = target.checked;
      this.updatePaymentMethodState();
    }
    if (id === 'select-payment-method') {
      this.kwitansi.paymentMethod = target.value;
      this.updatePaymentMethodState();
    }
    if (id === 'input-bank-name') this.kwitansi.bankName = target.value;
    if (id === 'input-bank-account') this.kwitansi.bankAccount = target.value;
    if (id === 'input-bank-holder') this.kwitansi.bankHolder = target.value;
    if (id === 'input-cheque-number') this.kwitansi.chequeNumber = target.value;

    // Stamp
    if (id === 'toggle-show-stamp') {
      this.kwitansi.showStamp = target.checked;
      this.updateStampState();
    }
    if (id === 'input-stamp-text') this.kwitansi.stampText = target.value;
    if (id === 'select-stamp-color') this.kwitansi.stampColor = target.value;

    // Signature
    if (id === 'toggle-show-signature') {
      this.kwitansi.showSignature = target.checked;
      this.updateSignatureState();
    }
    if (id === 'input-signer-name') this.kwitansi.signerName = target.value;
    if (id === 'input-signer-title') this.kwitansi.signerTitle = target.value;

    // QR Code & Notes
    if (id === 'toggle-show-qr') {
      this.kwitansi.showQrCode = target.checked;
      this.updateQrState();
    }
    if (id === 'input-qr-payload') this.kwitansi.qrPayload = target.value;

    if (id === 'toggle-show-notes') {
      this.kwitansi.showNotes = target.checked;
      this.updateNotesState();
    }
    if (id === 'input-notes') this.kwitansi.notes = target.value;

    // Re-render and auto-save
    this.renderKwitansi();
    this.autoSaveDraft();
  }

  autoSaveDraft() {
    StorageManager.saveKwitansiDraft(this.kwitansi);
  }

  /* ================= SAMPLE & NEW DATA ================= */
  loadSampleData() {
    this.kwitansi = {
      ...getInitialKwitansi(),
      id: 'kwt_' + Date.now().toString(36),
      number: 'KWT-2026-088',
      referenceNumber: 'INV-2026-042',
      date: new Date().toISOString().slice(0, 10),
      senderCity: 'Jakarta Selatan',
      clientName: 'PT SINAR BERKAH LOGISTIK',
      clientPhone: '0812-9988-7766',
      clientAddress: 'Kawasan Industri Pulogadung Blok B No. 12, Jakarta Timur',
      paymentFor: 'Pembayaran Pelunasan Pengadaan 10 Unit Komputer & Setup Jaringan Kantor Cabang Sesuai Invoice INV-2026-042',
      amount: 47500000,
      status: 'paid',
      enableMeterai: true,
      showStamp: true,
      stampText: 'LUNAS',
      showPaymentMethod: true,
      paymentMethod: 'Transfer Bank',
      bankName: 'Bank Central Asia (BCA)',
      bankAccount: '8830-1234-56',
      bankHolder: 'PT TEKNOLOGI DIGITAL ABADI',
      signerName: 'Budi Santoso, S.Kom',
      signerTitle: 'Direktur Utama',
      notes: 'Pembayaran telah diterima lunas dengan transfer bank. Terima kasih atas kepercayaan Anda.'
    };

    this.populateForm();
    this.updateAllCheckboxStates();
    this.renderKwitansi();
    this.autoSaveDraft();
    this.showToast('Contoh data kwitansi berhasil dimuat!', 'success');
  }

  createNewKwitansi() {
    if (confirm('Buat kwitansi baru? Perubahan belum tersimpan di riwayat akan hilang.')) {
      this.kwitansi = getInitialKwitansi();
      this.populateForm();
      this.updateAllCheckboxStates();
      this.signatureManager?.clear();
      this.renderKwitansi();
      this.autoSaveDraft();
      this.showToast('Kwitansi baru siap diisi', 'info');
    }
  }

  /* ================= HISTORY & STATS ================= */
  saveToHistory() {
    StorageManager.saveKwitansiToHistory(this.kwitansi);
    this.renderHistoryTable();
    this.updateStatsCards();
    this.showToast(`Kwitansi ${this.kwitansi.number} berhasil disimpan ke riwayat!`, 'success');
    if (typeof confetti === 'function') {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    }
  }

  renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const list = StorageManager.getAllKwitansis();
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400 text-xs">
            Belum ada kwitansi tersimpan di riwayat. Klik "Simpan" di bar atas untuk menyimpan.
          </td>
        </tr>
      `;
      return;
    }

    const curr = this.kwitansi.currency || 'IDR';
    tbody.innerHTML = list.map(item => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition">
        <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">${item.number || '-'}</td>
        <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">${item.clientName || '-'}</td>
        <td class="py-3 px-4 text-slate-500 font-mono">${item.date || '-'}</td>
        <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">${formatCurrency(item.amount || 0, curr, false)}</td>
        <td class="py-3 px-4">${KwitansiTemplates.renderStatusBadge(item.status)}</td>
        <td class="py-3 px-4 text-right">
          <button type="button" class="btn-load-history px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg hover:bg-blue-100 transition mr-1" data-id="${item.id}">Buka</button>
          <button type="button" class="btn-del-history p-1 text-slate-400 hover:text-rose-500 rounded-lg transition" data-id="${item.id}" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-load-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.loadKwitansiById(id);
      });
    });

    tbody.querySelectorAll('.btn-del-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Hapus kwitansi ini dari riwayat?')) {
          StorageManager.deleteKwitansi(id);
          this.renderHistoryTable();
          this.updateStatsCards();
          this.showToast('Kwitansi dihapus dari riwayat', 'info');
        }
      });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  loadKwitansiById(id) {
    const item = StorageManager.getAllKwitansis().find(k => k.id === id);
    if (item) {
      this.kwitansi = { ...item };
      this.populateForm();
      this.updateAllCheckboxStates();
      this.renderKwitansi();
      this.autoSaveDraft();
      this.closeHistoryModal();
      this.showToast(`Kwitansi ${this.kwitansi.number} berhasil dibuka`, 'success');
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
    const summary = StorageManager.getKwitansiSummary();
    const curr = this.kwitansi.currency || 'IDR';

    const countEl = document.getElementById('stat-total-kwitansis');
    const amountEl = document.getElementById('stat-total-kwitansi-amount');
    const paidEl = document.getElementById('stat-total-kwitansi-paid');

    if (countEl) countEl.textContent = summary.totalCount;
    if (amountEl) amountEl.textContent = formatCurrency(summary.totalAmount, curr, false);
    if (paidEl) paidEl.textContent = formatCurrency(summary.totalPaid, curr, false);
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

  async downloadPdf() {
    const element = document.getElementById('kwitansi-paper-preview');
    if (!element) return;

    const isLandscape = this.kwitansi.paperFormat !== 'a4';
    const filename = `Kwitansi_${this.kwitansi.number || '001'}_${(this.kwitansi.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Save previous transform to prevent mobile zoom scaling artifacts
    const prevTransform = element.style.transform;
    element.style.transform = 'none';

    // Calculate actual height needed in mm (1px = 0.264583 mm) so nominal & signature are NEVER cut off
    const heightMm = isLandscape ? Math.max(140, Math.ceil(element.scrollHeight * 0.264583) + 6) : 297;

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
          format: isLandscape ? [210, heightMm] : 'a4',
          orientation: isLandscape ? 'landscape' : 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      try {
        this.showToast('Memproses dokumen PDF...', 'info');
        await html2pdf().set(opt).from(element).save();
        this.showToast('PDF Kwitansi berhasil diunduh!', 'success');
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
    const totals = this.calculateTotals();
    const curr = this.kwitansi.currency || 'IDR';
    const dec = this.kwitansi.useDecimals;
    const hasWatermark = typeof window.AuthManager !== 'undefined' ? window.AuthManager.shouldShowWatermark() : true;

    let text = '';
    if (hasWatermark) {
      text += `⚠️ *[CONTOH KWITANSI / SAMPLE]* ⚠️\n`;
      text += `_(Dibuat via InvoicePro - Belum Berlangganan Pro)_\n\n`;
    }

    text += `*BUKTI PENERIMAAN PEMBAYARAN (KWITANSI)*\n`;
    text += `--------------------------------\n`;
    text += `*No. Kwitansi:* ${this.kwitansi.number || '-'}\n`;
    text += `*Tanggal:* ${this.kwitansi.date || '-'}\n`;
    if (this.kwitansi.showRefNumber && this.kwitansi.referenceNumber) {
      text += `*No. Referensi:* ${this.kwitansi.referenceNumber}\n`;
    }
    text += `*Status:* ${(this.kwitansi.status || 'LUNAS').toUpperCase()}\n\n`;
    text += `*Telah Terima Dari:* ${this.kwitansi.clientName || '-'}\n`;
    text += `*Untuk Pembayaran:* ${this.kwitansi.paymentFor || '-'}\n\n`;

    if (this.kwitansi.showTerbilang) {
      const terbilangText = this.kwitansi.customTerbilang || getSpelledOutAmount(totals.finalAmount, curr, 'id');
      text += `*Terbilang:* _### ${terbilangText} ###_\n\n`;
    }

    text += `*JUMLAH TOTAL:* *${formatCurrency(totals.finalAmount, curr, dec)}*\n`;

    if (this.kwitansi.showPaymentMethod) {
      text += `\n*Metode Pembayaran:* ${this.kwitansi.paymentMethod || 'Tunai'}\n`;
      if (this.kwitansi.paymentMethod === 'Transfer Bank' && this.kwitansi.bankName) {
        text += `- ${this.kwitansi.bankName}: ${this.kwitansi.bankAccount} (a.n. ${this.kwitansi.bankHolder})\n`;
      }
    }

    if (this.kwitansi.notes) {
      text += `\n*Catatan:* ${this.kwitansi.notes}\n`;
    }

    text += `\nTerima kasih atas pembayarannya! 🙏\n_${this.kwitansi.senderName || 'Kami'}_`;

    let phone = (this.kwitansi.clientPhone || '').replace(/[^0-9]/g, '');
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
    this.setZoom(Math.min(1.5, Math.max(0.5, this.zoomLevel + delta)));
  }

  setZoom(level) {
    this.zoomLevel = Math.round(level * 10) / 10;
    const paper = document.getElementById('kwitansi-paper-preview');
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
        tabBtnEditor.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs flex items-center justify-center gap-1.5 transition-all';
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
        tabBtnPreview.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs flex items-center justify-center gap-1.5 transition-all';
      }
      if (tabBtnEditor) {
        tabBtnEditor.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-all';
      }
      // On mobile screens, auto-scale preview so receipt paper fits the screen width cleanly
      if (window.innerWidth < 768) {
        const targetZoom = Math.min(1.0, Math.max(0.4, (window.innerWidth - 32) / 800));
        this.setZoom(targetZoom);
      }
      this.renderKwitansi();
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
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white' : (type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white');
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
  window.kwitansiApp = new KwitansiApp();
});
