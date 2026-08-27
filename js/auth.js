/**
 * Authentication Module with Google OAuth & Superadmin Role Management
 * Supports Cloudflare SQLite/D1 user models & client-side OAuth sessions.
 */

const SUPERADMIN_EMAILS = ['megakomindo@gmail.com'];
const AUTH_STORAGE_KEY = 'invoicecraft_auth_user';

const AuthManager = {
  /**
   * Get current authenticated user
   */
  getUser() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error parsing auth state', e);
    }
    return null;
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.getUser() !== null;
  },

  /**
   * Check if current user is superadmin
   */
  isSuperadmin() {
    const user = this.getUser();
    if (!user || !user.email) return false;
    const cleanEmail = user.email.toLowerCase().trim();
    return SUPERADMIN_EMAILS.includes(cleanEmail) || user.isSuperadmin === true || user.role === 'superadmin';
  },

  /**
   * Check if watermark ("CONTOH INVOICE") should be displayed.
   * Watermark is shown if:
   * 1. User is NOT logged in, OR
   * 2. Logged-in user has an inactive / expired / suspended subscription or Free plan.
   * Superadmin and active Pro/Enterprise users have NO watermark.
   */
  shouldShowWatermark() {
    const user = this.getUser();
    
    // 1. Not logged in -> Watermark ACTIVE
    if (!user) return true;

    // 2. Superadmin -> Watermark INACTIVE
    if (this.isSuperadmin()) return false;

    // 3. Subscription Status Check
    if (user.subscriptionStatus === 'inactive' || user.subscriptionStatus === 'suspended' || user.subscriptionStatus === 'expired') {
      return true;
    }

    // 4. Free plan without paid subscription -> Watermark ACTIVE
    if (user.plan === 'free') {
      return true;
    }

    // 5. Expiration date check
    if (user.expiresAt) {
      const expiry = new Date(user.expiresAt);
      if (expiry < new Date()) {
        return true;
      }
    }

    // Active paid subscriber (Pro / Enterprise) -> Watermark INACTIVE
    return false;
  },

  /**
   * Save user session
   */
  setUser(userData) {
    const isSuper = SUPERADMIN_EMAILS.includes((userData.email || '').toLowerCase().trim()) || userData.isSuperadmin === true;
    const sessionUser = {
      ...userData,
      isSuperadmin: isSuper,
      role: isSuper ? 'superadmin' : (userData.role || 'user'),
      plan: isSuper ? 'enterprise' : (userData.plan || 'pro'),
      subscriptionStatus: isSuper ? 'active' : (userData.subscriptionStatus || 'active'),
      loginAt: new Date().toISOString()
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
    window.dispatchEvent(new CustomEvent('auth:change', { detail: sessionUser }));
    return sessionUser;
  },

  /**
   * Logout
   */
  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('auth:change', { detail: null }));
  },

  /**
   * Parse JWT token payload from Google OAuth Credential Response
   */
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to parse JWT token', e);
      return null;
    }
  },

  /**
   * Handle Google Credential Response
   */
  handleGoogleResponse(response) {
    if (!response || !response.credential) {
      console.error('Invalid Google Credential Response');
      return null;
    }

    const payload = this.parseJwt(response.credential);
    if (!payload || !payload.email) {
      console.error('Failed to extract email from Google Token');
      return null;
    }

    const user = {
      id: 'usr_' + (payload.sub || Date.now().toString(36)),
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      avatar: payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name || payload.email)}`,
      provider: 'google',
      googleId: payload.sub,
      plan: 'pro'
    };

    return this.setUser(user);
  },

  /**
   * Login with Simulated Google Account (One-click login for easy testing)
   */
  loginDemo(email, name, role = 'user') {
    const isSuper = SUPERADMIN_EMAILS.includes((email || '').toLowerCase().trim());
    const user = {
      id: 'usr_' + (isSuper ? 'superadmin' : Date.now().toString(36)),
      email: email,
      name: name || (isSuper ? 'Super Administrator' : email.split('@')[0]),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
      provider: 'google',
      role: isSuper ? 'superadmin' : role,
      plan: isSuper ? 'enterprise' : 'pro'
    };

    return this.setUser(user);
  }
};

// Expose globally
window.AuthManager = AuthManager;
