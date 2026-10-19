// functions/api/admin/users/[id]/status.js  ->  POST /api/admin/users/:id/status
// SUPERADMIN ONLY. Activate / suspend an account. Setting is_active=0 revokes the
// user's access on their NEXT request (guards re-read the DB row every call).

import { requireSuperadmin, badRequest } from '../../../../_shared/guards.js';
import { findUserById } from '../../../../_shared/users.js';
import { json } from '../../../../_shared/util.js';

export async function onRequestPost(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const target = await findUserById(context.env.DB, context.params.id);
  if (!target) return json({ error: 'Pengguna tidak ditemukan.' }, 404);

  let body;
  try { body = await context.request.json(); } catch { return badRequest('Body tidak valid.'); }

  const raw = body.isActive !== undefined ? body.isActive : body.status;
  if (raw === undefined) return badRequest('Status wajib diisi.');
  const activate = raw === true || raw === 1 || raw === '1' || raw === 'active';

  // Guard: never deactivate the seed superadmin (would lock everyone out of admin).
  if (!activate && Number(target.is_superadmin) === 1) {
    return badRequest('Akun superadmin tidak dapat dinonaktifkan.');
  }

  await context.env.DB
    .prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(activate ? 1 : 0, target.id).run();

  const user = await findUserById(context.env.DB, target.id);
  return json({ ok: true, id: user.id, isActive: Number(user.is_active) !== 0 });
}
