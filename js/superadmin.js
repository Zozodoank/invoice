/**
 * Superadmin Portal - User & Subscription Management Logic.
 *
 * This is a thin client over the D1-backed admin API (js/api.js). The browser
 * never trusts itself: role/plan/trial/watermark are decided by the server, and
 * every action here is a credentialed call. No localStorage mock data remains.
 * Rendering is event-delegated (no inline onclick) and HTML-escaped (no XSS).
 */

// Subscription tiers are seeded into D1 on first run (id must match users.plan CHECK).
const SEED_PLANS = [
  { id: 'free', name: 'Free Starter', price: 0, billingInterval: 'month',
    maxInvoicesPerMonth: 5, maxTemplates: 1, canUseQr: false, canUseSignature: false,
    canExportWhatsapp: true, hasWatermark: true, isActive: true },
  { id: 'pro', name: 'Pro Member', price: 79000, billingInterval: 'month',
    maxInvoicesPerMonth: -1, maxTemplates: 5, canUseQr: true, canUseSignature: true,
    canExportWhatsapp: true, hasWatermark: false, isActive: true },
  { id: 'enterprise', name: 'Enterprise / Agency', price: 249000, billingInterval: 'month',
    maxInvoicesPerMonth: -1, maxTemplates: 99, canUseQr: true, canUseSignature: true,
    canExportWhatsapp: true, hasWatermark: false, isActive: true }
];

// Presentation-only styling keyed by plan id (backend enforces the real capability).
const PLAN_META = {
  free: { badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', color: '#64748b' },
  pro: { badgeClass: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700', color: '#2563eb' },
  enterprise: { badgeClass: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700', color: '#9333ea' }
};
const DEFAULT_META = PLAN_META.free;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class SuperadminApp {
  constructor() {
    this.users = [];
    this.plans = [];
    this.billing = null;            // tarif per-dokumen & QRIS statis (server-derived)
    this.qrisImageDataUrl = null;   // gambar hasil upload/re-encode; null = tidak berubah
    this.qrisImageRemoved = false;  // user menekan "Hapus gambar"
    this.payStats = null;
    this.currentUser = null;
    this.searchQuery = '';
    this.selectedPlanFilter = 'all';
    this.selectedStatusFilter = 'all';
    this.selectedSort = 'newest';
    // Separate modal state — never share one id between two modals (#33).
    this.editingUserId = null;
    this.quickPlanUserId = null;
    this.editingPlanId = null;
    this._ready = false;

    this.init();
  }

  // --- INITIALIZATION ---
  init() {
    this.initTheme();
    this.bindEvents();
    this.checkAuth();
  }

  initTheme() {
    const isDark = localStorage.getItem('invoicecraft_theme') === 'dark' ||
      (!('invoicecraft_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', !!isDark);
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('invoicecraft_theme', isDark ? 'dark' : 'light');
  }

  // --- AUTHENTICATION GUARD (server-authoritative) ---
  async checkAuth() {
    const loginGate = document.getElementById('login-gate');
    const dashboardContent = document.getElementById('dashboard-content');
    const headerAdminEmail = document.getElementById('header-admin-email');

    const authUser = window.AuthManager ? await window.AuthManager.refresh() : null;
    const isSuper = !!(authUser && authUser.role === 'superadmin');

    if (isSuper && authUser) {
      this.currentUser = authUser;
      if (loginGate) loginGate.classList.add('hidden');
      if (dashboardContent) dashboardContent.classList.remove('hidden');
      if (headerAdminEmail) headerAdminEmail.textContent = authUser.email;
      await this.loadData();
      this.renderDashboard();
    } else {
      if (loginGate) loginGate.classList.remove('hidden');
      if (dashboardContent) dashboardContent.classList.add('hidden');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // Superadmin must sign in through the normal (Google) flow, then return here.
  loginOAuthSuperadmin() {
    window.location.href = 'auth.html';
  }

  async logout() {
    if (window.AuthManager) await window.AuthManager.logout();
    this.currentUser = null;
    this.checkAuth();
  }

  // --- DATA LOADING (D1 via API) ---
  async loadData() {
    try {
      this.plans = await this.ensurePlans();
      this.users = (await window.Api.adminListUsers(this._querySuffix())).map(u => this.normalizeUser(u));
      // Billing/payments are fail-soft: an older backend without the endpoints
      // must not blank the whole dashboard.
      try { this.billing = await window.Api.adminGetBilling(); } catch { this.billing = null; }
      try { this.payStats = await window.Api.adminPayments(); } catch { this.payStats = null; }
      this._ready = true;
    } catch (err) {
      this.showToast(err.message || 'Gagal memuat data dari server.', 'error');
    }
  }

  // Load plan tiers; seed the defaults once if the table is empty.
  async ensurePlans() {
    let plans = await window.Api.adminListPlans();
    if (!plans || plans.length === 0) {
      for (const p of SEED_PLANS) {
        try { await window.Api.adminSavePlan(p); } catch { /* exists or transient */ }
      }
      plans = await window.Api.adminListPlans();
    }
    return plans || [];
  }

  _querySuffix() {
    return this.searchQuery ? `?q=${encodeURIComponent(this.searchQuery)}` : '';
  }

  // --- NORMALIZERS (server row -> UI model) ---
  normalizeUser(r) {
    const isActive = Number(r.is_active) !== 0;
    const isSuper = Number(r.is_superadmin) === 1;
    const isLifetime = Number(r.is_lifetime) === 1;
    const plan = r.plan || 'free';
    const expiresAt = r.subscription_expires_at ? String(r.subscription_expires_at).slice(0, 10) : null;

    let status;
    if (!isActive) status = 'suspended';
    else if (plan !== 'free' && !isLifetime && expiresAt && new Date(expiresAt) < new Date()) status = 'expired';
    else if (r.subscription_status === 'expired' && plan !== 'free') status = 'expired';
    else status = 'active';

    return {
      id: r.id,
      email: r.email,
      name: r.name || '',
      company: r.company || '',
      phone: r.phone || '',
      notes: r.notes || '',
      role: isSuper ? 'superadmin' : 'user',
      plan,
      status,
      isActive,
      isLifetime,
      billingInterval: r.billing_interval || 'month',
      effectivePrice: Number(r.effective_price) || 0,
      expiresAt,
      registeredAt: r.created_at ? String(r.created_at).slice(0, 10) : null,
      invoicesCount: Number(r.invoices_count) || 0
    };
  }

  normalizePlan(r) {
    const meta = PLAN_META[r.id] || DEFAULT_META;
    const features = this.planFeatures(r);
    return {
      id: r.id,
      name: r.name,
      price: Number(r.price) || 0,
      interval: r.billing_interval === 'year' ? 'Tahun' : 'Bulan',
      billingInterval: r.billing_interval || 'month',
      maxInvoices: Number(r.max_invoices_per_month),
      maxTemplates: Number(r.max_templates),
      canUseQr: Number(r.can_use_qr) === 1,
      canUseSignature: Number(r.can_use_signature) === 1,
      canExportWhatsapp: Number(r.can_export_whatsapp) === 1,
      hasWatermark: Number(r.has_watermark) === 1,
      isActive: Number(r.is_active) !== 0,
      features,
      badgeClass: meta.badgeClass,
      color: meta.color
    };
  }

  // Capability list is derived from what the BACKEND actually enforces (#46).
  planFeatures(p) {
    const f = [];
    const max = Number(p.max_invoices_per_month);
    f.push(max === -1 ? 'Unlimited Dokumen' : `${max} Dokumen/Bulan`);
    const tpl = Number(p.max_templates);
    f.push(tpl >= 99 ? 'Semua Desain Template' : (tpl <= 1 ? 'Template Standar' : `${tpl} Desain Template`));
    f.push(Number(p.has_watermark) === 1 ? 'Watermark "CONTOH"' : 'Bebas Watermark');
    if (Number(p.can_use_qr) === 1) f.push('QR Code & E-Wallet');
    if (Number(p.can_use_signature) === 1) f.push('Tanda Tangan Digital');
    if (Number(p.can_export_whatsapp) === 1) f.push('Kirim WhatsApp & Email');
    return f;
  }

  // --- DASHBOARD RENDERING ---
  renderDashboard() {
    this.updateStats();
    this.renderPlansGrid();
    this.renderBillingForm();
    this.renderUsersTable();
    if (window.lucide) window.lucide.createIcons();
  }

  updateStats() {
    const totalUsers = this.users.length;
    const paid = this.users.filter(u => (u.plan === 'pro' || u.plan === 'enterprise') && u.status === 'active');
    const proUsers = paid.filter(u => u.plan === 'pro').length;
    const enterpriseUsers = paid.filter(u => u.plan === 'enterprise').length;

    // MRR uses each user's negotiated effective price (#37), falling back to tier price.
    const priceFor = (u) => {
      if (u.effectivePrice > 0) return u.effectivePrice;
      const tier = this.plans.find(p => p.id === u.plan);
      return tier ? (Number(tier.price) || 0) : 0;
    };
    const monthly = paid.reduce((sum, u) => {
      const base = priceFor(u);
      return sum + (u.billingInterval === 'year' ? base / 12 : base);
    }, 0);

    const now = new Date();
    const expiringSoon = this.users.filter(u => {
      if (!u.expiresAt || u.status !== 'active' || u.isLifetime) return false;
      const diffDays = Math.ceil((new Date(u.expiresAt) - now) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total-users', totalUsers);
    set('stat-paid-users', paid.length);
    set('stat-pro-count', `${proUsers} Pro • ${enterpriseUsers} Enterprise`);
    set('stat-mrr', this.formatCurrency(Math.round(monthly)));
    set('stat-expiring', expiringSoon);
  }

  renderPlansGrid() {
    const container = document.getElementById('plans-cards-container');
    if (!container) return;
    const esc = window.esc;

    container.innerHTML = this.plans.map(r => this.normalizePlan(r)).map(plan => {
      const activeSubsCount = this.users.filter(u => u.plan === plan.id && u.status === 'active').length;
      return `
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg ${plan.badgeClass} border">
                ${esc(plan.name)}
              </span>
              <span class="text-xs font-mono font-bold text-slate-500">${activeSubsCount} Pengguna</span>
            </div>
            <div class="mt-4 flex items-baseline justify-between">
              <div>
                <span class="text-2xl font-extrabold font-heading text-slate-900 dark:text-white">
                  ${plan.price === 0 ? 'Gratis' : esc(this.formatCurrency(plan.price))}
                </span>
                ${plan.price > 0 ? `<span class="text-xs text-slate-400">/${esc(plan.interval)}</span>` : ''}
              </div>
              <button type="button" data-action="edit-plan" data-plan-id="${esc(plan.id)}" class="px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1">
                <i data-lucide="tag" class="w-3 h-3"></i><span>Atur Harga</span>
              </button>
            </div>
            <ul class="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              ${plan.features.map(f => `
                <li class="flex items-center gap-1.5">
                  <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-500 shrink-0"></i>
                  <span>${esc(f)}</span>
                </li>`).join('')}
            </ul>
          </div>
          <div class="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span class="text-slate-400">Limit: ${plan.maxInvoices === -1 ? 'Unlimited' : esc(plan.maxInvoices) + ' /bln'}</span>
            <div class="flex items-center gap-2">
              <button type="button" data-action="edit-plan" data-plan-id="${esc(plan.id)}" class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Edit Harga</button>
              <button type="button" data-action="add-user" data-plan-id="${esc(plan.id)}" class="text-blue-600 dark:text-blue-400 font-bold hover:underline">+ Tambah User</button>
            </div>
          </div>
        </div>`;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
  }

  renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    const emptyState = document.getElementById('users-empty-state');
    const tableCountBadge = document.getElementById('table-users-count');
    const esc = window.esc;

    let filtered = [...this.users];
    if (this.selectedPlanFilter !== 'all') filtered = filtered.filter(u => u.plan === this.selectedPlanFilter);
    if (this.selectedStatusFilter !== 'all') filtered = filtered.filter(u => u.status === this.selectedStatusFilter);

    filtered.sort((a, b) => {
      if (this.selectedSort === 'name-asc') return (a.name || a.email).localeCompare(b.name || b.email);
      if (this.selectedSort === 'invoices-desc') return (b.invoicesCount || 0) - (a.invoicesCount || 0);
      if (this.selectedSort === 'expiry-asc') {
        if (!a.expiresAt && !a.isLifetime) return 1;
        if (!b.expiresAt && !b.isLifetime) return -1;
        return new Date(a.expiresAt || '2999') - new Date(b.expiresAt || '2999');
      }
      return new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0); // newest
    });

    if (tableCountBadge) tableCountBadge.textContent = `${filtered.length} dari ${this.users.length} pengguna`;

    if (filtered.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const now = new Date();

    tbody.innerHTML = filtered.map(u => {
      const planObj = this.normalizePlan(this.plans.find(p => p.id === u.plan) || { id: u.plan, name: (u.plan || 'free').toUpperCase() });
      const initials = esc((u.name || u.email || 'U').substring(0, 2).toUpperCase());

      let expiryBadge;
      if (u.isLifetime) {
        expiryBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Seumur Hidup</span>`;
      } else if (u.expiresAt) {
        const diffDays = Math.ceil((new Date(u.expiresAt) - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) expiryBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">Kedaluwarsa</span>`;
        else if (diffDays <= 14) expiryBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Sisa ${diffDays} hari</span>`;
        else expiryBadge = `<span class="text-xs text-slate-500 font-mono">${esc(window.Format.formatDateId(u.expiresAt))}</span>`;
      } else {
        expiryBadge = `<span class="text-xs text-slate-400 italic">Selamanya (Free)</span>`;
      }

      let statusBadge;
      if (u.status === 'active') statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Aktif</span>`;
      else if (u.status === 'suspended') statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Ditangguhkan</span>`;
      else statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Kedaluwarsa</span>`;

      const actions = `
        <button type="button" data-action="quick-plan" data-id="${esc(u.id)}" title="Ubah Paket & Masa Aktif" class="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"><i data-lucide="zap" class="w-4 h-4 text-blue-500"></i></button>
        <button type="button" data-action="edit" data-id="${esc(u.id)}" title="Edit Profil Pengguna" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
        ${u.role !== 'superadmin' ? `
          <button type="button" data-action="toggle-status" data-id="${esc(u.id)}" title="${u.status === 'suspended' ? 'Aktifkan Akun' : 'Tangguhkan Akun'}" class="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition"><i data-lucide="${u.status === 'suspended' ? 'check-circle' : 'ban'}" class="w-4 h-4 ${u.status === 'suspended' ? 'text-emerald-500' : 'text-amber-500'}"></i></button>
          <button type="button" data-action="delete" data-id="${esc(u.id)}" title="Hapus Pengguna" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        ` : ''}`;

      return `
        <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shadow-sm">${initials}</div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-900 dark:text-white">${esc(u.name || 'Tanpa Nama')}</span>
                  ${u.role === 'superadmin' ? `<span class="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded">SUPERADMIN</span>` : ''}
                </div>
                <div class="text-slate-400 font-mono text-[11px]">${esc(u.email)}</div>
                ${u.company ? `<div class="text-slate-500 text-[10px]">${esc(u.company)}</div>` : ''}
              </div>
            </div>
          </td>
          <td class="py-3.5 px-4"><span class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${planObj.badgeClass} border">${esc(planObj.name)}</span></td>
          <td class="py-3.5 px-4">${statusBadge}</td>
          <td class="py-3.5 px-4">${expiryBadge}</td>
          <td class="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">${u.invoicesCount} dokumen</td>
          <td class="py-3.5 px-4 font-mono text-slate-400 text-[11px]">${esc(u.registeredAt || '-')}</td>
          <td class="py-3.5 px-4 text-right"><div class="inline-flex items-center gap-1">${actions}</div></td>
        </tr>`;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
  }

  // --- USER MODAL ---
  openAddUserModal(defaultPlan = 'pro') {
    this.editingUserId = null;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const title = document.getElementById('user-modal-title');
    if (title) title.textContent = 'Tambah Pengguna & Langganan Baru';
    set('input-user-name', ''); set('input-user-email', ''); set('input-user-company', '');
    set('input-user-phone', ''); set('input-user-notes', '');
    set('select-user-plan', defaultPlan); set('select-user-status', 'active');
    set('input-user-expiry', defaultPlan === 'free' ? '' : window.Format.addMonths(window.Format.todayLocal(), 1));
    document.getElementById('user-modal')?.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  openEditUserModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    this.editingUserId = userId;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const title = document.getElementById('user-modal-title');
    if (title) title.textContent = `Edit Pengguna: ${user.name || user.email}`;
    set('input-user-name', user.name); set('input-user-email', user.email);
    set('input-user-company', user.company); set('input-user-phone', user.phone);
    set('select-user-plan', user.plan); set('select-user-status', user.status);
    set('input-user-expiry', user.expiresAt || ''); set('input-user-notes', user.notes);
    document.getElementById('user-modal')?.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeUserModal() {
    document.getElementById('user-modal')?.classList.add('hidden');
    this.editingUserId = null;
  }

  validateUser({ email, name, editingId }) {
    if (!EMAIL_RE.test(email)) return 'Format email tidak valid.';
    if (!name) return 'Nama wajib diisi.';
    const dup = this.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== editingId);
    if (dup) return `Email ${email} sudah terdaftar.`;
    return null;
  }

  async saveUserForm(e) {
    if (e) e.preventDefault();
    const get = id => (document.getElementById(id) || {}).value || '';
    const name = get('input-user-name').trim();
    const email = get('input-user-email').trim().toLowerCase();
    const company = get('input-user-company').trim();
    const phone = get('input-user-phone').trim();
    const plan = get('select-user-plan');
    const status = get('select-user-status');
    const expiresAt = get('input-user-expiry');
    const notes = get('input-user-notes').trim();

    // Role is NEVER promoted from typed input — a matching superadmin email is rejected here (#34).
    if (this.editingUserId) {
      const target = this.users.find(u => u.id === this.editingUserId);
      const err = this.validateUser({ email, name, editingId: this.editingUserId });
      if (err) { this.showToast(err, 'error'); return; }
      try {
        await window.Api.adminUpdateUser(this.editingUserId, { name, email, company, phone, notes });
        await window.Api.adminSetPlan(this.editingUserId, this._planPayload(plan, status, expiresAt));
        await window.Api.adminSetStatus(this.editingUserId, { isActive: status !== 'suspended' });
        this.showToast(`Data pengguna ${email} berhasil diperbarui`, 'success');
        await this.reload();
      } catch (e2) { this.showToast(e2.message || 'Gagal menyimpan.', 'error'); }
    } else {
      const err = this.validateUser({ email, name, editingId: null });
      if (err) { this.showToast(err, 'error'); return; }
      try {
        const created = await window.Api.adminCreateUser({ name, email, company, phone, plan: 'free' });
        await window.Api.adminSetPlan(created.id, this._planPayload(plan, status, expiresAt));
        await window.Api.adminSetStatus(created.id, { isActive: status !== 'suspended' });
        this.showToast(`Pengguna baru ${email} (${plan.toUpperCase()}) berhasil ditambahkan!`, 'success');
        await this.reload();
      } catch (e2) { this.showToast(e2.message || 'Gagal membuat pengguna.', 'error'); }
    }
    this.closeUserModal();
  }

  _planPayload(plan, status, expiresAt) {
    if (plan === 'free') return { plan: 'free', billingInterval: 'month', isLifetime: false, effectivePrice: 0 };
    const payload = { plan, billingInterval: 'month', isLifetime: false, effectivePrice: 0 };
    if (status !== 'expired' && expiresAt) payload.subscriptionExpiresAt = expiresAt;
    return payload;
  }

  // --- QUICK PLAN MODAL ---
  openQuickPlanModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    this.quickPlanUserId = userId;
    const currentPlanId = user.plan || 'pro';
    const tier = this.plans.find(p => p.id === currentPlanId) || {};
    const nameEl = document.getElementById('quick-plan-user-name');
    if (nameEl) nameEl.textContent = `${user.name || ''} (${user.email})`;
    const sel = document.getElementById('quick-plan-select'); if (sel) sel.value = currentPlanId;
    const dur = document.getElementById('quick-plan-duration'); if (dur) dur.value = '1m';
    const priceEl = document.getElementById('quick-plan-agreed-price');
    if (priceEl) priceEl.value = user.effectivePrice || Number(tier.price) || 0;
    const notesEl = document.getElementById('quick-plan-notes');
    if (notesEl) notesEl.value = user.notes || '';

    if (sel) sel.onchange = () => {
      const selected = this.plans.find(p => p.id === sel.value) || {};
      if (priceEl) priceEl.value = Number(selected.price) || 0;
    };
    document.getElementById('quick-plan-modal')?.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeQuickPlanModal() {
    document.getElementById('quick-plan-modal')?.classList.add('hidden');
    this.quickPlanUserId = null;
  }

  async applyQuickPlanChange() {
    // Validate the target against its OWN modal state, not the shared editing id (#33).
    if (!this.quickPlanUserId) return;
    const user = this.users.find(u => u.id === this.quickPlanUserId);
    if (!user) return;

    const get = id => (document.getElementById(id) || {}).value || '';
    const newPlan = get('quick-plan-select');
    const duration = get('quick-plan-duration');
    const agreedPrice = Number(get('quick-plan-agreed-price')) || 0;
    const notes = get('quick-plan-notes');

    const payload = { plan: newPlan, effectivePrice: agreedPrice, isLifetime: false, billingInterval: 'month' };
    if (newPlan === 'free') {
      payload.subscriptionExpiresAt = null;
    } else if (duration === 'lifetime') {
      payload.isLifetime = true;
    } else {
      const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[duration] || 1;
      payload.billingInterval = duration === '1y' ? 'year' : 'month';
      // Extend from the current (still-future) expiry if any, clamped end-of-month (#36).
      const base = (user.expiresAt && new Date(user.expiresAt) > new Date()) ? user.expiresAt : window.Format.todayLocal();
      payload.subscriptionExpiresAt = window.Format.addMonths(base, months);
    }

    try {
      await window.Api.adminSetPlan(user.id, payload);
      await window.Api.adminUpdateUser(user.id, { notes });
      await window.Api.adminSetStatus(user.id, { isActive: true });
      this.showToast(`Langganan ${user.email} diubah menjadi ${newPlan.toUpperCase()}`, 'success');
      this.closeQuickPlanModal();
      await this.reload();
    } catch (e2) { this.showToast(e2.message || 'Gagal menerapkan perubahan.', 'error'); }
  }

  // --- PLAN PRICE MODAL ---
  openEditPlanPriceModal(planId) {
    const plan = this.normalizePlan(this.plans.find(p => p.id === planId) || { id: planId });
    if (!this.plans.find(p => p.id === planId)) return;
    this.editingPlanId = planId;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('edit-plan-name', `${plan.name} (${planId.toUpperCase()})`);
    set('edit-plan-price', plan.price);
    set('edit-plan-interval', plan.interval === 'Tahun' ? 'Tahun' : 'Bulan');
    document.getElementById('modal-edit-plan-price')?.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeEditPlanPriceModal() {
    document.getElementById('modal-edit-plan-price')?.classList.add('hidden');
    this.editingPlanId = null;
  }

  async savePlanPrice() {
    if (!this.editingPlanId) return;
    const raw = this.plans.find(p => p.id === this.editingPlanId);
    if (!raw) return;
    const get = id => (document.getElementById(id) || {}).value || '';
    const newPrice = Math.max(0, Number(get('edit-plan-price')) || 0);
    const interval = get('edit-plan-interval') === 'Tahun' ? 'year' : 'month';
    try {
      await window.Api.adminSavePlan({
        id: raw.id, name: raw.name, price: newPrice, billingInterval: interval,
        maxInvoicesPerMonth: Number(raw.max_invoices_per_month), maxTemplates: Number(raw.max_templates),
        canUseQr: Number(raw.can_use_qr) === 1, canUseSignature: Number(raw.can_use_signature) === 1,
        canExportWhatsapp: Number(raw.can_export_whatsapp) === 1, hasWatermark: Number(raw.has_watermark) === 1,
        isActive: Number(raw.is_active) !== 0
      });
      this.showToast(`Tarif harga paket ${raw.name} berhasil diperbarui`, 'success');
      this.closeEditPlanPriceModal();
      await this.reload();
    } catch (e2) { this.showToast(e2.message || 'Gagal menyimpan harga.', 'error'); }
  }

  // --- TARIF PER-DOKUMEN & QRIS STATIS ---
  // Client mirror of the server's promo-window rule (badge is display-only;
  // the authoritative effective price always comes from the server).
  _billingEffectiveNow(b) {
    if (!b) return 0;
    const price = Number(b.pricePromo) || 0, normal = Number(b.priceNormal) || 0;
    if (!b.promoActive) return normal;
    const today = window.Format ? window.Format.todayLocal() : new Date().toISOString().slice(0, 10);
    if (b.promoStart && today < b.promoStart) return normal;
    if (b.promoEnd && today > b.promoEnd) return normal;
    return price;
  }

  renderBillingForm() {
    const b = this.billing;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (b) {
      const cb = document.getElementById('billing-promo-active');
      if (cb) cb.checked = !!b.promoActive;
      set('input-billing-promo', b.pricePromo);
      set('input-billing-normal', b.priceNormal);
      set('input-billing-start', b.promoStart || '');
      set('input-billing-end', b.promoEnd || '');
      set('input-billing-note', b.qrisNote || '');
    }
    // Pratinjau gambar: unggahan baru > penghapusan > tersimpan di server.
    const img = document.getElementById('billing-qris-preview');
    const empty = document.getElementById('billing-qris-empty');
    const src = this.qrisImageDataUrl || (!this.qrisImageRemoved && b && b.qrisImage) || null;
    if (img) {
      if (src) { img.src = src; img.classList.remove('hidden'); if (empty) empty.classList.add('hidden'); }
      else { img.removeAttribute('src'); img.classList.add('hidden'); if (empty) empty.classList.remove('hidden'); }
    }
    setTxt('billing-effective-badge', 'Rp ' + this._billingEffectiveNow(b || { pricePromo: 1000, priceNormal: 2000, promoActive: true }).toLocaleString('id-ID'));
    const s = this.payStats;
    setTxt('stat-paid-docs', `${s ? s.totalPaid : 0} lunas`);
    setTxt('stat-payment-revenue', s ? this.formatCurrency(s.revenue) : 'Rp 0');
    setTxt('stat-payment-pending', `${s ? s.pendingCount : 0} menunggu`);
  }

  // Badge-only refresh: reads the CURRENT (unsaved) input values so typing or
  // toggling never reverts the form to the last server state.
  renderBillingFormBadgeOnly() {
    const get = id => (document.getElementById(id) || {}).value || '';
    const b = {
      pricePromo: Number(get('input-billing-promo')) || 0,
      priceNormal: Number(get('input-billing-normal')) || 0,
      promoActive: !!(document.getElementById('billing-promo-active') || {}).checked,
      promoStart: get('input-billing-start') || null,
      promoEnd: get('input-billing-end') || null
    };
    const el = document.getElementById('billing-effective-badge');
    if (el) el.textContent = 'Rp ' + this._billingEffectiveNow(b).toLocaleString('id-ID');
  }

  // Upload QRIS -> decode -> re-encode via canvas (maks 600px, PNG) supaya
  // data URL kecil dan bebas EXIF/mime palsu (pola import logo/signature).
  handleQrisFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { this.showToast('Gambar QRIS harus PNG atau JPEG.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const im = new Image();
      im.onload = () => {
        const max = 600;
        const scale = Math.min(1, max / Math.max(im.width, im.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(im.width * scale);
        canvas.height = Math.round(im.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 300000) { this.showToast('Gambar QRIS terlalu besar setelah kompresi.', 'error'); return; }
        this.qrisImageDataUrl = dataUrl;
        this.qrisImageRemoved = false;
        this.renderBillingForm();
        this.showToast('Gambar QRIS siap disimpan.', 'info');
      };
      im.onerror = () => this.showToast('Gagal membaca gambar QRIS.', 'error');
      im.src = ev.target.result;
    };
    reader.onerror = () => this.showToast('Gagal membaca berkas.', 'error');
    reader.readAsDataURL(file);
  }

  async saveBilling() {
    const get = id => (document.getElementById(id) || {}).value || '';
    const pricePromo = Math.round(Number(get('input-billing-promo')));
    const priceNormal = Math.round(Number(get('input-billing-normal')));
    if (!Number.isFinite(pricePromo) || pricePromo < 0 || pricePromo > 1000000 ||
        !Number.isFinite(priceNormal) || priceNormal < 0 || priceNormal > 1000000) {
      this.showToast('Harga harus angka 0 - 1.000.000.', 'error'); return;
    }
    const promoStart = get('input-billing-start') || null;
    const promoEnd = get('input-billing-end') || null;
    if (promoStart && promoEnd && promoEnd < promoStart) {
      this.showToast('Tanggal akhir promo tidak boleh sebelum tanggal mulai.', 'error'); return;
    }
    const payload = {
      pricePromo, priceNormal,
      promoActive: !!(document.getElementById('billing-promo-active') || {}).checked,
      promoStart, promoEnd,
      qrisNote: get('input-billing-note').slice(0, 500)
    };
    if (this.qrisImageRemoved) payload.qrisImage = null;
    else if (this.qrisImageDataUrl) payload.qrisImage = this.qrisImageDataUrl;
    try {
      this.billing = await window.Api.adminSaveBilling(payload);
      this.qrisImageDataUrl = null;
      this.qrisImageRemoved = false;
      this.showToast('Tarif & QRIS berhasil disimpan.', 'success');
      await this.reload();
    } catch (e) { this.showToast(e.message || 'Gagal menyimpan tarif.', 'error'); }
  }

  // --- ROW ACTIONS ---
  async toggleUserStatus(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user || user.role === 'superadmin') return;
    try {
      await window.Api.adminSetStatus(user.id, { isActive: user.status !== 'suspended' ? false : true });
      this.showToast(`Status akun ${user.email} diperbarui`, 'info');
      await this.reload();
    } catch (e) { this.showToast(e.message || 'Gagal mengubah status.', 'error'); }
  }

  async deleteUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user || user.role === 'superadmin') return;
    if (!confirm(`Hapus akun ${user.name} (${user.email})? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await window.Api.adminDeleteUser(user.id);
      this.showToast(`Pengguna ${user.email} telah dihapus`, 'info');
      await this.reload();
    } catch (e) { this.showToast(e.message || 'Gagal menghapus.', 'error'); }
  }

  async reload() {
    await this.loadData();
    this.renderDashboard();
  }

  refreshData() {
    if (!this._ready) { this.showToast('Sesi belum aktif.', 'error'); return; }
    this.reload().then(() => this.showToast('Data dimuat ulang dari server.', 'success'));
  }

  // --- EXPORT ---
  exportUsersData() {
    const jsonStr = JSON.stringify(this.users, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoicecraft_users_${window.Format.todayLocal()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); // #35
    this.showToast('Backup data pengguna berhasil diunduh', 'success');
  }

  // --- UTILS ---
  formatCurrency(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-slate-900 dark:bg-slate-800');
    toast.className = `px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass}`;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info'));
    icon.className = 'w-4 h-4';
    const span = document.createElement('span');
    span.textContent = message; // textContent — never innerHTML for dynamic text
    toast.appendChild(icon);
    toast.appendChild(span);

    const container = document.getElementById('toast-container');
    if (!container) return;
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- EVENT BINDING (delegation; no inline onclick) ---
  bindEvents() {
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

    on('btn-theme-toggle', 'click', () => this.toggleTheme());
    on('btn-oauth-superadmin-login', 'click', () => this.loginOAuthSuperadmin());
    on('btn-superadmin-logout', 'click', () => this.logout());
    on('btn-add-user', 'click', () => this.openAddUserModal());
    on('btn-refresh-users', 'click', () => this.refreshData());
    on('btn-export-users-data', 'click', () => this.exportUsersData());

    on('search-users-input', 'input', (e) => {
      this.searchQuery = e.target.value;
      // Debounced server search + client re-render.
      clearTimeout(this._searchT);
      this._searchT = setTimeout(async () => {
        try {
          const rows = await window.Api.adminListUsers(this._querySuffix());
          this.users = rows.map(u => this.normalizeUser(u));
          this.renderUsersTable();
          if (window.lucide) window.lucide.createIcons();
        } catch { this.renderUsersTable(); }
      }, 250);
    });
    on('filter-plan-select', 'change', (e) => { this.selectedPlanFilter = e.target.value; this.renderUsersTable(); });
    on('filter-status-select', 'change', (e) => { this.selectedStatusFilter = e.target.value; this.renderUsersTable(); });
    on('sort-users-select', 'change', (e) => { this.selectedSort = e.target.value; this.renderUsersTable(); });

    on('user-modal-form', 'submit', (e) => this.saveUserForm(e));
    on('btn-close-user-modal', 'click', () => this.closeUserModal());
    on('btn-cancel-user-modal', 'click', () => this.closeUserModal());

    on('btn-save-quick-plan', 'click', () => this.applyQuickPlanChange());
    on('btn-close-quick-plan', 'click', () => this.closeQuickPlanModal());
    on('btn-cancel-quick-plan', 'click', () => this.closeQuickPlanModal());

    on('btn-save-plan-price', 'click', () => this.savePlanPrice());
    on('btn-close-edit-plan-price', 'click', () => this.closeEditPlanPriceModal());
    on('btn-cancel-edit-plan-price', 'click', () => this.closeEditPlanPriceModal());

    // Tarif per-dokumen & QRIS statis.
    on('btn-save-billing', 'click', () => this.saveBilling());
    on('billing-promo-active', 'change', () => this.renderBillingFormBadgeOnly());
    on('input-billing-promo', 'input', () => this.renderBillingFormBadgeOnly());
    on('input-billing-normal', 'input', () => this.renderBillingFormBadgeOnly());
    on('input-billing-start', 'change', () => this.renderBillingFormBadgeOnly());
    on('input-billing-end', 'change', () => this.renderBillingFormBadgeOnly());
    on('input-billing-qris', 'change', (e) => this.handleQrisFile(e.target.files && e.target.files[0]));
    on('btn-clear-billing-qris', 'click', () => {
      this.qrisImageDataUrl = null;
      this.qrisImageRemoved = true;
      const fi = document.getElementById('input-billing-qris'); if (fi) fi.value = '';
      this.renderBillingForm();
    });

    // Delegated table-row + plan-card actions.
    const tbody = document.getElementById('users-table-body');
    if (tbody) tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'quick-plan') this.openQuickPlanModal(id);
      else if (action === 'edit') this.openEditUserModal(id);
      else if (action === 'toggle-status') this.toggleUserStatus(id);
      else if (action === 'delete') this.deleteUser(id);
    });

    const plansEl = document.getElementById('plans-cards-container');
    if (plansEl) plansEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const planId = btn.getAttribute('data-plan-id');
      const action = btn.getAttribute('data-action');
      if (action === 'edit-plan') this.openEditPlanPriceModal(planId);
      else if (action === 'add-user') this.openAddUserModal(planId);
    });
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.superadminApp = new SuperadminApp();
});
