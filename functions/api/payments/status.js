// functions/api/payments/status.js  ->  POST /api/payments/status
// Body { id } (payment id). The client polls this while the QRIS modal is open.
// Only the owning user may read their own payment rows (404 otherwise).

import { requireAuth, badRequest } from '../../_shared/guards.js';
import { expireStalePayments, paymentExpiresAt, parseCreditCount } from '../../_shared/billing.js';
import { json } from '../../_shared/util.js';

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const id = body.id ? String(body.id) : '';
  if (!id) return badRequest('id pembayaran wajib diisi.');

  await expireStalePayments(context.env.DB); // pending > 30 menit -> expired
  const row = await context.env.DB
    .prepare('SELECT id, doc_type, doc_id, base_amount, suffix, total_amount, status, created_at FROM document_payments WHERE id = ? AND user_id = ?')
    .bind(id, auth.user.id)
    .first();
  if (!row) return json({ error: 'Pembayaran tidak ditemukan.' }, 404);

  const userRow = await context.env.DB
    .prepare('SELECT print_credits FROM users WHERE id = ?')
    .bind(auth.user.id)
    .first();

  return json({
    status: row.status,
    totalAmount: row.total_amount,
    baseAmount: row.base_amount,
    suffix: row.suffix,
    creditsGranted: parseCreditCount(row.doc_type, row.doc_id),
    printCredits: userRow && typeof userRow.print_credits === 'number' ? userRow.print_credits : 0,
    expiresAt: paymentExpiresAt(row)
  }, 200, { 'Cache-Control': 'no-store' });
}
