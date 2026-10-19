// functions/api/entitlements.js  ->  GET /api/entitlements
// Pure DB-derived watermark/trial snapshot for the signed-in user.

import { requireAuth } from '../_shared/guards.js';
import { computeEntitlement } from '../_shared/entitlements.js';
import { json, unauthorized } from '../_shared/util.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const ent = computeEntitlement(auth.user, context.data.superadminEmail);
  return json({
    plan: ent.plan,
    role: ent.role,
    isSuperadmin: ent.isSuperadmin,
    isPaid: ent.isPaid,
    hasWatermark: ent.hasWatermark,
    trial: ent.trial,
    expiresAt: ent.expiresAt
  }, 200, { 'Cache-Control': 'no-store' });
}
