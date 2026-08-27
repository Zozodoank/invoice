/**
 * Professional Invoice Templates Renderer
 */

const InvoiceTemplates = {
  /**
   * Helper to format status badge
   */
  renderStatusBadge(status, lang = 'id') {
    const statusMap = {
      paid: { id: 'LUNAS', en: 'PAID', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      pending: { id: 'MENUNGGU PEMBAYARAN', en: 'PENDING', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
      overdue: { id: 'JATUH TEMPO', en: 'OVERDUE', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
      draft: { id: 'DRAFT', en: 'DRAFT', bg: 'bg-slate-100 text-slate-700 border-slate-300' },
      cancelled: { id: 'DIBATALKAN', en: 'CANCELLED', bg: 'bg-gray-200 text-gray-700 border-gray-400' }
    };
    
    const config = statusMap[status] || statusMap.pending;
    const label = lang === 'id' ? config.id : config.en;
    
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${config.bg}">${label}</span>`;
  },

  /**
   * Helper to render Bank Accounts list
   */
  renderBankAccounts(bankAccounts = []) {
    if (!bankAccounts || bankAccounts.length === 0) return '';
    
    return `
      <div class="space-y-1 text-xs">
        <p class="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">Metode Pembayaran / Transfer:</p>
        ${bankAccounts.map(bank => `
          <div class="p-2 rounded bg-slate-50 border border-slate-200/70">
            <div class="font-bold text-slate-800">${bank.bankName || 'Bank'}</div>
            <div class="font-mono-num font-semibold text-slate-700">${bank.accountNumber || '-'}</div>
            <div class="text-slate-500 text-[11px]">a.n. ${bank.accountHolder || '-'}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * Helper to render Digital Signature
   */
  renderSignature(invoice) {
    if (!invoice.signatureData && !invoice.signerName) return '';
    return `
      <div class="flex flex-col items-center justify-end text-center min-w-[140px]">
        <p class="text-xs text-slate-500 mb-1">Hormat Kami,</p>
        ${invoice.signatureData ? `
          <img src="${invoice.signatureData}" alt="Tanda Tangan" class="h-16 max-w-[160px] object-contain my-1" />
        ` : `<div class="h-14"></div>`}
        <div class="w-full border-b border-slate-300 my-1"></div>
        <p class="font-bold text-xs text-slate-800">${invoice.signerName || ''}</p>
        ${invoice.signerTitle ? `<p class="text-[11px] text-slate-500">${invoice.signerTitle}</p>` : ''}
      </div>
    `;
  },

  /**
   * Helper to render QR Code container
   */
  renderQrContainer() {
    return `<div id="invoice-qr-code" class="w-20 h-20 bg-white p-1 rounded border border-slate-200 flex items-center justify-center"></div>`;
  },

  /**
   * TEMPLATE 1: Modern Slate (Default Clean & Bold)
   */
  modern(invoice, totals) {
    const accent = invoice.accentColor || '#2563eb';
    const lang = invoice.language || 'id';
    const curr = invoice.currency || 'IDR';
    const dec = invoice.useDecimals;
    
    return `
      <div class="p-8 sm:p-12 text-slate-800 bg-white flex flex-col justify-between min-h-[297mm]">
        <div>
          <!-- Header Area -->
          <div class="flex justify-between items-start pb-6 border-b border-slate-200">
            <div class="flex items-start gap-4">
              ${invoice.logoUrl ? `
                <img src="${invoice.logoUrl}" alt="Logo" class="h-16 max-w-[180px] object-contain rounded" />
              ` : `
                <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-sm" style="background-color: ${accent}">
                  ${(invoice.senderName || 'INV').substring(0, 2).toUpperCase()}
                </div>
              `}
              <div>
                <h1 class="text-xl font-bold text-slate-900">${invoice.senderName || 'Nama Perusahaan Anda'}</h1>
                <p class="text-xs text-slate-500 mt-0.5 whitespace-pre-line">${invoice.senderAddress || 'Alamat Perusahaan'}</p>
                <div class="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-1">
                  ${invoice.senderEmail ? `<span>✉ ${invoice.senderEmail}</span>` : ''}
                  ${invoice.senderPhone ? `<span>📞 ${invoice.senderPhone}</span>` : ''}
                  ${invoice.senderTaxId ? `<span>NPWP: ${invoice.senderTaxId}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="text-right">
              <h2 class="text-3xl font-extrabold tracking-tight" style="color: ${accent}">
                ${invoice.title || 'INVOICE'}
              </h2>
              <div class="mt-2 text-xs text-slate-500 space-y-0.5 font-mono-num">
                <div><span class="font-semibold text-slate-700">No:</span> <span class="font-bold text-slate-900">${invoice.number || 'INV-001'}</span></div>
                ${invoice.referenceNumber ? `<div><span>Ref/PO:</span> ${invoice.referenceNumber}</div>` : ''}
                <div><span>Tanggal:</span> ${invoice.date || '-'}</div>
                ${invoice.showDueDate !== false && invoice.dueDate ? `<div><span>Jatuh Tempo:</span> <span class="font-semibold text-slate-800">${invoice.dueDate}</span></div>` : ''}
              </div>
              ${invoice.showStatus !== false ? `
                <div class="mt-3">
                  ${this.renderStatusBadge(invoice.status, lang)}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Bill To & Payment Info Header -->
          <div class="grid grid-cols-2 gap-8 my-6">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tagihan Kepada:</span>
              <h3 class="text-sm font-bold text-slate-900">${invoice.clientName || 'Nama Klien / Perusahaan'}</h3>
              <p class="text-xs text-slate-600 mt-1 whitespace-pre-line">${invoice.clientAddress || 'Alamat Klien'}</p>
              <div class="text-xs text-slate-500 mt-2 space-y-0.5">
                ${invoice.clientEmail ? `<div>✉ ${invoice.clientEmail}</div>` : ''}
                ${invoice.clientPhone ? `<div>📞 ${invoice.clientPhone}</div>` : ''}
                ${invoice.clientTaxId ? `<div>NPWP: ${invoice.clientTaxId}</div>` : ''}
              </div>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Ringkasan Tagihan:</span>
                <div class="flex justify-between items-center text-xs py-1 border-b border-slate-200">
                  <span class="text-slate-600">Total Tagihan:</span>
                  <span class="font-mono-num font-bold text-slate-900">${formatCurrency(totals.grandTotal, curr, dec)}</span>
                </div>
                <div class="flex justify-between items-center text-xs py-1">
                  <span class="text-slate-600">Sisa Pembayaran:</span>
                  <span class="font-mono-num font-bold text-base" style="color: ${accent}">${formatCurrency(totals.balanceDue, curr, dec)}</span>
                </div>
              </div>
              ${invoice.showPaymentTerms !== false && invoice.paymentTerms ? `<div class="text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-200">Syarat: <span class="font-medium text-slate-700">${invoice.paymentTerms}</span></div>` : ''}
            </div>
          </div>

          <!-- Items Table -->
          <div class="overflow-hidden rounded-xl border border-slate-200 my-6">
            <table class="w-full text-left text-xs">
              <thead class="text-white font-semibold" style="background-color: ${accent}">
                <tr>
                  <th class="py-3 px-4 w-10 text-center">#</th>
                  <th class="py-3 px-4">Deskripsi Item / Layanan</th>
                  <th class="py-3 px-4 text-center w-16">Qty</th>
                  <th class="py-3 px-4 text-right w-28">Harga Satuan</th>
                  <th class="py-3 px-4 text-right w-24">Diskon</th>
                  <th class="py-3 px-4 text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-mono-num">
                ${(invoice.items || []).map((item, idx) => {
                  const lineTotal = calculateItemTotal(item);
                  return `
                    <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}">
                      <td class="py-3 px-4 text-center text-slate-400 font-sans">${idx + 1}</td>
                      <td class="py-3 px-4 font-sans">
                        <div class="font-semibold text-slate-900">${item.name || 'Nama Item'}</div>
                        ${item.description ? `<div class="text-[11px] text-slate-500 mt-0.5">${item.description}</div>` : ''}
                      </td>
                      <td class="py-3 px-4 text-center text-slate-700">${item.quantity || 1} <span class="text-[10px] text-slate-400 font-sans">${item.unit || ''}</span></td>
                      <td class="py-3 px-4 text-right text-slate-700">${formatCurrency(item.price, curr, dec)}</td>
                      <td class="py-3 px-4 text-right text-slate-500">
                        ${Number(item.discountValue) > 0 ? (item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, curr, dec)) : '-'}
                      </td>
                      <td class="py-3 px-4 text-right font-bold text-slate-900">${formatCurrency(lineTotal, curr, dec)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Totals Breakdown & Terbilang -->
          <div class="grid grid-cols-12 gap-6 my-6">
            <div class="col-span-7 space-y-4">
              <!-- Terbilang Box -->
              <div class="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Terbilang:</span>
                <p class="text-xs font-semibold text-slate-800 italic">
                  # ${getSpelledOutAmount(totals.balanceDue, curr, lang)} #
                </p>
              </div>

              <!-- Payment Details -->
              ${this.renderBankAccounts(invoice.bankAccounts)}

              <!-- Notes -->
              ${invoice.notes ? `
                <div class="text-xs text-slate-600">
                  <span class="font-bold text-slate-700 block mb-0.5">Catatan:</span>
                  <p class="whitespace-pre-line text-[11px] text-slate-500">${invoice.notes}</p>
                </div>
              ` : ''}
            </div>

            <div class="col-span-5">
              <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono-num text-xs space-y-2">
                <div class="flex justify-between text-slate-600">
                  <span class="font-sans">Subtotal</span>
                  <span>${formatCurrency(totals.subtotal, curr, dec)}</span>
                </div>
                ${totals.globalDiscount > 0 ? `
                  <div class="flex justify-between text-emerald-600">
                    <span class="font-sans">Diskon ${invoice.discountType === 'percent' ? `(${invoice.discountValue}%)` : ''}</span>
                    <span>-${formatCurrency(totals.globalDiscount, curr, dec)}</span>
                  </div>
                ` : ''}
                ${totals.taxAmount > 0 ? `
                  <div class="flex justify-between text-slate-600">
                    <span class="font-sans">PPN / Pajak (${totals.taxRate}%)</span>
                    <span>+${formatCurrency(totals.taxAmount, curr, dec)}</span>
                  </div>
                ` : ''}
                ${totals.shippingFee > 0 ? `
                  <div class="flex justify-between text-slate-600">
                    <span class="font-sans">Biaya Kirim / Lainnya</span>
                    <span>+${formatCurrency(totals.shippingFee, curr, dec)}</span>
                  </div>
                ` : ''}
                
                <div class="border-t border-slate-300 pt-2 flex justify-between font-bold text-sm text-slate-900">
                  <span class="font-sans">Grand Total</span>
                  <span>${formatCurrency(totals.grandTotal, curr, dec)}</span>
                </div>

                ${totals.downPayment > 0 ? `
                  <div class="flex justify-between text-emerald-700">
                    <span class="font-sans">Uang Muka (DP) / Dibayar</span>
                    <span>-${formatCurrency(totals.downPayment, curr, dec)}</span>
                  </div>
                  <div class="border-t border-slate-300 pt-2 flex justify-between font-bold text-base" style="color: ${accent}">
                    <span class="font-sans">Sisa Tagihan</span>
                    <span>${formatCurrency(totals.balanceDue, curr, dec)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer / Signature / QR Area -->
        <div class="pt-6 border-t border-slate-200 mt-auto">
          <div class="flex justify-between items-end">
            <div>
              ${invoice.showQrCode ? this.renderQrContainer() : ''}
              ${invoice.terms ? `
                <div class="text-[10px] text-slate-400 mt-2 max-w-sm">
                  <span class="font-semibold text-slate-500">Syarat & Ketentuan:</span>
                  <p class="whitespace-pre-line">${invoice.terms}</p>
                </div>
              ` : ''}
            </div>
            <div>
              ${this.renderSignature(invoice)}
            </div>
          </div>
          <div class="text-center text-[10px] text-slate-400 mt-6 pt-2 border-t border-slate-100">
            Terima kasih atas kerja sama dan kepercayaan Anda!
          </div>
        </div>
      </div>
    `;
  },

  /**
   * TEMPLATE 2: Minimalist Swiss (Monochrome & Elegant)
   */
  minimalist(invoice, totals) {
    const lang = invoice.language || 'id';
    const curr = invoice.currency || 'IDR';
    const dec = invoice.useDecimals;
    
    return `
      <div class="p-8 sm:p-12 text-zinc-900 bg-white flex flex-col justify-between min-h-[297mm]">
        <div>
          <!-- Minimalist Header -->
          <div class="flex justify-between items-start pb-8 border-b-2 border-zinc-900">
            <div>
              <h1 class="text-3xl font-black tracking-tight uppercase">${invoice.title || 'INVOICE'}</h1>
              <p class="text-xs font-mono tracking-widest text-zinc-500 mt-1 uppercase">NO: ${invoice.number || 'INV-001'}</p>
            </div>
            <div class="text-right">
              ${invoice.logoUrl ? `
                <img src="${invoice.logoUrl}" alt="Logo" class="h-14 max-w-[160px] object-contain ml-auto" />
              ` : `
                <span class="text-lg font-bold uppercase tracking-wider">${invoice.senderName || 'COMPANY NAME'}</span>
              `}
              ${invoice.showStatus !== false ? `
                <div class="mt-2">
                  ${this.renderStatusBadge(invoice.status, lang)}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Metadata 4-Column Bar -->
          <div class="grid grid-cols-4 gap-4 py-6 border-b border-zinc-200 text-xs">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Dari</p>
              <p class="font-bold text-zinc-900 mt-1">${invoice.senderName || 'Pengirim'}</p>
              <p class="text-zinc-500 text-[11px] whitespace-pre-line">${invoice.senderAddress || ''}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Kepada</p>
              <p class="font-bold text-zinc-900 mt-1">${invoice.clientName || 'Klien'}</p>
              <p class="text-zinc-500 text-[11px] whitespace-pre-line">${invoice.clientAddress || ''}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tanggal Faktur</p>
              <p class="font-mono text-zinc-800 mt-1">${invoice.date || '-'}</p>
              ${invoice.referenceNumber ? `<p class="text-[10px] text-zinc-400 mt-1">PO: ${invoice.referenceNumber}</p>` : ''}
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">${invoice.showDueDate !== false ? 'Jatuh Tempo' : (invoice.showPaymentTerms !== false && invoice.paymentTerms ? 'Syarat Pembayaran' : 'Jatuh Tempo')}</p>
              <p class="font-mono font-bold text-zinc-900 mt-1">${invoice.showDueDate !== false ? (invoice.dueDate || '-') : (invoice.showPaymentTerms !== false && invoice.paymentTerms ? invoice.paymentTerms : '-')}</p>
              ${invoice.showDueDate !== false && invoice.showPaymentTerms !== false && invoice.paymentTerms ? `<p class="text-[10px] text-zinc-500 mt-1">${invoice.paymentTerms}</p>` : ''}
            </div>
          </div>

          <!-- Table -->
          <div class="my-8">
            <table class="w-full text-left text-xs">
              <thead class="border-b-2 border-zinc-900 text-[11px] uppercase tracking-wider text-zinc-900 font-bold">
                <tr>
                  <th class="py-2.5 px-2">Item</th>
                  <th class="py-2.5 px-2 text-center w-16">Qty</th>
                  <th class="py-2.5 px-2 text-right w-28">Harga</th>
                  <th class="py-2.5 px-2 text-right w-20">Diskon</th>
                  <th class="py-2.5 px-2 text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 font-mono text-xs">
                ${(invoice.items || []).map(item => `
                  <tr>
                    <td class="py-3 px-2 font-sans">
                      <div class="font-bold text-zinc-900">${item.name || 'Item'}</div>
                      ${item.description ? `<div class="text-[11px] text-zinc-500 mt-0.5">${item.description}</div>` : ''}
                    </td>
                    <td class="py-3 px-2 text-center text-zinc-700">${item.quantity || 1} ${item.unit || ''}</td>
                    <td class="py-3 px-2 text-right text-zinc-700">${formatCurrency(item.price, curr, dec)}</td>
                    <td class="py-3 px-2 text-right text-zinc-500">
                      ${Number(item.discountValue) > 0 ? (item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, curr, dec)) : '-'}
                    </td>
                    <td class="py-3 px-2 text-right font-bold text-zinc-900">${formatCurrency(calculateItemTotal(item), curr, dec)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Summary & Totals -->
          <div class="flex justify-between items-start my-6 pt-4 border-t-2 border-zinc-900">
            <div class="w-1/2 space-y-4 pr-6">
              <div class="text-xs">
                <span class="font-bold uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">Terbilang</span>
                <p class="italic text-zinc-700">"${getSpelledOutAmount(totals.balanceDue, curr, lang)}"</p>
              </div>
              ${this.renderBankAccounts(invoice.bankAccounts)}
            </div>

            <div class="w-5/12 font-mono text-xs space-y-2">
              <div class="flex justify-between text-zinc-600">
                <span class="font-sans">Subtotal</span>
                <span>${formatCurrency(totals.subtotal, curr, dec)}</span>
              </div>
              ${totals.globalDiscount > 0 ? `
                <div class="flex justify-between text-zinc-600">
                  <span class="font-sans">Diskon</span>
                  <span>-${formatCurrency(totals.globalDiscount, curr, dec)}</span>
                </div>
              ` : ''}
              ${totals.taxAmount > 0 ? `
                <div class="flex justify-between text-zinc-600">
                  <span class="font-sans">Pajak (${totals.taxRate}%)</span>
                  <span>+${formatCurrency(totals.taxAmount, curr, dec)}</span>
                </div>
              ` : ''}
              ${totals.shippingFee > 0 ? `
                <div class="flex justify-between text-zinc-600">
                  <span class="font-sans">Ongkir/Biaya</span>
                  <span>+${formatCurrency(totals.shippingFee, curr, dec)}</span>
                </div>
              ` : ''}
              <div class="border-t-2 border-zinc-900 pt-2 flex justify-between font-bold text-base text-zinc-900">
                <span class="font-sans uppercase">Total</span>
                <span>${formatCurrency(totals.grandTotal, curr, dec)}</span>
              </div>
              ${totals.downPayment > 0 ? `
                <div class="flex justify-between text-zinc-600">
                  <span class="font-sans">DP/Terbayar</span>
                  <span>-${formatCurrency(totals.downPayment, curr, dec)}</span>
                </div>
                <div class="border-t border-zinc-300 pt-1 flex justify-between font-bold text-sm text-zinc-900">
                  <span class="font-sans uppercase">Sisa Tagihan</span>
                  <span>${formatCurrency(totals.balanceDue, curr, dec)}</span>
                </div>
              ` : ''}
            </div>
          </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-8 mt-auto flex justify-between items-end border-t border-zinc-200">
          <div>
            ${invoice.showQrCode ? this.renderQrContainer() : ''}
            ${invoice.notes ? `<p class="text-[11px] text-zinc-500 mt-2 max-w-sm whitespace-pre-line">${invoice.notes}</p>` : ''}
          </div>
          <div>
            ${this.renderSignature(invoice)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * TEMPLATE 3: Corporate Executive (Navy Header & Formal Structure)
   */
  classic(invoice, totals) {
    const accent = invoice.accentColor || '#1e3a8a';
    const lang = invoice.language || 'id';
    const curr = invoice.currency || 'IDR';
    const dec = invoice.useDecimals;
    
    return `
      <div class="text-slate-800 bg-white flex flex-col justify-between min-h-[297mm]">
        <div>
          <!-- Executive Top Header Banner -->
          <div class="p-8 sm:px-12 text-white flex justify-between items-center" style="background-color: ${accent}">
            <div>
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-wide uppercase">${invoice.title || 'FAKTUR PENJUALAN'}</h1>
              <p class="text-xs text-white/80 font-mono mt-1"># ${invoice.number || 'INV-001'}</p>
            </div>
            <div class="text-right">
              ${invoice.logoUrl ? `
                <img src="${invoice.logoUrl}" alt="Logo" class="h-14 max-w-[160px] object-contain rounded bg-white/10 p-1" />
              ` : `
                <h2 class="text-xl font-bold tracking-tight">${invoice.senderName || 'PERUSAHAAN'}</h2>
              `}
              ${invoice.showStatus !== false ? `
                <div class="mt-2">
                  ${this.renderStatusBadge(invoice.status, lang)}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="p-8 sm:p-12 pb-0">
            <!-- 2-Column Info Block -->
            <div class="grid grid-cols-2 gap-8 pb-6 border-b border-slate-200 text-xs">
              <div>
                <span class="font-bold uppercase tracking-wider text-[11px] text-slate-400 block mb-1">DITERBITKAN OLEH:</span>
                <p class="font-bold text-sm text-slate-900">${invoice.senderName || 'Nama Perusahaan'}</p>
                <p class="text-slate-600 mt-1 whitespace-pre-line">${invoice.senderAddress || ''}</p>
                <div class="mt-2 text-slate-500 space-y-0.5">
                  ${invoice.senderEmail ? `<div>Email: ${invoice.senderEmail}</div>` : ''}
                  ${invoice.senderPhone ? `<div>Telp: ${invoice.senderPhone}</div>` : ''}
                  ${invoice.senderTaxId ? `<div>NPWP: ${invoice.senderTaxId}</div>` : ''}
                </div>
              </div>

              <div>
                <span class="font-bold uppercase tracking-wider text-[11px] text-slate-400 block mb-1">TAGIHAN KEPADA:</span>
                <p class="font-bold text-sm text-slate-900">${invoice.clientName || 'Nama Klien'}</p>
                <p class="text-slate-600 mt-1 whitespace-pre-line">${invoice.clientAddress || ''}</p>
                <div class="mt-2 text-slate-500 space-y-0.5">
                  ${invoice.clientEmail ? `<div>Email: ${invoice.clientEmail}</div>` : ''}
                  ${invoice.clientPhone ? `<div>Telp: ${invoice.clientPhone}</div>` : ''}
                  ${invoice.clientTaxId ? `<div>NPWP: ${invoice.clientTaxId}</div>` : ''}
                </div>
              </div>
            </div>

            <!-- Date & Terms Bar -->
            <div class="grid ${(invoice.showDueDate !== false && invoice.showPaymentTerms !== false && invoice.paymentTerms) ? 'grid-cols-3' : (invoice.showDueDate !== false || (invoice.showPaymentTerms !== false && invoice.paymentTerms) ? 'grid-cols-2' : 'grid-cols-1')} gap-4 py-3 bg-slate-50 px-4 rounded-lg my-6 text-xs font-mono border border-slate-200">
              <div><span class="text-slate-500 font-sans">Tgl Faktur:</span> <span class="font-bold text-slate-800">${invoice.date || '-'}</span></div>
              ${invoice.showDueDate !== false ? `<div><span class="text-slate-500 font-sans">Jatuh Tempo:</span> <span class="font-bold text-slate-800">${invoice.dueDate || '-'}</span></div>` : ''}
              ${invoice.showPaymentTerms !== false && invoice.paymentTerms ? `<div><span class="text-slate-500 font-sans">Syarat:</span> <span class="font-bold text-slate-800">${invoice.paymentTerms}</span></div>` : ''}
            </div>

            <!-- Items Table -->
            <table class="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden my-6">
              <thead class="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th class="py-3 px-3 w-8 text-center">No</th>
                  <th class="py-3 px-3">Rincian Barang / Jasa</th>
                  <th class="py-3 px-3 text-center w-16">Kuantitas</th>
                  <th class="py-3 px-3 text-right w-28">Harga</th>
                  <th class="py-3 px-3 text-right w-20">Diskon</th>
                  <th class="py-3 px-3 text-right w-32">Jumlah</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-mono-num">
                ${(invoice.items || []).map((item, idx) => `
                  <tr>
                    <td class="py-3 px-3 text-center text-slate-400 font-sans">${idx + 1}</td>
                    <td class="py-3 px-3 font-sans">
                      <div class="font-bold text-slate-900">${item.name || 'Item'}</div>
                      ${item.description ? `<div class="text-[11px] text-slate-500">${item.description}</div>` : ''}
                    </td>
                    <td class="py-3 px-3 text-center text-slate-700">${item.quantity || 1} ${item.unit || ''}</td>
                    <td class="py-3 px-3 text-right text-slate-700">${formatCurrency(item.price, curr, dec)}</td>
                    <td class="py-3 px-3 text-right text-slate-500">
                      ${Number(item.discountValue) > 0 ? (item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, curr, dec)) : '-'}
                    </td>
                    <td class="py-3 px-3 text-right font-bold text-slate-900">${formatCurrency(calculateItemTotal(item), curr, dec)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Summary Breakdown -->
            <div class="grid grid-cols-12 gap-6 my-6">
              <div class="col-span-7 space-y-4">
                <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                  <span class="font-bold text-slate-500 block text-[10px] uppercase">Terbilang:</span>
                  <p class="font-semibold text-slate-800 italic"># ${getSpelledOutAmount(totals.balanceDue, curr, lang)} #</p>
                </div>
                ${this.renderBankAccounts(invoice.bankAccounts)}
              </div>

              <div class="col-span-5 font-mono-num text-xs space-y-2">
                <div class="flex justify-between text-slate-600">
                  <span class="font-sans">Subtotal</span>
                  <span>${formatCurrency(totals.subtotal, curr, dec)}</span>
                </div>
                ${totals.globalDiscount > 0 ? `
                  <div class="flex justify-between text-emerald-600">
                    <span class="font-sans">Diskon</span>
                    <span>-${formatCurrency(totals.globalDiscount, curr, dec)}</span>
                  </div>
                ` : ''}
                ${totals.taxAmount > 0 ? `
                  <div class="flex justify-between text-slate-600">
                    <span class="font-sans">PPN (${totals.taxRate}%)</span>
                    <span>+${formatCurrency(totals.taxAmount, curr, dec)}</span>
                  </div>
                ` : ''}
                ${totals.shippingFee > 0 ? `
                  <div class="flex justify-between text-slate-600">
                    <span class="font-sans">Ongkos Kirim</span>
                    <span>+${formatCurrency(totals.shippingFee, curr, dec)}</span>
                  </div>
                ` : ''}
                <div class="border-t-2 border-slate-800 pt-2 flex justify-between font-bold text-sm text-slate-900">
                  <span class="font-sans">Total Tagihan</span>
                  <span>${formatCurrency(totals.grandTotal, curr, dec)}</span>
                </div>
                ${totals.downPayment > 0 ? `
                  <div class="flex justify-between text-emerald-700">
                    <span class="font-sans">Uang Muka (DP)</span>
                    <span>-${formatCurrency(totals.downPayment, curr, dec)}</span>
                  </div>
                  <div class="border-t border-slate-300 pt-1 flex justify-between font-bold text-base text-blue-900">
                    <span class="font-sans">Sisa Pembayaran</span>
                    <span>${formatCurrency(totals.balanceDue, curr, dec)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Corporate Footer -->
        <div class="p-8 sm:p-12 pt-4 border-t border-slate-200 mt-auto flex justify-between items-end">
          <div>
            ${invoice.showQrCode ? this.renderQrContainer() : ''}
            ${invoice.notes ? `<p class="text-[11px] text-slate-500 mt-2 max-w-sm">${invoice.notes}</p>` : ''}
          </div>
          <div>
            ${this.renderSignature(invoice)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * TEMPLATE 4: Creative / Bold (Modern Gradient & Rounded Cards)
   */
  creative(invoice, totals) {
    const accent = invoice.accentColor || '#7c3aed';
    const lang = invoice.language || 'id';
    const curr = invoice.currency || 'IDR';
    const dec = invoice.useDecimals;
    
    return `
      <div class="p-8 sm:p-12 text-slate-800 bg-white flex flex-col justify-between min-h-[297mm]">
        <div>
          <!-- Creative Header -->
          <div class="relative p-6 rounded-2xl text-white overflow-hidden shadow-sm" style="background: linear-gradient(135deg, ${accent}, #3b82f6)">
            <div class="flex justify-between items-start relative z-10">
              <div class="flex items-center gap-4">
                ${invoice.logoUrl ? `
                  <img src="${invoice.logoUrl}" alt="Logo" class="h-14 max-w-[150px] object-contain bg-white/20 p-1.5 rounded-xl backdrop-blur-sm" />
                ` : `
                  <div class="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-xl">
                    ${(invoice.senderName || 'IN').substring(0, 2).toUpperCase()}
                  </div>
                `}
                <div>
                  <h1 class="text-xl font-bold">${invoice.senderName || 'Studio Kreatif'}</h1>
                  <p class="text-xs text-white/80">${invoice.senderEmail || ''} ${invoice.senderPhone ? `• ${invoice.senderPhone}` : ''}</p>
                </div>
              </div>

              <div class="text-right">
                <span class="text-2xl font-black tracking-tight">${invoice.title || 'INVOICE'}</span>
                <p class="font-mono text-xs text-white/90">#${invoice.number || 'INV-001'}</p>
                ${invoice.showStatus !== false ? `
                  <div class="mt-2">
                    ${this.renderStatusBadge(invoice.status, lang)}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Parties Grid -->
          <div class="grid grid-cols-2 gap-6 my-6">
            <div class="p-4 rounded-xl bg-violet-50/60 border border-violet-100">
              <span class="text-[10px] font-bold tracking-wider uppercase text-violet-500 block mb-1">Ditagihkan Kepada:</span>
              <p class="font-bold text-sm text-slate-900">${invoice.clientName || 'Nama Klien'}</p>
              <p class="text-xs text-slate-600 mt-1 whitespace-pre-line">${invoice.clientAddress || 'Alamat Klien'}</p>
              <p class="text-xs text-slate-500 mt-2">${invoice.clientEmail || ''} ${invoice.clientPhone ? `• ${invoice.clientPhone}` : ''}</p>
            </div>

            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 grid ${invoice.showDueDate !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-xs">
              <div>
                <span class="text-slate-400 text-[10px] uppercase font-bold">Tanggal:</span>
                <p class="font-semibold text-slate-800 mt-0.5">${invoice.date || '-'}</p>
              </div>
              ${invoice.showDueDate !== false ? `
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold">Jatuh Tempo:</span>
                  <p class="font-semibold text-rose-600 mt-0.5">${invoice.dueDate || '-'}</p>
                </div>
              ` : ''}
              <div class="${invoice.showDueDate !== false ? 'col-span-2' : ''} pt-2 border-t border-slate-200 mt-1">
                <span class="text-slate-400 text-[10px] uppercase font-bold">Total Pembayaran:</span>
                <p class="font-bold text-base" style="color: ${accent}">${formatCurrency(totals.balanceDue, curr, dec)}</p>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="overflow-hidden rounded-xl border border-slate-200 my-6">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900 text-white font-semibold">
                <tr>
                  <th class="py-3 px-4 w-10">#</th>
                  <th class="py-3 px-4">Deskripsi</th>
                  <th class="py-3 px-4 text-center w-16">Qty</th>
                  <th class="py-3 px-4 text-right w-28">Harga</th>
                  <th class="py-3 px-4 text-right w-20">Diskon</th>
                  <th class="py-3 px-4 text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-mono-num">
                ${(invoice.items || []).map((item, idx) => `
                  <tr class="hover:bg-slate-50/50">
                    <td class="py-3 px-4 text-slate-400 font-sans">${idx + 1}</td>
                    <td class="py-3 px-4 font-sans">
                      <div class="font-semibold text-slate-900">${item.name || 'Item'}</div>
                      ${item.description ? `<div class="text-[11px] text-slate-500">${item.description}</div>` : ''}
                    </td>
                    <td class="py-3 px-4 text-center text-slate-700">${item.quantity || 1} ${item.unit || ''}</td>
                    <td class="py-3 px-4 text-right text-slate-700">${formatCurrency(item.price, curr, dec)}</td>
                    <td class="py-3 px-4 text-right text-slate-500">
                      ${Number(item.discountValue) > 0 ? (item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, curr, dec)) : '-'}
                    </td>
                    <td class="py-3 px-4 text-right font-bold text-slate-900">${formatCurrency(calculateItemTotal(item), curr, dec)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Bottom Totals -->
          <div class="grid grid-cols-12 gap-6 my-6">
            <div class="col-span-7 space-y-4">
              <div class="p-3 bg-violet-50/40 rounded-xl border border-violet-100 text-xs">
                <span class="text-[10px] font-bold uppercase text-violet-500">Terbilang:</span>
                <p class="font-medium text-slate-800 italic mt-0.5"># ${getSpelledOutAmount(totals.balanceDue, curr, lang)} #</p>
              </div>
              ${this.renderBankAccounts(invoice.bankAccounts)}
            </div>

            <div class="col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono-num text-xs space-y-2">
              <div class="flex justify-between text-slate-600">
                <span class="font-sans">Subtotal</span>
                <span>${formatCurrency(totals.subtotal, curr, dec)}</span>
              </div>
              ${totals.globalDiscount > 0 ? `
                <div class="flex justify-between text-emerald-600">
                  <span class="font-sans">Diskon</span>
                  <span>-${formatCurrency(totals.globalDiscount, curr, dec)}</span>
                </div>
              ` : ''}
              ${totals.taxAmount > 0 ? `
                <div class="flex justify-between text-slate-600">
                  <span class="font-sans">Pajak (${totals.taxRate}%)</span>
                  <span>+${formatCurrency(totals.taxAmount, curr, dec)}</span>
                </div>
              ` : ''}
              ${totals.shippingFee > 0 ? `
                <div class="flex justify-between text-slate-600">
                  <span class="font-sans">Ongkir</span>
                  <span>+${formatCurrency(totals.shippingFee, curr, dec)}</span>
                </div>
              ` : ''}
              <div class="border-t border-slate-300 pt-2 flex justify-between font-bold text-sm text-slate-900">
                <span class="font-sans">Total</span>
                <span>${formatCurrency(totals.grandTotal, curr, dec)}</span>
              </div>
              ${totals.downPayment > 0 ? `
                <div class="flex justify-between text-emerald-700">
                  <span class="font-sans">DP</span>
                  <span>-${formatCurrency(totals.downPayment, curr, dec)}</span>
                </div>
                <div class="border-t border-slate-300 pt-1 flex justify-between font-bold text-base" style="color: ${accent}">
                  <span class="font-sans">Sisa Tagihan</span>
                  <span>${formatCurrency(totals.balanceDue, curr, dec)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-6 border-t border-slate-200 mt-auto flex justify-between items-end">
          <div>
            ${invoice.showQrCode ? this.renderQrContainer() : ''}
            ${invoice.notes ? `<p class="text-[11px] text-slate-500 mt-2 max-w-sm whitespace-pre-line">${invoice.notes}</p>` : ''}
          </div>
          <div>
            ${this.renderSignature(invoice)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * TEMPLATE 5: Compact Thermal / Receipt Format (80mm)
   */
  receipt(invoice, totals) {
    const lang = invoice.language || 'id';
    const curr = invoice.currency || 'IDR';
    const dec = invoice.useDecimals;
    
    return `
      <div class="p-4 text-slate-900 bg-white font-mono text-[11px] leading-relaxed max-w-[80mm] mx-auto">
        <!-- Header Center -->
        <div class="text-center pb-3 border-b border-dashed border-slate-400">
          ${invoice.logoUrl ? `
            <img src="${invoice.logoUrl}" alt="Logo" class="h-10 max-w-[120px] object-contain mx-auto mb-1" />
          ` : ''}
          <h2 class="font-bold text-sm uppercase">${invoice.senderName || 'TOKO / BISNIS'}</h2>
          <p class="text-[10px] text-slate-600">${invoice.senderAddress || ''}</p>
          <p class="text-[10px] text-slate-600">${invoice.senderPhone || ''}</p>
        </div>

        <!-- Info -->
        <div class="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
          <div class="flex justify-between">
            <span>NO: ${invoice.number || '001'}</span>
            <span>${invoice.date || ''}</span>
          </div>
          <div class="flex justify-between">
            <span>Klien: ${invoice.clientName || 'Umum'}</span>
            ${invoice.showStatus !== false ? `<span class="uppercase font-bold">${invoice.status ? (invoice.status === 'paid' ? 'LUNAS' : invoice.status.toUpperCase()) : 'LUNAS'}</span>` : ''}
          </div>
        </div>

        <!-- Items -->
        <div class="py-2 border-b border-dashed border-slate-400">
          <div class="space-y-1.5">
            ${(invoice.items || []).map(item => `
              <div>
                <div class="font-bold">${item.name || 'Item'}</div>
                <div class="flex justify-between text-slate-600 text-[10px]">
                  <span>${item.quantity || 1} x ${formatCurrency(item.price, curr, dec)}</span>
                  <span class="font-bold text-slate-900">${formatCurrency(calculateItemTotal(item), curr, dec)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Totals -->
        <div class="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
          <div class="flex justify-between">
            <span>Subtotal:</span>
            <span>${formatCurrency(totals.subtotal, curr, dec)}</span>
          </div>
          ${totals.globalDiscount > 0 ? `
            <div class="flex justify-between text-emerald-600">
              <span>Diskon:</span>
              <span>-${formatCurrency(totals.globalDiscount, curr, dec)}</span>
            </div>
          ` : ''}
          ${totals.taxAmount > 0 ? `
            <div class="flex justify-between">
              <span>Pajak (${totals.taxRate}%):</span>
              <span>+${formatCurrency(totals.taxAmount, curr, dec)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
            <span>TOTAL:</span>
            <span>${formatCurrency(totals.grandTotal, curr, dec)}</span>
          </div>
          ${totals.downPayment > 0 ? `
            <div class="flex justify-between">
              <span>Terbayar (DP):</span>
              <span>-${formatCurrency(totals.downPayment, curr, dec)}</span>
            </div>
            <div class="flex justify-between font-bold">
              <span>SISA:</span>
              <span>${formatCurrency(totals.balanceDue, curr, dec)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="text-center pt-3 space-y-2">
          ${invoice.showQrCode ? `<div class="flex justify-center">${this.renderQrContainer()}</div>` : ''}
          <p class="text-[10px] text-slate-600 italic">Terima kasih atas kunjungan Anda!</p>
          ${invoice.notes ? `<p class="text-[9px] text-slate-500">${invoice.notes}</p>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Main Dispatcher
   */
  render(invoice, totals) {
    const templateName = invoice.template || 'modern';
    const renderer = this[templateName] || this.modern;
    return renderer.call(this, invoice, totals);
  }
};
