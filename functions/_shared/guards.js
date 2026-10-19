// functions/_shared/guards.js
// Central authorization helpers used by API endpoints.
// Role/plan/ownership ALWAYS come from the verified session + a fresh DB row,
// never from the request body -> prevents privilege escalation & IDOR, and makes
// disabling `is_superadmin`/`is_active` revoke access on the NEXT request.

import { json, unauthorized, forbidden } from './util.js';
import { findUserById } from './users.js';

/**
 * Require an authenticated, still-active session.
 * Returns { session, user } or a 401/403 Response.
 */
export async function requireAuth(context) {
  const session = context.data && context.data.session;
  if (!session || !session.uid) return unauthorized('Anda harus login.');
  const user = await findUserById(context.env.DB, session.uid);
  if (!user) return unauthorized('Sesi tidak dikenali. Silakan login ulang.');
  if (Number(user.is_active) === 0) return forbidden('Akun dinonaktifkan.');
  return { session, user };
}

/** Require a superadmin (re-checked against DB). Returns { session, user } or a Response. */
export async function requireSuperadmin(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const email = (auth.user.email || '').toLowerCase().trim();
  const isSuper = Number(auth.user.is_superadmin) === 1 &&
    email === (context.data.superadminEmail || '');
  if (!isSuper) return forbidden('Hanya superadmin yang boleh mengakses.');
  return auth;
}

/** The user id ALL document queries must be scoped to (from session, never body). */
export async function scopedUserId(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  return auth.user.id;
}

/** `const bad = badRequest('...'); if (bad) return bad;` */
export function badRequest(msg) {
  return json({ error: msg || 'Data tidak valid.' }, 400);
}
