// functions/_shared/util.js
// Shared helpers for Cloudflare Pages Functions.
// Files/folders prefixed with "_" are NOT routed as endpoints, so this is safe to colocate.

const enc = new TextEncoder();
const dec = new TextDecoder();

/** base64url encode bytes/string */
export function b64url(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url decode to string */
export function b64urlDecodeToString(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

/** base64url decode to raw bytes */
export function b64urlToBytes(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Import an HMAC key from a secret string. */
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

/** Sign a session payload object -> token string (payload.signature), both base64url. */
export async function signToken(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/** Verify a token string -> payload object, or null when invalid/expired. */
export async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlToBytes(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecodeToString(body));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Parse the "session" cookie value out of a request Cookie header. */
export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function sessionCookie(token, maxAgeSeconds) {
  return `session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/** JSON response helpers. */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

export function unauthorized(msg = 'Tidak terautentikasi') {
  return json({ error: msg }, 401);
}

export function forbidden(msg = 'Akses ditolak') {
  return json({ error: msg }, 403);
}

/** Generate a reasonably unique id with a given prefix. */
export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(crypto.getRandomValues(new Uint8Array(6))
    .reduce((a, b) => a + b.toString(36), ''))}`;
}
