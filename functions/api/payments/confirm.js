// functions/api/payments/confirm.js  ->  POST /api/payments/confirm
// Called by MACRODROID on the merchant's phone — NOT by the browser. There is
// no session here: the request must carry the shared secret header
// `X-Payment-Key: <PAYMENT_WEBHOOK_SECRET>`.
// Body { amount } = the exact rupiah amount seen in the bank/e-wallet
// notification (base price + 2 unique suffix digits). A matching pending
// payment is marked 'paid' and its document loses the watermark
// (has_watermark=0 on the doc row — which /api/export/verify already trusts).

import { FIELDS } from '../../_shared/docstore.js';
import { secureCompare } from '../../_shared/billing.js';
import { json, unauthorized } from '../../_shared/util.js';

export async function onRequestPost(context) {
  const secret = context.env.PAYMENT_WEBHOOK_SECRET || '';
  if (!secret) {
    return json({ error: 'Server belum dikonfigurasi (PAYMENT_WEBHOOK_SECRET).' }, 500);
  }
  const key = context.request.headers.get('X-Payment-Key') || '';
  if (!secureCompare(key, secret)) return unauthorized('Kunci pembayaran salah.');

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Body tidak valid.' }, 400); }
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000000) {
    return json({ error: 'Nominal tidak valid.' }, 400);
  }

  const payment = await context.env.DB
    .prepare("SELECT * FROM document_payments WHERE total_amount = ? AND status = 'pending'")
    .bind(amount)
    .first();
  if (!payment) {
    return json({ matched: false }, 200, { 'Cache-Control': 'no-store' });
  }

  await context.env.DB
    .prepare("UPDATE document_payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(payment.id).run();

  const cfg = FIELDS[payment.doc_type];
  if (cfg) {
    await context.env.DB
      .prepare(`UPDATE ${cfg.table} SET has_watermark = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
      .bind(payment.doc_id, payment.user_id).run();
  }

  return json({ matched: true, paymentId: payment.id, docId: payment.doc_id }, 200, { 'Cache-Control': 'no-store' });
}
