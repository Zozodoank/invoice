// functions/api/kwitansis.js  ->  GET | POST /api/kwitansis
import { requireAuth } from '../_shared/guards.js';
import { listDocs, saveDoc } from '../_shared/docstore.js';
import { json } from '../_shared/util.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const docs = await listDocs(context.env.DB, auth.user.id, 'kwitansi');
  return json(docs, 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  let doc;
  try { doc = await context.request.json(); } catch { return json({ error: 'Body tidak valid.' }, 400); }
  try {
    const saved = await saveDoc(context.env.DB, auth.user, context.data.superadminEmail, 'kwitansi', doc);
    return json(saved, 200, { 'Cache-Control': 'no-store' });
  } catch (e) {
    return json({ error: e.message || 'Gagal menyimpan.' }, e.status || 500);
  }
}
