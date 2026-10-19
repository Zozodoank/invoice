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
    return this._user;
  },

  /** Boot: hydrate from cache for a fast first paint, then confirm against the server. */
  async init() {
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      if (cached) this._user = JSON.parse(cached);
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
   * Whether a brand-new document should show the "CONTOH" watermark.
   * Default is the MOST RESTRICTIVE (true) whenever there is no valid server session.
   * Per-document trial resolution happens on the server at save time.
   */
  shouldShowWatermark() {
    if (!this._user) return true;          // not logged in -> always watermark
    if (this._user.isSuperadmin) return false;
    if (this._user.isPaid) return false;
    // Free user: server tells us global default; if missing, be safe.
    return this._user.hasWatermark !== false;
  },

  /** Remaining clean (no-watermark) bonus documents per type, or null if unlimited. */
  getTrial() {
    return (this._user && this._user.trial) || null;
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
    window.dispatchEvent(new CustomEvent('auth:change', { detail: null }));
  }
};

// Expose globally
window.AuthManager = AuthManager;
