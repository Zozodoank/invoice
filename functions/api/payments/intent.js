// functions/api/payments/intent.js  ->  POST /api/payments/intent
// Ask the server for the QRIS amount to pay for ONE saved document.
// Body { type, id }. Ownership is enforced (WHERE id=? AND user_id=?).
// If the document would not be watermarked anyway (superadmin / paid plan /
// trial credit / already paid via QRIS) -> { alreadyClean: true } and nothing
// is charged. Otherwise a pending payment with a unique 2-digit suffix (3 digits
// when all 2-digit codes are busy; valid 30 minutes) is returned together with a
// DYNAMIC QRIS payload built server-side from the merchant's static payload
// (amount locked in tag 54). Without a configured payload it falls back to the
// merchant's static QRIS image.

import { requireAuth, badRequest } from '../../_shared/guards.js';
import { FIELDS } from '../../_shared/docstore.js';
import { computeEntitlement } from '../../_shared/entitlements.js';
import { createPaymentIntent, isDocPaidClean, paymentExpiresAt } from '../../_shared/billing.js';
import { buildDynamicQris } from '../../_shared/qris-emv.js';
import { json } from '../../_shared/util.js';

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const type = String(body.type || '').toLowerCase();
  const id = body.id ? String(body.id) : (type === 'credit' ? 'credit' : '');
  const forCredit = type === 'credit' || body.forCredit === true;

  if (type !== 'credit') {
    const cfgDoc = FIELDS[type];
    if (!cfgDoc) return badRequest('Tipe dokumen tidak dikenali.');
    if (!id) return badRequest('id dokumen wajib diisi.');

    // Ownership-scoped lookup — another user's document id is simply "not found".
    const doc = await context.env.DB
      .prepare(`SELECT id, has_watermark FROM ${cfgDoc.table} WHERE id = ? AND user_id = ?`)
      .bind(id, auth.user.id)
      .first();
    if (!doc) return badRequest('Dokumen tidak ditemukan.');
  }

  const ent = computeEntitlement(auth.user, context.data.superadminEmail);
  if (ent.isSuperadmin) {
    return json({ alreadyClean: true, reason: 'entitlement' }, 200, { 'Cache-Control': 'no-store' });
  }

  if (type !== 'credit' && !forCredit) {
    if (await isDocPaidClean(context.env.DB, type, id)) {
      return json({ alreadyClean: true, reason: 'paid' }, 200, { 'Cache-Control': 'no-store' });
    }
    const trialLeft = (ent.trial[{ invoice: 'invoice', kwitansi: 'kwitansi', 'surat-jalan': 'suratJalan' }[type]] ?? 0) > 0;
    if (ent.isPaid || trialLeft) {
      return json({ alreadyClean: true, reason: 'entitlement' }, 200, { 'Cache-Control': 'no-store' });
    }
  }

  try {
    const { payment, config } = await createPaymentIntent(context.env.DB, auth.user, type, id);
    let qrisPayload = null;
    if (config.qris_static_payload) {
      try {
        qrisPayload = buildDynamicQris(config.qris_static_payload, payment.total_amount);
      } catch (e) {
        // Bad static payload must never block payment: fall back to the static image.
        console.error('Dynamic QRIS build failed:', e && e.message ? e.message : String(e));
      }
    }
    return json({
      alreadyClean: false,
      payment: {
        id: payment.id,
        docId: payment.doc_id,
        baseAmount: payment.base_amount,
        suffix: payment.suffix,
        totalAmount: payment.total_amount,
        status: payment.status,
        expiresAt: paymentExpiresAt(payment)
      },
      billing: {
        qrisPayload,
        qrisImage: config.qris_image || null,
        qrisNote: config.qris_note || null
      }
    }, 200, { 'Cache-Control': 'no-store' });
  } catch (e) {
    if (e.status) return json({ error: e.message }, e.status);
    throw e;
  }
}
