/**
 * Authentication Module — thin client for the Cloudflare Pages Functions backend.
 *
 * IMPORTANT: The browser is NEVER the source of truth for identity/role/plan/watermark.
 * Those decisions come from the server (verified session + D1) via `GET /api/me`.
 * `localStorage` here is only a fast-display CACHE and is re-confirmed on every load.
 */

const AUTH_CACHE_KEY = 'invoicecraft_auth_cache';

const AuthManager = {
  /** In-memory server snapshot (or null). Not authoritative until confirmed by /api/me. */
  _user: null,

  /** API base — same origin (Pages Functions under /api). */
  _api(path) {
    return `/api${path}`;
  },

  async _fetchJSON(path, options = {}) {
    const res = await fetch(this._api(path), {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { ok: res.ok, status: res.status, data };
  },

  /**
   * Re-confirm identity with the server. Updates cache + dispatches `auth:change`.
   * @returns the authoritative user snapshot (or null when logged out).
   */
  async refresh() {
    const { ok, data } = await this._fetchJSON('/me');
    if (ok && data) {
      this._user = data;
      this._writeCache(data);
    } else {
      this._user = null;
      try { localStorage.removeItem(AUTH_CACHE_KEY); } catch { /* ignore */ }
    }
    window.dispatchEvent(new CustomEvent('auth:change', { detail: this._user }));
    this._updateCreditsUi();
    return this._user;
  },

  /** Boot: hydrate from cache for a fast first paint, then confirm against the server. */
  async init() {
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      if (cached) {
        this._user = JSON.parse(cached);
        this._updateCreditsUi();
      }
    } catch { /* ignore */ }
    return await this.refresh();
  },

  _writeCache(user) {
    try { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user)); } catch { /* ignore */ }
  },

  /** Server snapshot (display fields + entitlement). */
  getUser() {
    return this._user;
  },

  isLoggedIn() {
    return !!this._user;
  },

  /** Authoritative ONLY after a successful refresh(); cached otherwise. */
  isSuperadmin() {
    return !!(this._user && this._user.role === 'superadmin');
  },

  /**
   * Whether a document should show the "CONTOH" watermark.
   * - Not logged in -> true (must register/login first)
   * - Superadmin -> false (unlimited)
   * - Logged in -> false while printCredits > 0; true as soon as printCredits <= 0 (kredit habis -> watermark muncul kembali)
   */
  shouldShowWatermark() {
    if (!this._user) return true;
    if (this._user.isSuperadmin) return false;
    return this.getCredits() <= 0;
  },

  /** Remaining clean (no-watermark) bonus documents per type, or null if unlimited. */
  getTrial() {
    return (this._user && this._user.trial) || null;
  },

  /** Get current print/download credits */
  getCredits() {
    if (!this._user) return 0;
    if (this._user.isSuperadmin) return 999999;
    return typeof this._user.printCredits === 'number' ? this._user.printCredits : 3;
  },

  /** Update credits locally and notify listeners */
  setCredits(credits) {
    if (!this._user) return;
    this._user.printCredits = credits;
    this._writeCache(this._user);
    this._updateCreditsUi();
    window.dispatchEvent(new CustomEvent('auth:credits', { detail: { credits } }));
  },

  _updateCreditsUi() {
    const loggedIn = this.isLoggedIn();
    const badges = document.querySelectorAll('.user-credits-badge');
    const counts = document.querySelectorAll('.user-credits-count');
    const cr = this.getCredits();
    const isSuper = this.isSuperadmin();
    const hasCredit = isSuper || cr > 0;
    const txt = isSuper ? '∞' : String(cr);
    counts.forEach(el => { el.textContent = txt; });
    badges.forEach(b => {
      if (loggedIn) {
        b.classList.remove('hidden');
        b.classList.add('inline-flex');
      } else {
        b.classList.add('hidden');
        b.classList.remove('inline-flex');
      }
    });

    // Update kontrol Hilangkan Watermark di sidebar panel kiri
    const btnLogin = document.getElementById('btn-watermark-login');
    const btnPay = document.getElementById('btn-watermark-pay');
    const badgeClean = document.getElementById('badge-watermark-clean');
    if (btnLogin) {
      btnLogin.classList.toggle('hidden', loggedIn);
      btnLogin.classList.toggle('flex', !loggedIn);
    }
    if (btnPay) {
      const showPay = loggedIn && !hasCredit;
      btnPay.classList.toggle('hidden', !showPay);
      btnPay.classList.toggle('flex', showPay);
    }
    if (badgeClean) {
      const showClean = loggedIn && hasCredit;
      badgeClean.classList.toggle('hidden', !showClean);
      badgeClean.classList.toggle('flex', showClean);
    }
  },

  /**
   * Exchange a Google Credential Response for a server session.
   * @returns authoritative user snapshot, or null on failure (reason in `.error`).
   */
  async loginWithCredential(credential) {
    if (!credential) {
      console.error('Invalid Google Credential Response');
      return null;
    }
    const { ok, data } = await this._fetchJSON('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    if (!ok || !data) {
      return { error: (data && data.error) || 'Login gagal. Coba lagi.' };
    }
    this._user = data;
    this._writeCache(data);
    this._updateCreditsUi();
    window.dispatchEvent(new CustomEvent('auth:change', { detail: data }));
    return data;
  },

  /** GIS SDK callback entry point. */
  async handleGoogleResponse(response) {
    const credential = response && response.credential;
    return await this.loginWithCredential(credential);
  },

  /** Sign out: clear server cookie + local cache. */
  async logout() {
    try { await this._fetchJSON('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    this._user = null;
    try { localStorage.removeItem(AUTH_CACHE_KEY); } catch { /* ignore */ }
    this._updateCreditsUi();
    window.dispatchEvent(new CustomEvent('auth:change', { detail: null }));
  }
};

// Expose globally
window.AuthManager = AuthManager;
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuthManager._updateCreditsUi());
  } else {
    AuthManager._updateCreditsUi();
  }
}
