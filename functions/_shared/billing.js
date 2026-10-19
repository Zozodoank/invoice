// functions/_shared/billing.js
// Server-authoritative per-document pricing (promo vs normal), static-QRIS
// payment intents with a unique 2-digit amount suffix, and paid-document lookup.
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
  qris_note: null
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

/**
 * Create (or reuse) a pending payment for one document.
 * Suffix = 2 unique digits appended to the price so a STATIC QRIS notification
 * amount identifies which document was paid (e.g. 1000 + 37 -> pay Rp 1.037).
 * @returns {{ payment, config }} — throws { status: 503 } when all suffixes are busy.
 */
export async function createPaymentIntent(db, user, docType, docId) {
  const existing = await db
    .prepare("SELECT * FROM document_payments WHERE doc_type = ? AND doc_id = ? AND user_id = ? AND status = 'pending'")
    .bind(docType, docId, user.id)
    .first();
  if (existing) return { payment: existing, config: await getBillingConfig(db) };

  // Reclaim suffix slots: pendings older than 24h are considered abandoned.
  await db
    .prepare("UPDATE document_payments SET status = 'expired' WHERE status = 'pending' AND created_at < datetime('now', '-24 hours')")
    .run();

  const cfg = await getBillingConfig(db);
  const base = selectEffectivePrice(cfg);

  // total_amount is UNIQUE for the whole table (it is the match key for a static
  // QRIS notification), so a new intent must avoid the amount of EVERY live row,
  // paid ones included — only 'expired' rows release their slot.
  const taken = new Set();
  const { results } = await db
    .prepare("SELECT total_amount FROM document_payments WHERE status IN ('pending', 'paid')")
    .bind()
    .all();
  for (const r of results || []) taken.add(Number(r.total_amount));

  const avail = [];
  for (let s = 10; s <= 99; s++) if (!taken.has(base + s)) avail.push(s);
  if (avail.length === 0) {
    throw Object.assign(new Error('Slot pembayaran penuh, coba lagi beberapa saat.'), { status: 503 });
  }
  const suffix = avail[Math.floor(Math.random() * avail.length)];

  const id = newId('pay');
  await db
    .prepare(`INSERT INTO document_payments (id, user_id, doc_type, doc_id, base_amount, suffix, total_amount, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`)
    .bind(id, user.id, docType, docId, base, suffix, base + suffix)
    .run();

  const payment = await db.prepare('SELECT * FROM document_payments WHERE id = ?').bind(id).first();
  return { payment, config: cfg };
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
