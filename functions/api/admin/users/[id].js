// functions/api/admin/users/[id].js  ->  PUT /api/admin/users/:id | DELETE /api/admin/users/:id
// SUPERADMIN ONLY. Editing is limited to non-privileged profile fields.
// email, is_superadmin, plan and trial counters are NEVER editable here (plan => /plan endpoint).

import { requireSuperadmin, badRequest } from '../../../_shared/guards.js';
import { findUserById } from '../../../_shared/users.js';
import { json } from '../../../_shared/util.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPut(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const target = await findUserById(context.env.DB, context.params.id);
  if (!target) return json({ error: 'Pengguna tidak ditemukan.' }, 404);

  let body;
  try { body = await context.request.json(); } catch { return badRequest('Body tidak valid.'); }

  // Only whitelisted, non-privileged fields are accepted.
  const sets = [];
  const vals = [];
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return badRequest('Nama tidak boleh kosong.');
    sets.push('name = ?'); vals.push(name);
  }
  if (body.company !== undefined) { sets.push('company = ?'); vals.push(String(body.company || '').trim() || null); }
  if (body.phone !== undefined) { sets.push('phone = ?'); vals.push(String(body.phone || '').trim() || null); }
  if (body.notes !== undefined) { sets.push('notes = ?'); vals.push(String(body.notes || '').trim() || null); }
  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!EMAIL_RE.test(email)) return badRequest('Format email tidak valid.');
    sets.push('email = ?'); vals.push(email);
  }

  if (!sets.length) return json(target);

  vals.push(target.id);
  await context.env.DB
    .prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...vals).run();

  const user = await findUserById(context.env.DB, target.id);
  return json(user);
}

export async function onRequestDelete(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const target = await findUserById(context.env.DB, context.params.id);
  if (!target) return json({ error: 'Pengguna tidak ditemukan.' }, 404);

  // Never allow the superadmin to delete their own (or another superadmin's) account.
  if (Number(target.is_superadmin) === 1) {
    return badRequest('Akun superadmin tidak dapat dihapus.');
  }

  await context.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(target.id).run();
  return json({ ok: true });
}
