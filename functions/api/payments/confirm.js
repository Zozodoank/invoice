// functions/api/payments/confirm.js  ->  POST /api/payments/confirm
// Called by MACRODROID on the merchant's phone — NOT by the browser. There is
// no session here: the request must carry the shared secret header
// `X-Payment-Key: <PAYMENT_WEBHOOK_SECRET>`.
// Body { amount } = the exact rupiah amount seen in the bank/e-wallet
// notification (base price + 2/3 unique suffix digits). A matching pending
// payment is marked 'paid' and its document loses the watermark
// (has_watermark=0 on the doc row — which /api/export/verify already trusts).

import { FIELDS } from '../../_shared/docstore.js';
import { secureCompare, expireStalePayments, parseCreditCount } from '../../_shared/billing.js';
import { json, unauthorized } from '../../_shared/util.js';
import { parseAmountsFromBody } from '../../_shared/notif.js';

export async function onRequestPost(context) {
  const secret = context.env.PAYMENT_WEBHOOK_SECRET || '';
  if (!secret) {
    return json({ error: 'Server belum dikonfigurasi (PAYMENT_WEBHOOK_SECRET).' }, 500);
  }
  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Body tidak valid.' }, 400); }
  body = body && typeof body === 'object' ? body : {};

  // Kunci: header X-Payment-Key ATAU x-macrodroid-key (atau body.key, format makro MacroDroid).
  const key = context.request.headers.get('X-Payment-Key')
    || context.request.headers.get('x-macrodroid-key')
    || (typeof body.key === 'string' ? body.key : '');
  if (!secureCompare(key, secret)) return unauthorized('Kunci pembayaran salah.');

  // Nominal: body.amount (eksplisit) dan/atau diekstrak dari body.notification_text.
  const candidates = parseAmountsFromBody(body);
  if (!candidates.length) {
    return json({ error: 'Nominal tidak valid.' }, 400);
  }

  // Pembayaran yang lewat masa berlaku (30 menit) tidak boleh lagi dicocokkan.
  await expireStalePayments(context.env.DB);
  let payment = null;
  let amount = candidates[0];
  for (const cand of candidates) {
    payment = await context.env.DB
      .prepare("SELECT * FROM document_payments WHERE total_amount = ? AND status = 'pending'")
      .bind(cand)
      .first();
    if (payment) { amount = cand; break; }
  }
  if (!payment) {
    return json({ matched: false }, 200, { 'Cache-Control': 'no-store' });
  }

  // Update atomik dengan guard `AND status = 'pending'` agar webhook ganda tidak mengkredit dua kali.
  const upd = await context.env.DB
    .prepare("UPDATE document_payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
    .bind(payment.id).run();
  if (!upd || !upd.meta || Number(upd.meta.changes) !== 1) {
    return json({ matched: false }, 200, { 'Cache-Control': 'no-store' });
  }

  // Kredit Per Aksi: tambahkan +N kredit cetak/unduh ke pengguna (1 atau jumlah paket)
  const creditsAdded = parseCreditCount(payment.doc_type, payment.doc_id);
  await context.env.DB
    .prepare("UPDATE users SET print_credits = COALESCE(print_credits, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(creditsAdded, payment.user_id).run();

  const cfg = FIELDS[payment.doc_type];
  if (cfg && payment.doc_id && !/^credit(?::\d+)?$/.test(payment.doc_id)) {
    await context.env.DB
      .prepare(`UPDATE ${cfg.table} SET has_watermark = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
      .bind(payment.doc_id, payment.user_id).run();
  }

  return json({
    matched: true,
    paymentId: payment.id,
    docId: payment.doc_id,
    credited: true,
    creditsAdded,
    amount
  }, 200, { 'Cache-Control': 'no-store' });
}
