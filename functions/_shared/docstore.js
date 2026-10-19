// functions/_shared/docstore.js
// Generic, server-authoritative CRUD for the three document types.
// The field maps mirror js/db-mapping.js (keep both in sync).

import { newId } from './util.js';
import { computeTotals, itemNet, itemTax } from './calc.js';
import { resolveWatermark, consumeTrial, computeEntitlement } from './entitlements.js';
import { isDocPaidClean } from './billing.js';

const BOOL = v => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;

// Tolerate the legacy/alternate frontend field names so the browser object and the
// canonical API/DB contract stay reconcilable without a repo-wide rename.
const ALIASES = {
  invoice: { logo: 'logoUrl', signature: 'signatureData', banks: 'bankAccounts' },
  kwitansi: { logo: 'logoUrl', signature: 'signatureData' },
  'surat-jalan': { logo: 'logoUrl', signature: 'signatureData' }
};

function normalizeDoc(type, doc) {
  const alias = ALIASES[type] || {};
  for (const [canonical, alt] of Object.entries(alias)) {
    if (doc[canonical] === undefined && doc[alt] !== undefined) doc[canonical] = doc[alt];
  }
  return doc;
}

export const FIELDS = {
  invoice: {
    table: 'invoices', itemsTable: 'invoice_items', itemFk: 'invoice_id', prefix: 'inv',
    jsonCol: 'items_json', numberCol: 'invoice_number', dateCol: 'invoice_date',
    required: { number: 'Nomor invoice wajib diisi', date: 'Tanggal invoice wajib diisi' },
    map: {
      number: 'invoice_number', referenceNumber: 'reference_number', title: 'title',
      date: 'invoice_date', dueDate: 'due_date', showDueDate: 'show_due_date',
      paymentTerms: 'payment_terms', showPaymentTerms: 'show_payment_terms',
      status: 'status', showStatus: 'show_status', useDecimals: 'use_decimals',
      template: 'template', accentColor: 'accent_color', currency: 'currency', language: 'language',
      logo: 'logo_url', signature: 'signature_url',
      senderName: 'sender_name', senderEmail: 'sender_email', senderPhone: 'sender_phone',
      senderAddress: 'sender_address', senderTaxId: 'sender_tax_id', senderWebsite: 'sender_website',
      clientName: 'client_name', clientEmail: 'client_email', clientPhone: 'client_phone',
      clientAddress: 'client_address', clientTaxId: 'client_tax_id',
      discountType: 'discount_type', discountValue: 'discount_value', enableDiscount: 'enable_discount',
      taxRate: 'tax_rate', enableTax: 'enable_tax', shippingFee: 'shipping_fee', downPayment: 'down_payment',
      notes: 'notes', terms: 'terms', signerName: 'signer_name', signerTitle: 'signer_title',
      qrPayload: 'qr_payload', showQrCode: 'show_qr_code'
    },
    bools: ['showDueDate', 'showPaymentTerms', 'showStatus', 'useDecimals', 'enableDiscount', 'enableTax', 'showQrCode'],
    itemMap: { name: 'name', description: 'description', quantity: 'quantity', unit: 'unit',
      price: 'price', discountType: 'discount_type', discountValue: 'discount_value', taxRate: 'tax_rate', total: 'total_amount' },
    hasItems: true, hasTotals: true, paperCheck: false
  },

  kwitansi: {
    table: 'kwitansis', itemsTable: 'kwitansi_items', itemFk: 'kwitansi_id', prefix: 'kwt',
    jsonCol: 'items_json', numberCol: 'receipt_number', dateCol: 'receipt_date',
    required: { number: 'Nomor kwitansi wajib diisi', date: 'Tanggal kwitansi wajib diisi', clientName: 'Nama penerima wajib diisi' },
    map: {
      number: 'receipt_number', date: 'receipt_date', showRefNumber: 'show_reference_number',
      referenceNumber: 'reference_number', clientName: 'client_name', clientAddress: 'client_address',
      paymentFor: 'payment_for', amount: 'amount', currency: 'currency', useDecimals: 'use_decimals',
      method: 'method', enableDiscount: 'enable_discount', discountType: 'discount_type', discountValue: 'discount_value',
      enableTax: 'enable_tax', taxRate: 'tax_rate', meteraiFee: 'meterai_fee', stampColor: 'stamp_color',
      showTerbilang: 'show_terbilangan', showSignature: 'show_signature', showQrCode: 'show_qr_code',
      qrPayload: 'qr_payload', template: 'template', accentColor: 'accent_color', logo: 'logo_url',
      signature: 'signature_url', signerName: 'signer_name', signerTitle: 'signer_title',
      senderName: 'sender_name', notes: 'notes', status: 'status'
    },
    bools: ['showRefNumber', 'useDecimals', 'enableDiscount', 'enableTax', 'showTerbilang', 'showSignature', 'showQrCode'],
    itemMap: { name: 'name', description: 'description', quantity: 'quantity', unit: 'unit',
      price: 'price', discountType: 'discount_type', discountValue: 'discount_value', total: 'total_amount' },
    hasItems: true, hasTotals: false, paperCheck: false
  },

  'surat-jalan': {
    table: 'surat_jalans', itemsTable: 'surat_jalan_items', itemFk: 'surat_jalan_id', prefix: 'sj',
    jsonCol: 'items_json', numberCol: 'delivery_number', dateCol: 'delivery_date',
    required: { number: 'Nomor surat jalan wajib diisi', date: 'Tanggal wajib diisi', recipientName: 'Nama penerima wajib diisi' },
    map: {
      number: 'delivery_number', date: 'delivery_date', referenceNumber: 'reference_number',
      recipientName: 'recipient_name', recipientAddress: 'recipient_address', recipientPic: 'recipient_pic',
      recipientPhone: 'recipient_phone', senderName: 'sender_name', senderAddress: 'sender_address',
      senderPic: 'sender_pic', driverName: 'driver_name', driverSignerName: 'driver_signer_name',
      warehouseOfficerName: 'warehouse_officer_name', vehicle: 'vehicle', poNumber: 'po_number',
      sealNumber: 'seal_number', deliveryInstructions: 'delivery_instructions', notes: 'notes',
      status: 'status', template: 'template', accentColor: 'accent_color', paperSize: 'paper_size',
      logo: 'logo_url', signature: 'signature_url', showSkuColumn: 'show_sku_column',
      showItemCondition: 'show_item_condition', showSealNumber: 'show_seal_number',
      showPoNumber: 'show_po_number', showSignatures: 'show_signatures'
    },
    bools: ['showSkuColumn', 'showItemCondition', 'showSealNumber', 'showPoNumber', 'showSignatures'],
    itemMap: { sku: 'sku', name: 'name', description: 'description', quantity: 'quantity', unit: 'unit', condition: 'condition' },
    hasItems: true, hasTotals: false, paperCheck: true
  }
};

const STATUS = {
  invoice: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
  kwitansi: ['draft', 'paid', 'void', 'pending'],
  'surat-jalan': ['draft', 'in_transit', 'delivered', 'cancelled']
};

function validate(type, doc) {
  const cfg = FIELDS[type];
  for (const [camel, msg] of Object.entries(cfg.required)) {
    const v = doc[camel];
    if (v === undefined || v === null || String(v).trim() === '') return msg;
  }
  if (doc.status && !STATUS[type].includes(doc.status)) return `Status '${doc.status}' tidak valid.`;
  if (cfg.paperCheck) {
    const ps = doc.paperSize;
    if (ps && !['a4', 'a5-landscape'].includes(ps)) return "Ukuran kertas tidak valid (pakai 'a4' atau 'a5-landscape').";
  }
  return null;
}

/** Map a camelCase doc into DB column values for INSERT/UPDATE (header only). */
function toColumns(type, doc, extra) {
  const cfg = FIELDS[type];
  const cols = { ...extra };
  const boolSet = new Set(cfg.bools);
  for (const [camel, col] of Object.entries(cfg.map)) {
    let val = doc[camel];
    if (val === undefined) continue;
    if (boolSet.has(camel)) val = BOOL(val);
    cols[col] = val;
  }
  return cols;
}

/** Reconstruct a camelCase object from a DB row. */
function fromRow(type, row) {
  const cfg = FIELDS[type];
  const boolSet = new Set(cfg.bools);
  const obj = { id: row.id };
  for (const [camel, col] of Object.entries(cfg.map)) {
    let val = row[col];
    if (boolSet.has(camel)) val = Number(val) === 1;
    obj[camel] = val === undefined ? null : val;
  }
  obj.hasWatermark = Number(row.has_watermark) === 1;
  // items from the JSON snapshot (authoritative round-trip) else empty array (#29)
  try { obj.items = row[cfg.jsonCol] ? JSON.parse(row[cfg.jsonCol]) : []; } catch { obj.items = []; }
  if (!Array.isArray(obj.items)) obj.items = [];
  if (type === 'invoice') {
    try { obj.banks = row.banks_json ? JSON.parse(row.banks_json) : []; } catch { obj.banks = []; }
    obj.subtotal = row.subtotal; obj.taxAmount = row.tax_amount;
    obj.grandTotal = row.grand_total; obj.balanceDue = row.balance_due;
  }
  // Echo alias names so existing template code keeps working.
  const alias = ALIASES[type] || {};
  for (const [canonical, alt] of Object.entries(alias)) {
    if (obj[canonical] !== undefined) obj[alt] = obj[canonical];
  }
  obj.createdAt = row.created_at; obj.updatedAt = row.updated_at;
  return obj;
}

async function writeItems(db, cfg, docId, items) {
  await db.prepare(`DELETE FROM ${cfg.itemsTable} WHERE ${cfg.itemFk} = ?`).bind(docId).run();
  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i] || {};
    const cols = { [cfg.itemFk]: docId, item_index: i };
    for (const [camel, col] of Object.entries(cfg.itemMap)) {
      if (it[camel] !== undefined) cols[col] = it[camel];
    }
    if (cols.total_amount === undefined && it.price !== undefined) {
      cols.total_amount = computeItemAmount(it);
    }
    const keys = Object.keys(cols);
    const sql = `INSERT INTO ${cfg.itemsTable} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    await db.prepare(sql).bind(...keys.map(k => cols[k])).run();
  }
}

function computeItemAmount(it) {
  const net = itemNet(it);
  return it.taxRate ? (net + itemTax(it, net)) : net;
}

export async function listDocs(db, userId, type) {
  const cfg = FIELDS[type];
  const order = type === 'invoice' ? 'invoice_date' : cfg.dateCol;
  const { results } = await db
    .prepare(`SELECT * FROM ${cfg.table} WHERE user_id = ? ORDER BY date(${order}) DESC, created_at DESC LIMIT 500`)
    .bind(userId)
    .all();
  return (results || []).map(r => fromRow(type, r));
}

export async function deleteDoc(db, userId, type, id) {
  const cfg = FIELDS[type];
  const res = await db.prepare(`DELETE FROM ${cfg.table} WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  return (res.meta && res.meta.changes) > 0;
}

/**
 * Upsert a document. Server computes totals + watermark; consumes a trial credit.
 * @returns the persisted camelCase object (with server-authoritative fields).
 */
export async function saveDoc(db, user, superadminEmail, type, doc) {
  const cfg = FIELDS[type];
  doc = normalizeDoc(type, { ...doc });
  const err = validate(type, doc);
  if (err) throw Object.assign(new Error(err), { status: 400 });

  const id = doc.id || newId(cfg.prefix);
  const items = Array.isArray(doc.items) ? doc.items : [];

  const extra = { id, user_id: user.id };
  let wm = resolveWatermark(user, superadminEmail, type);
  // A document already cleared by a paid static-QRIS payment stays watermark-free
  // on every re-save (and must not consume a trial credit).
  if (wm.hasWatermark || wm.consumesTrial) {
    if (await isDocPaidClean(db, type, id)) wm = { hasWatermark: false, consumesTrial: false };
  }
  extra.has_watermark = wm.hasWatermark ? 1 : 0;

  if (type === 'invoice') {
    const totals = computeTotals({ ...doc, items });
    extra.subtotal = totals.subtotal;
    extra.tax_amount = totals.taxAmount;
    extra.grand_total = totals.grandTotal;
    extra.balance_due = totals.balanceDue;
    extra.items_json = JSON.stringify(items);
    extra.banks_json = JSON.stringify(Array.isArray(doc.banks) ? doc.banks : []);
  } else {
    extra[cfg.jsonCol] = JSON.stringify(items);
  }

  const cols = toColumns(type, doc, extra);
  // Guarantee NOT NULL headers have values.
  if (cols[cfg.numberCol] === undefined) throw Object.assign(new Error(cfg.required.number || 'Nomor wajib diisi'), { status: 400 });
  if (cols[cfg.dateCol] === undefined) throw Object.assign(new Error(cfg.required.date || 'Tanggal wajib diisi'), { status: 400 });

  const keys = Object.keys(cols);
  // Try update first, then insert (SQLite has no portable upsert here).
  const existing = await db.prepare(`SELECT id FROM ${cfg.table} WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (existing) {
    const updKeys = keys.filter(k => k !== 'id' && k !== 'user_id');
    await db.prepare(`UPDATE ${cfg.table} SET ${updKeys.map(k => `${k}=?`).join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`)
      .bind(...updKeys.map(k => cols[k]), id, user.id).run();
  } else {
    const insertSql = `INSERT INTO ${cfg.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    await db.prepare(insertSql).bind(...keys.map(k => cols[k])).run();
  }

  await writeItems(db, cfg, id, items);

  // Consume the trial credit AFTER a successful no-watermark save.
  if (wm.consumesTrial) await consumeTrial(db, user.id, type);

  const savedUser = { ...user };
  if (wm.consumesTrial) {
    savedUser[{ invoice: 'trial_invoice_used', kwitansi: 'trial_kwitansi_used', 'surat-jalan': 'trial_surat_jalan_used' }[type]] = 1;
  }
  const row = await db.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(id).first();
  const out = fromRow(type, row);
  out.entitlement = computeEntitlement(savedUser, superadminEmail);
  return out;
}
