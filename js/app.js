/**
 * Main Application Controller & State Manager
 */

// Default Blank / Starter Invoice Generator State
function getInitialInvoice() {
  const today = new Date();
  const dueDate = new Date();
  dueDate.setDate(today.getDate() + 14);

  const formatDate = (d) => d.toISOString().split('T')[0];
  const randomNum = Math.floor(1000 + Math.random() * 9000);

  return {
    id: 'inv_' + Date.now(),
    title: 'INVOICE',
    number: `INV-${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}-${randomNum}`,
    referenceNumber: 'PO-2026/08',
    date: formatDate(today),
    dueDate: formatDate(dueDate),
    showDueDate: true,
    paymentTerms: 'Jatuh tempo 14 hari',
    showPaymentTerms: true,
    showStatus: true,
    status: 'pending',
    useDecimals: false,
    template: 'modern',
    accentColor: '#2563eb',
    currency: 'IDR',
    language: 'id',
    
    // Sender Information
    senderName: 'PT Teknologi Digital Abadi',
    senderEmail: 'billing@digitalabadi.co.id',
    senderPhone: '0812-3456-7890',
    senderAddress: 'Gedung Cyber 2 Lantai 12\nJl. HR Rasuna Said, Jakarta Selatan, 12950',
    senderTaxId: '01.234.567.8-012.000',
    senderWebsite: 'https://digitalabadi.co.id',
    logoUrl: '',

    // Client Information
    clientName: 'CV Nusantara Mandiri',
    clientEmail: 'finance@nusantaramandiri.com',
    clientPhone: '0821-9876-5432',
    clientAddress: 'Jl. Merdeka No. 45, Coblong, Bandung, Jawa Barat',
    clientTaxId: '02.987.654.3-432.000',

    // Items
    items: [
      {
        id: 1,
        name: 'Pengembangan Website & Portal Sistem',
        description: 'Frontend React + Backend API integration & deployment',
        quantity: 1,
        unit: 'Paket',
        price: 15000000,
        discountType: 'percent',
        discountValue: 0,
        taxRate: 0
      },
      {
        id: 2,
        name: 'Layanan Cloud Hosting & Domain Premium',
        description: 'Server Cloud VPS 4 Core 8GB RAM + Domain .co.id 1 Tahun',
        quantity: 1,
        unit: 'Tahun',
        price: 2500000,
        discountType: 'fixed',
        discountValue: 200000,
        taxRate: 0
      },
      {
        id: 3,
        name: 'Maintenance & Dukungan Teknis Bulanan',
        description: 'Garansi pemeliharaan teknis & backup berkala',
        quantity: 3,
        unit: 'Bulan',
        price: 1000000,
        discountType: 'percent',
        discountValue: 0,
        taxRate: 0
      }
    ],

    // Calculations
    enableDiscount: true,
    discountType: 'percent',
    discountValue: 5,
    enableTax: true,
    taxRate: 11, // PPN 11%
    shippingFee: 0,
    downPayment: 5000000,

    // Payment Info
    bankAccounts: [
      {
        bankName: 'Bank Central Asia (BCA)',
        accountNumber: '8830-1234-56',
        accountHolder: 'PT TEKNOLOGI DIGITAL ABADI'
      },
      {
        bankName: 'Bank Mandiri',
        accountNumber: '127-00-9876543-2',
        accountHolder: 'PT TEKNOLOGI DIGITAL ABADI'
      }
    ],

    // Notes, Terms & QR
    notes: 'Terima kasih atas kerja sama Anda. Pembayaran mohon dikonfirmasi setelah transfer via WhatsApp atau email.',
    terms: '1. Pembayaran ditransfer sesuai nominal tagihan.\n2. Faktur pajak akan diterbitkan setelah pembayaran lunas.\n3. Keterlambatan pembayaran dapat dikenakan denda sesuai kesepakatan.',
    showQrCode: true,
    qrPayload: 'https://digitalabadi.co.id/pay/INV-2026',

    // Signature
    signerName: 'Budi Santoso, S.Kom',
    signerTitle: 'Direktur Utama',
    signatureData: ''
  };
}

class InvoiceApp {
  constructor() {
    this.invoice = StorageManager.loadDraft() || getInitialInvoice();
    this.zoomLevel = 1.0;
    this.currentTab = 'editor'; // for mobile view
    this.activeEditorSection = 'parties'; // 'general', 'parties', 'items', 'totals', 'payment', 'design'
    this.signatureManager = null;
    
    this.init();
  }

  init() {
    this.initSignaturePad();
    this.populateForm();
    this.renderInvoice();
    this.renderHistoryTable();
    this.attachEventListeners();
    this.initTheme();
    this.updateStatsCards();
    this.updateAuthNavUI();
  }

  initSignaturePad() {
    this.signatureManager = new SignaturePadManager('signature-canvas', (dataUrl) => {
      this.invoice.signatureData = dataUrl;
      this.renderInvoice();
      StorageManager.saveDraft(this.invoice);
    });

    if (this.invoice.signatureData) {
      this.signatureManager.loadFromDataUrl(this.invoice.signatureData);
    }
  }

  initTheme() {
    const isDark = localStorage.getItem('invoice_theme_dark') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('invoice_theme_dark', isDark);
    this.showToast(isDark ? 'Mode Gelap diaktifkan' : 'Mode Terang diaktifkan', 'info');
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 text-white',
      info: 'bg-blue-600 text-white',
      warning: 'bg-amber-600 text-white',
      error: 'bg-rose-600 text-white'
    };

    toast.className = `px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 ease-out translate-y-2 opacity-0 ${bgColors[type] || bgColors.success}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  updateAuthNavUI() {
    if (typeof window.AuthManager === 'undefined') return;

    const user = window.AuthManager.getUser();
    const isSuper = window.AuthManager.isSuperadmin();

    const btnSuperadmin = document.getElementById('btn-header-superadmin');
    const btnLogin = document.getElementById('btn-header-login');
    const profileBadge = document.getElementById('user-profile-badge');
    const avatarInitials = document.getElementById('user-avatar-initials');
    const displayName = document.getElementById('user-display-name');
    const displayRole = document.getElementById('user-display-role');

    // Only show Superadmin button if logged in as Superadmin (megakomindo@gmail.com or dumy@mail.com)
    if (btnSuperadmin) {
      if (isSuper) {
        btnSuperadmin.classList.remove('hidden');
      } else {
        btnSuperadmin.classList.add('hidden');
      }
    }

    if (user) {
      if (btnLogin) btnLogin.classList.add('hidden');
      if (profileBadge) {
        profileBadge.classList.remove('hidden');
        profileBadge.classList.add('flex');
      }

      if (avatarInitials) {
        const initials = (user.name || user.email || 'U').substring(0, 2).toUpperCase();
        avatarInitials.textContent = initials;
      }
      if (displayName) displayName.textContent = user.name || user.email.split('@')[0];
      if (displayRole) {
        displayRole.textContent = isSuper ? 'Superadmin' : (user.plan || 'Pro').toUpperCase();
        displayRole.className = isSuper 
          ? 'text-[9px] text-purple-600 dark:text-purple-400 font-bold block'
          : 'text-[9px] text-blue-600 dark:text-blue-400 font-bold block';
      }
    } else {
      if (btnLogin) btnLogin.classList.remove('hidden');
      if (profileBadge) {
        profileBadge.classList.add('hidden');
        profileBadge.classList.remove('flex');
      }
    }
  }

  populateForm() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined ? val : '';
    };

    setVal('input-title', this.invoice.title);
    setVal('input-number', this.invoice.number);
    setVal('input-ref-number', this.invoice.referenceNumber);
    setVal('input-date', this.invoice.date);
    setVal('input-due-date', this.invoice.dueDate);
    const dueDateToggle = document.getElementById('toggle-show-due-date');
    if (dueDateToggle) dueDateToggle.checked = this.invoice.showDueDate !== false;
    this.updateDueDateInputState();

    setVal('input-payment-terms', this.invoice.paymentTerms);
    const paymentTermsToggle = document.getElementById('toggle-show-payment-terms');
    if (paymentTermsToggle) paymentTermsToggle.checked = this.invoice.showPaymentTerms !== false;
    this.updatePaymentTermsInputState();

    setVal('select-status', this.invoice.status);
    const statusToggle = document.getElementById('toggle-show-status');
    if (statusToggle) statusToggle.checked = this.invoice.showStatus !== false;
    this.updateStatusInputState();

    const decToggle = document.getElementById('toggle-use-decimals');
    if (decToggle) decToggle.checked = !!this.invoice.useDecimals;

    setVal('select-template', this.invoice.template);
    setVal('input-accent-color', this.invoice.accentColor);
    setVal('select-currency', this.invoice.currency);
    setVal('select-language', this.invoice.language);

    // Sender
    setVal('input-sender-name', this.invoice.senderName);
    setVal('input-sender-email', this.invoice.senderEmail);
    setVal('input-sender-phone', this.invoice.senderPhone);
    setVal('input-sender-address', this.invoice.senderAddress);
    setVal('input-sender-tax-id', this.invoice.senderTaxId);
    setVal('input-sender-website', this.invoice.senderWebsite);

    // Client
    setVal('input-client-name', this.invoice.clientName);
    setVal('input-client-email', this.invoice.clientEmail);
    setVal('input-client-phone', this.invoice.clientPhone);
    setVal('input-client-address', this.invoice.clientAddress);
    setVal('input-client-tax-id', this.invoice.clientTaxId);

    // Totals
    setVal('select-discount-type', this.invoice.discountType);
    setVal('input-discount-value', this.invoice.discountValue);
    const discountToggle = document.getElementById('toggle-enable-discount');
    if (discountToggle) discountToggle.checked = this.invoice.enableDiscount !== false;
    this.updateDiscountInputState();

    setVal('input-tax-rate', this.invoice.taxRate);
    setVal('input-shipping-fee', this.invoice.shippingFee);
    setVal('input-down-payment', this.invoice.downPayment);
    const taxToggle = document.getElementById('toggle-enable-tax');
    if (taxToggle) taxToggle.checked = this.invoice.enableTax !== false;
    this.updateTaxInputState();

    // Notes, Terms & QR
    setVal('input-notes', this.invoice.notes);
    setVal('input-terms', this.invoice.terms);
    setVal('input-qr-payload', this.invoice.qrPayload);
    const qrToggle = document.getElementById('toggle-show-qr');
    if (qrToggle) qrToggle.checked = !!this.invoice.showQrCode;
    this.updateQrInputState();

    // Signer
    setVal('input-signer-name', this.invoice.signerName);
    setVal('input-signer-title', this.invoice.signerTitle);

    this.renderItemsList();
    this.renderBankAccountsList();
  }

  updateDueDateInputState() {
    const isDueDateEnabled = this.invoice.showDueDate !== false;
    const dueDateInput = document.getElementById('input-due-date');
    if (dueDateInput) {
      dueDateInput.disabled = !isDueDateEnabled;
      if (isDueDateEnabled) {
        dueDateInput.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        dueDateInput.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updatePaymentTermsInputState() {
    const isTermsEnabled = this.invoice.showPaymentTerms !== false;
    const termsInput = document.getElementById('input-payment-terms');
    if (termsInput) {
      termsInput.disabled = !isTermsEnabled;
      if (isTermsEnabled) {
        termsInput.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        termsInput.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateStatusInputState() {
    const isStatusEnabled = this.invoice.showStatus !== false;
    const statusSelect = document.getElementById('select-status');
    if (statusSelect) {
      statusSelect.disabled = !isStatusEnabled;
      if (isStatusEnabled) {
        statusSelect.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        statusSelect.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateDiscountInputState() {
    const isDiscountEnabled = this.invoice.enableDiscount !== false;
    const discountValueInput = document.getElementById('input-discount-value');
    const discountTypeSelect = document.getElementById('select-discount-type');
    const discountInputGroup = document.getElementById('discount-input-group');

    if (discountValueInput) discountValueInput.disabled = !isDiscountEnabled;
    if (discountTypeSelect) discountTypeSelect.disabled = !isDiscountEnabled;

    if (discountInputGroup) {
      if (isDiscountEnabled) {
        discountInputGroup.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        discountInputGroup.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateTaxInputState() {
    const isTaxEnabled = this.invoice.enableTax !== false;
    const taxGroup = document.getElementById('tax-input-group');
    const taxInput = document.getElementById('input-tax-rate');
    const quickButtons = document.querySelectorAll('.btn-quick-tax');
    
    if (taxInput) {
      taxInput.disabled = !isTaxEnabled;
    }
    quickButtons.forEach(btn => {
      btn.disabled = !isTaxEnabled;
    });

    if (taxGroup) {
      if (isTaxEnabled) {
        taxGroup.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        taxGroup.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  updateQrInputState() {
    const isQrEnabled = !!this.invoice.showQrCode;
    const qrInput = document.getElementById('input-qr-payload');
    if (qrInput) {
      qrInput.disabled = !isQrEnabled;
      if (isQrEnabled) {
        qrInput.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        qrInput.classList.add('opacity-40', 'pointer-events-none');
      }
    }
  }

  renderItemsList() {
    const container = document.getElementById('items-form-container');
    if (!container) return;

    container.innerHTML = '';
    const curr = this.invoice.currency || 'IDR';

    this.invoice.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 transition hover:border-slate-300';
      row.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">${index + 1}</span>
          <input type="text" class="item-name flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100" placeholder="Nama Barang / Layanan" value="${item.name || ''}" data-index="${index}" />
          
          <div class="flex items-center gap-1">
            <button type="button" class="btn-dup-item p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="Duplikat" data-index="${index}">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="btn-del-item p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="Hapus" data-index="${index}">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div>
          <input type="text" class="item-desc w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300" placeholder="Deskripsi tambahan (opsional)" value="${item.description || ''}" data-index="${index}" />
        </div>

        <div class="grid grid-cols-12 gap-2 text-xs">
          <div class="col-span-3">
            <label class="text-[10px] text-slate-400 font-medium block">Qty</label>
            <input type="number" min="0" step="any" class="item-qty w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono-num" value="${item.quantity || 1}" data-index="${index}" />
          </div>
          <div class="col-span-3">
            <label class="text-[10px] text-slate-400 font-medium block">Satuan</label>
            <input type="text" class="item-unit w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" placeholder="Pcs/Jam" value="${item.unit || ''}" data-index="${index}" />
          </div>
          <div class="col-span-6">
            <label class="text-[10px] text-slate-400 font-medium block">Harga Satuan</label>
            <input type="number" min="0" step="any" class="item-price w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono-num font-semibold" value="${item.price || 0}" data-index="${index}" />
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-xs">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-slate-400">Diskon:</span>
            <input type="number" min="0" step="any" class="item-discount w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-mono-num" value="${item.discountValue || 0}" data-index="${index}" />
            <select class="item-discount-type text-[10px] px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" data-index="${index}">
              <option value="percent" ${item.discountType === 'percent' ? 'selected' : ''}>%</option>
              <option value="fixed" ${item.discountType === 'fixed' ? 'selected' : ''}>Nominal</option>
            </select>
          </div>
          <div class="font-mono-num font-bold text-slate-800 dark:text-slate-200">
            ${formatCurrency(calculateItemTotal(item), curr)}
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  renderBankAccountsList() {
    const container = document.getElementById('banks-form-container');
    if (!container) return;

    container.innerHTML = '';
    (this.invoice.bankAccounts || []).forEach((bank, index) => {
      const row = document.createElement('div');
      row.className = 'p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 relative';
      row.innerHTML = `
        <button type="button" class="btn-del-bank absolute top-2 right-2 text-slate-400 hover:text-rose-500" data-index="${index}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
        <div class="grid grid-cols-1 gap-2 text-xs">
          <div>
            <label class="text-[10px] text-slate-400 font-medium block">Nama Bank / E-Wallet</label>
            <input type="text" class="bank-name w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" placeholder="BCA / Mandiri / QRIS" value="${bank.bankName || ''}" data-index="${index}" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-slate-400 font-medium block">Nomor Rekening</label>
              <input type="text" class="bank-number w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono-num" placeholder="1234567890" value="${bank.accountNumber || ''}" data-index="${index}" />
            </div>
            <div>
              <label class="text-[10px] text-slate-400 font-medium block">Atas Nama (a.n.)</label>
              <input type="text" class="bank-holder w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" placeholder="Nama Pemilik" value="${bank.accountHolder || ''}" data-index="${index}" />
            </div>
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  renderInvoice() {
    const previewContainer = document.getElementById('invoice-paper-preview');
    if (!previewContainer) return;

    const totals = calculateInvoiceTotals(this.invoice);
    
    // Apply template format classes
    if (this.invoice.template === 'receipt') {
      previewContainer.className = 'invoice-paper receipt-format';
    } else {
      previewContainer.className = 'invoice-paper';
    }

    // Render HTML template
    previewContainer.innerHTML = InvoiceTemplates.render(this.invoice, totals);

    // Render QR Code if enabled
    if (this.invoice.showQrCode && this.invoice.qrPayload) {
      ExportManager.generateQrCode('invoice-qr-code', this.invoice.qrPayload);
    }

    // Update live calculations preview in sidebar
    this.updateSidebarTotals(totals);

    // Apply paper zoom transform
    previewContainer.style.transform = `scale(${this.zoomLevel})`;
    previewContainer.style.transformOrigin = 'top center';
  }

  updateSidebarTotals(totals) {
    const curr = this.invoice.currency || 'IDR';
    const dec = this.invoice.useDecimals;
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setTxt('summary-subtotal', formatCurrency(totals.subtotal, curr, dec));
    setTxt('summary-tax', formatCurrency(totals.taxAmount, curr, dec));
    setTxt('summary-grand-total', formatCurrency(totals.grandTotal, curr, dec));
    setTxt('summary-balance-due', formatCurrency(totals.balanceDue, curr, dec));
  }

  setZoom(level) {
    this.zoomLevel = Math.max(0.4, Math.min(1.5, level));
    const zoomText = document.getElementById('zoom-percentage-text');
    if (zoomText) zoomText.innerText = `${Math.round(this.zoomLevel * 100)}%`;
    this.renderInvoice();
  }

  switchMobileTab(tab) {
    this.currentTab = tab;
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');
    const btnEditor = document.getElementById('tab-btn-editor');
    const btnPreview = document.getElementById('tab-btn-preview');

    if (tab === 'editor') {
      if (editorPane) {
        editorPane.classList.remove('hidden');
        editorPane.classList.add('flex');
      }
      if (previewPane) {
        previewPane.classList.add('hidden');
        previewPane.classList.remove('flex');
      }
      if (btnEditor) {
        btnEditor.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm flex items-center justify-center gap-1.5 transition-all';
      }
      if (btnPreview) {
        btnPreview.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-all';
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
      if (btnPreview) {
        btnPreview.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm flex items-center justify-center gap-1.5 transition-all';
      }
      if (btnEditor) {
        btnEditor.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-all';
      }
      // Auto-fit zoom on mobile so the paper fits the screen width cleanly
      if (window.innerWidth < 768) {
        const targetZoom = Math.min(1.0, Math.max(0.4, (window.innerWidth - 32) / 800));
        this.setZoom(targetZoom);
      }
      // Re-render invoice when switching to preview tab to ensure crisp dimensions
      this.renderInvoice();
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
    } else {
      this.switchMobileTab(this.currentTab || 'editor');
    }
  }

  attachEventListeners() {
    // Mobile View Tab Switcher & Quick Actions
    document.getElementById('tab-btn-editor')?.addEventListener('click', () => this.switchMobileTab('editor'));
    document.getElementById('tab-btn-preview')?.addEventListener('click', () => this.switchMobileTab('preview'));
    document.getElementById('btn-mobile-history')?.addEventListener('click', () => this.openHistoryModal());
    document.getElementById('btn-mobile-sample')?.addEventListener('click', () => this.loadSamplePreset());

    // Window Resize Responsive Handler
    window.addEventListener('resize', () => this.handleWindowResize());

    // Top Bar Actions
    document.getElementById('btn-new-invoice')?.addEventListener('click', () => this.createNewInvoice());
    document.getElementById('btn-save-invoice')?.addEventListener('click', () => this.saveCurrentInvoice());
    document.getElementById('btn-print-invoice')?.addEventListener('click', () => ExportManager.printInvoice());
    document.getElementById('btn-download-pdf')?.addEventListener('click', () => {
      this.showToast('Membuat file PDF...', 'info');
      ExportManager.downloadPdf(this.invoice);
    });
    document.getElementById('btn-share-whatsapp')?.addEventListener('click', () => {
      const totals = calculateInvoiceTotals(this.invoice);
      ExportManager.shareViaWhatsApp(this.invoice, totals);
    });
    document.getElementById('btn-share-email')?.addEventListener('click', () => {
      const totals = calculateInvoiceTotals(this.invoice);
      ExportManager.shareViaEmail(this.invoice, totals);
    });
    document.getElementById('btn-history-modal')?.addEventListener('click', () => this.openHistoryModal());
    document.getElementById('btn-close-history-modal')?.addEventListener('click', () => this.closeHistoryModal());
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('btn-sample-data')?.addEventListener('click', () => this.loadSamplePreset());

    // Zoom Controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoomLevel + 0.1));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoomLevel - 0.1));
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => this.setZoom(1.0));

    // Logo Upload & Remove
    document.getElementById('input-logo-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.invoice.logoUrl = event.target.result;
          this.renderInvoice();
          StorageManager.saveDraft(this.invoice);
          this.showToast('Logo berhasil diunggah');
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('btn-remove-logo')?.addEventListener('click', () => {
      this.invoice.logoUrl = '';
      const input = document.getElementById('input-logo-file');
      if (input) input.value = '';
      this.renderInvoice();
      StorageManager.saveDraft(this.invoice);
      this.showToast('Logo dihapus', 'info');
    });

    // Signature Pad Actions
    document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
      this.signatureManager.clear();
      this.invoice.signatureData = '';
      this.renderInvoice();
      StorageManager.saveDraft(this.invoice);
    });

    // Color Presets
    document.querySelectorAll('.btn-color-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.currentTarget.getAttribute('data-color');
        if (color) {
          this.invoice.accentColor = color;
          const input = document.getElementById('input-accent-color');
          if (input) input.value = color;
          this.renderInvoice();
          StorageManager.saveDraft(this.invoice);
        }
      });
    });

    // Add Item & Add Bank
    document.getElementById('btn-add-item')?.addEventListener('click', () => {
      this.invoice.items.push({
        id: Date.now(),
        name: '',
        description: '',
        quantity: 1,
        unit: 'Pcs',
        price: 0,
        discountType: 'percent',
        discountValue: 0,
        taxRate: 0
      });
      this.renderItemsList();
      this.renderInvoice();
      StorageManager.saveDraft(this.invoice);
    });

    document.getElementById('btn-add-bank')?.addEventListener('click', () => {
      if (!this.invoice.bankAccounts) this.invoice.bankAccounts = [];
      this.invoice.bankAccounts.push({
        bankName: 'BCA',
        accountNumber: '',
        accountHolder: this.invoice.senderName || ''
      });
      this.renderBankAccountsList();
      this.renderInvoice();
      StorageManager.saveDraft(this.invoice);
    });

    // Generic Input Event Delegation for Form Fields
    document.getElementById('editor-form')?.addEventListener('input', (e) => this.handleFormInput(e));
    document.getElementById('editor-form')?.addEventListener('change', (e) => this.handleFormInput(e));

    // Delegation for Items & Banks Buttons
    document.getElementById('items-form-container')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-del-item');
      if (delBtn) {
        const idx = Number(delBtn.getAttribute('data-index'));
        this.invoice.items.splice(idx, 1);
        this.renderItemsList();
        this.renderInvoice();
        StorageManager.saveDraft(this.invoice);
        return;
      }

      const dupBtn = e.target.closest('.btn-dup-item');
      if (dupBtn) {
        const idx = Number(dupBtn.getAttribute('data-index'));
        const cloned = JSON.parse(JSON.stringify(this.invoice.items[idx]));
        cloned.id = Date.now();
        this.invoice.items.splice(idx + 1, 0, cloned);
        this.renderItemsList();
        this.renderInvoice();
        StorageManager.saveDraft(this.invoice);
      }
    });

    document.getElementById('banks-form-container')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-del-bank');
      if (delBtn) {
        const idx = Number(delBtn.getAttribute('data-index'));
        this.invoice.bankAccounts.splice(idx, 1);
        this.renderBankAccountsList();
        this.renderInvoice();
        StorageManager.saveDraft(this.invoice);
      }
    });

    // History Modal Actions
    document.getElementById('history-search-input')?.addEventListener('input', (e) => {
      this.renderHistoryTable(e.target.value, document.getElementById('history-status-filter')?.value);
    });

    document.getElementById('history-status-filter')?.addEventListener('change', (e) => {
      this.renderHistoryTable(document.getElementById('history-search-input')?.value, e.target.value);
    });

    document.getElementById('btn-export-backup')?.addEventListener('click', () => {
      StorageManager.exportBackupJSON();
      this.showToast('Backup data berhasil diunduh');
    });

    document.getElementById('input-import-backup')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (StorageManager.importBackupJSON(event.target.result)) {
            this.showToast('Data berhasil dipulihkan!');
            this.renderHistoryTable();
            this.updateStatsCards();
          } else {
            this.showToast('Format backup tidak valid', 'error');
          }
        };
        reader.readAsText(file);
      }
    });

    // Quick Clients Autofill
    document.getElementById('btn-save-client-contact')?.addEventListener('click', () => {
      if (this.invoice.clientName) {
        StorageManager.saveClient({
          name: this.invoice.clientName,
          email: this.invoice.clientEmail,
          phone: this.invoice.clientPhone,
          address: this.invoice.clientAddress,
          taxId: this.invoice.clientTaxId
        });
        this.showToast(`Kontak ${this.invoice.clientName} disimpan ke buku kontak`);
      }
    });

    // Auth & Logout
    document.getElementById('btn-user-logout')?.addEventListener('click', () => {
      if (typeof window.AuthManager !== 'undefined') {
        window.AuthManager.logout();
        this.showToast('Anda telah keluar dari akun', 'info');
      }
    });

    window.addEventListener('auth:change', () => {
      this.updateAuthNavUI();
      this.renderInvoice();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  handleFormInput(e) {
    const target = e.target;
    const id = target.id;

    // Header & Meta
    if (id === 'input-title') this.invoice.title = target.value;
    if (id === 'input-number') this.invoice.number = target.value;
    if (id === 'input-ref-number') this.invoice.referenceNumber = target.value;
    if (id === 'input-date') this.invoice.date = target.value;
    if (id === 'input-due-date') this.invoice.dueDate = target.value;
    if (id === 'toggle-show-due-date') {
      this.invoice.showDueDate = target.checked;
      this.updateDueDateInputState();
    }
    if (id === 'input-payment-terms') this.invoice.paymentTerms = target.value;
    if (id === 'toggle-show-payment-terms') {
      this.invoice.showPaymentTerms = target.checked;
      this.updatePaymentTermsInputState();
    }
    if (id === 'toggle-show-status') {
      this.invoice.showStatus = target.checked;
      this.updateStatusInputState();
    }
    if (id === 'toggle-use-decimals') {
      this.invoice.useDecimals = target.checked;
    }
    if (id === 'select-status') this.invoice.status = target.value;
    if (id === 'select-template') this.invoice.template = target.value;
    if (id === 'input-accent-color') this.invoice.accentColor = target.value;
    if (id === 'select-currency') {
      this.invoice.currency = target.value;
      this.renderItemsList();
    }
    if (id === 'select-language') this.invoice.language = target.value;

    // Sender
    if (id === 'input-sender-name') this.invoice.senderName = target.value;
    if (id === 'input-sender-email') this.invoice.senderEmail = target.value;
    if (id === 'input-sender-phone') this.invoice.senderPhone = target.value;
    if (id === 'input-sender-address') this.invoice.senderAddress = target.value;
    if (id === 'input-sender-tax-id') this.invoice.senderTaxId = target.value;
    if (id === 'input-sender-website') this.invoice.senderWebsite = target.value;

    // Client
    if (id === 'input-client-name') this.invoice.clientName = target.value;
    if (id === 'input-client-email') this.invoice.clientEmail = target.value;
    if (id === 'input-client-phone') this.invoice.clientPhone = target.value;
    if (id === 'input-client-address') this.invoice.clientAddress = target.value;
    if (id === 'input-client-tax-id') this.invoice.clientTaxId = target.value;

    // Totals
    if (id === 'toggle-enable-discount') {
      this.invoice.enableDiscount = target.checked;
      this.updateDiscountInputState();
    }
    if (id === 'select-discount-type') this.invoice.discountType = target.value;
    if (id === 'input-discount-value') this.invoice.discountValue = Number(target.value) || 0;
    if (id === 'toggle-enable-tax') {
      this.invoice.enableTax = target.checked;
      this.updateTaxInputState();
    }
    if (id === 'input-tax-rate') this.invoice.taxRate = Number(target.value) || 0;
    if (id === 'input-shipping-fee') this.invoice.shippingFee = Number(target.value) || 0;
    if (id === 'input-down-payment') this.invoice.downPayment = Number(target.value) || 0;

    // Notes, Terms & QR
    if (id === 'input-notes') this.invoice.notes = target.value;
    if (id === 'input-terms') this.invoice.terms = target.value;
    if (id === 'input-qr-payload') this.invoice.qrPayload = target.value;
    if (id === 'toggle-show-qr') {
      this.invoice.showQrCode = target.checked;
      this.updateQrInputState();
    }

    // Signer
    if (id === 'input-signer-name') this.invoice.signerName = target.value;
    if (id === 'input-signer-title') this.invoice.signerTitle = target.value;

    // Line Items dynamic inputs
    if (target.dataset.index !== undefined) {
      const idx = Number(target.dataset.index);
      const item = this.invoice.items[idx];
      if (item) {
        if (target.classList.contains('item-name')) item.name = target.value;
        if (target.classList.contains('item-desc')) item.description = target.value;
        if (target.classList.contains('item-qty')) item.quantity = Number(target.value) || 0;
        if (target.classList.contains('item-unit')) item.unit = target.value;
        if (target.classList.contains('item-price')) item.price = Number(target.value) || 0;
        if (target.classList.contains('item-discount')) item.discountValue = Number(target.value) || 0;
        if (target.classList.contains('item-discount-type')) item.discountType = target.value;
      }

      // Bank dynamic inputs
      const bank = (this.invoice.bankAccounts || [])[idx];
      if (bank) {
        if (target.classList.contains('bank-name')) bank.bankName = target.value;
        if (target.classList.contains('bank-number')) bank.accountNumber = target.value;
        if (target.classList.contains('bank-holder')) bank.accountHolder = target.value;
      }
    }

    this.renderInvoice();
    StorageManager.saveDraft(this.invoice);
  }

  createNewInvoice() {
    if (confirm('Buat invoice baru dan reset formulir?')) {
      this.invoice = getInitialInvoice();
      this.populateForm();
      if (this.signatureManager) this.signatureManager.clear();
      this.renderInvoice();
      StorageManager.saveDraft(this.invoice);
      this.showToast('Invoice baru siap dibuat!');
    }
  }

  loadSamplePreset() {
    this.invoice = getInitialInvoice();
    this.populateForm();
    this.renderInvoice();
    StorageManager.saveDraft(this.invoice);
    this.showToast('Contoh data invoice berhasil dimuat!');
  }

  saveCurrentInvoice() {
    const saved = StorageManager.saveInvoiceToHistory(this.invoice);
    this.showToast(`Invoice ${saved.number} berhasil disimpan ke Riwayat!`);
    
    // Confetti effect if paid or created
    if (typeof confetti !== 'undefined') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }

    this.updateStatsCards();
    this.renderHistoryTable();
  }

  updateStatsCards() {
    const summary = StorageManager.getHistorySummary();
    const curr = this.invoice.currency || 'IDR';
    const dec = this.invoice.useDecimals;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setTxt('stat-total-invoices', summary.totalCount);
    setTxt('stat-total-amount', formatCurrency(summary.totalAmount, curr, dec));
    setTxt('stat-total-paid', formatCurrency(summary.totalPaid, curr, dec));
    setTxt('stat-total-pending', formatCurrency(summary.totalPending, curr, dec));
  }

  openHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.renderHistoryTable();
    }
  }

  closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.add('hidden');
  }

  renderHistoryTable(searchTerm = '', statusFilter = 'all') {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    let list = StorageManager.getAllInvoices();

    // Filter
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter(inv => inv.status === statusFilter);
    }
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      list = list.filter(inv => 
        (inv.number && inv.number.toLowerCase().includes(query)) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(query)) ||
        (inv.senderName && inv.senderName.toLowerCase().includes(query))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400 text-xs">
            Belum ada data invoice yang tersimpan. Klik tombol "Simpan ke Riwayat" di atas untuk menyimpan.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(inv => {
      const totals = calculateInvoiceTotals(inv);
      const curr = inv.currency || 'IDR';
      const dec = inv.useDecimals;
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <td class="py-3 px-4 font-mono-num font-bold text-slate-800 dark:text-slate-200">${inv.number || '-'}</td>
          <td class="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">${inv.clientName || '-'}</td>
          <td class="py-3 px-4 text-slate-500 text-[11px]">${inv.date || '-'}</td>
          <td class="py-3 px-4 font-mono-num font-bold text-slate-900 dark:text-slate-100">${formatCurrency(totals.grandTotal, curr, dec)}</td>
          <td class="py-3 px-4">${inv.showStatus !== false ? InvoiceTemplates.renderStatusBadge(inv.status, inv.language || 'id') : '<span class="text-xs text-slate-400 italic">Nonaktif</span>'}</td>
          <td class="py-3 px-4 text-right space-x-1">
            <button class="btn-load-history px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-100" data-id="${inv.id}">Buka</button>
            <button class="btn-delete-history p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" data-id="${inv.id}" title="Hapus">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Attach click events
    tbody.querySelectorAll('.btn-load-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const found = StorageManager.getAllInvoices().find(i => i.id === id);
        if (found) {
          this.invoice = JSON.parse(JSON.stringify(found));
          this.populateForm();
          if (this.signatureManager) {
            this.signatureManager.loadFromDataUrl(this.invoice.signatureData || '');
          }
          this.renderInvoice();
          StorageManager.saveDraft(this.invoice);
          this.closeHistoryModal();
          this.showToast(`Invoice ${this.invoice.number} berhasil dimuat!`);
        }
      });
    });

    tbody.querySelectorAll('.btn-delete-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('Hapus invoice ini dari riwayat?')) {
          const id = e.currentTarget.getAttribute('data-id');
          StorageManager.deleteInvoice(id);
          this.renderHistoryTable(
            document.getElementById('history-search-input')?.value,
            document.getElementById('history-status-filter')?.value
          );
          this.updateStatsCards();
          this.showToast('Invoice dihapus dari riwayat', 'info');
        }
      });
    });
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new InvoiceApp();
});
