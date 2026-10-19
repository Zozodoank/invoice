// functions/api/admin/users.js  ->  GET /api/admin/users | POST /api/admin/users
// SUPERADMIN ONLY. All writes go to D1; role/superadmin are NEVER taken from the body.

import { requireSuperadmin, badRequest } from '../../_shared/guards.js';
import { findUserByEmail } from '../../_shared/users.js';
import { newId, json } from '../../_shared/util.js';

const COLUMNS = 'id, email, name, company, phone, plan, subscription_status, subscription_expires_at, is_lifetime, effective_price, billing_interval, is_active, is_superadmin, notes, created_at';
// Aggregate every document a user has created (invoice + kwitansi + surat jalan).
const DOC_COUNT = `(SELECT COUNT(*) FROM invoices WHERE user_id = users.id)
                 + (SELECT COUNT(*) FROM kwitansis WHERE user_id = users.id)
                 + (SELECT COUNT(*) FROM surat_jalans WHERE user_id = users.id)`;
const SELECT_LIST = `SELECT ${COLUMNS}, ${DOC_COUNT} AS invoices_count FROM users`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestGet(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();

  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await context.env.DB
      .prepare(`${SELECT_LIST} WHERE lower(email) LIKE ? OR lower(name) LIKE ? OR lower(company) LIKE ? ORDER BY created_at DESC LIMIT 500`)
      .bind(like, like, like).all();
  } else {
    rows = await context.env.DB
      .prepare(`${SELECT_LIST} ORDER BY created_at DESC LIMIT 500`).all();
  }
  return json(rows.results || [], 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPost(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { return badRequest('Body tidak valid.'); }
  const email = (body.email || '').toLowerCase().trim();
  const name = (body.name || '').trim();

  if (!EMAIL_RE.test(email)) return badRequest('Format email tidak valid.');
  if (!name) return badRequest('Nama wajib diisi.');

  const existing = await findUserByEmail(context.env.DB, email);
  if (existing) return json({ error: 'Email sudah terdaftar.' }, 409);

  const plan = ['free', 'pro', 'enterprise'].includes(body.plan) ? body.plan : 'free';
  const id = newId('usr');
  // is_superadmin is intentionally NOT accepted here — only the seed sets it.
  await context.env.DB
    .prepare(`INSERT INTO users (id, email, name, company, phone, plan, is_active)
              VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .bind(id, email, name, body.company || null, body.phone || null, plan).run();

  const user = await context.env.DB.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).bind(id).first();
  return json(user, 201);
}
