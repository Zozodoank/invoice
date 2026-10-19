// scripts/verify-units.mjs — Phase 9.2 unit/edge checks for the browser modules,
// loaded into Node with a window/document shim (they are classic scripts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? (pass++, console.log(`PASS ${n}`)) : (fail++, console.log(`FAIL ${n} ${x}`)); };

const win = { addEventListener() {}, dispatchEvent() {}, location: { href: 'http://x/', search: '' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
globalThis.window = win;
globalThis.localStorage = win.localStorage;
globalThis.document = { addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {} }), documentElement: { classList: { add() {}, remove() {}, toggle() {} } }, body: { classList: { add() {}, remove() {} } } };

function load(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const fn = new Function('window', 'document', 'localStorage', 'Intl', 'Date', src + '\n;if (typeof calculateInvoiceTotals !== "undefined") window.calculateInvoiceTotals = calculateInvoiceTotals;');
  fn.call(win, win, globalThis.document, win.localStorage, Intl, Date);
}
load('js/sanitize.js');
load('js/format.js');
load('js/calculations.js');

const { esc, escAttr, safeColor } = win.Sanitize || window.Sanitize;
const e1 = esc('<img src=x onerror=alert(1)>');
ok('esc() neutralizes tags', !e1.includes('<') && !e1.includes('>'), e1);
ok('esc() escapes quotes', esc(`a'b"c`).includes('&#39;') || esc(`a'b"c`).includes('&quot;'), esc(`a'b"c`));
ok('escAttr blocks quote breakout', !escAttr('a" onmouseover="alert(1)').includes('"'), escAttr('a" onmouseover="alert(1)'));
ok('safeColor accepts hex', safeColor('#2563eb') === '#2563eb');
const sc = safeColor('red; } body { display:none');
ok('safeColor rejects CSS junk (whitelist fallback)', !sc.includes(';') && !sc.includes('{') && !sc.includes('}'), sc);

const F = win.Format;
ok('formatDateId dd/mm/yyyy', /^\d{2}\/\d{2}\/\d{2,4}$/.test(F.formatDateId('2026-10-19')), F.formatDateId('2026-10-19'));
ok('todayLocal is WIB-based (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(F.todayLocal()), F.todayLocal());
ok('addMonths clamp 31 Jan -> 28 Feb', String(F.addMonths('2026-01-31', 1)).startsWith('2026-02-28'), F.addMonths('2026-01-31', 1));
ok('addMonths normal 15 Mar -> 15 Apr', String(F.addMonths('2026-03-15', 1)).startsWith('2026-04-15'), F.addMonths('2026-03-15', 1));
const sl = F.slug('Invoice/Rekap #1 (OK)!');
ok('slug strips filename-unsafe chars', /^[A-Za-z0-9_-]+$/.test(sl), sl);

const calc = win.calculateInvoiceTotals;
// PPN case: item has own taxRate AND global tax enabled -> must not double count.
const t1 = calc({
  items: [{ name: 'A', quantity: 2, price: 100000, taxRate: 11, discountValue: 0, discountType: 'percent' }],
  enableTax: true, taxRate: 11, enableDiscount: false, discountValue: 0, shippingFee: 0, downPayment: 0
});
// item tax = 2*100000*11% = 22000; taxable = 200000; global tax = 22000 => total tax 44000? Design: taxAmount = itemTaxTotal + taxable*rate => 22000 + 22000 = 44000, grand = 244000
ok('PPN item+global both counted once each', Math.abs(t1.taxAmount - 44000) < 0.51 && Math.abs(t1.grandTotal - 244000) < 0.51, JSON.stringify(t1));
const t2 = calc({
  items: [{ name: 'A', quantity: 1, price: 50000, discountValue: 10, discountType: 'percent', taxRate: 0 }],
  enableTax: false, taxRate: 11, enableDiscount: true, discountValue: 20, discountType: 'percent', shippingFee: 5000, downPayment: 10000
});
ok('undefined-safe: tax disabled => only item discount + global discount + ship - dp',
  Math.abs(t2.grandTotal - (45000 - 9000 + 5000)) < 0.51 && Math.abs(t2.balanceDue - (t2.grandTotal - 10000)) < 0.51, JSON.stringify(t2));
ok('enableTax undefined means OFF', calc({ items: [{ name: 'A', quantity: 1, price: 100000 }], taxRate: 12 }).taxAmount === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
