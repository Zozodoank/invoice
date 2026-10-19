// functions/api/admin/payments.js  ->  GET /api/admin/payments
// SUPERADMIN ONLY. Per-document QRIS payment stats + the 200 most recent rows,
// shown on the "Tarif & QRIS" card of the dashboard.

import { requireSuperadmin } from '../../_shared/guards.js';
import { json } from '../../_shared/util.js';

const COLUMNS = 'id, user_id, doc_type, doc_id, base_amount, suffix, total_amount, status, created_at, paid_at';

export async function onRequestGet(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const agg = await context.env.DB
    .prepare("SELECT COUNT(*) AS total_paid, COALESCE(SUM(base_amount), 0) AS revenue FROM document_payments WHERE status = 'paid'")
    .first();
  const pend = await context.env.DB
    .prepare("SELECT COUNT(*) AS pending FROM document_payments WHERE status = 'pending'")
    .first();
  const recent = await context.env.DB
    .prepare(`SELECT ${COLUMNS} FROM document_payments ORDER BY created_at DESC LIMIT 200`)
    .all();

  return json({
    totalPaid: Number(agg && agg.total_paid) || 0,
    revenue: Number(agg && agg.revenue) || 0,
    pendingCount: Number(pend && pend.pending) || 0,
    recent: recent.results || []
  }, 200, { 'Cache-Control': 'no-store' });
}
