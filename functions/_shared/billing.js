// functions/_shared/billing.js
// Server-authoritative per-document pricing (promo vs normal), dynamic-QRIS
// payment intents with a unique 2-digit (3-digit when full) amount suffix, and paid-document lookup.
// The browser never decides prices or payment state — it only renders what the
// server returns. Files/folders prefixed with "_" are NOT routed as endpoints.

import { newId } from './util.js';

const DEFAULTS = {
  id: 'default',
  price_promo: 1000,
  price_normal: 2000,
  promo_active: 1,
  promo_start: null,
  promo_end: null,
  qris_image: null,
  qris_note: null,
  qris_static_payload: null
};

/** Read the single billing_config row (falls back to seeded defaults). */
export async function getBillingConfig(db) {
  const row = await db.prepare('SELECT * FROM billing_config WHERE id = ?').bind('default').first();
  return row || { ...DEFAULTS };
}

/** Current calendar date (YYYY-MM-DD) in Asia/Jakarta — matches the app's TZ. */
export function jakartaDate(now = new Date()) {
  // en-CA formats as ISO YYYY-MM-DD; timeZone fixed per product spec (not UTC).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

/**
 * Pure: effective per-document price right now.
 * Promo applies only when promo_active=1 AND the Jakarta date sits inside the
 * (inclusive, optionally open-ended) window. String compare of YYYY-MM-DD.
 */
export function selectEffectivePrice(cfg, now = new Date()) {
  const promo = Number(cfg.promo_active) === 1;
  if (!promo) return Number(cfg.price_normal) || 0;
  const today = jakartaDate(now);
  if (cfg.promo_start && today < String(cfg.promo_start)) return Number(cfg.price_normal) || 0;
  if (cfg.promo_end && today > String(cfg.promo_end)) return Number(cfg.price_normal) || 0;
  return Number(cfg.price_promo) || 0;
}

/** camelCase view of the config row (API contract). */
export function billingToCamel(cfg) {
  return {
    pricePromo: Number(cfg.price_promo) || 0,
    priceNormal: Number(cfg.price_normal) || 0,
    promoActive: Number(cfg.promo_active) === 1,
    promoStart: cfg.promo_start || null,
    promoEnd: cfg.promo_end || null,
    qrisImage: cfg.qris_image || null,
    qrisNote: cfg.qris_note || null,
    // Payload statis TIDAK pernah dikirim ke klien; hanya penanda bahwa QRIS dinamis aktif.
    qrisDynamic: !!cfg.qris_static_payload,
    effectivePrice: selectEffectivePrice(cfg)
  };
}

/** True when a paid QRIS confirmation already cleared this exact document. */
export async function isDocPaidClean(db, docType, docId) {
  const row = await db
    .prepare("SELECT id FROM document_payments WHERE doc_type = ? AND doc_id = ? AND status = 'paid' LIMIT 1")
    .bind(docType, docId)
    .first();
  return !!row;
}

/** Masa berlaku kode unik + QRIS dinamis per transaksi. Setelah ini baris 'pending' jadi 'expired'. */
export const PAYMENT_TTL_MINUTES = 30;

/** Percobaan ulang bila dua request berebut kode unik yang sama. */
const MAX_SUFFIX_RETRY = 5;

/** Tandai 'pending' yang lewat masa berlaku sebagai 'expired' (melepas kode uniknya). */
export async function expireStalePayments(db) {
  await db
    .prepare(`UPDATE document_payments SET status = 'expired' WHERE status = 'pending' AND created_at < datetime('now', '-${PAYMENT_TTL_MINUTES} minutes')`)
    .run();
}

/** ISO waktu kedaluwarsa dari created_at (SQLite 'YYYY-MM-DD HH:MM:SS' UTC). */
export function paymentExpiresAt(payment) {
  const created = String(payment && payment.created_at || '').replace(' ', 'T') + 'Z';
  const ms = Date.parse(created);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + PAYMENT_TTL_MINUTES * 60 * 1000).toISOString();
}

/**
 * Pure: pilih kode unik yang belum dipakai pembayaran pending lain.
 * Kode 2 digit (10..99) dipakai lebih dulu; bila semuanya penuh, jatuh ke 3 digit (100..999).
 * @param {Set<number>} taken total_amount yang sedang pending
 * @param {number} base harga dasar
 * @param {() => number} [rand] sumber acak [0,1) (bisa di-inject untuk test)
 * @returns {number|null} suffix, atau null bila 3 digit pun penuh
 */
export function pickSuffix(taken, base, rand = Math.random) {
  for (const [lo, hi] of [[10, 99], [100, 999]]) {
    const avail = [];
    for (let s = lo; s <= hi; s++) if (!taken.has(base + s)) avail.push(s);
    if (avail.length) return avail[Math.floor(rand() * avail.length)];
  }
  return null;
}

/**
 * Create (or reuse) a pending payment for one document.
 * Suffix = unique digits appended to the price so the amount in a bank/e-wallet
 * notification identifies which document was paid (e.g. 1000 + 37 -> pay Rp 1.037).
 * The pending payment lives PAYMENT_TTL_MINUTES; the same total is rendered as a
 * dynamic QRIS (see qris-emv.js), so the payer cannot change the amount.
 * @returns {{ payment, config }} — throws { status: 503 } when every suffix is busy.
 */
export async function createPaymentIntent(db, user, docType, docId) {
  // Reclaim suffix slots first so an abandoned pending is never "reused" past its TTL.
  await expireStalePayments(db);

  const existing = await db
    .prepare("SELECT * FROM document_payments WHERE doc_type = ? AND doc_id = ? AND user_id = ? AND status = 'pending'")
    .bind(docType, docId, user.id)
    .first();
  if (existing) return { payment: existing, config: await getBillingConfig(db) };

  const cfg = await getBillingConfig(db);
  const base = selectEffectivePrice(cfg);

  for (let attempt = 0; attempt < MAX_SUFFIX_RETRY; attempt++) {
    // total_amount only has to be unique among LIVE (pending) rows: it is the match key for
    // the notification amount. Paid/expired rows release their code for reuse.
    const taken = new Set();
    const { results } = await db
      .prepare("SELECT total_amount FROM document_payments WHERE status = 'pending'")
      .bind()
      .all();
    for (const r of results || []) taken.add(Number(r.total_amount));

    const suffix = pickSuffix(taken, base);
    if (suffix === null) {
      throw Object.assign(new Error('Slot pembayaran penuh, coba lagi beberapa saat.'), { status: 503 });
    }

    const id = newId('pay');
    try {
      await db
        .prepare(`INSERT INTO document_payments (id, user_id, doc_type, doc_id, base_amount, suffix, total_amount, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`)
        .bind(id, user.id, docType, docId, base, suffix, base + suffix)
        .run();
    } catch (e) {
      // Another request grabbed the same code between SELECT and INSERT (partial UNIQUE index) - retry.
      if (attempt === MAX_SUFFIX_RETRY - 1) throw e;
      continue;
    }
    const payment = await db.prepare('SELECT * FROM document_payments WHERE id = ?').bind(id).first();
    return { payment, config: cfg };
  }
  throw Object.assign(new Error('Slot pembayaran penuh, coba lagi beberapa saat.'), { status: 503 });
}
/** Constant-time-ish string compare (length + char accumulation) for the webhook secret. */
export function secureCompare(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (s1.length !== s2.length) return false;
  let diff = 0;
  for (let i = 0; i < s1.length; i++) diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
  return diff === 0;
}
