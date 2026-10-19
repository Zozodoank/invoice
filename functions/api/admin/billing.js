// functions/api/admin/billing.js  ->  GET /api/admin/billing | POST /api/admin/billing
// SUPERADMIN ONLY. Per-document pricing (promo vs normal), promo window and the
// static QRIS image/note. Only whitelisted columns are written; the effective
// price is always recomputed server-side.

import { requireSuperadmin, badRequest } from '../../_shared/guards.js';
import { getBillingConfig, billingToCamel } from '../../_shared/billing.js';
import { json } from '../../_shared/util.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const QRIS_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

export async function onRequestGet(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;
  const cfg = await getBillingConfig(context.env.DB);
  return json(billingToCamel(cfg), 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPost(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { return badRequest('Body tidak valid.'); }

  const price = (v, dflt) => {
    if (v === undefined || v === null || v === '') return dflt;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 1000000) return null; // invalid
    return n;
  };
  const dateOrNull = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const s = String(v).slice(0, 10);
    return DATE_RE.test(s) ? s : undefined; // undefined = invalid marker
  };

  const pricePromo = price(body.pricePromo, undefined);
  const priceNormal = price(body.priceNormal, undefined);
  if (pricePromo === null || priceNormal === null) return badRequest('Harga harus angka 0 - 1.000.000.');
  const promoStart = dateOrNull(body.promoStart);
  const promoEnd = dateOrNull(body.promoEnd);
  if (promoStart === undefined || promoEnd === undefined) return badRequest('Format tanggal promo harus YYYY-MM-DD.');
  if (promoStart && promoEnd && promoEnd < promoStart) return badRequest('Tanggal akhir promo tidak boleh sebelum tanggal mulai.');

  let qrisImage;
  if (body.qrisImage === null || body.qrisImage === '') {
    qrisImage = null;
  } else if (body.qrisImage !== undefined) {
    qrisImage = String(body.qrisImage);
    if (qrisImage.length > 300000 || !QRIS_RE.test(qrisImage)) {
      return badRequest('Gambar QRIS harus PNG/JPEG data-URL maksimal ~300 KB.');
    }
  }
  const qrisNote = body.qrisNote === undefined || body.qrisNote === null
    ? undefined : String(body.qrisNote).slice(0, 500);

  const cur = await getBillingConfig(context.env.DB);
  const rec = {
    price_promo: pricePromo !== undefined ? pricePromo : Number(cur.price_promo),
    price_normal: priceNormal !== undefined ? priceNormal : Number(cur.price_normal),
    promo_active: body.promoActive === undefined ? Number(cur.promo_active) : (body.promoActive === true || body.promoActive === 1 || body.promoActive === '1' ? 1 : 0),
    promo_start: promoStart !== undefined ? promoStart : (cur.promo_start || null),
    promo_end: promoEnd !== undefined ? promoEnd : (cur.promo_end || null),
    qris_image: qrisImage !== undefined ? qrisImage : (cur.qris_image || null),
    qris_note: qrisNote !== undefined ? qrisNote : (cur.qris_note || null)
  };

  await context.env.DB
    .prepare(`UPDATE billing_config SET price_promo=?, price_normal=?, promo_active=?,
              promo_start=?, promo_end=?, qris_image=?, qris_note=?, updated_at=CURRENT_TIMESTAMP
              WHERE id='default'`)
    .bind(rec.price_promo, rec.price_normal, rec.promo_active, rec.promo_start, rec.promo_end,
          rec.qris_image, rec.qris_note).run();

  const cfg = await getBillingConfig(context.env.DB);
  return json(billingToCamel(cfg), 200, { 'Cache-Control': 'no-store' });
}
