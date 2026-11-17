// functions/api/payments/qr/[id].js  ->  GET /api/payments/qr/:id?s=token
// Render SVG QRIS dinamis (nominal terkunci di tag 54) untuk satu baris pembayaran.
// Akses: token HMAC query `?s=...` ATAU cookie sesi milik user pemilik pembayaran (parity dengan Voiceover).

import { getBillingConfig, resolveEffectiveStaticPayload, expireStalePayments, secureCompare } from '../../../_shared/billing.js';
import { buildDynamicQris } from '../../../_shared/qris-emv.js';
import { qrSvg, qrSvgResponse } from '../../../_shared/qris-svg.js';
import { json, signQrToken } from '../../../_shared/util.js';

export async function onRequestGet(context) {
  const id = context.params && context.params.id ? String(context.params.id) : '';
  if (!id) return json({ error: 'order_expired', message: 'ID pembayaran tidak valid.' }, 404);

  await expireStalePayments(context.env.DB);
  const payment = await context.env.DB
    .prepare('SELECT id, user_id, total_amount, status FROM document_payments WHERE id = ?')
    .bind(id)
    .first();
  if (!payment || payment.status === 'expired') {
    return json({ error: 'order_expired', message: 'Pembayaran tidak ditemukan atau sudah kedaluwarsa.' }, 404);
  }

  const url = new URL(context.request.url);
  const suppliedToken = url.searchParams.get('s') || '';
  const expectedToken = await signQrToken(payment.id, payment.user_id, context.env.SESSION_SECRET);
  const sessionUser = context.data && context.data.user ? context.data.user : null;

  const allowed = (suppliedToken && secureCompare(suppliedToken, expectedToken))
    || (sessionUser && sessionUser.uid === payment.user_id);
  if (!allowed) {
    return json({ error: 'forbidden', message: 'Tidak berhak mengakses QRIS pembayaran ini.' }, 403);
  }

  const cfg = await getBillingConfig(context.env.DB);
  const eff = resolveEffectiveStaticPayload(cfg, context.env);
  if (!eff.payload) {
    return json({ error: 'dynamic_qris_not_configured', message: 'QRIS dinamis belum diaktifkan.' }, 409);
  }

  try {
    const dyn = buildDynamicQris(eff.payload, payment.total_amount);
    const size = Math.min(512, Math.max(120, Math.round(Number(url.searchParams.get('size')) || 320)));
    return qrSvgResponse(qrSvg(dyn, { size }));
  } catch (e) {
    if (e && e.code === 'qr_capacity') {
      return json({ error: 'qr_capacity', message: 'Payload QRIS melebihi kapasitas QR.' }, 422);
    }
    return json({ error: 'qris_build_failed', message: String(e && e.message ? e.message : e) }, 400);
  }
}
