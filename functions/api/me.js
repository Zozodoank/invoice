// functions/api/me.js  ->  GET /api/me
// Returns the current server-authoritative identity + entitlement (401 if no session).

import { requireAuth } from '../_shared/guards.js';
import { publicUserWithEntitlement } from '../_shared/users.js';
import { unauthorized } from '../_shared/util.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (!auth.user) return unauthorized();
  const data = publicUserWithEntitlement(auth.user, context.data.superadminEmail);
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
