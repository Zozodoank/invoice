// functions/_shared/session.js
import { getCookie, verifyToken } from './util.js';

const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours
export { SESSION_MAX_AGE };

/**
 * Read and verify the signed session cookie. Returns the session payload or null.
 * session: { uid, email, role, plan, exp }
 */
export async function readSession(request, env) {
  const token = getCookie(request, 'session');
  if (!token) return null;
  return await verifyToken(token, env.SESSION_SECRET);
}

/**
 * Build a session payload object from a DB user row + superadmin secret.
 */
export function sessionFromUser(user, superadminEmail) {
  const email = (user.email || '').toLowerCase().trim();
  const isSuper = Number(user.is_superadmin) === 1 &&
    (!superadminEmail || email === superadminEmail.toLowerCase().trim());
  return {
    uid: user.id,
    email,
    role: isSuper ? 'superadmin' : 'user',
    plan: isSuper ? 'enterprise' : (user.plan || 'free')
  };
}
