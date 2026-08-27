/**
 * Superadmin Portal - User & Subscription Management Logic
 * Dedicated Superadmin: megakomindo@gmail.com
 */

const SUPERADMIN_EMAIL = 'megakomindo@gmail.com';
const STORAGE_KEY_USERS = 'invoicecraft_superadmin_users';
const STORAGE_KEY_PLANS = 'invoicecraft_superadmin_plans';
const STORAGE_KEY_AUTH = 'invoicecraft_superadmin_session';

// Default Subscription Plans
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free Starter',
    price: 0,
    interval: 'Bulan',
    maxInvoices: 5,
    templates: ['Modern Slate'],
    features: ['5 Invoice/Bulan', 'Template Standar', 'Export PDF Dasar', '1 Rekening Bank'],
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    color: '#64748b'
  },
  {
    id: 'pro',
    name: 'Pro Member',
    price: 79000,
    interval: 'Bulan',
    maxInvoices: -1, // Unlimited
    templates: ['Semua (5 Template)'],
    features: ['Unlimited Invoice', 'Semua 5 Desain Template', 'QR Code & E-Wallet', 'Tanda Tangan Digital', 'Kirim WhatsApp & Email', 'Tanpa Watermark'],
    badgeClass: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    color: '#2563eb'
  },
  {
    id: 'enterprise',
    name: 'Enterprise / Agency',
    price: 249000,
    interval: 'Bulan',
    maxInvoices: -1,
    templates: ['Semua Template + Kustom'],
    features: ['Multi-User Tenant', 'Custom Domain & Logo', 'White-label PDF', 'API & Webhooks', 'Prioritas Support 24/7', 'Database Cloud Backup'],
    badgeClass: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
    color: '#9333ea'
  }
];

// Initial Realistic Mock Users
const INITIAL_USERS = [
  {
    id: 'usr_001',
    email: 'megakomindo@gmail.com',
    name: 'Super Administrator',
    company: 'Megakomindo Solusindo',
    phone: '0812-3456-7890',
    role: 'superadmin',
    plan: 'enterprise',
    status: 'active',
    registeredAt: '2026-01-01',
    expiresAt: '2099-12-31', // Lifetime
    invoicesCount: 142,
    notes: 'Akun Superadmin Utama Platform'
  },
  {
    id: 'usr_002',
    email: 'budi.santoso@digitalabadi.co.id',
    name: 'Budi Santoso',
    company: 'PT Teknologi Digital Abadi',
    phone: '0812-9876-5432',
    role: 'user',
    plan: 'pro',
    status: 'active',
    registeredAt: '2026-03-15',
    expiresAt: '2026-09-15',
    invoicesCount: 38,
    notes: 'Paket Pro Langganan 6 Bulan'
  },
  {
    id: 'usr_003',
    email: 'sari.wijaya@nusantaracreative.com',
    name: 'Sari Dewi Wijaya',
    company: 'Nusantara Creative Studio',
    phone: '0857-1122-3344',
    role: 'user',
    plan: 'enterprise',
    status: 'active',
    registeredAt: '2026-02-10',
    expiresAt: '2027-02-10',
    invoicesCount: 95,
    notes: 'Paket Enterprise 1 Tahun (Agensi Desain)'
  },
  {
    id: 'usr_004',
    email: 'hendra.kurniawan@gmail.com',
    name: 'Hendra Kurniawan',
    company: 'Bengkel Mandiri Motor',
    phone: '0813-5566-7788',
    role: 'user',
    plan: 'free',
    status: 'active',
    registeredAt: '2026-06-01',
    expiresAt: null,
    invoicesCount: 4,
    notes: 'Pengguna Paket Free Starter'
  },
  {
    id: 'usr_005',
    email: 'rina.anggraeni@solusibisnis.id',
    name: 'Rina Anggraeni',
    company: 'CV Solusi Bisnis Cemerlang',
    phone: '0821-4433-2211',
    role: 'user',
    plan: 'pro',
    status: 'active',
    registeredAt: '2026-07-20',
    expiresAt: '2026-08-30', // Segera berakhir
    invoicesCount: 22,
    notes: 'Masa aktif sisa beberapa hari'
  },
  {
    id: 'usr_006',
    email: 'ahmad.fauzi@freelance.net',
    name: 'Ahmad Fauzi',
    company: 'Fauzi Web Developer',
    phone: '0878-9988-7766',
    role: 'user',
    plan: 'pro',
    status: 'expired',
    registeredAt: '2026-05-10',
    expiresAt: '2026-08-10',
    invoicesCount: 15,
    notes: 'Masa aktif telah berakhir, belum perpanjang'
  },
  {
    id: 'usr_007',
    email: 'dimas.prasetyo@tokoberkah.com',
    name: 'Dimas Prasetyo',
    company: 'Toko Berkah Sembako',
    phone: '0819-2233-4455',
    role: 'user',
    plan: 'free',
    status: 'suspended',
    registeredAt: '2026-04-12',
    expiresAt: null,
    invoicesCount: 12,
    notes: 'Akun ditangguhkan sementara karena indikasi spam'
  }
];

class SuperadminApp {
  constructor() {
    this.users = this.loadUsers();
    this.plans = this.loadPlans();
    this.currentUser = this.loadAuthSession();
    this.searchQuery = '';
    this.selectedPlanFilter = 'all';
    this.selectedStatusFilter = 'all';
    this.selectedSort = 'newest';
    this.editingUserId = null;

    this.init();
  }

  // --- PERSISTENCE ---
  loadUsers() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse superadmin users from storage', e);
    }
    this.saveUsers(INITIAL_USERS);
    return INITIAL_USERS;
  }

  saveUsers(users) {
    this.users = users;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }

  loadPlans() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PLANS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse superadmin plans', e);
    }
    return DEFAULT_PLANS;
  }

  loadAuthSession() {
    if (window.AuthManager && window.AuthManager.isLoggedIn()) {
      const user = window.AuthManager.getUser();
      if (window.AuthManager.isSuperadmin()) {
        return user;
      }
    }
    return null;
  }

  setAuthSession(user) {
    this.currentUser = user;
    if (window.AuthManager) {
      window.AuthManager.setUser(user);
    }
  }

  clearAuthSession() {
    this.currentUser = null;
    if (window.AuthManager) {
      window.AuthManager.logout();
    }
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
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('invoicecraft_theme', isDark ? 'dark' : 'light');
  }

  // --- AUTHENTICATION GUARD ---
  checkAuth() {
    const loginGate = document.getElementById('login-gate');
    const dashboardContent = document.getElementById('dashboard-content');
    const headerAdminEmail = document.getElementById('header-admin-email');

    // Direct OAuth Check: Only Superadmin email can access
    const isSuper = window.AuthManager ? window.AuthManager.isSuperadmin() : (this.currentUser && this.currentUser.email === SUPERADMIN_EMAIL);
    const authUser = window.AuthManager ? window.AuthManager.getUser() : this.currentUser;

    if (isSuper && authUser) {
      this.currentUser = authUser;
      loginGate.classList.add('hidden');
      dashboardContent.classList.remove('hidden');
      if (headerAdminEmail) headerAdminEmail.textContent = authUser.email;
      this.renderDashboard();
    } else {
      loginGate.classList.remove('hidden');
      dashboardContent.classList.add('hidden');
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  loginOAuthSuperadmin() {
    const sessionData = {
      id: 'usr_superadmin',
      email: SUPERADMIN_EMAIL,
      name: 'Super Administrator',
      role: 'superadmin',
      isSuperadmin: true,
      provider: 'google',
      plan: 'enterprise',
      loginAt: new Date().toISOString()
    };
    this.setAuthSession(sessionData);
    this.showToast('Selamat datang, Superadmin Megakomindo! 👋', 'success');
    this.checkAuth();
    return true;
  }

  logout() {
    this.clearAuthSession();
    this.showToast('Anda telah keluar dari Portal Superadmin', 'info');
    this.checkAuth();
  }

  showLoginError(msg) {
    const errBox = document.getElementById('login-error-message');
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    }
  }

  // --- DASHBOARD RENDERING ---
  renderDashboard() {
    this.updateStats();
    this.renderPlansGrid();
    this.renderUsersTable();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateStats() {
    const totalUsers = this.users.length;
    const proUsers = this.users.filter(u => u.plan === 'pro' && u.status === 'active').length;
    const enterpriseUsers = this.users.filter(u => u.plan === 'enterprise' && u.status === 'active').length;
    const paidUsers = proUsers + enterpriseUsers;
    
    // Calculate Monthly Recurring Revenue (MRR)
    const proPrice = (this.plans.find(p => p.id === 'pro') || {}).price || 79000;
    const entPrice = (this.plans.find(p => p.id === 'enterprise') || {}).price || 249000;
    const estimatedMrr = (proUsers * proPrice) + (enterpriseUsers * entPrice);

    // Calculate Expiring Soon (< 30 days remaining)
    const now = new Date();
    const expiringSoon = this.users.filter(u => {
      if (!u.expiresAt || u.status !== 'active') return false;
      const expiry = new Date(u.expiresAt);
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    // Update DOM
    document.getElementById('stat-total-users').textContent = totalUsers;
    document.getElementById('stat-paid-users').textContent = paidUsers;
    document.getElementById('stat-pro-count').textContent = `${proUsers} Pro • ${enterpriseUsers} Enterprise`;
    document.getElementById('stat-mrr').textContent = this.formatCurrency(estimatedMrr);
    document.getElementById('stat-expiring').textContent = expiringSoon;
  }

  renderPlansGrid() {
    const container = document.getElementById('plans-cards-container');
    if (!container) return;

    container.innerHTML = this.plans.map(plan => {
      const activeSubsCount = this.users.filter(u => u.plan === plan.id && u.status === 'active').length;
      return `
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg ${plan.badgeClass} border">
                ${plan.name}
              </span>
              <span class="text-xs font-mono font-bold text-slate-500">
                ${activeSubsCount} Pengguna
              </span>
            </div>
            
            <div class="mt-4">
              <span class="text-2xl font-extrabold font-heading text-slate-900 dark:text-white">
                ${plan.price === 0 ? 'Gratis' : this.formatCurrency(plan.price)}
              </span>
              ${plan.price > 0 ? `<span class="text-xs text-slate-400">/${plan.interval}</span>` : ''}
            </div>

            <ul class="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              ${plan.features.map(f => `
                <li class="flex items-center gap-1.5">
                  <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-500 shrink-0"></i>
                  <span>${f}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span class="text-slate-400">Limit: ${plan.maxInvoices === -1 ? 'Unlimited' : plan.maxInvoices + ' Inv/bln'}</span>
            <button type="button" onclick="window.superadminApp.openAddUserModal('${plan.id}')" class="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              + Tambah User
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    const emptyState = document.getElementById('users-empty-state');
    const tableCountBadge = document.getElementById('table-users-count');

    let filtered = [...this.users];

    // Filter by Query (Name, Email, Company, ID)
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.company && u.company.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }

    // Filter by Plan
    if (this.selectedPlanFilter !== 'all') {
      filtered = filtered.filter(u => u.plan === this.selectedPlanFilter);
    }

    // Filter by Status
    if (this.selectedStatusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === this.selectedStatusFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      if (this.selectedSort === 'newest') {
        return new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0);
      }
      if (this.selectedSort === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (this.selectedSort === 'invoices-desc') {
        return (b.invoicesCount || 0) - (a.invoicesCount || 0);
      }
      if (this.selectedSort === 'expiry-asc') {
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return new Date(a.expiresAt) - new Date(b.expiresAt);
      }
      return 0;
    });

    if (tableCountBadge) {
      tableCountBadge.textContent = `${filtered.length} dari ${this.users.length} pengguna`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const now = new Date();

    tbody.innerHTML = filtered.map((u, idx) => {
      const planObj = this.plans.find(p => p.id === u.plan) || DEFAULT_PLANS[0];
      const initials = (u.name || u.email || 'U').substring(0, 2).toUpperCase();

      // Expiry info
      let expiryText = '-';
      let expiryBadge = '';
      if (u.expiresAt) {
        const expDate = new Date(u.expiresAt);
        const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          expiryBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">Kedaluwarsa</span>`;
        } else if (diffDays <= 14) {
          expiryBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Sisa ${diffDays} hari</span>`;
        } else if (u.expiresAt.startsWith('2099')) {
          expiryBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Seumur Hidup (Lifetime)</span>`;
        } else {
          expiryBadge = `<span class="text-xs text-slate-500 font-mono">${u.expiresAt}</span>`;
        }
      } else {
        expiryBadge = `<span class="text-xs text-slate-400 italic">Selamanya (Free)</span>`;
      }

      // Status Badge
      let statusBadge = '';
      if (u.status === 'active') {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Aktif</span>`;
      } else if (u.status === 'suspended') {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Ditangguhkan</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Kedaluwarsa</span>`;
      }

      return `
        <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800 text-xs">
          <!-- User info -->
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shadow-sm">
                ${initials}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-900 dark:text-white">${u.name || 'Tanpa Nama'}</span>
                  ${u.role === 'superadmin' ? `<span class="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded">SUPERADMIN</span>` : ''}
                </div>
                <div class="text-slate-400 font-mono text-[11px]">${u.email}</div>
                ${u.company ? `<div class="text-slate-500 text-[10px]">${u.company}</div>` : ''}
              </div>
            </div>
          </td>

          <!-- Plan -->
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${planObj.badgeClass} border">
              ${planObj.name}
            </span>
          </td>

          <!-- Status -->
          <td class="py-3.5 px-4">
            ${statusBadge}
          </td>

          <!-- Expiry Date -->
          <td class="py-3.5 px-4">
            ${expiryBadge}
          </td>

          <!-- Invoices Count -->
          <td class="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
            ${u.invoicesCount || 0} faktur
          </td>

          <!-- Registered Date -->
          <td class="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
            ${u.registeredAt || '-'}
          </td>

          <!-- Actions -->
          <td class="py-3.5 px-4 text-right">
            <div class="inline-flex items-center gap-1">
              <!-- Extend / Change Plan -->
              <button type="button" onclick="window.superadminApp.openQuickPlanModal('${u.id}')" title="Ubah Paket & Masa Aktif" class="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition">
                <i data-lucide="zap" class="w-4 h-4 text-blue-500"></i>
              </button>

              <!-- Edit User -->
              <button type="button" onclick="window.superadminApp.openEditUserModal('${u.id}')" title="Edit Profil Pengguna" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>

              <!-- Toggle Suspend -->
              ${u.role !== 'superadmin' ? `
                <button type="button" onclick="window.superadminApp.toggleUserStatus('${u.id}')" title="${u.status === 'active' ? 'Tangguhkan Akun' : 'Aktifkan Akun'}" class="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition">
                  <i data-lucide="${u.status === 'active' ? 'ban' : 'check-circle'}" class="w-4 h-4 ${u.status === 'active' ? 'text-amber-500' : 'text-emerald-500'}"></i>
                </button>
              ` : ''}

              <!-- Delete (Non-superadmin only) -->
              ${u.role !== 'superadmin' ? `
                <button type="button" onclick="window.superadminApp.deleteUser('${u.id}')" title="Hapus Pengguna" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- USER MODAL ACTIONS ---
  openAddUserModal(defaultPlan = 'pro') {
    this.editingUserId = null;
    document.getElementById('user-modal-title').textContent = 'Tambah Pengguna & Langganan Baru';
    
    // Reset Form
    document.getElementById('input-user-name').value = '';
    document.getElementById('input-user-email').value = '';
    document.getElementById('input-user-company').value = '';
    document.getElementById('input-user-phone').value = '';
    document.getElementById('select-user-plan').value = defaultPlan;
    document.getElementById('select-user-status').value = 'active';
    document.getElementById('input-user-notes').value = '';

    // Default expiry 1 month from now
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById('input-user-expiry').value = nextMonth.toISOString().split('T')[0];

    document.getElementById('user-modal').classList.remove('hidden');
  }

  openEditUserModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    this.editingUserId = userId;
    document.getElementById('user-modal-title').textContent = `Edit Pengguna: ${user.name || user.email}`;
    
    document.getElementById('input-user-name').value = user.name || '';
    document.getElementById('input-user-email').value = user.email || '';
    document.getElementById('input-user-company').value = user.company || '';
    document.getElementById('input-user-phone').value = user.phone || '';
    document.getElementById('select-user-plan').value = user.plan || 'free';
    document.getElementById('select-user-status').value = user.status || 'active';
    document.getElementById('input-user-expiry').value = user.expiresAt || '';
    document.getElementById('input-user-notes').value = user.notes || '';

    document.getElementById('user-modal').classList.remove('hidden');
  }

  closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
    this.editingUserId = null;
  }

  saveUserForm(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('input-user-name').value.trim();
    const email = document.getElementById('input-user-email').value.trim().toLowerCase();
    const company = document.getElementById('input-user-company').value.trim();
    const phone = document.getElementById('input-user-phone').value.trim();
    const plan = document.getElementById('select-user-plan').value;
    const status = document.getElementById('select-user-status').value;
    const expiresAt = document.getElementById('input-user-expiry').value || null;
    const notes = document.getElementById('input-user-notes').value.trim();

    if (!email) {
      alert('Email wajib diisi!');
      return;
    }

    if (this.editingUserId) {
      // Update existing user
      const idx = this.users.findIndex(u => u.id === this.editingUserId);
      if (idx !== -1) {
        this.users[idx] = {
          ...this.users[idx],
          name,
          email,
          company,
          phone,
          plan,
          status,
          expiresAt: plan === 'free' ? null : expiresAt,
          notes
        };
        this.saveUsers(this.users);
        this.showToast(`Data pengguna ${email} berhasil diperbarui`, 'success');
      }
    } else {
      // Check duplicate email
      if (this.users.some(u => u.email === email)) {
        alert(`Email ${email} sudah terdaftar dalam sistem!`);
        return;
      }

      const newUser = {
        id: 'usr_' + Date.now().toString(36),
        name: name || email.split('@')[0],
        email,
        company,
        phone,
        role: email === SUPERADMIN_EMAIL ? 'superadmin' : 'user',
        plan,
        status,
        registeredAt: new Date().toISOString().split('T')[0],
        expiresAt: plan === 'free' ? null : expiresAt,
        invoicesCount: 0,
        notes
      };

      this.users.unshift(newUser);
      this.saveUsers(this.users);
      this.showToast(`Pengguna baru ${email} (${plan.toUpperCase()}) berhasil ditambahkan!`, 'success');
    }

    this.closeUserModal();
    this.renderDashboard();
  }

  // --- QUICK PLAN MODAL ---
  openQuickPlanModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    this.editingUserId = userId;
    document.getElementById('quick-plan-user-name').textContent = `${user.name} (${user.email})`;
    document.getElementById('quick-plan-select').value = user.plan || 'pro';
    document.getElementById('quick-plan-duration').value = '1m';

    document.getElementById('quick-plan-modal').classList.remove('hidden');
  }

  closeQuickPlanModal() {
    document.getElementById('quick-plan-modal').classList.add('hidden');
    this.editingUserId = null;
  }

  applyQuickPlanChange() {
    if (!this.editingUserId) return;
    const user = this.users.find(u => u.id === this.editingUserId);
    if (!user) return;

    const newPlan = document.getElementById('quick-plan-select').value;
    const duration = document.getElementById('quick-plan-duration').value;

    let targetDate = new Date();
    // If current expiry date is in the future, extend from that date
    if (user.expiresAt && new Date(user.expiresAt) > targetDate) {
      targetDate = new Date(user.expiresAt);
    }

    if (duration === '1m') {
      targetDate.setMonth(targetDate.getMonth() + 1);
    } else if (duration === '3m') {
      targetDate.setMonth(targetDate.getMonth() + 3);
    } else if (duration === '6m') {
      targetDate.setMonth(targetDate.getMonth() + 6);
    } else if (duration === '1y') {
      targetDate.setFullYear(targetDate.getFullYear() + 1);
    } else if (duration === 'lifetime') {
      targetDate = new Date('2099-12-31');
    }

    user.plan = newPlan;
    user.status = 'active';
    user.expiresAt = newPlan === 'free' ? null : targetDate.toISOString().split('T')[0];

    this.saveUsers(this.users);
    this.showToast(`Langganan ${user.email} diubah menjadi ${newPlan.toUpperCase()} (Aktif s.d ${user.expiresAt || 'Selamanya'})`, 'success');
    
    this.closeQuickPlanModal();
    this.renderDashboard();
  }

  // --- ACTIONS ---
  toggleUserStatus(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user || user.role === 'superadmin') return;

    user.status = user.status === 'active' ? 'suspended' : 'active';
    this.saveUsers(this.users);
    this.showToast(`Status akun ${user.email} diubah menjadi: ${user.status.toUpperCase()}`, 'info');
    this.renderDashboard();
  }

  deleteUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user || user.role === 'superadmin') return;

    if (confirm(`Apakah Anda yakin ingin menghapus akun ${user.name} (${user.email})? Tindakan ini tidak dapat dibatalkan.`)) {
      this.users = this.users.filter(u => u.id !== userId);
      this.saveUsers(this.users);
      this.showToast(`Pengguna ${user.email} telah dihapus`, 'info');
      this.renderDashboard();
    }
  }

  resetToDefaultMockData() {
    if (confirm('Reset seluruh data pengguna ke data simulasi bawaan?')) {
      this.saveUsers(INITIAL_USERS);
      this.showToast('Data simulasi pengguna berhasil di-reset', 'success');
      this.renderDashboard();
    }
  }

  exportUsersData() {
    const jsonStr = JSON.stringify(this.users, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoicecraft_users_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : 'info'}" class="w-4 h-4"></i>
      <span>${message}</span>
    `;

    const container = document.getElementById('toast-container');
    if (container) {
      container.appendChild(toast);
      if (window.lucide) window.lucide.createIcons();

      setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      }, 10);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }
  }

  // --- EVENT BINDING ---
  bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

    // OAuth Superadmin Quick Login Button
    const oauthLoginBtn = document.getElementById('btn-oauth-superadmin-login');
    if (oauthLoginBtn) {
      oauthLoginBtn.addEventListener('click', () => {
        this.loginOAuthSuperadmin();
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-superadmin-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    // Search input
    const searchInput = document.getElementById('search-users-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderUsersTable();
      });
    }

    // Filter Plan
    const planFilter = document.getElementById('filter-plan-select');
    if (planFilter) {
      planFilter.addEventListener('change', (e) => {
        this.selectedPlanFilter = e.target.value;
        this.renderUsersTable();
      });
    }

    // Filter Status
    const statusFilter = document.getElementById('filter-status-select');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.selectedStatusFilter = e.target.value;
        this.renderUsersTable();
      });
    }

    // Sort
    const sortSelect = document.getElementById('sort-users-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.selectedSort = e.target.value;
        this.renderUsersTable();
      });
    }

    // Add User Button
    const btnAddUser = document.getElementById('btn-add-user');
    if (btnAddUser) btnAddUser.addEventListener('click', () => this.openAddUserModal());

    // Reset Mock Data Button
    const btnResetData = document.getElementById('btn-reset-mock-data');
    if (btnResetData) btnResetData.addEventListener('click', () => this.resetToDefaultMockData());

    // Export Data Button
    const btnExportData = document.getElementById('btn-export-users-data');
    if (btnExportData) btnExportData.addEventListener('click', () => this.exportUsersData());

    // User Form Submit
    const userForm = document.getElementById('user-modal-form');
    if (userForm) userForm.addEventListener('submit', (e) => this.saveUserForm(e));

    // Close User Modal
    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    if (btnCloseUserModal) btnCloseUserModal.addEventListener('click', () => this.closeUserModal());

    const btnCancelUserModal = document.getElementById('btn-cancel-user-modal');
    if (btnCancelUserModal) btnCancelUserModal.addEventListener('click', () => this.closeUserModal());

    // Quick Plan Form
    const btnSaveQuickPlan = document.getElementById('btn-save-quick-plan');
    if (btnSaveQuickPlan) btnSaveQuickPlan.addEventListener('click', () => this.applyQuickPlanChange());

    const btnCloseQuickPlan = document.getElementById('btn-close-quick-plan');
    if (btnCloseQuickPlan) btnCloseQuickPlan.addEventListener('click', () => this.closeQuickPlanModal());

    const btnCancelQuickPlan = document.getElementById('btn-cancel-quick-plan');
    if (btnCancelQuickPlan) btnCancelQuickPlan.addEventListener('click', () => this.closeQuickPlanModal());
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.superadminApp = new SuperadminApp();
});
