/**
 * js/sanitize.js — context-aware escaping for safe innerHTML templating.
 * Load FIRST on every page (before templates run).
 */

const Sanitize = (() => {
  const ENT = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;'
  };

  // HTML text content: escape the dangerous set. Accepts null/undefined/numbers.
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`=\/]/g, c => ENT[c]);
  }

  // Attribute value (double-quoted context). Same set is safe for attributes.
  function escAttr(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`=\/]/g, c => ENT[c]);
  }

  // Allow only simple hex / rgb(a) color tokens for style interpolation.
  const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.,\s%]+\)|hsla?\(\s*[\d.,\s%deg]+\)|[a-zA-Z]+)$/;
  function safeColor(value, fallback = 'inherit') {
    if (value === null || value === undefined) return fallback;
    const s = String(value).trim();
    return COLOR_RE.test(s) ? s : fallback;
  }

  return { esc, escAttr, safeColor };
})();

/**
 * Validate an uploaded image and re-encode it to PNG via canvas, stripping any
 * embedded SVG/HTML markup (#11, #57). Resolves to a data URL or rejects.
 */
function sanitizeImageFile(file, opts = {}) {
  const maxKB = opts.maxKB || 512;
  const allowMime = opts.mime || ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Tidak ada file.'));
    if (!allowMime.includes(file.type)) return reject(new Error('Format gambar tidak didukung (pakai PNG/JPEG/WebP).'));
    if (file.size > maxKB * 1024) return reject(new Error(`Ukuran gambar terlalu besar (maks ${maxKB} KB).`));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        try {
          const maxDim = opts.maxDim || 1600;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxDim || h > maxDim) {
            const r = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) { reject(new Error('Gagal memproses gambar.')); }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Convenience globals used across templates.
if (typeof window !== 'undefined') {
  window.Sanitize = Sanitize;
  window.esc = Sanitize.esc;
  window.escAttr = Sanitize.escAttr;
  window.safeColor = Sanitize.safeColor;
  window.sanitizeImageFile = sanitizeImageFile;
}
