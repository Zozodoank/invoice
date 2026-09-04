/**
 * Professional Indonesian Kwitansi Templates Renderer
 * Supports:
 * 1. classic - Standar Tradisional Indonesia (Paperline / SIDU Heritage)
 * 2. modern - Modern Corporate (Flat Clean with Accent Header)
 * 3. minimalist - Swiss Minimalist (Monochrome / Elegant)
 * 4. detailed - Kwitansi Rincian / Voucher Kas (Multi-item breakdown)
 */

const KwitansiTemplates = {
  /**
   * Helper to format status badge
   */
  renderStatusBadge(status = 'paid') {
    const statusMap = {
      paid: { text: 'LUNAS', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      dp: { text: 'UANG MUKA (DP)', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
      installment: { text: 'ANGSURAN / CICILAN', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      partial: { text: 'SEBAGIAN (PARTIAL)', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
      deposit: { text: 'TITIPAN (DEPOSIT)', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
      cancelled: { text: 'DIBATALKAN', bg: 'bg-rose-100 text-rose-800 border-rose-300' }
    };

    const config = statusMap[status] || statusMap.paid;
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${config.bg}">${config.text}</span>`;
  },

  /**
   * Helper to render Realistic Digital Stamp (LUNAS / DITERIMA)
   */
  renderStamp(kwitansi) {
    if (!kwitansi.showStamp) return '';
    const text = (kwitansi.stampText || 'LUNAS').toUpperCase();
    const color = kwitansi.stampColor || 'red';
    const colorClass = color === 'blue' ? 'stamp-blue' : (color === 'emerald' ? 'stamp-emerald' : '');
    const dateStr = kwitansi.date || '';

    return `
      <div class="kwitansi-stamp ${colorClass}">
        <span class="text-[9px] tracking-widest leading-none">${kwitansi.senderCity || 'DITERIMA'}</span>
        <span class="text-sm font-black tracking-widest leading-tight my-0.5">${text}</span>
        <span class="text-[8px] font-mono tracking-wider leading-none">${dateStr}</span>
      </div>
    `;
  },

  /**
   * Helper to render Materai Box
   */
  renderMateraiBox(kwitansi) {
    if (!kwitansi.enableMeterai) return '';
    return `
      <div class="kwitansi-materai-box">
        <span class="text-[7px] text-slate-400">TEMPEL DI SINI</span>
        <span class="font-extrabold text-[9px] text-slate-700">METERAI</span>
        <span class="text-[7.5px] font-bold text-slate-600">Rp 10.000</span>
      </div>
    `;
  },

  /**
   * Helper to render Digital Signature block
   */
  renderSignature(kwitansi) {
    if (!kwitansi.showSignature) return '';
    const city = kwitansi.senderCity ? `${kwitansi.senderCity}, ` : '';
    const date = kwitansi.date || '';

    return `
      <div class="flex flex-col items-center justify-end text-center min-w-[170px] relative">
        <p class="text-[11px] text-slate-600 mb-1">${city}${date}</p>
        <p class="text-[10px] font-semibold text-slate-500 mb-1">Penerima / Kasir,</p>
        
        <div class="relative w-full flex items-center justify-center my-1 min-h-[64px]">
          ${kwitansi.enableMeterai ? `
            <div class="absolute -left-6 top-1/2 -translate-y-1/2 z-0 opacity-85">
              ${this.renderMateraiBox(kwitansi)}
            </div>
          ` : ''}

          ${kwitansi.signatureData ? `
            <img src="${kwitansi.signatureData}" alt="Tanda Tangan" class="h-16 max-w-[150px] object-contain relative z-10" />
          ` : `
            <div class="h-14 w-32 border-b border-dashed border-slate-300"></div>
          `}

          ${kwitansi.showStamp ? `
            <div class="absolute -right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
              ${this.renderStamp(kwitansi)}
            </div>
          ` : ''}
        </div>

        <div class="w-full border-b border-slate-800 my-1"></div>
        <p class="font-bold text-xs text-slate-900">${kwitansi.signerName || '(...................................)'}</p>
        ${kwitansi.signerTitle ? `<p class="text-[10px] text-slate-500">${kwitansi.signerTitle}</p>` : ''}
      </div>
    `;
  },

  /**
   * Helper to render QR Code container
   */
  renderQrContainer(kwitansi) {
    if (!kwitansi.showQrCode) return '';
    return `
      <div class="flex flex-col items-center justify-center text-center">
        <div id="kwitansi-qr-code" class="w-16 h-16 bg-white p-1 rounded border border-slate-200 flex items-center justify-center shadow-xs"></div>
        <span class="text-[9px] text-slate-400 mt-1 font-mono">Scan Verifikasi</span>
      </div>
    `;
  },

  /**
   * Helper to render Company Header / Kop Surat
   */
  renderHeader(kwitansi, accentColor = '#2563eb') {
    if (!kwitansi.showCompanyHeader) return '';

    return `
      <div class="flex items-start justify-between border-b-2 border-slate-200 pb-3 mb-3">
        <div class="flex items-center gap-3">
          ${kwitansi.logo ? `
            <img src="${kwitansi.logo}" alt="Logo" class="max-h-12 max-w-[140px] object-contain" />
          ` : `
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-base shadow-sm" style="background-color: ${accentColor}">
              ${(kwitansi.senderName || 'K').charAt(0).toUpperCase()}
            </div>
          `}
          <div>
            <h3 class="font-bold text-sm text-slate-900 leading-tight">${kwitansi.senderName || 'Nama Perusahaan / Usaha'}</h3>
            ${kwitansi.senderAddress ? `<p class="text-[10px] text-slate-500 leading-tight mt-0.5">${kwitansi.senderAddress.replace(/\n/g, ', ')}</p>` : ''}
            <div class="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
              ${kwitansi.senderPhone ? `<span>Telp: ${kwitansi.senderPhone}</span>` : ''}
              ${kwitansi.senderEmail ? `<span>Email: ${kwitansi.senderEmail}</span>` : ''}
            </div>
          </div>
        </div>
        ${kwitansi.showStatus ? `
          <div class="text-right">
            ${this.renderStatusBadge(kwitansi.status)}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Helper to render Terbilang Text
   */
  renderTerbilang(kwitansi, calculatedAmount) {
    if (!kwitansi.showTerbilang) return '';
    const curr = kwitansi.currency || 'IDR';
    const terbilangText = kwitansi.customTerbilang && kwitansi.customTerbilang.trim()
      ? kwitansi.customTerbilang.trim()
      : getSpelledOutAmount(calculatedAmount, curr, 'id');

    return `
      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 my-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Uang Sejumlah:</span>
        <p class="font-heading italic font-bold text-xs sm:text-sm text-slate-800 leading-relaxed">
          ### ${terbilangText} ###
        </p>
      </div>
    `;
  },

  /**
   * Helper to render Payment Method / Bank Details
   */
  renderPaymentMethod(kwitansi) {
    if (!kwitansi.showPaymentMethod) return '';
    const method = kwitansi.paymentMethod || 'Tunai';

    return `
      <div class="text-[11px] text-slate-600 bg-slate-50/70 p-2 rounded border border-slate-200/70">
        <div class="flex items-center gap-1.5 font-semibold text-slate-800">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Metode Pembayaran:</span>
          <span class="px-1.5 py-0.2 bg-white rounded border border-slate-200 text-[10px] font-bold text-blue-600">${method}</span>
        </div>
        ${method === 'Transfer Bank' && (kwitansi.bankName || kwitansi.bankAccount) ? `
          <div class="mt-1 text-[10px] text-slate-600 flex flex-wrap gap-x-3">
            <span><strong>Bank:</strong> ${kwitansi.bankName || '-'}</span>
            <span><strong>No. Rek:</strong> ${kwitansi.bankAccount || '-'}</span>
            <span><strong>a.n:</strong> ${kwitansi.bankHolder || '-'}</span>
          </div>
        ` : ''}
        ${method === 'Cek / Bilyet Giro' && kwitansi.chequeNumber ? `
          <div class="mt-1 text-[10px] text-slate-600">
            <span><strong>No. Cek/BG:</strong> ${kwitansi.chequeNumber}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Helper to render Notes / Perhatian
   */
  renderNotes(kwitansi) {
    if (!kwitansi.showNotes || !kwitansi.notes) return '';
    return `
      <div class="text-[10px] text-slate-500 italic mt-2 border-t border-slate-100 pt-1.5">
        <strong>Catatan:</strong> ${kwitansi.notes}
      </div>
    `;
  },

  /**
   * Watermark support
   */
  renderWatermark(kwitansi) {
    const showWatermark = kwitansi && kwitansi.showWatermark !== undefined
      ? kwitansi.showWatermark
      : (typeof window.AuthManager !== 'undefined' ? window.AuthManager.shouldShowWatermark() : true);

    if (!showWatermark) return '';

    return `
      <div class="invoice-watermark-overlay pointer-events-none select-none absolute inset-0 z-20 overflow-hidden flex items-center justify-center">
        <div class="invoice-watermark-badge text-center" style="transform: rotate(-25deg); border: 4px dashed rgba(225, 29, 72, 0.35); padding: 14px 36px; border-radius: 16px; background-color: rgba(255, 255, 255, 0.25);">
          <div style="font-size: 34px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(225, 29, 72, 0.32); font-family: 'Outfit', sans-serif; line-height: 1;">
            CONTOH KWITANSI
          </div>
          <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(225, 29, 72, 0.32); font-family: 'Inter', sans-serif; margin-top: 3px;">
            DIBUAT DENGAN INVOICEPRO • SAMPLE
          </div>
        </div>
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 1: KLASIK INDONESIA (Paperline / SIDU Heritage)
   * ========================================================== */
  classic(kwitansi, totals) {
    const curr = kwitansi.currency || 'IDR';
    const dec = kwitansi.useDecimals;
    const finalAmount = totals.finalAmount;

    return `
      <div class="kwitansi-classic-border p-4 sm:p-6 bg-white relative text-slate-900 leading-normal font-sans">
        ${this.renderWatermark(kwitansi)}

        <!-- Top Header & No Kwitansi -->
        <div class="flex items-start justify-between border-b-2 border-slate-900 pb-2 mb-3">
          <div>
            ${kwitansi.showCompanyHeader ? `
              <div class="flex items-center gap-2 mb-1">
                ${kwitansi.logo ? `<img src="${kwitansi.logo}" alt="Logo" class="max-h-8 max-w-[100px] object-contain" />` : ''}
                <div>
                  <h4 class="font-extrabold text-xs tracking-tight uppercase">${kwitansi.senderName || 'Nama Usaha'}</h4>
                  ${kwitansi.senderAddress ? `<p class="text-[9px] text-slate-600">${kwitansi.senderAddress.replace(/\n/g, ', ')}</p>` : ''}
                </div>
              </div>
            ` : ''}
            <div class="flex items-center gap-2 mt-1">
              <span class="font-heading font-extrabold text-lg sm:text-xl tracking-wider text-slate-900 uppercase">KWITANSI</span>
              ${kwitansi.showStatus ? this.renderStatusBadge(kwitansi.status) : ''}
            </div>
          </div>

          <div class="text-right">
            <div class="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded border border-slate-300 inline-block">
              <span class="text-slate-500 font-sans mr-1">No:</span> ${kwitansi.number || 'KWT-001'}
            </div>
            ${kwitansi.showRefNumber && kwitansi.referenceNumber ? `
              <div class="text-[10px] text-slate-500 mt-1 font-mono">
                Ref/Inv: ${kwitansi.referenceNumber}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Classic Lined Form Content -->
        <div class="space-y-2 text-xs">
          <!-- Sudah Terima Dari -->
          <div class="flex items-baseline">
            <span class="w-36 shrink-0 font-bold text-slate-700 uppercase tracking-wide text-[11px]">Sudah Terima Dari</span>
            <span class="mr-1">:</span>
            <span class="font-bold text-slate-900 text-sm flex-1 border-b border-dotted border-slate-400 pb-0.5">
              ${kwitansi.clientName || '-'}
            </span>
          </div>

          <!-- Terbilang Otomatis -->
          ${kwitansi.showTerbilang ? `
            <div class="flex items-baseline">
              <span class="w-36 shrink-0 font-bold text-slate-700 uppercase tracking-wide text-[11px]">Banyaknya Uang</span>
              <span class="mr-1">:</span>
              <div class="flex-1 italic font-heading font-bold text-slate-800 text-xs sm:text-[13px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
                ### ${kwitansi.customTerbilang && kwitansi.customTerbilang.trim() ? kwitansi.customTerbilang.trim() : getSpelledOutAmount(finalAmount, curr, 'id')} ###
              </div>
            </div>
          ` : ''}

          <!-- Untuk Pembayaran -->
          <div class="flex items-baseline">
            <span class="w-36 shrink-0 font-bold text-slate-700 uppercase tracking-wide text-[11px]">Untuk Pembayaran</span>
            <span class="mr-1">:</span>
            <span class="flex-1 text-slate-800 leading-relaxed border-b border-dotted border-slate-400 pb-0.5">
              ${kwitansi.paymentFor || '-'}
            </span>
          </div>

          <!-- Multi-item table if enabled -->
          ${kwitansi.enableItems && kwitansi.items && kwitansi.items.length > 0 ? `
            <div class="pt-2">
              <table class="w-full text-left text-[11px] border border-slate-300 rounded overflow-hidden">
                <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th class="p-1.5 w-8 text-center">No</th>
                    <th class="p-1.5">Keterangan / Rincian</th>
                    <th class="p-1.5 text-center w-16">Qty</th>
                    <th class="p-1.5 text-right w-24">Harga</th>
                    <th class="p-1.5 text-right w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  ${kwitansi.items.map((item, idx) => `
                    <tr>
                      <td class="p-1.5 text-center font-mono text-slate-500">${idx + 1}</td>
                      <td class="p-1.5 font-medium text-slate-900">${item.name || '-'}</td>
                      <td class="p-1.5 text-center font-mono">${item.quantity || 1} ${item.unit || ''}</td>
                      <td class="p-1.5 text-right font-mono">${formatNumber(item.price || 0, curr, dec)}</td>
                      <td class="p-1.5 text-right font-mono font-semibold">${formatNumber((item.quantity || 1) * (item.price || 0), curr, dec)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>

        <!-- Middle Summary Bar: Diskon, Pajak, Meterai if enabled -->
        ${(kwitansi.enableDiscount || kwitansi.enableTax || (kwitansi.enableMeterai && kwitansi.addMeteraiFee)) ? `
          <div class="flex justify-end gap-4 text-[10px] text-slate-600 font-mono py-1 border-t border-slate-200 mt-2">
            ${kwitansi.enableDiscount && totals.discountAmount > 0 ? `<span>Diskon: -${formatCurrency(totals.discountAmount, curr, dec)}</span>` : ''}
            ${kwitansi.enableTax && totals.taxAmount > 0 ? `<span>Pajak (${kwitansi.taxRate}%): +${formatCurrency(totals.taxAmount, curr, dec)}</span>` : ''}
            ${kwitansi.enableMeterai && kwitansi.addMeteraiFee ? `<span>Bea Meterai: +${formatCurrency(10000, curr, dec)}</span>` : ''}
          </div>
        ` : ''}

        <!-- Bottom Row: Big Nominal Box on Left, Signature & Method on Right -->
        <div class="flex flex-col sm:flex-row items-end justify-between gap-4 pt-4 mt-2 border-t-2 border-slate-900">
          <div class="space-y-2 w-full sm:w-auto">
            <!-- Classic Jumlah Rp Badge Box -->
            <div class="inline-flex items-center gap-2 p-2 sm:px-4 sm:py-2.5 rounded-lg bg-slate-100 border-2 border-slate-900 shadow-sm">
              <span class="font-heading font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-700">Jumlah</span>
              <span class="font-mono-num font-black text-base sm:text-xl text-slate-950">
                ${formatCurrency(finalAmount, curr, dec)},-
              </span>
            </div>

            <!-- Payment Method Details -->
            ${this.renderPaymentMethod(kwitansi)}

            <!-- QR Code -->
            ${this.renderQrContainer(kwitansi)}
          </div>

          <!-- Right side: Signature & Stamp -->
          <div class="w-full sm:w-auto flex justify-end">
            ${this.renderSignature(kwitansi)}
          </div>
        </div>

        <!-- Notes Footer -->
        ${this.renderNotes(kwitansi)}
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 2: MODERN CORPORATE (Clean, Header Accent, Card Layout)
   * ========================================================== */
  modern(kwitansi, totals) {
    const accent = kwitansi.accentColor || '#2563eb';
    const curr = kwitansi.currency || 'IDR';
    const dec = kwitansi.useDecimals;
    const finalAmount = totals.finalAmount;

    return `
      <div class="p-6 bg-white relative text-slate-800 font-sans rounded-2xl shadow-sm border border-slate-200/80">
        ${this.renderWatermark(kwitansi)}

        <!-- Top Accent Bar -->
        <div class="h-1.5 w-full rounded-full mb-4" style="background-color: ${accent}"></div>

        <!-- Header -->
        <div class="flex items-start justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            ${kwitansi.showCompanyHeader && kwitansi.logo ? `
              <img src="${kwitansi.logo}" alt="Logo" class="max-h-12 max-w-[140px] object-contain" />
            ` : (kwitansi.showCompanyHeader ? `
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm" style="background-color: ${accent}">
                ${(kwitansi.senderName || 'K').charAt(0).toUpperCase()}
              </div>
            ` : '')}
            <div>
              <h2 class="font-heading font-bold text-base text-slate-900 tracking-tight">
                ${kwitansi.showCompanyHeader ? (kwitansi.senderName || 'InvoicePro') : 'BUKTI PENERIMAAN PEMBAYARAN'}
              </h2>
              ${kwitansi.showCompanyHeader && kwitansi.senderAddress ? `
                <p class="text-[10px] text-slate-400 mt-0.5">${kwitansi.senderAddress.replace(/\n/g, ', ')}</p>
              ` : ''}
            </div>
          </div>

          <div class="text-right">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[10px] font-bold text-slate-400 uppercase">NO.</span>
              <span class="font-mono font-bold text-xs text-slate-900">${kwitansi.number || 'KWT-001'}</span>
            </div>
            ${kwitansi.showStatus ? `<div class="mt-1">${this.renderStatusBadge(kwitansi.status)}</div>` : ''}
            ${kwitansi.showRefNumber && kwitansi.referenceNumber ? `
              <p class="text-[10px] text-slate-400 font-mono mt-1">Ref: ${kwitansi.referenceNumber}</p>
            ` : ''}
          </div>
        </div>

        <!-- Main Body Details -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <!-- Pembayar -->
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Telah Diterima Dari</span>
            <p class="font-bold text-sm text-slate-900">${kwitansi.clientName || '-'}</p>
            ${kwitansi.clientPhone || kwitansi.clientAddress ? `
              <p class="text-[10px] text-slate-500 mt-0.5">${[kwitansi.clientPhone, kwitansi.clientAddress].filter(Boolean).join(' • ')}</p>
            ` : ''}
          </div>

          <!-- Nominal Box -->
          <div class="p-3 rounded-xl text-white flex flex-col justify-between" style="background: linear-gradient(135deg, ${accent}, #1e3a8a)">
            <span class="text-[10px] font-bold uppercase tracking-wider text-white/80">Jumlah Diterima</span>
            <p class="font-mono-num font-extrabold text-xl tracking-tight text-white mt-1">
              ${formatCurrency(finalAmount, curr, dec)}
            </p>
            <span class="text-[9px] text-white/70 mt-1">${kwitansi.senderCity || 'Indonesia'}, ${kwitansi.date || ''}</span>
          </div>
        </div>

        <!-- Terbilang Box -->
        ${this.renderTerbilang(kwitansi, finalAmount)}

        <!-- Untuk Pembayaran -->
        <div class="my-3 p-3 rounded-xl border border-slate-200">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Keperluan Pembayaran</span>
          <p class="text-xs font-semibold text-slate-800 leading-relaxed">${kwitansi.paymentFor || '-'}</p>

          <!-- Multi-item table if enabled -->
          ${kwitansi.enableItems && kwitansi.items && kwitansi.items.length > 0 ? `
            <div class="mt-3 pt-2 border-t border-slate-100">
              <table class="w-full text-left text-[11px]">
                <thead class="text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="py-1">Item</th>
                    <th class="py-1 text-center">Qty</th>
                    <th class="py-1 text-right">Harga</th>
                    <th class="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${kwitansi.items.map(item => `
                    <tr>
                      <td class="py-1 font-medium text-slate-800">${item.name}</td>
                      <td class="py-1 text-center font-mono">${item.quantity} ${item.unit || ''}</td>
                      <td class="py-1 text-right font-mono">${formatNumber(item.price, curr, dec)}</td>
                      <td class="py-1 text-right font-mono font-semibold">${formatNumber(item.quantity * item.price, curr, dec)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>

        <!-- Calculations Bar (Discount, Tax, Meterai) -->
        ${(kwitansi.enableDiscount || kwitansi.enableTax || (kwitansi.enableMeterai && kwitansi.addMeteraiFee)) ? `
          <div class="flex justify-end gap-3 text-xs font-mono py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 mb-3">
            ${kwitansi.enableDiscount && totals.discountAmount > 0 ? `<span class="text-emerald-600">Diskon: -${formatCurrency(totals.discountAmount, curr, dec)}</span>` : ''}
            ${kwitansi.enableTax && totals.taxAmount > 0 ? `<span class="text-slate-700">Pajak (${kwitansi.taxRate}%): +${formatCurrency(totals.taxAmount, curr, dec)}</span>` : ''}
            ${kwitansi.enableMeterai && kwitansi.addMeteraiFee ? `<span class="text-indigo-600">Meterai: +${formatCurrency(10000, curr, dec)}</span>` : ''}
          </div>
        ` : ''}

        <!-- Bottom Row -->
        <div class="flex flex-col sm:flex-row items-end justify-between gap-4 pt-3 border-t border-slate-200">
          <div class="space-y-2 w-full sm:w-auto">
            ${this.renderPaymentMethod(kwitansi)}
            ${this.renderQrContainer(kwitansi)}
          </div>
          <div class="w-full sm:w-auto flex justify-end">
            ${this.renderSignature(kwitansi)}
          </div>
        </div>

        ${this.renderNotes(kwitansi)}
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 3: MINIMALIST FORMAL (Monochrome Swiss Style)
   * ========================================================== */
  minimalist(kwitansi, totals) {
    const curr = kwitansi.currency || 'IDR';
    const dec = kwitansi.useDecimals;
    const finalAmount = totals.finalAmount;

    return `
      <div class="p-6 bg-white relative text-zinc-900 font-sans border-2 border-zinc-900">
        ${this.renderWatermark(kwitansi)}

        <!-- Top bar -->
        <div class="flex items-start justify-between pb-3 border-b border-zinc-900">
          <div>
            <span class="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block">OFFICIAL PAYMENT RECEIPT</span>
            <h1 class="font-heading font-black text-2xl tracking-tighter uppercase">KWITANSI</h1>
            ${kwitansi.showCompanyHeader && kwitansi.senderName ? `
              <p class="font-bold text-xs mt-0.5">${kwitansi.senderName}</p>
            ` : ''}
          </div>

          <div class="text-right font-mono">
            <p class="text-xs font-bold">${kwitansi.number || 'KWT-001'}</p>
            <p class="text-[10px] text-zinc-500">${kwitansi.date || ''}</p>
            ${kwitansi.showStatus ? `<div class="mt-1">${this.renderStatusBadge(kwitansi.status)}</div>` : ''}
          </div>
        </div>

        <!-- Grid Fields -->
        <div class="divide-y divide-zinc-200 text-xs my-4">
          <div class="py-2 flex items-baseline">
            <span class="w-32 text-zinc-400 font-mono text-[10px] uppercase">Terima Dari</span>
            <span class="font-bold text-zinc-900 text-sm">${kwitansi.clientName || '-'}</span>
          </div>

          ${kwitansi.showTerbilang ? `
            <div class="py-2 flex items-baseline">
              <span class="w-32 text-zinc-400 font-mono text-[10px] uppercase">Terbilang</span>
              <span class="font-medium italic text-zinc-800">
                # ${kwitansi.customTerbilang && kwitansi.customTerbilang.trim() ? kwitansi.customTerbilang.trim() : getSpelledOutAmount(finalAmount, curr, 'id')} #
              </span>
            </div>
          ` : ''}

          <div class="py-2 flex items-baseline">
            <span class="w-32 text-zinc-400 font-mono text-[10px] uppercase">Keperluan</span>
            <span class="text-zinc-800 leading-relaxed">${kwitansi.paymentFor || '-'}</span>
          </div>

          <div class="py-2 flex items-baseline justify-between bg-zinc-50 px-2 rounded">
            <span class="text-zinc-500 font-mono text-[10px] uppercase font-bold">Total Diterima</span>
            <span class="font-mono font-black text-lg text-zinc-950">${formatCurrency(finalAmount, curr, dec)}</span>
          </div>
        </div>

        <!-- Bottom Row -->
        <div class="flex flex-col sm:flex-row items-end justify-between gap-4 pt-4 border-t border-zinc-900">
          <div class="space-y-2">
            ${this.renderPaymentMethod(kwitansi)}
            ${this.renderQrContainer(kwitansi)}
          </div>
          <div class="flex justify-end">
            ${this.renderSignature(kwitansi)}
          </div>
        </div>

        ${this.renderNotes(kwitansi)}
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 4: DETAILED VOUCHER / KWITANSI RINCIAN KAS
   * ========================================================== */
  detailed(kwitansi, totals) {
    const accent = kwitansi.accentColor || '#059669';
    const curr = kwitansi.currency || 'IDR';
    const dec = kwitansi.useDecimals;
    const finalAmount = totals.finalAmount;

    return `
      <div class="p-6 bg-white relative text-slate-800 font-sans border border-slate-200 rounded-xl shadow-xs">
        ${this.renderWatermark(kwitansi)}

        <!-- Top Header -->
        <div class="flex items-start justify-between border-b-2 pb-3 mb-4" style="border-color: ${accent}">
          <div class="flex items-center gap-3">
            ${kwitansi.showCompanyHeader && kwitansi.logo ? `
              <img src="${kwitansi.logo}" alt="Logo" class="max-h-12 max-w-[140px] object-contain" />
            ` : ''}
            <div>
              <h2 class="font-heading font-black text-base uppercase text-slate-900 tracking-wide">
                BUKTI KAS MASUK / KWITANSI RINCIAN
              </h2>
              ${kwitansi.showCompanyHeader ? `
                <p class="font-bold text-xs text-slate-700">${kwitansi.senderName || 'Nama Perusahaan'}</p>
                <p class="text-[10px] text-slate-400">${kwitansi.senderAddress || ''}</p>
              ` : ''}
            </div>
          </div>

          <div class="text-right">
            <div class="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded border border-slate-200">
              No: ${kwitansi.number || 'BKM-001'}
            </div>
            <p class="text-[10px] text-slate-400 font-mono mt-1">Tgl: ${kwitansi.date || '-'}</p>
            ${kwitansi.showStatus ? `<div class="mt-1">${this.renderStatusBadge(kwitansi.status)}</div>` : ''}
          </div>
        </div>

        <!-- Info Box -->
        <div class="grid grid-cols-2 gap-3 text-xs mb-3 bg-slate-50 p-3 rounded-lg border border-slate-200/70">
          <div>
            <span class="text-[10px] font-bold text-slate-400 uppercase block">Diterima Dari:</span>
            <p class="font-bold text-slate-900">${kwitansi.clientName || '-'}</p>
            ${kwitansi.clientPhone ? `<p class="text-[10px] text-slate-500">${kwitansi.clientPhone}</p>` : ''}
          </div>
          <div>
            <span class="text-[10px] font-bold text-slate-400 uppercase block">Untuk Pembayaran:</span>
            <p class="font-semibold text-slate-800">${kwitansi.paymentFor || '-'}</p>
            ${kwitansi.showRefNumber && kwitansi.referenceNumber ? `
              <p class="text-[10px] text-slate-500 font-mono">No. Rujukan: ${kwitansi.referenceNumber}</p>
            ` : ''}
          </div>
        </div>

        <!-- Terbilang -->
        ${this.renderTerbilang(kwitansi, finalAmount)}

        <!-- Multi-Item Detailed Table -->
        <div class="my-3 overflow-hidden rounded-lg border border-slate-200">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th class="p-2 w-8 text-center">#</th>
                <th class="p-2">Deskripsi Rincian Pembayaran</th>
                <th class="p-2 text-center w-20">Volume</th>
                <th class="p-2 text-right w-28">Tarif Satuan</th>
                <th class="p-2 text-right w-32">Jumlah</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-mono text-[11px]">
              ${kwitansi.enableItems && kwitansi.items && kwitansi.items.length > 0 ? kwitansi.items.map((it, i) => `
                <tr>
                  <td class="p-2 text-center text-slate-400">${i + 1}</td>
                  <td class="p-2 font-sans font-medium text-slate-900">${it.name || '-'}</td>
                  <td class="p-2 text-center">${it.quantity || 1} ${it.unit || ''}</td>
                  <td class="p-2 text-right">${formatNumber(it.price || 0, curr, dec)}</td>
                  <td class="p-2 text-right font-bold">${formatNumber((it.quantity || 1) * (it.price || 0), curr, dec)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td class="p-2 text-center text-slate-400">1</td>
                  <td class="p-2 font-sans font-medium text-slate-900">${kwitansi.paymentFor || 'Pembayaran Sesuai Kesepakatan'}</td>
                  <td class="p-2 text-center">1 Paket</td>
                  <td class="p-2 text-right">${formatNumber(kwitansi.amount || 0, curr, dec)}</td>
                  <td class="p-2 text-right font-bold">${formatNumber(kwitansi.amount || 0, curr, dec)}</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Calculations Table Breakdown -->
        <div class="flex justify-end text-xs font-mono mb-4">
          <div class="w-64 space-y-1">
            <div class="flex justify-between text-slate-500">
              <span class="font-sans">Subtotal:</span>
              <span>${formatCurrency(totals.subtotal, curr, dec)}</span>
            </div>
            ${kwitansi.enableDiscount && totals.discountAmount > 0 ? `
              <div class="flex justify-between text-emerald-600">
                <span class="font-sans">Potongan (${kwitansi.discountType === 'percent' ? kwitansi.discountValue + '%' : 'Nominal'}):</span>
                <span>-${formatCurrency(totals.discountAmount, curr, dec)}</span>
              </div>
            ` : ''}
            ${kwitansi.enableTax && totals.taxAmount > 0 ? `
              <div class="flex justify-between text-slate-600">
                <span class="font-sans">Pajak (${kwitansi.taxRate}%):</span>
                <span>+${formatCurrency(totals.taxAmount, curr, dec)}</span>
              </div>
            ` : ''}
            ${kwitansi.enableMeterai && kwitansi.addMeteraiFee ? `
              <div class="flex justify-between text-slate-600">
                <span class="font-sans">Bea Meterai:</span>
                <span>+${formatCurrency(10000, curr, dec)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t-2 border-slate-900">
              <span class="font-sans">Total Diterima:</span>
              <span>${formatCurrency(finalAmount, curr, dec)}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex flex-col sm:flex-row items-end justify-between gap-4 pt-3 border-t border-slate-200">
          <div class="space-y-2">
            ${this.renderPaymentMethod(kwitansi)}
            ${this.renderQrContainer(kwitansi)}
          </div>
          <div class="flex justify-end">
            ${this.renderSignature(kwitansi)}
          </div>
        </div>

        ${this.renderNotes(kwitansi)}
      </div>
    `;
  }
};

// Expose globally
window.KwitansiTemplates = KwitansiTemplates;
