// functions/api/admin/payments.js  ->  GET /api/admin/payments
// SUPERADMIN ONLY. Per-document QRIS payment stats + the 200 most recent rows,
// shown on the "Tarif & QRIS" card of the dashboard.

import { requireSuperadmin } from '../../_shared/guards.js';
import { expireStalePayments, parseCreditCount } from '../../_shared/billing.js';
import { json } from '../../_shared/util.js';

const COLUMNS = 'p.id, p.user_id, u.email AS user_email, p.doc_type, p.doc_id, p.base_amount, p.suffix, p.total_amount, p.status, p.created_at, p.paid_at';

export async function onRequestGet(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  await expireStalePayments(context.env.DB);

  const agg = await context.env.DB
    .prepare("SELECT COUNT(*) AS total_paid, COALESCE(SUM(base_amount), 0) AS revenue FROM document_payments WHERE status = 'paid'")
    .first();
  const pend = await context.env.DB
    .prepare("SELECT COUNT(*) AS pending FROM document_payments WHERE status = 'pending'")
    .first();
  const recentRes = await context.env.DB
    .prepare(`SELECT ${COLUMNS} FROM document_payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 200`)
    .all();

  const recent = (recentRes.results || []).map((r) => ({
    ...r,
    credits_granted: parseCreditCount(r.doc_type, r.doc_id)
  }));

  return json({
    totalPaid: Number(agg && agg.total_paid) || 0,
    revenue: Number(agg && agg.revenue) || 0,
    pendingCount: Number(pend && pend.pending) || 0,
    recent
  }, 200, { 'Cache-Control': 'no-store' });
}
