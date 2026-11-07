// functions/_shared/notif.js
// Ekstrak kandidat nominal rupiah dari teks notifikasi dana masuk (dikirim MacroDroid).
// Diportasi dari Voiceover/worker/lib/qris.js (parseAmountsFromBody) dan diperketat:
// angka polos (mis. no. referensi) hanya dipakai bila notifikasi TIDAK memuat pola "Rp/IDR".

export const MIN_CANDIDATE_AMOUNT = 1000;

/** "50.037,00" -> 50037, "50,037" -> 50037, "1.037" -> 1037 */
function normalizeAmountToken(token) {
  let s = String(token == null ? '' : token).replace(/[^\d.,]/g, '');
  if (!s) return '';
  const cut = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const tail = cut > 0 ? s.length - cut - 1 : 0;
  if (cut > 0 && tail > 0 && tail <= 2) s = s.slice(0, cut); // pecahan (",00")
  return s.replace(/[.,]/g, '');
}

/**
 * @param {{amount?:any, notification_text?:string, text?:string, message?:string}} body
 * @returns {number[]} kandidat nominal unik, berurutan prioritas
 */
export function parseAmountsFromBody(body) {
  const rawText = String((body && (body.notification_text || body.text || body.message)) || '').slice(0, 2000);
  const out = [];
  const push = (v) => {
    const digits = normalizeAmountToken(v);
    if (!digits || digits.length > 9) return;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n) || n < MIN_CANDIDATE_AMOUNT || n > 10000000 || out.includes(n)) return;
    out.push(n);
  };

  if (body && body.amount != null) push(body.amount);

  const rp = /(?:Rp|IDR)\.?\s*([\d.,]{3,20})/gi;
  let m; let found = false;
  while ((m = rp.exec(rawText)) !== null) { found = true; push(m[1]); }

  if (!found) {
    const plain = rawText.replace(/[.,]/g, '').match(/\d{4,9}/g) || [];
    plain.forEach(push);
  }
  return out;
}

