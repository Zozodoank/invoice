// functions/api/auth/google.js  ->  POST /api/auth/google
// Body: { credential } (Google ID token from GIS). Verifies server-side, upserts the
// user, then issues an HttpOnly signed session cookie. Role/plan come ONLY from DB.

import { verifyGoogleIdToken } from '../../_shared/google.js';
import { upsertUserFromGoogle, publicUserWithEntitlement } from '../../_shared/users.js';
import { sessionFromUser, SESSION_MAX_AGE } from '../../_shared/session.js';
import { signToken, json, sessionCookie } from '../../_shared/util.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let credential;
  try {
    const body = await request.json();
    credential = body.credential;
  } catch { /* ignore */ }
  if (!credential) return json({ error: 'Kredensial Google tidak ada.' }, 400);
  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) {
    return json({ error: 'Konfigurasi server tidak lengkap.' }, 500);
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  } catch (e) {
    // Never leak the email/claims in the error to the client.
    return json({ error: 'Login gagal. Coba lagi.' }, 401);
  }

  const superadminEmail = (env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
  const user = await upsertUserFromGoogle(env.DB, payload);
  if (!user) return json({ error: 'Login gagal. Coba lagi.' }, 500);

  if (Number(user.is_active) === 0) {
    return json({ error: 'Akun dinonaktifkan. Hubungi admin.' }, 403);
  }

  const session = { ...sessionFromUser(user, superadminEmail), exp: Date.now() + SESSION_MAX_AGE * 1000 };
  const token = await signToken(session, env.SESSION_SECRET);

  return json(
    publicUserWithEntitlement(user, superadminEmail),
    200,
    { 'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE), 'Cache-Control': 'no-store' }
  );
}
