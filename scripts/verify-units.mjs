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

// ---------- Dynamic QRIS (functions/_shared/qris-emv.js) + unique-code picker ----------
{
  const Q = await import('../functions/_shared/qris-emv.js');
  const B = await import('../functions/_shared/billing.js');
  ok('CRC16-CCITT-FALSE known vector "123456789" = 29B1', Q.crc16ccitt('123456789') === '29B1', Q.crc16ccitt('123456789'));
  const mk = (extra = '') => {
    const inner = Q.buildTLV('00', 'ID.CO.TEST.WWW') + Q.buildTLV('01', '936000000000000001');
    const body = '000201' + '010211' + Q.buildTLV('26', inner) + '52045999' + '5303360' + extra + '5802ID'
      + Q.buildTLV('59', 'TOKO 010211 TEST') + Q.buildTLV('60', 'JAKARTA') + '6304';
    return body + Q.crc16ccitt(body);
  };
  const S = mk();
  ok('static fixture validates', Q.validateStaticQris(S).ok === true && Q.validateStaticQris(S).poi === '11');
  const D = Q.buildDynamicQris(S, 1037);
  const tags = Object.fromEntries(Q.parseTLV(D).map(t => [t.tag, t.value]));
  ok('dynamic: tag01=12 and tag54=1037', tags['01'] === '12' && tags['54'] === '1037');
  ok('dynamic: merchant name containing "010211" is NOT corrupted (TLV-safe, no string.replace)', tags['59'] === 'TOKO 010211 TEST');
  ok('dynamic: CRC recomputed and valid', D.slice(-4) === Q.crc16ccitt(D.slice(0, -4)));
  ok('dynamic: tag54 sits right before country tag 58', D.includes('54041037' + '5802ID'));
  ok('dynamic: re-converting an already-dynamic payload replaces the amount', (() => {
    const t = Object.fromEntries(Q.parseTLV(Q.buildDynamicQris(D, 1111)).map(x => [x.tag, x.value]));
    return t['54'] === '1111' && Q.parseTLV(Q.buildDynamicQris(D, 1111)).filter(x => x.tag === '54').length === 1;
  })());
  ok('CRC tampering is detected', Q.validateStaticQris(S.slice(0, -4) + '0000').ok === false);
  for (const bad of [0, -5, 1.5, '12a', '0123', NaN, Infinity]) {
    let threw = false; try { Q.buildDynamicQris(S, bad); } catch (e) { threw = e instanceof Q.QrisError; }
    ok(`buildDynamicQris rejects amount ${String(bad)}`, threw);
  }
  ok('buildDynamicQris rejects garbage payload', (() => { try { Q.buildDynamicQris('abc', 1000); return false; } catch (e) { return e instanceof Q.QrisError; } })());

  // unique code picker: 2 digits first, 3 digits when the 2-digit range is full
  const taken = new Set();
  const first = B.pickSuffix(taken, 1000, () => 0);
  ok('pickSuffix prefers 2 digits (10..99)', first >= 10 && first <= 99);
  for (let s = 10; s <= 99; s++) taken.add(1000 + s);
  const third = B.pickSuffix(taken, 1000, () => 0);
  ok('pickSuffix falls back to 3 digits when 10..99 are busy', third >= 100 && third <= 999, String(third));
  for (let s = 100; s <= 999; s++) taken.add(1000 + s);
  ok('pickSuffix returns null when 2- and 3-digit codes are all busy', B.pickSuffix(taken, 1000) === null);
  ok('pickSuffix skips a single free 2-digit slot correctly', (() => {
    const t = new Set(); for (let s = 10; s <= 99; s++) if (s !== 57) t.add(1000 + s);
    return B.pickSuffix(t, 1000) === 57;
  })());
  ok('paymentExpiresAt = created_at + 30 min', B.paymentExpiresAt({ created_at: '2026-11-06 02:00:00' }) === '2026-11-06T02:30:00.000Z');
}

// ── 4. Sidebar Watermark & AuthManager Credit State Transitions ───────
console.log('\n[AuthManager] Watermark & Sidebar State Transitions');
{
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const authCode = fs.readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8');

  const mkEl = () => ({
    classList: {
      hidden: true,
      add(c) { if (c === 'hidden') this.hidden = true; },
      remove(c) { if (c === 'hidden') this.hidden = false; },
      toggle(c, force) { if (c === 'hidden') this.hidden = force !== undefined ? Boolean(force) : !this.hidden; }
    }
  });
  const elements = {
    'btn-watermark-login': mkEl(),
    'btn-watermark-pay': mkEl(),
    'badge-watermark-clean': mkEl()
  };
  const sandbox = {
    window: { dispatchEvent() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      readyState: 'complete',
      getElementById(id) { return elements[id] || null; },
      querySelectorAll() { return []; },
      addEventListener() {}
    },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);
  const AM = sandbox.window.AuthManager;

  // 1) Not logged in -> watermark visible, login button shown
  AM._user = null;
  AM._updateCreditsUi();
  ok('guest -> shouldShowWatermark() === true', AM.shouldShowWatermark() === true);
  ok('guest -> #btn-watermark-login visible', elements['btn-watermark-login'].classList.hidden === false && elements['btn-watermark-pay'].classList.hidden === true && elements['badge-watermark-clean'].classList.hidden === true);

  // 2) Logged in with 3 bonus credits -> watermark removed, clean badge shown
  AM._user = { id: 'u1', email: 'u1@example.com', role: 'user', plan: 'free', printCredits: 3 };
  AM._updateCreditsUi();
  ok('logged in (credits=3) -> shouldShowWatermark() === false', AM.shouldShowWatermark() === false);
  ok('logged in (credits=3) -> #badge-watermark-clean visible', elements['badge-watermark-clean'].classList.hidden === false && elements['btn-watermark-pay'].classList.hidden === true && elements['btn-watermark-login'].classList.hidden === true);

  // 3) Credits exhausted (0) -> watermark reappears, button resets to unpaid (#btn-watermark-pay)
  AM.setCredits(0);
  ok('credits exhausted (0) -> shouldShowWatermark() === true', AM.shouldShowWatermark() === true);
  ok('credits exhausted (0) -> #btn-watermark-pay visible (reset to unpaid)', elements['btn-watermark-pay'].classList.hidden === false && elements['badge-watermark-clean'].classList.hidden === true && elements['btn-watermark-login'].classList.hidden === true);

  // 4) QRIS deposit (+1 credit) -> watermark removed again, clean badge restored
  AM.setCredits(1);
  ok('after QRIS deposit (credits=1) -> shouldShowWatermark() === false', AM.shouldShowWatermark() === false);
  ok('after QRIS deposit (credits=1) -> #badge-watermark-clean restored', elements['badge-watermark-clean'].classList.hidden === false && elements['btn-watermark-pay'].classList.hidden === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
