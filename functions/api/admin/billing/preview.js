// functions/api/admin/billing/preview.js  ->  GET /api/admin/billing/preview?amount=1000
// SUPERADMIN ONLY. Render SVG QRIS dinamis contoh dari payload statis yang aktif (DB / env)
// agar admin dapat langsung melakukan scan pratinjau nominal terkunci sebelum/sesudah simpan.

import { requireSuperadmin, badRequest } from '../../../_shared/guards.js';
import { getBillingConfig, resolveEffectiveStaticPayload } from '../../../_shared/billing.js';
import { buildDynamicQris } from '../../../_shared/qris-emv.js';
import { qrSvg, qrSvgResponse } from '../../../_shared/qris-svg.js';
import { json } from '../../../_shared/util.js';

export async function onRequestGet(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  const amount = Math.round(Number(url.searchParams.get('amount') || 1000));
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000000) {
    return badRequest('Nominal pratinjau tidak valid (1 - 1.000.000).');
  }

  const cfg = await getBillingConfig(context.env.DB);
  const eff = resolveEffectiveStaticPayload(cfg, context.env);
  if (!eff.payload) {
    return json({ error: 'qris_static_not_configured', message: 'Payload QRIS statis belum diatur atau sedang dinonaktifkan.' }, 409);
  }

  try {
    const dyn = buildDynamicQris(eff.payload, amount);
    const size = Math.min(512, Math.max(120, Math.round(Number(url.searchParams.get('size')) || 320)));
    return qrSvgResponse(qrSvg(dyn, { size }));
  } catch (e) {
    return json({ error: 'qris_preview_failed', message: String(e && e.message ? e.message : e) }, 400);
  }
}
