/**
 * js/api.js — centralized fetch client for the Cloudflare Pages Functions backend.
 * Every request is credentialed (HttpOnly session cookie) and JSON.
 * Non-2xx responses throw an Error carrying the server's message.
 */

const Api = {
  base: '/api',

  async _request(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(this.base + path, opts);
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Request gagal (${res.status}).`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path) { return this._request('GET', path); },
  post(path, body) { return this._request('POST', path, body); },
  put(path, body) { return this._request('PUT', path, body); },
  del(path, body) { return this._request('DELETE', path, body); },

  // ---- documents ----
  listInvoices() { return this.get('/invoices'); },
  saveInvoice(doc) { return this.post('/invoices', doc); },
  deleteInvoice(id) { return this.del(`/invoices/${encodeURIComponent(id)}`); },

  listKwitansis() { return this.get('/kwitansis'); },
  saveKwitansi(doc) { return this.post('/kwitansis', doc); },
  deleteKwitansi(id) { return this.del(`/kwitansis/${encodeURIComponent(id)}`); },

  listSuratJalans() { return this.get('/surat-jalans'); },
  saveSuratJalan(doc) { return this.post('/surat-jalans', doc); },
  deleteSuratJalan(id) { return this.del(`/surat-jalans/${encodeURIComponent(id)}`); },

  // ---- auth / entitlements ----
  me() { return this.get('/me'); },
  entitlements() { return this.get('/entitlements'); },
  // Server-authoritative watermark check before export (Plan Phase 3.4).
  verifyExport(body) { return this.post('/export/verify', body); },

  // ---- superadmin ----
  adminListUsers(params = '') { return this.get('/admin/users' + params); },
  adminCreateUser(body) { return this.post('/admin/users', body); },
  adminUpdateUser(id, body) { return this.put(`/admin/users/${encodeURIComponent(id)}`, body); },
  adminDeleteUser(id) { return this.del(`/admin/users/${encodeURIComponent(id)}`); },
  adminSetStatus(id, body) { return this.post(`/admin/users/${encodeURIComponent(id)}/status`, body); },
  adminSetPlan(id, body) { return this.post(`/admin/users/${encodeURIComponent(id)}/plan`, body); },
  adminListPlans() { return this.get('/admin/plans'); },
  adminSavePlan(body) { return this.post('/admin/plans', body); },

  // ---- per-document pricing / static-QRIS payments ----
  adminGetBilling() { return this.get('/admin/billing'); },
  adminSaveBilling(body) { return this.post('/admin/billing', body); },
  adminPayments() { return this.get('/admin/payments'); },
  paymentIntent(body) { return this.post('/payments/intent', body); },
  paymentStatus(body) { return this.post('/payments/status', body); }
};

if (typeof window !== 'undefined') window.Api = Api;
