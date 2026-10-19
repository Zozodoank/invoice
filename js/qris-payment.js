/**
 * js/qris-payment.js — shared "Bayar QRIS" controller for the three document pages.
 *
 * Server-authoritative by design: the server decides WHICH documents need
 * payment, the effective price (promo vs normal) and the unique 2-digit amount
 * suffix that makes a static-QRIS bank notification identifiable. This module
 * only renders the answer and polls payment status while the modal is open.
 * Requires js/api.js (window.Api) and js/auth.js (window.AuthManager) and the
 * modal markup with the ids used below (present in index/kwitansi/surat-jalan).
 */

const QrisPay = {
  _timer: null,
  _paymentId: null,
  _total: 0,
  _onClean: null,

  /** Should a server-sourced history row show the "Bayar QRIS" button? */
  isPayable(doc) {
    const u = (typeof window.AuthManager !== 'undefined' && window.AuthManager.getUser)
      ? window.AuthManager.getUser() : null;
    if (!u) return false;                       // logged out: only trial/subscription clears it
    if (u.isSuperadmin || u.isPaid) return false;
    return !!(doc && doc.id && doc.hasWatermark === true); // flag comes from the D1 row
  },

  buttonHtml(docId) {
    const escA = window.escAttr || (s => String(s == null ? '' : s));
    return `<button class="btn-qris-pay px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50" data-id="${escA(docId)}" title="Bayar via QRIS statis agar dokumen ini bebas watermark">Bayar QRIS</button>`;
  },

  _fmtRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },

  _el(id) { return document.getElementById(id); },

  /** Ask the server for a payment for this document, then show + poll the modal. */
  async open(type, docId, callbacks = {}) {
    const toast = (msg, kind) => {
      if (typeof window.showToast === 'function') window.showToast(msg, kind);
      else if (window.app && window.app.showToast) window.app.showToast(msg, kind);
    };
    let intent;
    try {
      intent = await window.Api.paymentIntent({ type, id: docId });
    } catch (e) { toast(e.message || 'Gagal membuat pembayaran QRIS.', 'error'); return; }

    if (intent && intent.alreadyClean) {
      toast('Dokumen ini sudah bebas watermark tanpa perlu bayar.', 'success');
      if (callbacks.onClean) await callbacks.onClean();
      return;
    }
    const p = intent.payment;
    this._paymentId = p.id;
    this._total = p.totalAmount;

    const img = this._el('qris-image');
    const imgEmpty = this._el('qris-image-empty');
    if (img) {
      if (intent.billing && intent.billing.qrisImage) {
        img.src = intent.billing.qrisImage;
        img.classList.remove('hidden');
        if (imgEmpty) imgEmpty.classList.add('hidden');
      } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        if (imgEmpty) imgEmpty.classList.remove('hidden');
      }
    }
    const amount = this._el('qris-amount');
    if (amount) amount.textContent = this._fmtRp(p.totalAmount);
    const baseInfo = this._el('qris-base-info');
    if (baseInfo) baseInfo.textContent =
      `Tarif ${this._fmtRp(p.baseAmount)} + kode unik ${p.suffix} — bayar PERSIS ${this._fmtRp(p.totalAmount)}.`;
    const note = this._el('qris-note');
    if (note) {
      const txt = (intent.billing && intent.billing.qrisNote) || 'Transfer nominal PERSIS via QRIS statis merchant.';
      note.textContent = txt;
    }
    this._setStatus('Menunggu pembayaran…');
    const modal = this._el('qris-modal');
    if (modal) modal.classList.remove('hidden');

    this._onClean = callbacks.onClean || null;
    this._startPolling();
    toast(`Silakan bayar ${this._fmtRp(p.totalAmount)} via QRIS.`, 'info');
  },

  _setStatus(text, kind) {
    const el = this._el('qris-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'text-xs font-bold ' + (kind === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400');
  },

  _startPolling() {
    this._stopPolling();
    this._timer = setInterval(() => this._checkOnce(), 8000);
  },

  _stopPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  async _checkOnce() {
    if (!this._paymentId) return;
    try {
      const st = await window.Api.paymentStatus({ id: this._paymentId });
      if (st && st.status === 'paid') {
        this._stopPolling();
        this._setStatus('Pembayaran terkonfirmasi ✓', 'paid');
        // Grab the callback BEFORE close() — close() clears this._onClean.
        const onClean = this._onClean;
        setTimeout(() => {
          this.close();
          if (onClean) onClean();
        }, 1200);
      } else if (st && st.status === 'expired') {
        this._stopPolling();
        this._setStatus('Kode nominal kedaluwarsa — buka ulang pembayaran.', 'warn');
      }
    } catch { /* transient network/poll error: keep waiting */ }
  },

  close() {
    this._stopPolling();
    const modal = this._el('qris-modal');
    if (modal) modal.classList.add('hidden');
    this._paymentId = null;
    this._onClean = null;
  },

  copyAmount() {
    const text = String(this._total);
    const done = () => { if (window.app && window.app.showToast) window.app.showToast('Nominal disalin: ' + this._fmtRp(this._total), 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else done();
  }
};

if (typeof window !== 'undefined') {
  window.QrisPay = QrisPay;
  document.addEventListener('DOMContentLoaded', () => {
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
    on('btn-close-qris-modal', 'click', () => QrisPay.close());
    on('qris-copy-btn', 'click', () => QrisPay.copyAmount());
    on('qris-check-btn', 'click', () => QrisPay._checkOnce());
  });
}
