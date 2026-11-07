/**
 * js/qris-payment.js — shared "Bayar QRIS" controller for the three document pages.
 *
 * Server-authoritative by design: the server decides WHICH documents need
 * payment, the effective price (promo vs normal), the unique amount suffix (2 digits,
 * 3 when full) that makes a bank notification identifiable, and the DYNAMIC QRIS payload
 * (amount locked in the QR). This module only renders the answer (QR via QRCode.js),
 * shows a 30-minute countdown and polls payment status while the modal is open.
 * Requires js/api.js (window.Api) and js/auth.js (window.AuthManager) and the
 * modal markup with the ids used below (present in index/kwitansi/surat-jalan).
 */

const QrisPay = {
  _timer: null,
  _cdTimer: null,
  _expiresAt: null,
  _paymentId: null,
  _total: 0,
  _onClean: null,

  /** Should a server-sourced history row show the "Bayar QRIS" button? */
  isPayable(doc) {
    const u = (typeof window.AuthManager !== 'undefined' && window.AuthManager.getUser)
      ? window.AuthManager.getUser() : null;
    if (!u) return false;
    if (u.isSuperadmin) return false;
    return true;
  },

  buttonHtml(docId) {
    const escA = window.escAttr || (s => String(s == null ? '' : s));
    return `<button class="btn-qris-pay px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50" data-id="${escA(docId)}" title="Beli 1 kredit cetak/unduh via QRIS dinamis">Beli Kredit</button>`;
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
      toast('Akun Anda bebas biaya cetak/unduh tanpa perlu bayar.', 'success');
      if (callbacks.onClean) await callbacks.onClean();
      return;
    }
    const p = intent.payment;
    this._paymentId = p.id;
    this._total = p.totalAmount;

    const img = this._el('qris-image');
    const imgEmpty = this._el('qris-image-empty');
    const dyn = this._el('qris-dynamic');
    const showImage = (src) => {
      if (!img) return;
      if (src) {
        img.src = src;
        img.classList.remove('hidden');
        if (imgEmpty) imgEmpty.classList.add('hidden');
      } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        if (imgEmpty) imgEmpty.classList.remove('hidden');
      }
    };
    // Preferred: DYNAMIC QRIS built by the server (amount is locked in tag 54, payer cannot edit it).
    // Fallback: the merchant's static QRIS image (payer must type the exact amount).
    let isDynamic = false;
    if (dyn) {
      dyn.innerHTML = '';
      dyn.classList.add('hidden');
      const payload = intent.billing && intent.billing.qrisPayload;
      if (payload) {
        try {
          isDynamic = this._renderQr(dyn, payload);
        } catch (e) { console.error('Dynamic QRIS render failed, using static image:', e); dyn.innerHTML = ''; }
      }
    }
    if (isDynamic) {
      dyn.classList.remove('hidden');
      if (img) img.classList.add('hidden');
      if (imgEmpty) imgEmpty.classList.add('hidden');
    } else {
      showImage(intent.billing && intent.billing.qrisImage);
    }
    const amount = this._el('qris-amount');
    if (amount) amount.textContent = this._fmtRp(p.totalAmount);
    const baseInfo = this._el('qris-base-info');
    if (baseInfo) baseInfo.textContent =
      `Tarif ${this._fmtRp(p.baseAmount)} + kode unik ${p.suffix} — bayar PERSIS ${this._fmtRp(p.totalAmount)}.`;
    const note = this._el('qris-note');
    if (note) {
      const txt = (intent.billing && intent.billing.qrisNote)
        || (isDynamic ? 'Scan dengan aplikasi bank / e-wallet apa pun. Nominal sudah terkunci di QR.' : 'Transfer nominal PERSIS via QRIS statis merchant.');
      note.textContent = txt;
    }
    this._setStatus('Menunggu pembayaran…');
    const modal = this._el('qris-modal');
    if (modal) modal.classList.remove('hidden');

    this._onClean = callbacks.onClean || null;
    this._startCountdown(p.expiresAt);
    this._startPolling();
    toast(`Silakan bayar ${this._fmtRp(p.totalAmount)} via QRIS.`, 'info');
  },

  /**
   * Draw the QR for a (long, ~260 char) QRIS payload. Prefers qrcode-generator -> inline SVG
   * (EC level M, 4-module quiet zone, scales crisply to any size). Falls back to QRCode.js (canvas).
   * @returns {boolean} true when something was rendered
   */
  _renderQr(container, text) {
    if (typeof window.qrcode === 'function') {
      const qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const margin = 4;
      const total = n + margin * 2;
      let d = '';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) d += 'M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z';
        }
      }
      container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="100%" height="100%" shape-rendering="crispEdges" role="img" aria-label="QRIS">'
        + '<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>'
        + '<path d="' + d + '" fill="#000000"/></svg>';
      return true;
    }
    if (typeof window.QRCode !== 'undefined') {
      new window.QRCode(container, {
        text, width: 200, height: 200,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
      return true;
    }
    return false;
  },

  _setStatus(text, kind) {
    const el = this._el('qris-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'text-xs font-bold ' + (kind === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400');
  },

  /** Show remaining time of the 30-minute code; at 0 stop polling and ask to re-open. */
  _startCountdown(expiresAt) {
    this._stopCountdown();
    const el = this._el('qris-countdown');
    const end = Date.parse(expiresAt || '');
    this._expiresAt = Number.isNaN(end) ? null : end;
    if (!el || !this._expiresAt) { if (el) el.textContent = ''; return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((this._expiresAt - Date.now()) / 1000));
      const mm = String(Math.floor(left / 60)).padStart(2, '0');
      const ss = String(left % 60).padStart(2, '0');
      if (left > 0) { el.textContent = 'Berlaku ' + mm + ':' + ss; return; }
      el.textContent = 'Kedaluwarsa';
      this._stopCountdown();
      this._stopPolling();
      this._setStatus('Kode nominal kedaluwarsa — buka ulang pembayaran.', 'warn');
    };
    tick();
    if (this._expiresAt > Date.now()) this._cdTimer = setInterval(tick, 1000);
  },

  _stopCountdown() {
    if (this._cdTimer) { clearInterval(this._cdTimer); this._cdTimer = null; }
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
        this._stopCountdown();
        this._setStatus('Pembayaran terkonfirmasi ✓', 'paid');
        if (window.AuthManager && window.AuthManager.getCredits && window.AuthManager.setCredits) {
          const cur = window.AuthManager.getCredits();
          window.AuthManager.setCredits(cur + 1);
        }
        // Grab the callback BEFORE close() — close() clears this._onClean.
        const onClean = this._onClean;
        setTimeout(() => {
          this.close();
          if (onClean) onClean();
        }, 1200);
      } else if (st && st.status === 'expired') {
        this._stopPolling();
        this._stopCountdown();
        this._setStatus('Kode nominal kedaluwarsa — buka ulang pembayaran.', 'warn');
      }
    } catch { /* transient network/poll error: keep waiting */ }
  },

  close() {
    this._stopPolling();
    this._stopCountdown();
    const dynEl = this._el('qris-dynamic');
    if (dynEl) dynEl.innerHTML = '';
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
    on('btn-watermark-pay', 'click', () => QrisPay.open('credit', 'credit', {
      onClean: () => {
        if (window.app && window.app.showToast) window.app.showToast('Deposit berhasil! Watermark pada dokumen telah dihilangkan.', 'success');
      }
    }));
    document.querySelectorAll('.btn-buy-credits').forEach(btn => {
      btn.addEventListener('click', () => QrisPay.open('credit', 'credit', {
        onClean: () => {
          if (window.app && window.app.showToast) window.app.showToast('Deposit berhasil! Kredit ditambahkan & watermark dihilangkan.', 'success');
        }
      }));
    });
  });
}
