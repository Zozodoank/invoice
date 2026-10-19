// functions/api/admin/users/[id]/plan.js  ->  POST /api/admin/users/:id/plan
// SUPERADMIN ONLY. Set a user's plan, billing interval, negotiated price and expiry.
// Expiry math uses addMonths() with end-of-month clamp. Lifetime is a real flag
// (is_lifetime=1 / expiresAt=null) — the old "2099" sentinel is not used.

import { requireSuperadmin, badRequest } from '../../../../_shared/guards.js';
import { findUserById } from '../../../../_shared/users.js';
import { json } from '../../../../_shared/util.js';

const PLANS = new Set(['free', 'pro', 'enterprise']);
const INTERVALS = new Set(['month', 'year']);

/** Add `months` to an ISO date string, clamping to the last day of the target month. */
function addMonths(dateStr, months) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 19).replace('T', ' ');
}

export async function onRequestPost(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const target = await findUserById(context.env.DB, context.params.id);
  if (!target) return json({ error: 'Pengguna tidak ditemukan.' }, 404);

  let body;
  try { body = await context.request.json(); } catch { return badRequest('Body tidak valid.'); }

  const plan = PLANS.has(body.plan) ? body.plan : (target.plan || 'free');
  const interval = INTERVALS.has(body.billingInterval) ? body.billingInterval : (target.billing_interval || 'month');
  const isLifetime = plan !== 'free' && body.isLifetime === true;
  const price = Math.max(0, Math.round(Number(body.effectivePrice) || 0));

  let status = 'inactive';
  let expiresAt = null;
  if (plan !== 'free') {
    status = 'active';
    if (isLifetime) {
      expiresAt = null; // lifetime => no expiry date rendered
    } else if (body.subscriptionExpiresAt) {
      const d = new Date(body.subscriptionExpiresAt);
      expiresAt = Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
    } else {
      const months = interval === 'year' ? 12 : 1;
      expiresAt = addMonths(new Date().toISOString(), months);
    }
  }

  await context.env.DB
    .prepare(`UPDATE users
              SET plan = ?, billing_interval = ?, is_lifetime = ?, effective_price = ?,
                  subscription_status = ?, subscription_expires_at = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`)
    .bind(plan, interval, isLifetime ? 1 : 0, price, status, expiresAt, target.id).run();

  const user = await findUserById(context.env.DB, target.id);
  return json({
    ok: true, id: user.id, plan: user.plan, billingInterval: user.billing_interval,
    isLifetime: Number(user.is_lifetime) === 1, effectivePrice: user.effective_price,
    subscriptionStatus: user.subscription_status, subscriptionExpiresAt: user.subscription_expires_at
  });
}
