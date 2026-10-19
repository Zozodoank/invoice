// functions/api/admin/plans.js  ->  GET /api/admin/plans | POST /api/admin/plans
// SUPERADMIN ONLY. List subscription tiers and update a tier's price/limits.
// POST upserts by `id`; only whitelisted numeric/boolean columns are written.

import { requireSuperadmin, badRequest } from '../../_shared/guards.js';
import { newId, json } from '../../_shared/util.js';

const COLUMNS = 'id, name, price, billing_interval, max_invoices_per_month, max_templates, can_use_qr, can_use_signature, can_export_whatsapp, has_watermark, is_active';

export async function onRequestGet(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;
  const rows = await context.env.DB
    .prepare(`SELECT ${COLUMNS} FROM plans ORDER BY price ASC`).all();
  return json(rows.results || [], 200, { 'Cache-Control': 'no-store' });
}

const numOr = (v, dflt) => (v === undefined || v === null || v === '' ? dflt : Math.max(-1, Math.round(Number(v) || 0)));
const boolInt = (v, dflt) => (v === undefined ? dflt : (v === true || v === 1 || v === '1' ? 1 : 0));

export async function onRequestPost(context) {
  const auth = await requireSuperadmin(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { return badRequest('Body tidak valid.'); }

  const name = String(body.name || '').trim();
  if (!name) return badRequest('Nama paket wajib diisi.');

  const rec = {
    name,
    price: Math.max(0, Math.round(Number(body.price) || 0)),
    billing_interval: body.billingInterval === 'year' ? 'year' : 'month',
    max_invoices_per_month: numOr(body.maxInvoicesPerMonth, 5),
    max_templates: numOr(body.maxTemplates, 1),
    can_use_qr: boolInt(body.canUseQr, 0),
    can_use_signature: boolInt(body.canUseSignature, 0),
    can_export_whatsapp: boolInt(body.canExportWhatsapp, 1),
    has_watermark: boolInt(body.hasWatermark, 1),
    is_active: boolInt(body.isActive, 1)
  };

  const id = body.id ? String(body.id) : newId('plan');
  const existing = await context.env.DB.prepare('SELECT id FROM plans WHERE id = ?').bind(id).first();

  if (existing) {
    await context.env.DB
      .prepare(`UPDATE plans SET name=?, price=?, billing_interval=?, max_invoices_per_month=?,
                max_templates=?, can_use_qr=?, can_use_signature=?, can_export_whatsapp=?,
                has_watermark=?, is_active=? WHERE id=?`)
      .bind(rec.name, rec.price, rec.billing_interval, rec.max_invoices_per_month, rec.max_templates,
            rec.can_use_qr, rec.can_use_signature, rec.can_export_whatsapp, rec.has_watermark, rec.is_active, id).run();
  } else {
    await context.env.DB
      .prepare(`INSERT INTO plans (id, name, price, billing_interval, max_invoices_per_month, max_templates,
                can_use_qr, can_use_signature, can_export_whatsapp, has_watermark, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, rec.name, rec.price, rec.billing_interval, rec.max_invoices_per_month, rec.max_templates,
            rec.can_use_qr, rec.can_use_signature, rec.can_export_whatsapp, rec.has_watermark, rec.is_active).run();
  }

  const plan = await context.env.DB.prepare(`SELECT ${COLUMNS} FROM plans WHERE id = ?`).bind(id).first();
  return json(plan, existing ? 200 : 201);
}
