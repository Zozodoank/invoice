/**
 * js/qris-payment.js — shared Dynamic QRIS controller for Faktur, Kwitansi & Surat Jalan.
 *
 * Mirrors Voiceover's Dynamic QRIS flow:
 *  - Server converts the merchant's static QRIS payload into a Dynamic QRIS (tag 01=12, tag 54=locked amount)
 *    with a unique 2-digit (3-digit fallback) verification suffix & 30-minute expiry.
 *  - Renders the QR from the server SVG endpoint (`/api/payments/qr/:id?s=token`) with inline SVG fallback
 *    and static QRS.jpg / admin image fallback when dynamic QRIS is off.
 *  - Supports single-click Rp 1.000 (1 credit) default + multi-credit pack selector (1 / 5 / 10 / 25 credits).
 *  - Highlights unique suffix digits, provides Copy Nominal & Download QRIS (.svg), and polls every 5s.
 */

const QrisPay = {
  _timer: null,
  _cdTimer: null,
  _expiresAt: null,
  _paymentId: null,
  _total: 0,
  _qrUrl: null,
  _type: 'credit',
  _docId: 'credit',
  _credits: 1,
  _callbacks: {},
  _onClean: null,

  isPayable() {
    const u = (typeof window.AuthManager !== 'undefined' && window.AuthManager.getUser)
      ? window.AuthManager.getUser() : null;
    if (!u) return false;
    if (u.isSuperadmin) return false;
    return true;
  },

  buttonHtml(docId) {
    const escA = window.escAttr || (s => String(s == null ? '' : s));
    return `<button class="btn-qris-pay px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50" data-id="${escA(docId)}" title="Bayar via QRIS dinamis">Bayar QRIS</button>`;
  },

  _fmtRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },
  _el(id) { return document.getElementById(id); },

  _toast(msg, kind = 'info') {
    if (typeof window.showToast === 'function') window.showToast(msg, kind);
    else if (window.app && window.app.showToast) window.app.showToast(msg, kind);
    else if (window.kwitansiApp && window.kwitansiApp.showToast) window.kwitansiApp.showToast(msg, kind);
    else if (window.suratJalanApp && window.suratJalanApp.showToast) window.suratJalanApp.showToast(msg, kind);
  },

  /** Highlight the trailing unique verification digits inside #qris-amount & #qris-right-example. */
  _paintHighlightedAmount(totalAmount, suffix, baseAmount) {
    const suffixLen = Math.max(2, String(suffix || '').length);
    const formatted = this._fmtRp(totalAmount);
    const prefix = formatted.slice(0, -suffixLen);
    const tail = formatted.slice(-suffixLen);

    const amountEl = this._el('qris-amount');
    if (amountEl) {
      amountEl.innerHTML = `${prefix}<span class="inline-block bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-lg font-black ring-2 ring-amber-300/80 shadow-sm">${tail}</span>`;
    }
    const rightEl = this._el('qris-right-example');
    if (rightEl) {
      rightEl.innerHTML = `${prefix}<span class="bg-amber-400 text-slate-950 px-1 rounded font-black">${tail}</span>`;
    }
    const wrongEl = this._el('qris-wrong-example');
    if (wrongEl) wrongEl.textContent = this._fmtRp(baseAmount);

    const uniqueBig = this._el('qris-unique-big');
    if (uniqueBig) uniqueBig.textContent = `+${String(suffix || tail)}`;

    const basePriceEl = this._el('qris-base-price');
    if (basePriceEl) {
      basePriceEl.textContent = this._type === 'credit' && this._credits > 1
        ? `${this._fmtRp(baseAmount)} (${this._credits} Kredit)`
        : this._fmtRp(baseAmount);
    }
    const uniqueCodeEl = this._el('qris-unique-code');
    if (uniqueCodeEl) uniqueCodeEl.textContent = `+ ${this._fmtRp(suffix)}`;
  },

  _syncPackButtons(unitPrice) {
    const wrap = this._el('qris-pack-selector');
    if (!wrap) return;
    wrap.classList.toggle('hidden', this._type !== 'credit');
    if (this._type !== 'credit') return;

    const unit = Number(unitPrice) > 0 ? Number(unitPrice) : 1000;
    wrap.querySelectorAll('.qris-pack-btn').forEach(btn => {
      const cnt = parseInt(btn.getAttribute('data-qris-credits') || '1', 10);
      const priceSpan = btn.querySelector('[data-pack-price]');
      if (priceSpan) priceSpan.textContent = this._fmtRp(cnt * unit);
      const active = cnt === this._credits;
      btn.className = 'qris-pack-btn py-1.5 px-2 rounded-xl border text-[11px] font-bold transition ' + (
        active
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
      );
    });
  },

  /** Request payment intent from server & open/update modal. */
  async open(type, docId, callbacks = {}, opts = {}) {
    this._type = type || 'credit';
    this._docId = docId || (this._type === 'credit' ? 'credit' : '');
    this._credits = this._type === 'credit' ? Math.max(1, Math.round(Number(opts.credits) || 1)) : 1;
    this._callbacks = callbacks || {};

    let intent;
    try {
      const payload = { type: this._type, id: this._docId };
      if (this._type === 'credit') payload.credits = this._credits;
      intent = await window.Api.paymentIntent(payload);
    } catch (e) {
      this._toast(e.message || 'Gagal membuat pembayaran QRIS.', 'error');
      return;
    }

    if (intent && intent.alreadyClean) {
      this._toast('Akun Anda bebas biaya cetak/unduh tanpa perlu bayar.', 'success');
      if (this._callbacks.onClean) await this._callbacks.onClean();
      return;
    }

    const p = intent.payment;
    const b = intent.billing || {};
    this._paymentId = p.id;
    this._total = p.totalAmount;
    this._qrUrl = p.qrUrl || b.qrUrl || null;
    if (p.credits) this._credits = p.credits;

    this._syncPackButtons(b.unitPrice);

    const dynImg = this._el('qris-dynamic-img');
    const dynBox = this._el('qris-dynamic');
    const img = this._el('qris-image');
    const imgEmpty = this._el('qris-image-empty');
    const dynBadge = this._el('qris-dynamic-badge');
    const merchantLbl = this._el('qris-merchant-label');
    const dlBtn = this._el('qris-download-btn');
    const rebuildBtn = this._el('qris-rebuild-btn');
    if (rebuildBtn) rebuildBtn.classList.add('hidden');

    [dynImg, dynBox, img, imgEmpty].forEach(el => { if (el) el.classList.add('hidden'); });
    if (dynImg) { dynImg.removeAttribute('src'); dynImg.style.opacity = '1'; }
    if (dynBox) dynBox.innerHTML = '';

    const showStaticFallback = () => {
      const src = b.qrisImage || 'QRS.jpg';
      if (img) {
        img.src = src;
        img.classList.remove('hidden');
        img.onerror = () => {
          img.classList.add('hidden');
          if (imgEmpty) { imgEmpty.textContent = 'Gambar QRIS belum tersedia.'; imgEmpty.classList.remove('hidden'); }
        };
      } else if (imgEmpty) {
        imgEmpty.textContent = 'Gambar QRIS belum tersedia.';
        imgEmpty.classList.remove('hidden');
      }
    };

    // Priority 1: Server-generated SVG QR (/api/payments/qr/:id?s=token) mirroring Voiceover,
    // with automatic inline-SVG fallback if image load fails before falling back to static QRIS.
    let hasDynamic = !!(b.qrisPayload || this._qrUrl);
    if (this._qrUrl && dynImg) {
      dynImg.onerror = () => {
        dynImg.classList.add('hidden');
        if (dynBox && b.qrisPayload && this._renderQr(dynBox, b.qrisPayload)) {
          dynBox.classList.remove('hidden');
        } else {
          hasDynamic = false;
          if (dynBadge) dynBadge.classList.add('hidden');
          if (dlBtn) dlBtn.classList.add('hidden');
          showStaticFallback();
        }
      };
      dynImg.src = this._qrUrl;
      dynImg.classList.remove('hidden');
    } else if (b.qrisPayload && dynBox && this._renderQr(dynBox, b.qrisPayload)) {
      dynBox.classList.remove('hidden');
    } else {
      hasDynamic = false;
      showStaticFallback();
    }

    if (dynBadge) dynBadge.classList.toggle('hidden', !hasDynamic);
    if (merchantLbl) {
      merchantLbl.textContent = b.merchantName
        ? `Nominal terkunci • ${b.merchantName}`
        : 'Nominal terkunci otomatis di QRIS';
    }
    if (dlBtn) dlBtn.classList.toggle('hidden', !hasDynamic);

    this._paintHighlightedAmount(p.totalAmount, p.suffix, p.baseAmount);
    const baseInfo = this._el('qris-base-info');
    if (baseInfo) {
      baseInfo.textContent = `Tarif ${this._fmtRp(p.baseAmount)} + kode unik ${p.suffix} — bayar PERSIS ${this._fmtRp(p.totalAmount)}.`;
    }

    const note = this._el('qris-note');
    if (note) {
      note.textContent = b.qrisNote || (hasDynamic
        ? 'Scan QRIS dengan m-banking atau e-wallet (DANA/GoPay/OVO/ShopeePay/BCA/BRI). Nominal otomatis terkunci persis.'
        : 'Transfer nominal PERSIS hingga 2 digit terakhir via QRIS merchant agar kredit masuk otomatis.');
    }

    this._setStatus('Menunggu pembayaran…');
    const modal = this._el('qris-modal');
    if (modal) modal.classList.remove('hidden');

    this._onClean = this._callbacks.onClean || null;
    this._startCountdown(p.expiresAt);
    this._startPolling();
    this._toast(`Silakan bayar ${this._fmtRp(p.totalAmount)} via QRIS.`, 'info');
  },

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
    el.className = 'text-xs font-bold ' + (
      kind === 'paid'
        ? 'text-emerald-600 dark:text-emerald-400'
        : (kind === 'warn' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')
    );
  },

  _markExpired() {
    this._stopCountdown();
    this._stopPolling();
    const dynImg = this._el('qris-dynamic-img');
    if (dynImg) dynImg.style.opacity = '0.35';
    const rebuildBtn = this._el('qris-rebuild-btn');
    if (rebuildBtn) rebuildBtn.classList.remove('hidden');
    this._setStatus('Kode kedaluwarsa — klik "Buat Ulang" untuk QRIS baru.', 'warn');
  },

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
      this._markExpired();
    };
    tick();
    if (this._expiresAt > Date.now()) this._cdTimer = setInterval(tick, 1000);
  },

  _stopCountdown() {
    if (this._cdTimer) { clearInterval(this._cdTimer); this._cdTimer = null; }
  },

  _startPolling() {
    this._stopPolling();
    this._timer = setInterval(() => this._checkOnce(), 5000);
  },

  _stopPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  async _checkOnce(manual = false) {
    if (!this._paymentId) return;
    try {
      const st = await window.Api.paymentStatus({ id: this._paymentId });
      if (st && st.status === 'paid') {
        this._stopPolling();
        this._stopCountdown();
        const added = Number(st.creditsGranted) || 1;
        this._setStatus(`Pembayaran terkonfirmasi (+${added} Kredit) ✓`, 'paid');
        if (window.AuthManager && window.AuthManager.setCredits) {
          if (typeof st.printCredits === 'number') {
            window.AuthManager.setCredits(st.printCredits);
          } else {
            const cur = window.AuthManager.getCredits ? window.AuthManager.getCredits() : 0;
            window.AuthManager.setCredits(cur + added);
          }
        }
        this._toast(`Pembayaran diterima! +${added} kredit cetak/PDF ditambahkan.`, 'success');
        const onClean = this._onClean;
        setTimeout(() => {
          this.close();
          if (onClean) onClean();
        }, 1200);
      } else if (st && st.status === 'expired') {
        this._markExpired();
      } else if (manual) {
        this._toast('Belum terdeteksi masuk. Pastikan nominal transfer persis sampai digit kode unik.', 'info');
      }
    } catch { /* transient network/poll error: keep waiting */ }
  },

  downloadSvg() {
    const filename = `QRIS-${this._paymentId || 'InvoicePro'}.svg`;
    const trigger = (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      this._toast('Gambar QRIS (.svg) berhasil diunduh.', 'success');
    };
    if (this._qrUrl) {
      fetch(this._qrUrl, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
        .then(trigger)
        .catch(() => this._toast('Gagal mengunduh QRIS.', 'error'));
      return;
    }
    const svgEl = this._el('qris-dynamic')?.querySelector('svg');
    if (svgEl) {
      trigger(new Blob([svgEl.outerHTML], { type: 'image/svg+xml;charset=utf-8' }));
    }
  },

  close() {
    this._stopPolling();
    this._stopCountdown();
    const dynImg = this._el('qris-dynamic-img');
    if (dynImg) dynImg.removeAttribute('src');
    const dynEl = this._el('qris-dynamic');
    if (dynEl) dynEl.innerHTML = '';
    const modal = this._el('qris-modal');
    if (modal) modal.classList.add('hidden');
    this._paymentId = null;
    this._qrUrl = null;
    this._onClean = null;
  },

  copyAmount() {
    const text = String(this._total);
    const done = () => this._toast('Nominal disalin: ' + this._fmtRp(this._total), 'success');
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
    on('qris-check-btn', 'click', () => QrisPay._checkOnce(true));
    on('qris-download-btn', 'click', () => QrisPay.downloadSvg());
    on('qris-rebuild-btn', 'click', () => QrisPay.open(QrisPay._type, QrisPay._docId, QrisPay._callbacks, { credits: QrisPay._credits }));

    document.querySelectorAll('.qris-pack-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cnt = parseInt(btn.getAttribute('data-qris-credits') || '1', 10);
        if (cnt === QrisPay._credits && QrisPay._paymentId) return;
        QrisPay.open('credit', 'credit', QrisPay._callbacks, { credits: cnt });
      });
    });

    on('btn-watermark-pay', 'click', () => QrisPay.open('credit', 'credit', {
      onClean: () => {
        QrisPay._toast('Deposit berhasil! Watermark pada dokumen telah dihilangkan.', 'success');
      }
    }));
    document.querySelectorAll('.btn-buy-credits').forEach(btn => {
      btn.addEventListener('click', () => QrisPay.open('credit', 'credit', {
        onClean: () => {
          QrisPay._toast('Deposit berhasil! Kredit ditambahkan & watermark dihilangkan.', 'success');
        }
      }));
    });
  });
}
