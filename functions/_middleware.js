// functions/_middleware.js
// Runs for every request handled by Pages Functions.
// Its ONLY job: parse + verify the session cookie into context.data.session
// and expose request-scoped helpers. It does NOT block static assets.

import { readSession } from './_shared/session.js';

export async function onRequest(context) {
  // readSession returns the signed payload { uid, email, role, plan, exp } or null.
  context.data.session = await readSession(context.request, context.env);
  // Superadmin email is a server-only secret; expose to handlers via data (not client).
  context.data.superadminEmail = (context.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
  return await context.next();
}
