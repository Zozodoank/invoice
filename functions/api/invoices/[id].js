// functions/api/invoices/[id].js  ->  DELETE /api/invoices/:id
import { requireAuth } from '../../_shared/guards.js';
import { deleteDoc } from '../../_shared/docstore.js';
import { json } from '../../_shared/util.js';

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const id = context.params.id;
  const ok = await deleteDoc(context.env.DB, auth.user.id, 'invoice', id);
  return ok ? json({ ok: true }) : json({ error: 'Tidak ditemukan.' }, 404);
}
