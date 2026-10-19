// functions/api/export/verify.js  ->  POST /api/export/verify
// Defense-in-depth (Plan Phase 3.4): the export/PDF flow asks the server whether a
// document must carry the watermark. The answer ALWAYS comes from DB state
// (users.trial_*_used / plan / is_superadmin or the saved row's has_watermark).
// Any client-proposed `hasWatermark: false` is ignored — it can never override the server.

import { requireAuth, badRequest } from '../../_shared/guards.js';
import { computeEntitlement } from '../../_shared/entitlements.js';
import { FIELDS } from '../../_shared/docstore.js';
import { json } from '../../_shared/util.js';

const TYPE_TABLE = {
  invoice: 'invoices',
  kwitansi: 'kwitansis',
  'surat-jalan': 'surat_jalans'
};
const TRIAL_KEY = { invoice: 'invoice', kwitansi: 'kwitansi', 'surat-jalan': 'suratJalan' };

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const type = String(body.type || '').toLowerCase();
  if (!TYPE_TABLE[type]) return badRequest('Tipe dokumen tidak dikenali.');

  let hasWatermark;
  const id = body.id ? String(body.id) : null;

  if (id) {
    // Saved document: the persisted has_watermark column is authoritative.
    const cfg = FIELDS[type];
    const row = await context.env.DB
      .prepare(`SELECT has_watermark FROM ${cfg.table} WHERE id = ? AND user_id = ?`)
      .bind(id, auth.user.id)
      .first();
    if (!row) return badRequest('Dokumen tidak ditemukan.');
    hasWatermark = Number(row.has_watermark) === 1;
  } else {
    // Unsaved draft: resolve against the user's current entitlement.
    const ent = computeEntitlement(auth.user, context.data.superadminEmail);
    hasWatermark = ent.hasWatermark === true && (ent.trial[TRIAL_KEY[type]] ?? 0) === 0;
  }

  return json({ hasWatermark, source: 'server' }, 200, { 'Cache-Control': 'no-store' });
}
