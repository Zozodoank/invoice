/**
 * scripts/verify-api.mjs — end-to-end API checks against the preview server.
 * Runs the REAL session signing code (functions/_shared/util.js) to forge
 * cookies locally — the same thing /api/auth/google does server-side.
 * Usage: node scripts/verify-api.mjs [port]
 */
import { signToken } from '../functions/_shared/util.js';
import { selectEffectivePrice, jakartaDate, secureCompare } from '../functions/_shared/billing.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 8788);
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keys must match the running preview server, so read them from .dev.vars
// (gitignored) instead of hardcoding; fall back to the documented dev placeholders.
const devVars = Object.fromEntries(
  (fs.existsSync(path.join(ROOT, '.dev.vars'))
    ? fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').split(/\r?\n/)
    : []
  )
    .map((line) => (line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/) || [])
      .slice(1))
    .filter((pair) => pair.length === 2)
);
const SECRET = devVars.SESSION_SECRET || 'local-dev-secret-please-replace-0123456789';
const PAY_SECRET = devVars.PAYMENT_WEBHOOK_SECRET || 'local-dev-payment-secret-change-me';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const sqlite = new DatabaseSync(path.join(ROOT, '.wrangler', 'state', 'preview.sqlite'));

// clean state from previous runs (incl. legacy NULL-id rows from the old saveDoc bug)
sqlite.prepare('DELETE FROM invoice_items WHERE invoice_id NOT IN (SELECT id FROM invoices WHERE id IS NOT NULL)').run();
sqlite.prepare('DELETE FROM invoices WHERE id IS NULL').run();
sqlite.prepare("DELETE FROM users WHERE id LIKE 'usr_verify_%' OR email LIKE 'verify_%@example.test'").run();
// billing tables come from the same schema file; if the preview server has not
// been restarted after the schema change they are missing -> say so loudly.
const hasBilling = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='billing_config'").get();
ok('billing_config table migrated', !!hasBilling, 'restart scripts/local-preview-server.mjs');
ok('document_payments table migrated', !!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='document_payments'").get());
if (hasBilling) {
  sqlite.prepare('DELETE FROM document_payments').run();
  sqlite.prepare("UPDATE billing_config SET price_promo=1000, price_normal=2000, promo_active=1, promo_start=NULL, promo_end=NULL, qris_image=NULL, qris_note=NULL WHERE id='default'").run();
}

async function mkSession(email) {
  const row = sqlite.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row) return null;
  return await signToken({ uid: row.id, email: row.email, role: Number(row.is_superadmin) === 1 ? 'superadmin' : 'user', plan: row.plan, exp: Date.now() + 3600_000 }, SECRET);
}
const req = (p, method = 'GET', body, token) => fetch(BASE + p, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `session=${encodeURIComponent(token)}` } : {}) },
  body: body ? JSON.stringify(body) : undefined
});
// Session-less call (MacroDroid bridge): explicit headers, no cookie.
const raw = (p, method = 'POST', body, headers = {}) => fetch(BASE + p, {
  method,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body ? JSON.stringify(body) : undefined
});
const newEmail = (t) => `verify_${t}_${Date.now()}@example.test`;
// Shift a YYYY-MM-DD string by N days (noon-UTC anchor avoids DST/edge drift).
const shiftDate = (s, days) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function upsertUser(id, email, extra = {}) {
  sqlite.prepare('INSERT OR REPLACE INTO users (id, email, name, is_superadmin, plan, subscription_status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, 'Verify Bot', extra.is_superadmin ?? 0, extra.plan ?? 'free', extra.subscription_status ?? 'inactive', extra.is_active ?? 1);
}

// ---------- 1. public + unauthenticated gates ----------
let r = await req('/api/config'); ok('config public', r.status === 200 && (await r.json()).clientId);
r = await req('/api/me'); ok('me requires session (401)', r.status === 401);
r = await req('/api/invoices'); ok('list invoices requires session (401)', r.status === 401);
r = await req('/api/entitlements'); ok('entitlements requires session (401)', r.status === 401);
r = await req('/api/export/verify', 'POST', { type: 'invoice' }); ok('export/verify requires session (401)', r.status === 401);

// ---------- 2. tampered cookie rejected ----------
r = await req('/api/me', 'GET', undefined, 'tampered.token'); ok('tampered cookie rejected', r.status === 401);

// ---------- 3. superadmin session (seeded DB row) ----------
const superTok = await mkSession('megakomindo@gmail.com');
ok('seeded superadmin exists', !!superTok);
r = await req('/api/me', 'GET', undefined, superTok);
const me = await r.json();
ok('/api/me role from DB = superadmin', r.status === 200 && me.role === 'superadmin', JSON.stringify(me));
r = await req('/api/entitlements', 'GET', undefined, superTok);
const ent = await r.json();
ok('superadmin never watermarked', ent.hasWatermark === false && ent.trial.invoice === null);

// ---------- 4. admin endpoints enforce superadmin ----------
const plainEmail = newEmail('plain');
upsertUser('usr_verify_plain', plainEmail);
const plainTok = await mkSession(plainEmail);
r = await req('/api/admin/users', 'GET', undefined, plainTok);
ok('admin list blocked for non-super (403)', r.status === 403);
r = await req('/api/admin/users', 'GET', undefined, superTok);
const users = await r.json();
ok('admin list works for superadmin', r.status === 200 && Array.isArray(users.users ?? users), JSON.stringify(users).slice(0, 120));

// privilege escalation via body must be ignored
r = await req('/api/admin/users', 'POST', { email: newEmail('esc'), name: 'Esc', is_superadmin: 1, plan: 'enterprise' }, superTok);
ok('admin create ignores privileged body fields', r.status < 500, `status=${r.status}`);
const created = await r.json();
const cid = (created.user && created.user.id) || created.id;
if (cid) {
  const row = sqlite.prepare('SELECT is_superadmin FROM users WHERE id = ?').get(cid);
  ok('created user is NOT superadmin (body cannot grant role)', row && Number(row.is_superadmin) === 0, JSON.stringify(row));
}

// ---------- 5. trial / watermark business logic (free user) ----------
const freeEmail = newEmail('free');
upsertUser('usr_verify_free', freeEmail);
let tok = await mkSession(freeEmail);
r = await req('/api/entitlements', 'GET', undefined, tok);
let e2 = await r.json();
ok('new free user: 3 clean credits', e2.trial.invoice === 1 && e2.trial.kwitansi === 1 && e2.trial.suratJalan === 1 && e2.hasWatermark === false, JSON.stringify(e2));

const mkDoc = (n) => ({ number: n, date: '2026-10-19', clientName: 'Klien <b>XSS</b>', items: [{ name: 'Barang', quantity: 2, unit: 'Pcs', price: 100000 }] });
r = await req('/api/invoices', 'POST', { ...mkDoc('INV-1'), title: 'INVOICE', status: 'pending' }, tok);
let saved = await r.json();
ok('1st invoice: NO watermark + trial consumed', r.status === 200 && saved.hasWatermark === false);
ok('server totals authoritative', saved.grandTotal === 200000 && saved.subtotal === 200000, JSON.stringify({ sub: saved.subtotal, gt: saved.grandTotal }));

r = await req('/api/invoices', 'POST', mkDoc('INV-2'), tok);
saved = await r.json();
ok('2nd invoice: watermarked (credit spent)', r.status === 200 && saved.hasWatermark === true);

// client CANNOT override watermark by sending hasWatermark/showWatermark false
r = await req('/api/invoices', 'POST', { ...mkDoc('INV-3'), hasWatermark: false, showWatermark: false }, tok);
saved = await r.json();
ok('client watermark override ignored', saved.hasWatermark === true);

r = await req('/api/kwitansis', 'POST', { number: 'KWT-1', date: '2026-10-19', clientName: 'Penerima', paymentFor: 'Cicilan', items: [] }, tok);
saved = await r.json();
ok('kwitansi first credit clean', saved.hasWatermark === false);
r = await req('/api/surat-jalans', 'POST', { number: 'SJ-1', date: '2026-10-19', recipientName: 'Penerima', items: [{ name: 'Brg', quantity: 1, unit: 'Pcs' }] }, tok);
saved = await r.json();
ok('surat jalan first credit clean', saved.hasWatermark === false);

// validation (#16 paper size + required fields)
r = await req('/api/surat-jalans', 'POST', { number: 'SJ-2', date: '2026-10-19', recipientName: 'X', paperSize: 'letter' }, tok);
ok('invalid paper_size rejected 400', r.status === 400);
r = await req('/api/invoices', 'POST', { date: '2026-10-19' }, tok);
ok('missing number rejected 400', r.status === 400);

// export/verify now DB-backed
r = await req('/api/export/verify', 'POST', { type: 'invoice', id: saved.id }, tok);
// (SJ id is irrelevant here) use an invoice id instead:
const invList = await (await req('/api/invoices', 'GET', undefined, tok)).json();
const wmInv = invList.find(d => d.hasWatermark);
r = await req('/api/export/verify', 'POST', { type: 'invoice', id: wmInv.id }, tok);
e2 = await r.json();
ok('export/verify says watermark required (DB)', e2.hasWatermark === true && e2.source === 'server');

// IDOR: other user cannot delete this doc
r = await req(`/api/invoices/${wmInv.id}`, 'DELETE', undefined, superTok);
const stillThere = sqlite.prepare('SELECT user_id FROM invoices WHERE id = ?').get(wmInv.id);
ok('IDOR: cross-user delete leaves doc owned by free user', !!stillThere && stillThere.user_id === 'usr_verify_free', `status=${r.status}`);

// suspension revokes access immediately
sqlite.prepare("UPDATE users SET is_active = 0 WHERE id = 'usr_verify_free'").run();
r = await req('/api/me', 'GET', undefined, tok);
ok('suspended user revoked instantly (403)', r.status === 403);
sqlite.prepare("UPDATE users SET is_active = 1 WHERE id = 'usr_verify_free'").run();

// superadmin deactivation protection
r = await req('/api/admin/users/usr_superadmin_01/status', 'POST', { active: false }, superTok);
ok('cannot deactivate superadmin', r.status === 400 || r.status === 403);

// plan set + expiry (provided date stored verbatim; interval path uses addMonths clamp)
const planEmail = newEmail('plan');
upsertUser('usr_verify_plan', planEmail);
r = await req('/api/admin/users/usr_verify_plan/plan', 'POST', { plan: 'pro', billingInterval: 'month', subscriptionExpiresAt: '2027-01-31' }, superTok);
ok('admin set plan ok', r.status === 200, `status=${r.status}`);
const prow = sqlite.prepare('SELECT plan, subscription_status, subscription_expires_at FROM users WHERE id=?').get('usr_verify_plan');
ok('provided expiry stored + status active', prow && prow.plan === 'pro' && prow.subscription_status === 'active' && /^2027-01-31/.test(prow.subscription_expires_at), JSON.stringify(prow));
tok = await mkSession(planEmail);
r = await req('/api/entitlements', 'GET', undefined, tok);
e2 = await r.json();
ok('paid active: no watermark, no trial use', e2.hasWatermark === false && e2.isPaid === true);

// lifetime = null expiry, still paid
r = await req('/api/admin/users/usr_verify_plan/plan', 'POST', { plan: 'pro', isLifetime: true }, superTok);
const lrow = sqlite.prepare('SELECT is_lifetime, subscription_expires_at, subscription_status FROM users WHERE id=?').get('usr_verify_plan');
ok('lifetime flag, null expiry (no 2099 sentinel)', Number(lrow.is_lifetime) === 1 && !lrow.subscription_expires_at, JSON.stringify(lrow));

// addMonths end-of-month clamp (31 Jan + 1 month -> 28 Feb) — same algorithm as plan.js/format.js
function addMonths(dateStr, months) {
  const base = new Date(dateStr);
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
ok('addMonths clamp 31 Jan +1 = 28 Feb', addMonths('2026-01-31T00:00:00Z', 1) === '2026-02-28', addMonths('2026-01-31T00:00:00Z', 1));

// ---------- 6. per-document QRIS pricing (server-authoritative) ----------
// 6a. pure pricing unit checks (promo window compared as Jakarta date strings)
const NOW = new Date();
const TODAY = jakartaDate(NOW);
const base1000 = { price_promo: 1000, price_normal: 2000, promo_active: 1, promo_start: null, promo_end: null };
ok('price: promo active, open window -> promo', selectEffectivePrice(base1000, NOW) === 1000);
ok('price: promo off -> normal', selectEffectivePrice({ ...base1000, promo_active: 0 }, NOW) === 2000);
ok('price: window ended yesterday -> normal', selectEffectivePrice({ ...base1000, promo_end: shiftDate(TODAY, -1) }, NOW) === 2000);
ok('price: window ends today (inclusive) -> promo', selectEffectivePrice({ ...base1000, promo_end: TODAY }, NOW) === 1000);
ok('price: window starts tomorrow -> normal', selectEffectivePrice({ ...base1000, promo_start: shiftDate(TODAY, 1) }, NOW) === 2000);
ok('secureCompare: equal / unequal / missing', secureCompare('abc', 'abc') && !secureCompare('abc', 'abd') && !secureCompare('abc', undefined));

// 6b. admin billing gates + validation
r = await req('/api/admin/billing'); ok('billing GET 401 without session', r.status === 401);
r = await req('/api/admin/billing', 'GET', undefined, plainTok); ok('billing GET 403 for normal user', r.status === 403);
r = await req('/api/admin/billing', 'POST', { pricePromo: 900 }, plainTok); ok('billing POST 403 for normal user', r.status === 403);
r = await req('/api/admin/billing', 'GET', undefined, superTok);
const bcfg = await r.json();
ok('billing GET 200 superadmin with seeded defaults', r.status === 200 && bcfg.pricePromo === 1000 && bcfg.priceNormal === 2000 && bcfg.effectivePrice === 1000, JSON.stringify(bcfg));

r = await req('/api/admin/billing', 'POST', { pricePromo: -5 }, superTok); ok('billing rejects negative price (400)', r.status === 400);
r = await req('/api/admin/billing', 'POST', { priceNormal: 2000000 }, superTok); ok('billing rejects price > 1.000.000', r.status === 400);
r = await req('/api/admin/billing', 'POST', { pricePromo: 'gratis' }, superTok); ok('billing rejects non-numeric price', r.status === 400);
r = await req('/api/admin/billing', 'POST', { promoStart: '2026-10-20', promoEnd: '2026-10-10' }, superTok); ok('billing rejects promoEnd < promoStart', r.status === 400);
r = await req('/api/admin/billing', 'POST', { promoStart: '20-10-2026' }, superTok); ok('billing rejects bad date format', r.status === 400);
r = await req('/api/admin/billing', 'POST', { qrisImage: 'data:text/html;base64,PHNjcmlwdD4=' }, superTok); ok('billing rejects non-image qris data URL', r.status === 400);
r = await req('/api/admin/billing', 'POST', { qrisNote: 'x'.repeat(600) }, superTok);
ok('billing accepts oversized note (truncated, not rejected)', r.status === 200 && (await r.json()).qrisNote.length <= 500);

r = await req('/api/admin/billing', 'POST', {
  pricePromo: 1000, priceNormal: 2000, promoActive: true,
  promoStart: shiftDate(TODAY, -1), promoEnd: shiftDate(TODAY, 7),
  qrisNote: 'Bayar PERSIS nominal ini via QRIS statis.', qrisImage: null
}, superTok);
const savedCfg = await r.json();
ok('billing saves window + note', r.status === 200 && savedCfg.promoStart === shiftDate(TODAY, -1) && savedCfg.effectivePrice === 1000, JSON.stringify(savedCfg));

// 6c. buyer: free user whose invoice trial is spent -> document needs payment
const buyEmail = newEmail('buyer');
upsertUser('usr_verify_buyer', buyEmail);
const buyTok = await mkSession(buyEmail);
await req('/api/invoices', 'POST', mkDoc('PAY-1'), buyTok);
r = await req('/api/invoices', 'POST', mkDoc('PAY-2'), buyTok);
const payDoc = await r.json();
ok('buyer 2nd invoice watermarked (trial spent)', payDoc.hasWatermark === true);
r = await req('/api/invoices', 'POST', mkDoc('PAY-3'), buyTok);
const payDoc2 = await r.json();
ok('buyer 3rd invoice also watermarked', payDoc2.hasWatermark === true);

// intent guards
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc.id }); ok('intent 401 without session', r.status === 401);
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc.id }, superTok); ok('intent IDOR other user doc -> 400', r.status === 400);
r = await req('/api/payments/intent', 'POST', { type: 'invoice' }, buyTok); ok('intent missing doc id -> 400', r.status === 400);
r = await req('/api/payments/intent', 'POST', { type: 'bogus', id: payDoc.id }, buyTok); ok('intent unknown type -> 400', r.status === 400);
r = await req('/api/invoices', 'POST', { ...mkDoc('SUP-1'), title: 'INVOICE' }, superTok);
const supDoc = await r.json();
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: supDoc.id }, superTok);
const supIntent = await r.json();
ok('intent for superadmin doc -> alreadyClean', supIntent.alreadyClean === true && !supIntent.payment, JSON.stringify(supIntent));
r = await req('/api/invoices', 'POST', { ...mkDoc('PLAN-1'), title: 'INVOICE' }, await mkSession(planEmail));
const planDoc = await r.json();
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: planDoc.id }, await mkSession(planEmail));
ok('intent for paid-plan doc -> alreadyClean', (await r.json()).alreadyClean === true);

// expired promo window -> normal tariff reaches the intent
await req('/api/admin/billing', 'POST', { promoStart: null, promoEnd: shiftDate(TODAY, -1) }, superTok);
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc.id }, buyTok);
const intentNormal = await r.json();
ok('intent uses NORMAL price outside promo window', intentNormal.alreadyClean === false && intentNormal.payment.baseAmount === 2000, JSON.stringify(intentNormal));
ok('intent total = base + 2-digit suffix', intentNormal.payment.totalAmount === 2000 + intentNormal.payment.suffix && intentNormal.payment.suffix >= 10 && intentNormal.payment.suffix <= 99, JSON.stringify(intentNormal.payment));
ok('intent status pending + no-store', intentNormal.payment.status === 'pending' && /no-store/i.test(r.headers.get('Cache-Control') || ''));

r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc.id }, buyTok);
const intentReuse = await r.json();
ok('repeat intent reuses same pending payment', intentReuse.payment.id === intentNormal.payment.id, JSON.stringify(intentReuse.payment));

// back inside the promo window -> new doc gets the promo tariff
await req('/api/admin/billing', 'POST', { promoStart: shiftDate(TODAY, -1), promoEnd: shiftDate(TODAY, 7) }, superTok);
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc2.id }, buyTok);
const intentPromo = await r.json();
ok('intent uses PROMO price inside window', intentPromo.payment.baseAmount === 1000, JSON.stringify(intentPromo.payment));
ok('two pendings never share total_amount', intentPromo.payment.totalAmount !== intentNormal.payment.totalAmount);

// 6d. confirm endpoint (MacroDroid bridge, no session)
r = await raw('/api/payments/confirm', 'POST', { amount: intentPromo.payment.totalAmount });
ok('confirm without key -> 401', r.status === 401);
r = await raw('/api/payments/confirm', 'POST', { amount: intentPromo.payment.totalAmount }, { 'X-Payment-Key': 'wrong-secret-000000' });
ok('confirm wrong key -> 401', r.status === 401);
r = await raw('/api/payments/confirm', 'POST', { amount: 0 }, { 'X-Payment-Key': PAY_SECRET });
ok('confirm invalid amount -> 400', r.status === 400);
r = await raw('/api/payments/confirm', 'POST', { amount: 4999912 }, { 'X-Payment-Key': PAY_SECRET });
ok('confirm unknown amount -> matched:false', r.status === 200 && (await r.json()).matched === false);

r = await raw('/api/payments/confirm', 'POST', { amount: intentNormal.payment.totalAmount }, { 'X-Payment-Key': PAY_SECRET });
const conf = await r.json();
ok('confirm matched:true for exact amount', conf.matched === true && conf.docId === payDoc.id, JSON.stringify(conf));
const payRow = sqlite.prepare('SELECT status, paid_at, user_id FROM document_payments WHERE id = ?').get(intentNormal.payment.id);
ok('payment row marked paid + paid_at set', payRow && payRow.status === 'paid' && !!payRow.paid_at && payRow.user_id === 'usr_verify_buyer', JSON.stringify(payRow));
const docRow = sqlite.prepare('SELECT has_watermark FROM invoices WHERE id = ?').get(payDoc.id);
ok('confirm flips doc has_watermark=0', Number(docRow.has_watermark) === 0);
r = await req('/api/export/verify', 'POST', { type: 'invoice', id: payDoc.id }, buyTok);
ok('export/verify now clean for paid doc', (await r.json()).hasWatermark === false);
r = await req('/api/payments/status', 'POST', { id: intentNormal.payment.id }, buyTok);
ok('status owner sees paid', (await r.json()).status === 'paid');
r = await req('/api/payments/status', 'POST', { id: intentNormal.payment.id }, plainTok);
ok('status non-owner -> 404', r.status === 404);
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc.id }, buyTok);
ok('intent on paid doc -> alreadyClean(paid)', (await r.json()).alreadyClean === true);

// paid doc must stay clean on re-save and must not burn another trial credit
const trialBefore = sqlite.prepare('SELECT trial_invoice_used FROM users WHERE id = ?').get('usr_verify_buyer').trial_invoice_used;
r = await req('/api/invoices', 'POST', { ...mkDoc('PAY-2'), id: payDoc.id }, buyTok);
const resaved = await r.json();
ok('re-saved paid doc stays watermark-free', resaved.hasWatermark === false, JSON.stringify({ hm: resaved.hasWatermark }));
ok('re-saved paid doc consumes no trial', sqlite.prepare('SELECT trial_invoice_used FROM users WHERE id = ?').get('usr_verify_buyer').trial_invoice_used === trialBefore);
r = await raw('/api/payments/confirm', 'POST', { amount: intentNormal.payment.totalAmount }, { 'X-Payment-Key': PAY_SECRET });
ok('double confirm same amount is idempotent (matched:false)', (await r.json()).matched === false);

// regression: a paid total_amount must not be handed out again (column is UNIQUE)
r = await req('/api/invoices', 'POST', mkDoc('PAY-4'), buyTok);
const payDoc3 = await r.json();
r = await req('/api/payments/intent', 'POST', { type: 'invoice', id: payDoc3.id }, buyTok);
const intent3 = await r.json();
ok('new intent skips the PAID amount', intent3.payment.totalAmount !== intentNormal.payment.totalAmount && intent3.payment.status === 'pending', JSON.stringify({ new: intent3.payment.totalAmount, paid: intentNormal.payment.totalAmount }));
ok('no two live payments share total_amount', sqlite.prepare("SELECT total_amount FROM document_payments WHERE status IN ('pending','paid') GROUP BY total_amount HAVING COUNT(*) > 1").all().length === 0);

// 6e. admin payment stats
r = await req('/api/admin/payments', 'GET', undefined, superTok);
const stats = await r.json();
ok('admin/payments 200 + stats', r.status === 200 && stats.totalPaid === 1 && stats.revenue === 2000 && stats.pendingCount === 2 && Array.isArray(stats.recent) && stats.recent.length === 3, JSON.stringify({ tp: stats.totalPaid, rv: stats.revenue, pc: stats.pendingCount, rc: (stats.recent || []).length }));
r = await req('/api/admin/payments', 'GET', undefined, plainTok); ok('admin/payments blocked for non-super (403)', r.status === 403);

// ---------- 7. schema smoke (Plan Phase 9.5) ----------
const TABLES = ['users', 'plans', 'invoices', 'invoice_items', 'kwitansis', 'kwitansi_items', 'surat_jalans', 'surat_jalan_items', 'billing_config', 'document_payments'];
const found = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name));
ok('all documented tables exist in DB', TABLES.every(t => found.has(t)), [...found].join(','));
ok('PRAGMA foreign_key_check clean', sqlite.prepare('PRAGMA foreign_key_check').all().length === 0);
const cols = new Set(sqlite.prepare('PRAGMA table_info(users)').all().map(c => c.name));
ok('users has entitlement columns', ['plan', 'trial_invoice_used', 'trial_kwitansi_used', 'trial_surat_jalan_used', 'is_active', 'is_lifetime', 'effective_price'].every(c => cols.has(c)), [...cols].join(','));
ok('billing_config has exactly one default row', sqlite.prepare("SELECT COUNT(*) c FROM billing_config WHERE id='default'").get().c === 1);
let dupeRejected = false;
try {
  sqlite.prepare("INSERT INTO document_payments (id, user_id, doc_type, doc_id, base_amount, suffix, total_amount, status) VALUES ('pay_dupe_probe', 'usr_verify_buyer', 'invoice', 'pay_dupe_probe', 1000, 37, ?, 'pending')")
    .run(intentPromo.payment.totalAmount);
} catch { dupeRejected = true; }
sqlite.prepare("DELETE FROM document_payments WHERE id = 'pay_dupe_probe'").run();
ok('document_payments.total_amount enforced UNIQUE at DB level', dupeRejected);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
