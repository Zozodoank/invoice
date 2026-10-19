// functions/api/auth/logout.js  ->  POST /api/auth/logout
// Clears the session cookie.

import { clearSessionCookie, json } from '../../_shared/util.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, {
    'Set-Cookie': clearSessionCookie(),
    'Cache-Control': 'no-store'
  });
}
