// functions/_shared/qris-svg.js
// Render string payload QRIS menjadi SVG (tanpa DOM/canvas, aman di Cloudflare Workers/Pages & Node).
// Diportasi dari Voiceover/worker/lib/qris-svg.js.

import qrcode from './qrcode-vendor.js';

/**
 * Bangun SVG QR dari teks payload QRIS.
 * - EC level 'M' (konvensi QRIS), versi otomatis (typeNumber 0).
 * - Modul digambar sebagai satu <path> tajam agar ukuran kecil dan rapi saat di-scale.
 */
export function qrSvg(text, opts = {}) {
  const payload = String(text == null ? '' : text);
  if (!payload) {
    throw Object.assign(new Error('Payload QR kosong'), { code: 'empty_payload', status: 400 });
  }
  const margin = Number.isFinite(Number(opts.margin)) ? Math.max(0, Math.floor(Number(opts.margin))) : 4;
  const size = Number.isFinite(Number(opts.size)) ? Math.max(64, Math.floor(Number(opts.size))) : 320;
  const darkColor = opts.dark || '#000000';
  const lightColor = opts.light || '#ffffff';

  let qr;
  try {
    qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
  } catch (e) {
    throw Object.assign(
      new Error('Payload melebihi kapasitas QR: ' + (e && e.message ? e.message : String(e))),
      { code: 'qr_capacity', status: 422 }
    );
  }

  const count = qr.getModuleCount();
  const total = count + margin * 2;
  const modules = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      modules.push(`M${col + margin} ${row + margin}h1v1h-1z`);
    }
  }

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '"' +
    ' viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="QRIS">' +
    '<rect width="' + total + '" height="' + total + '" fill="' + lightColor + '"/>' +
    '<path d="' + modules.join('') + '" fill="' + darkColor + '"/>' +
    '</svg>'
  );
}

/** Response HTTP SVG standar dengan header keamanan ketat (no-store + nosniff + sandbox CSP). */
export function qrSvgResponse(svg, status = 200) {
  return new Response(svg, {
    status,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Referrer-Policy': 'no-referrer'
    }
  });
}
