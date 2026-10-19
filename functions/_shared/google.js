// functions/_shared/google.js
// Verify Google Identity Services ID tokens server-side (RS256 against Google JWKS).
// Never trust a token the client merely "decoded".

import { b64urlDecodeToString, b64urlToBytes } from './util.js';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

// Very small module-scope cache; reused across requests within the same isolate.
let jwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 1000 * 60 * 60; // 1 hour

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('Gagal mengambil JWKS Google');
  const data = await res.json();
  jwksCache = { keys: data.keys || [], fetchedAt: now };
  return jwksCache.keys;
}

/**
 * Verify a Google ID token. Returns the decoded payload on success, throws on failure.
 */
export async function verifyGoogleIdToken(idToken, clientId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Format token tidak valid');
  const [b64Header, b64Payload, b64Sig] = parts;

  const header = JSON.parse(b64urlDecodeToString(b64Header));
  const payload = JSON.parse(b64urlDecodeToString(b64Payload));

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Algoritma token tidak didukung');

  const keys = await getJwks();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('Key token tidak ditemukan');

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );

  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key,
    b64urlToBytes(b64Sig),
    new TextEncoder().encode(`${b64Header}.${b64Payload}`)
  );
  if (!signatureValid) throw new Error('Tanda tangan token tidak valid');

  // Claim validation.
  if (!ISSUERS.has(payload.iss)) throw new Error('Issuer token tidak dikenal');
  if (payload.aud !== clientId) throw new Error('Audience token tidak cocok');
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token kedaluwarsa');
  if (!payload.email) throw new Error('Email tidak ada pada token');
  if (payload.email_verified !== true) throw new Error('Email belum terverifikasi');

  return payload;
}
