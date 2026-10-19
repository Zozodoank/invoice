// functions/api/config.js  ->  GET /api/config
// Returns only PUBLIC configuration. Never returns secrets or the admin email.
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    clientId: env.GOOGLE_CLIENT_ID || '',
    tz: env.TZ || 'Asia/Jakarta'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
