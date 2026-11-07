// functions/api/payments/status.js  ->  POST /api/payments/status
// Body { id } (payment id). The client polls this while the QRIS modal is open.
// Only the owning user may read their own payment rows (404 otherwise).

import { requireAuth, badRequest } from '../../_shared/guards.js';
import { expireStalePayments, paymentExpiresAt } from '../../_shared/billing.js';
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
    .prepare('SELECT id, status, total_amount, created_at FROM document_payments WHERE id = ? AND user_id = ?')
    .bind(id, auth.user.id)
    .first();
  if (!row) return json({ error: 'Pembayaran tidak ditemukan.' }, 404);

  return json({ status: row.status, totalAmount: row.total_amount, expiresAt: paymentExpiresAt(row) }, 200, { 'Cache-Control': 'no-store' });
}
