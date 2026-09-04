/**
 * Professional Indonesian Surat Jalan (Delivery Order / Bukti Pengiriman Barang) Templates
 * Supports:
 * 1. warehouse - Standar Resmi Gudang & Distribusi (3-4 Kolom Tanda Tangan)
 * 2. corporate - Corporate Delivery Order (Modern Flat with Accent Colors)
 * 3. minimalist - Minimalist Industrial (Clean Lines & High Table Density)
 * 4. cargo - Ekspedisi & Cargo Manifest (Plat Nomor, Seal, Rute, Instruksi)
 */

const SuratJalanTemplates = {
  /**
   * Helper to format status badge
   */
  renderStatusBadge(status = 'in_transit') {
    const statusMap = {
      delivered: { text: 'TERKIRIM (DELIVERED)', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      in_transit: { text: 'DALAM PENGIRIMAN', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
      ready: { text: 'SIAP DIKIRIM (READY)', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
      completed: { text: 'SELESAI (COMPLETED)', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      partial: { text: 'PARSIAL (SEBAGIAN)', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
      draft: { text: 'DRAFT', bg: 'bg-slate-100 text-slate-700 border-slate-300' }
    };

    const config = statusMap[status] || statusMap.in_transit;
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${config.bg}">${config.text}</span>`;
  },

  /**
   * Helper to render Realistic Logistics Stamp
   */
  renderStamp(sj) {
    if (!sj.showStamp) return '';
    const text = (sj.stampText || 'DIKIRIM').toUpperCase();
    const color = sj.stampColor || 'amber';
    const colorClass = color === 'emerald' ? 'stamp-emerald' : (color === 'blue' ? 'stamp-blue' : (color === 'red' ? 'stamp-red' : ''));
    const dateStr = sj.date || '';

    return `
      <div class="surat-jalan-stamp ${colorClass}">
        <span class="text-[8px] tracking-widest leading-none">${sj.senderCity || 'LOGISTIK'}</span>
        <span class="text-xs font-black tracking-widest leading-tight my-0.5">${text}</span>
        <span class="text-[7.5px] font-mono tracking-wider leading-none">${dateStr}</span>
      </div>
    `;
  },

  /**
   * Helper to render Watermark
   */
  renderWatermark(sj) {
    const showWatermark = sj && sj.showWatermark !== undefined
      ? sj.showWatermark
      : (typeof window.AuthManager !== 'undefined' ? window.AuthManager.shouldShowWatermark() : true);

    if (!showWatermark) return '';

    return `
      <div class="invoice-watermark-overlay pointer-events-none select-none absolute inset-0 z-20 overflow-hidden flex items-center justify-center">
        <div class="invoice-watermark-badge text-center" style="transform: rotate(-25deg); border: 4px dashed rgba(245, 158, 11, 0.4); padding: 14px 36px; border-radius: 16px; background-color: rgba(255, 255, 255, 0.25);">
          <div style="font-size: 34px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(217, 119, 6, 0.35); font-family: 'Outfit', sans-serif; line-height: 1;">
            CONTOH SURAT JALAN
          </div>
          <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(217, 119, 6, 0.35); font-family: 'Inter', sans-serif; margin-top: 3px;">
            DIBUAT DENGAN INVOICEPRO • SAMPLE
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Helper to render QR Code Container
   */
  renderQrContainer(sj) {
    if (!sj.showQrCode) return '';
    return `
      <div class="flex flex-col items-center justify-center text-center">
        <div id="surat-jalan-qr-code" class="w-16 h-16 bg-white p-1 rounded border border-slate-200 flex items-center justify-center shadow-xs"></div>
        <span class="text-[8px] text-slate-400 mt-1 font-mono">Scan Tracking</span>
      </div>
    `;
  },

  /**
   * Helper to render Shipping / Armada details
   */
  renderShippingInfo(sj) {
    if (!sj.showShippingInfo) return '';

    return `
      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5 font-sans">
        <div>
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Kurir / Pengemudi:</span>
          <p class="font-bold text-slate-800 truncate">${sj.driverName || '-'}</p>
        </div>
        <div>
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Kendaraan / Armada:</span>
          <p class="font-semibold text-slate-800 truncate">${sj.vehicleType || '-'}</p>
        </div>
        <div>
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">No. Polisi (Plat):</span>
          <p class="font-mono font-bold text-slate-900 truncate">${sj.plateNumber || '-'}</p>
        </div>
        <div>
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">${sj.trackingNumber ? 'No. Resi / AWB:' : 'Estimasi Tiba:'}</span>
          <p class="font-mono font-bold text-slate-800 truncate">${sj.trackingNumber || sj.estimatedArrival || '-'}</p>
        </div>
        ${sj.showSealNumber && sj.sealNumber ? `
          <div class="col-span-2 sm:col-span-4 pt-1 border-t border-slate-200 flex items-center gap-2">
            <span class="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">No. Segel (Seal):</span>
            <span class="font-mono font-bold text-slate-800 text-[10px]">${sj.sealNumber}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Helper to render Multi-Party Signatures (Penerima, Pengemudi, Gudang, Otorisasi)
   */
  renderSignatures(sj) {
    const is4Cols = sj.showMultiSignature; // if true, 4 columns. if false, 3 standard columns
    const gridClass = is4Cols ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3';

    return `
      <div class="grid ${gridClass} gap-3 pt-3 border-t-2 border-slate-800 text-center text-xs">
        <!-- Kolom 1: Penerima -->
        <div class="flex flex-col justify-between min-h-[95px] p-1 border border-slate-100 rounded bg-slate-50/50">
          <div>
            <p class="font-bold text-[10px] uppercase tracking-wider text-slate-700">Diterima Oleh,</p>
            <p class="text-[9px] text-slate-400">Penerima di Lokasi</p>
          </div>
          <div class="h-10"></div>
          <div>
            <div class="border-b border-slate-400 mx-2 mb-1"></div>
            <p class="text-[10px] font-bold text-slate-800 truncate">${sj.recipientSignerName || '(..........................)'}</p>
            <p class="text-[8px] text-slate-400">Tgl & Cap:</p>
          </div>
        </div>

        <!-- Kolom 2: Pengemudi / Supir -->
        <div class="flex flex-col justify-between min-h-[95px] p-1 border border-slate-100 rounded bg-slate-50/50">
          <div>
            <p class="font-bold text-[10px] uppercase tracking-wider text-slate-700">Diserahkan Oleh,</p>
            <p class="text-[9px] text-slate-400">Pengemudi / Ekspedisi</p>
          </div>
          <div class="h-10"></div>
          <div>
            <div class="border-b border-slate-400 mx-2 mb-1"></div>
            <p class="text-[10px] font-bold text-slate-800 truncate">${sj.driverName || '(..........................)'}</p>
            <p class="text-[8px] text-slate-400">Pengemudi</p>
          </div>
        </div>

        <!-- Kolom 3: Petugas Gudang -->
        <div class="flex flex-col justify-between min-h-[95px] p-1 border border-slate-100 rounded bg-slate-50/50 relative">
          <div>
            <p class="font-bold text-[10px] uppercase tracking-wider text-slate-700">Dibuat Oleh,</p>
            <p class="text-[9px] text-slate-400">Bagian Gudang</p>
          </div>
          <div class="h-10 flex items-center justify-center relative">
            ${sj.showDigitalSign && sj.signatureData ? `
              <img src="${sj.signatureData}" alt="Ttd" class="max-h-10 max-w-[90px] object-contain" />
            ` : ''}
            ${sj.showStamp ? `
              <div class="absolute -top-1 -right-2 pointer-events-none z-10">
                ${this.renderStamp(sj)}
              </div>
            ` : ''}
          </div>
          <div>
            <div class="border-b border-slate-400 mx-2 mb-1"></div>
            <p class="text-[10px] font-bold text-slate-800 truncate">${sj.senderPic || '(..........................)'}</p>
            <p class="text-[8px] text-slate-400">Staff Gudang</p>
          </div>
        </div>

        <!-- Kolom 4: Otorisasi / Admin (jika 4 kolom) -->
        ${is4Cols ? `
          <div class="flex flex-col justify-between min-h-[95px] p-1 border border-slate-100 rounded bg-slate-50/50">
            <div>
              <p class="font-bold text-[10px] uppercase tracking-wider text-slate-700">Mengetahui,</p>
              <p class="text-[9px] text-slate-400">Otorisasi / Head Logistics</p>
            </div>
            <div class="h-10"></div>
            <div>
              <div class="border-b border-slate-400 mx-2 mb-1"></div>
              <p class="text-[10px] font-bold text-slate-800 truncate">${sj.authorizerName || '(..........................)'}</p>
              <p class="text-[8px] text-slate-400">${sj.authorizerTitle || 'Logistics Mgr'}</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Helper to render Notes & Disclaimer clause
   */
  renderNotes(sj) {
    if (!sj.showNotes || !sj.notes) return '';
    return `
      <div class="text-[9.5px] text-slate-500 bg-slate-50/80 p-2 rounded border border-slate-200/70 mt-3 space-y-0.5">
        <p class="font-bold text-slate-700 uppercase tracking-wide text-[9px]">Perhatian / Ketentuan Serah-Terima Barang:</p>
        <p class="leading-relaxed italic">${sj.notes}</p>
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 1: STANDAR GUDANG & LOGISTIK INDONESIA
   * ========================================================== */
  warehouse(sj) {
    return `
      <div class="p-4 sm:p-6 bg-white relative text-slate-900 leading-normal font-sans border-2 border-slate-900">
        ${this.renderWatermark(sj)}

        <!-- Top Header -->
        <div class="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
          <div>
            ${sj.showCompanyHeader ? `
              <div class="flex items-center gap-2.5 mb-1.5">
                ${sj.logo ? `<img src="${sj.logo}" alt="Logo" class="max-h-10 max-w-[110px] object-contain" />` : ''}
                <div>
                  <h3 class="font-black text-sm uppercase tracking-tight">${sj.senderName || 'Nama Perusahaan Pengirim'}</h3>
                  ${sj.senderAddress ? `<p class="text-[9.5px] text-slate-600">${sj.senderAddress.replace(/\n/g, ', ')}</p>` : ''}
                  ${sj.showSenderContact && (sj.senderPic || sj.senderPhone) ? `
                    <p class="text-[9px] text-slate-500">Gudang PIC: ${sj.senderPic || '-'} • Telp: ${sj.senderPhone || '-'}</p>
                  ` : ''}
                </div>
              </div>
            ` : ''}
            <div class="flex items-center gap-2 mt-1">
              <h1 class="font-heading font-black text-xl tracking-wider uppercase text-slate-900">SURAT JALAN</h1>
              ${sj.showStatus ? this.renderStatusBadge(sj.status) : ''}
            </div>
            <p class="text-[10px] text-slate-500 font-mono tracking-wide uppercase">SURAT PENGANTAR / BUKTI SERAH-TERIMA BARANG</p>
          </div>

          <div class="text-right font-mono text-xs">
            <div class="bg-slate-100 px-3 py-1.5 rounded border border-slate-300 font-bold inline-block">
              <span class="text-slate-500 font-sans mr-1">No:</span> ${sj.number || 'SJ-2026-001'}
            </div>
            <p class="text-[10.5px] text-slate-700 mt-1">Tanggal: <strong>${sj.date || '-'}</strong></p>
            ${sj.showPoNumber && sj.poNumber ? `
              <p class="text-[10px] text-slate-600">No. PO: <strong>${sj.poNumber}</strong></p>
            ` : ''}
            ${sj.showInvNumber && sj.invoiceRef ? `
              <p class="text-[10px] text-slate-600">No. Invoice: <strong>${sj.invoiceRef}</strong></p>
            ` : ''}
          </div>
        </div>

        <!-- Destination / Recipient Block -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs mb-3">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Tujuan Pengiriman (Kepada Yth):</span>
            <p class="font-bold text-sm text-slate-900">${sj.recipientName || '-'}</p>
            <p class="text-[11px] text-slate-700 mt-0.5 whitespace-pre-line">${sj.recipientAddress || '-'}</p>
          </div>
          <div class="border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Kontak Penerima di Lokasi:</span>
            ${sj.showRecipientContact ? `
              <p class="font-bold text-slate-800 text-[11px]">PIC: ${sj.recipientPic || '-'}</p>
              <p class="text-[10.5px] text-slate-600">Telp: ${sj.recipientPhone || '-'}</p>
            ` : `<p class="text-[10px] text-slate-400 italic">Sesuai data pemesanan</p>`}
            ${sj.deliveryInstructions ? `
              <p class="text-[10px] text-amber-700 mt-1 italic">Catatan Lokasi: ${sj.deliveryInstructions}</p>
            ` : ''}
          </div>
        </div>

        <!-- Shipping & Armada Info -->
        ${this.renderShippingInfo(sj)}

        <!-- Main Items Table -->
        <div class="my-3 overflow-hidden rounded border border-slate-300">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
              <tr>
                <th class="p-2 w-8 text-center border-r border-slate-200">No</th>
                ${sj.showSkuColumn ? `<th class="p-2 w-28 border-r border-slate-200">Kode / SKU</th>` : ''}
                <th class="p-2 border-r border-slate-200">Nama Barang & Deskripsi</th>
                <th class="p-2 w-20 text-center border-r border-slate-200">Jumlah</th>
                <th class="p-2 w-20 text-center border-r border-slate-200">Satuan</th>
                ${sj.showItemCondition ? `<th class="p-2 w-32 text-center">Kondisi / Ket.</th>` : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-[11px]">
              ${(sj.items || []).map((item, idx) => `
                <tr class="hover:bg-slate-50">
                  <td class="p-2 text-center font-mono text-slate-500 border-r border-slate-200">${idx + 1}</td>
                  ${sj.showSkuColumn ? `<td class="p-2 font-mono font-semibold text-slate-700 border-r border-slate-200">${item.sku || '-'}</td>` : ''}
                  <td class="p-2 font-medium text-slate-900 border-r border-slate-200">
                    <div class="font-bold">${item.name || '-'}</div>
                    ${item.description ? `<div class="text-[10px] text-slate-500">${item.description}</div>` : ''}
                  </td>
                  <td class="p-2 text-center font-mono font-bold text-slate-900 border-r border-slate-200">${item.quantity || 1}</td>
                  <td class="p-2 text-center font-medium text-slate-600 border-r border-slate-200">${item.unit || 'Pcs'}</td>
                  ${sj.showItemCondition ? `<td class="p-2 text-center font-semibold text-slate-700">${item.condition || 'Baik & Utuh'}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Total Items Summary -->
        <div class="flex justify-between items-center text-xs font-mono py-1 px-2 bg-slate-50 border border-slate-200 rounded mb-3">
          <span class="font-sans text-slate-600">Total Jenis Barang: <strong>${(sj.items || []).length} Item</strong></span>
          <span class="font-sans text-slate-800">Total Kuantitas Fisik: <strong>${(sj.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)} Unit</strong></span>
        </div>

        <!-- Notes & QR -->
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1">
            ${this.renderNotes(sj)}
          </div>
          ${this.renderQrContainer(sj)}
        </div>

        <!-- Multi Signatures Block -->
        ${this.renderSignatures(sj)}
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 2: CORPORATE DELIVERY ORDER (Clean Modern)
   * ========================================================== */
  corporate(sj) {
    const accent = sj.accentColor || '#4f46e5';

    return `
      <div class="p-6 bg-white relative text-slate-800 font-sans rounded-2xl shadow-xs border border-slate-200/90">
        ${this.renderWatermark(sj)}

        <!-- Top Accent Bar -->
        <div class="h-1.5 w-full rounded-full mb-4" style="background-color: ${accent}"></div>

        <!-- Header -->
        <div class="flex items-start justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-3">
            ${sj.showCompanyHeader && sj.logo ? `
              <img src="${sj.logo}" alt="Logo" class="max-h-12 max-w-[130px] object-contain" />
            ` : (sj.showCompanyHeader ? `
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-xs" style="background-color: ${accent}">
                ${(sj.senderName || 'S').charAt(0).toUpperCase()}
              </div>
            ` : '')}
            <div>
              <h2 class="font-heading font-extrabold text-base text-slate-900 tracking-tight">
                ${sj.showCompanyHeader ? (sj.senderName || 'PT Pengirim Logistik') : 'SURAT JALAN / DELIVERY ORDER'}
              </h2>
              ${sj.showCompanyHeader && sj.senderAddress ? `
                <p class="text-[10.5px] text-slate-500 mt-0.5">${sj.senderAddress.replace(/\n/g, ', ')}</p>
              ` : ''}
              ${sj.showSenderContact && (sj.senderPic || sj.senderPhone) ? `
                <p class="text-[10px] text-slate-400">PIC: ${sj.senderPic || '-'} • ${sj.senderPhone || '-'}</p>
              ` : ''}
            </div>
          </div>

          <div class="text-right">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[10px] font-bold text-slate-400 uppercase">NO. SJ</span>
              <span class="font-mono font-bold text-xs text-slate-900">${sj.number || 'SJ-001'}</span>
            </div>
            ${sj.showStatus ? `<div class="mt-1">${this.renderStatusBadge(sj.status)}</div>` : ''}
            <p class="text-[10px] text-slate-500 font-mono mt-1">Tgl: ${sj.date || '-'}</p>
          </div>
        </div>

        <!-- Rujukan & Tujuan Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3.5">
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Penerima & Alamat Tujuan:</span>
            <p class="font-bold text-sm text-slate-900">${sj.recipientName || '-'}</p>
            <p class="text-[11px] text-slate-600 mt-0.5 whitespace-pre-line">${sj.recipientAddress || '-'}</p>
            ${sj.showRecipientContact ? `
              <p class="text-[10px] text-indigo-600 font-semibold mt-1">Kontak PIC: ${sj.recipientPic || '-'} (${sj.recipientPhone || '-'})</p>
            ` : ''}
          </div>

          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Dokumen Rujukan:</span>
              <div class="space-y-1 font-mono text-[11px]">
                ${sj.showPoNumber && sj.poNumber ? `<p>No. PO: <strong class="text-slate-800">${sj.poNumber}</strong></p>` : ''}
                ${sj.showInvNumber && sj.invoiceRef ? `<p>No. Faktur: <strong class="text-slate-800">${sj.invoiceRef}</strong></p>` : ''}
                <p>Kota Pengirim: <strong class="text-slate-800 font-sans">${sj.senderCity || 'Jakarta'}</strong></p>
              </div>
            </div>
            ${sj.deliveryInstructions ? `<p class="text-[10px] text-amber-700 italic border-t border-slate-200 pt-1 mt-1">${sj.deliveryInstructions}</p>` : ''}
          </div>
        </div>

        <!-- Shipping details -->
        ${this.renderShippingInfo(sj)}

        <!-- Table -->
        <div class="my-3 overflow-hidden rounded-xl border border-slate-200">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th class="p-2 w-8 text-center">#</th>
                ${sj.showSkuColumn ? `<th class="p-2 w-28">Kode / SKU</th>` : ''}
                <th class="p-2">Deskripsi Barang</th>
                <th class="p-2 w-20 text-center">Volume</th>
                <th class="p-2 w-20 text-center">Satuan</th>
                ${sj.showItemCondition ? `<th class="p-2 w-28 text-center">Status</th>` : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-[11px]">
              ${(sj.items || []).map((item, idx) => `
                <tr>
                  <td class="p-2 text-center text-slate-400 font-mono">${idx + 1}</td>
                  ${sj.showSkuColumn ? `<td class="p-2 font-mono font-semibold text-slate-600">${item.sku || '-'}</td>` : ''}
                  <td class="p-2 font-semibold text-slate-900">${item.name || '-'}</td>
                  <td class="p-2 text-center font-mono font-bold">${item.quantity || 1}</td>
                  <td class="p-2 text-center text-slate-600">${item.unit || 'Pcs'}</td>
                  ${sj.showItemCondition ? `<td class="p-2 text-center text-slate-700 font-medium">${item.condition || 'Baik'}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Bottom Notes & QR -->
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1">${this.renderNotes(sj)}</div>
          ${this.renderQrContainer(sj)}
        </div>

        <!-- Signatures -->
        ${this.renderSignatures(sj)}
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 3: MINIMALIST INDUSTRIAL
   * ========================================================== */
  minimalist(sj) {
    return `
      <div class="p-6 bg-white relative text-zinc-900 font-sans border-2 border-zinc-900">
        ${this.renderWatermark(sj)}

        <!-- Header -->
        <div class="flex items-start justify-between pb-3 border-b-2 border-zinc-900">
          <div>
            <span class="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block">OFFICIAL GOODS DISPATCH NOTE</span>
            <h1 class="font-heading font-black text-2xl tracking-tighter uppercase">SURAT JALAN</h1>
            ${sj.showCompanyHeader && sj.senderName ? `<p class="font-bold text-xs mt-0.5 uppercase">${sj.senderName}</p>` : ''}
          </div>

          <div class="text-right font-mono text-xs">
            <p class="font-bold">${sj.number || 'SJ-001'}</p>
            <p class="text-[10px] text-zinc-500">${sj.date || ''}</p>
            ${sj.showStatus ? `<div class="mt-1">${this.renderStatusBadge(sj.status)}</div>` : ''}
          </div>
        </div>

        <!-- Recipient & PO Lines -->
        <div class="divide-y divide-zinc-200 text-xs my-3">
          <div class="py-1.5 flex items-baseline">
            <span class="w-32 text-zinc-400 font-mono text-[10px] uppercase">Kirim Kepada:</span>
            <span class="font-bold text-zinc-900 text-sm">${sj.recipientName || '-'}</span>
          </div>
          <div class="py-1.5 flex items-baseline">
            <span class="w-32 text-zinc-400 font-mono text-[10px] uppercase">Alamat Tujuan:</span>
            <span class="text-zinc-800 leading-relaxed">${sj.recipientAddress || '-'}</span>
          </div>
          ${sj.showPoNumber && sj.poNumber ? `
            <div class="py-1 flex items-baseline font-mono text-[11px]">
              <span class="w-32 text-zinc-400 text-[10px] uppercase">No. PO:</span>
              <span class="font-bold text-zinc-800">${sj.poNumber}</span>
            </div>
          ` : ''}
        </div>

        ${this.renderShippingInfo(sj)}

        <!-- Table -->
        <table class="w-full text-left text-xs my-3 border-t border-b border-zinc-900">
          <thead class="font-mono text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-300">
            <tr>
              <th class="py-1.5 w-8">#</th>
              ${sj.showSkuColumn ? `<th class="py-1.5 w-28">SKU</th>` : ''}
              <th class="py-1.5">Nama Item / Barang</th>
              <th class="py-1.5 w-20 text-center">Volume</th>
              <th class="py-1.5 w-20 text-center">Satuan</th>
              ${sj.showItemCondition ? `<th class="py-1.5 w-28 text-center">Kondisi</th>` : ''}
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-200 text-[11px]">
            ${(sj.items || []).map((item, idx) => `
              <tr>
                <td class="py-2 text-zinc-400 font-mono">${idx + 1}</td>
                ${sj.showSkuColumn ? `<td class="py-2 font-mono font-bold">${item.sku || '-'}</td>` : ''}
                <td class="py-2 font-medium text-zinc-900">${item.name || '-'}</td>
                <td class="py-2 text-center font-mono font-black">${item.quantity || 1}</td>
                <td class="py-2 text-center text-zinc-600">${item.unit || 'Pcs'}</td>
                ${sj.showItemCondition ? `<td class="py-2 text-center text-zinc-700">${item.condition || 'OK'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1">${this.renderNotes(sj)}</div>
          ${this.renderQrContainer(sj)}
        </div>

        ${this.renderSignatures(sj)}
      </div>
    `;
  },

  /* ==========================================================
   * TEMPLATE 4: EKSPEDISI & CARGO MANIFEST
   * ========================================================== */
  cargo(sj) {
    const accent = sj.accentColor || '#d97706';

    return `
      <div class="p-5 bg-white relative text-slate-800 font-sans border-2 border-amber-600 rounded-xl shadow-xs">
        ${this.renderWatermark(sj)}

        <!-- Top Header with Logistics Motif -->
        <div class="flex items-start justify-between border-b-2 border-amber-600 pb-3 mb-3">
          <div class="flex items-center gap-3">
            ${sj.showCompanyHeader && sj.logo ? `
              <img src="${sj.logo}" alt="Logo" class="max-h-12 max-w-[130px] object-contain" />` : ''}
            <div>
              <div class="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-black uppercase tracking-wider mb-1">
                CARGO & FREIGHT DELIVERY ORDER
              </div>
              <h2 class="font-heading font-black text-lg uppercase tracking-tight text-slate-900">
                ${sj.showCompanyHeader ? (sj.senderName || 'EKSPEDISI & CARGO LOGISTIK') : 'SURAT JALAN CARGO'}
              </h2>
              ${sj.showCompanyHeader && sj.senderAddress ? `<p class="text-[10px] text-slate-500">${sj.senderAddress.replace(/\n/g, ', ')}</p>` : ''}
            </div>
          </div>

          <div class="text-right">
            <div class="text-xs font-mono font-bold bg-amber-50 text-amber-900 px-3 py-1 rounded border border-amber-200">
              No. Resi: ${sj.trackingNumber || sj.number || 'AWB-001'}
            </div>
            <p class="text-[10px] text-slate-500 font-mono mt-1">Tgl Muat: ${sj.date || '-'}</p>
            ${sj.showStatus ? `<div class="mt-1">${this.renderStatusBadge(sj.status)}</div>` : ''}
          </div>
        </div>

        <!-- Route & Fleet Box -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-xs font-mono mb-3">
          <div>
            <span class="text-[8.5px] uppercase font-bold text-amber-800 block">Sopir / Driver:</span>
            <span class="font-bold text-slate-900">${sj.driverName || '-'}</span>
          </div>
          <div>
            <span class="text-[8.5px] uppercase font-bold text-amber-800 block">No. Plat Polisi:</span>
            <span class="font-black text-slate-900">${sj.plateNumber || '-'}</span>
          </div>
          <div>
            <span class="text-[8.5px] uppercase font-bold text-amber-800 block">Armada:</span>
            <span class="font-bold text-slate-800">${sj.vehicleType || '-'}</span>
          </div>
          <div>
            <span class="text-[8.5px] uppercase font-bold text-amber-800 block">Segel / Seal:</span>
            <span class="font-bold text-amber-900">${sj.sealNumber || '-'}</span>
          </div>
        </div>

        <!-- Shipper vs Consignee -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Pengirim (Shipper):</span>
            <p class="font-bold text-slate-900">${sj.senderName || '-'}</p>
            <p class="text-[10.5px] text-slate-600">${sj.senderAddress || '-'}</p>
            ${sj.showSenderContact ? `<p class="text-[10px] text-slate-500 mt-1">PIC: ${sj.senderPic || '-'} (${sj.senderPhone || '-'})</p>` : ''}
          </div>
          <div class="border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-3">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Penerima (Consignee):</span>
            <p class="font-bold text-slate-900">${sj.recipientName || '-'}</p>
            <p class="text-[10.5px] text-slate-600">${sj.recipientAddress || '-'}</p>
            ${sj.showRecipientContact ? `<p class="text-[10px] text-slate-500 mt-1">PIC: ${sj.recipientPic || '-'} (${sj.recipientPhone || '-'})</p>` : ''}
          </div>
        </div>

        <!-- Cargo Manifest Table -->
        <table class="w-full text-left text-xs my-2 rounded border border-slate-200 overflow-hidden">
          <thead class="bg-slate-100 text-slate-700 font-bold uppercase text-[9.5px]">
            <tr>
              <th class="p-2 w-8 text-center">No</th>
              ${sj.showSkuColumn ? `<th class="p-2 w-28">Kode / SKU</th>` : ''}
              <th class="p-2">Uraian Muatan / Kargo</th>
              <th class="p-2 w-20 text-center">Koli/Qty</th>
              <th class="p-2 w-20 text-center">Kemasan</th>
              ${sj.showItemCondition ? `<th class="p-2 w-28 text-center">Kondisi Segel</th>` : ''}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-[11px]">
            ${(sj.items || []).map((item, idx) => `
              <tr>
                <td class="p-2 text-center text-slate-400 font-mono">${idx + 1}</td>
                ${sj.showSkuColumn ? `<td class="p-2 font-mono font-semibold text-slate-600">${item.sku || '-'}</td>` : ''}
                <td class="p-2 font-semibold text-slate-900">${item.name || '-'}</td>
                <td class="p-2 text-center font-mono font-bold">${item.quantity || 1}</td>
                <td class="p-2 text-center text-slate-600">${item.unit || 'Colli'}</td>
                ${sj.showItemCondition ? `<td class="p-2 text-center text-slate-700">${item.condition || 'Segel Utuh'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Notes & QR -->
        <div class="flex items-start justify-between gap-3 my-2">
          <div class="flex-1">${this.renderNotes(sj)}</div>
          ${this.renderQrContainer(sj)}
        </div>

        <!-- 4 Columns Signatures -->
        ${this.renderSignatures(sj)}
      </div>
    `;
  },

  /**
   * Main render dispatch method
   */
  render(sj) {
    const templateName = (sj && sj.template) || 'warehouse';
    const renderer = this[templateName] || this.warehouse;
    return renderer.call(this, sj || {});
  }
};

// CommonJS and Global export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SuratJalanTemplates;
}
if (typeof window !== 'undefined') {
  window.SuratJalanTemplates = SuratJalanTemplates;
}
