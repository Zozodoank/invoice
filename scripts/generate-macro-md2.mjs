/**
 * scripts/generate-macro-md2.mjs
 * Best-effort generator untuk file ekspor MacroDroid (.md2 = arsip ZIP berisi
 * JSON definisi makro) yang mengonfirmasi pembayaran QRIS statis ke
 * POST /api/payments/confirm.
 *
 * ⚠️ DISCLAIMER: format .md2 MacroDroid bersifat PROPRIETARY dan struktur
 * internalnya bisa berubah antar versi aplikasi. File hasil skrip ini mungkin
 * GAGAL diimpor. Jalur resmi tetap panduan manual:
 *   docs/macrodroid-interactive-qris.md
 *
 * Pakai:          node scripts/generate-macro-md2.mjs [https://app.pages.dev]
 * Hasil:          dist/macrodroid-interactive-qris.md2 (+ .json)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.argv[2] || 'https://YOUR-APP.pages.dev').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Definisi makro (dinormalisasi; field mengikuti konvensi ekspor umum MacroDroid)
// ---------------------------------------------------------------------------
const macro = {
  name: 'QRIS Confirm -> InvoiceCraft',
  category: 'Bisnis',
  description: 'Membaca notifikasi dana masuk QRIS (bank/e-wallet merchant), ' +
    'mengekstrak nominal (base + 2 digit unik), lalu mengonfirmasi ke ' +
    BASE_URL + '/api/payments/confirm dengan header X-Payment-Key. ' +
    'GANTI <GANTI_DENGAN_SECRET> dan aplikasi notifikasi sumber. ' +
    'Panduan resmi: docs/macrodroid-interactive-qris.md',
  uid: 1700000000001,
  active: true,
  triggers: [
    {
      type: 'notification_received',
      parameters: {
        apps: ['com_example.bank'], // TODO: id aplikasi bank/e-wallet merchant Anda
        textFieldContains: 'QRIS'
      }
    }
  ],
  constraints: [
    { type: 'notification_text_contains', parameters: { text: 'QRIS' } },
    { type: 'cooldown', parameters: { seconds: 15 } }
  ],
  actions: [
    {
      type: 'set_variable',
      parameters: { name: 'amtRaw', kind: 'string', source: 'notification_text_regex', regex: '[0-9]{1,3}(\\.[0-9]{3})+|[0-9]+', occurrence: 'last' }
    },
    {
      type: 'set_variable',
      parameters: { name: 'amt', kind: 'integer', expression: 'parseInt("{amtRaw}".replace(/[^0-9]/g, "") || "0")' }
    },
    {
      type: 'http_post',
      parameters: {
        url: `${BASE_URL}/api/payments/confirm`,
        contentType: 'application/json',
        body: '{"amount": {amt}}',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Key': '<GANTI_DENGAN_SECRET>' // = PAYMENT_WEBHOOK_SECRET server
        },
        storeResponseAs: 'httpResp'
      }
    },
    {
      type: 'toast',
      parameters: { text: 'QRIS confirm: {httpResp}', onlyOnError: false }
    }
  ]
};

const jsonText = JSON.stringify({ settings: { exportVersion: 1 }, macros: [macro] }, null, 2);

// ---------------------------------------------------------------------------
// Minimal ZIP writer (metode store, tanpa dependensi) -> .md2
// ---------------------------------------------------------------------------
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let table = crc32._t;
  if (!table) {
    table = crc32._t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function buildZip(fileName, contentBuf) {
  const nameBuf = Buffer.from(fileName, 'utf8');
  const crc = crc32(contentBuf);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);      // local file header signature
  local.writeUInt16LE(20, 4);              // version needed
  local.writeUInt16LE(0, 6);               // flags
  local.writeUInt16LE(0, 8);               // method = store
  local.writeUInt16LE(0, 10);              // mod time
  local.writeUInt16LE(0x5921, 12);         // mod date (2026-01-01-ish, fixed)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(contentBuf.length, 18);
  local.writeUInt32LE(contentBuf.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);              // extra len

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);            // version made by
  central.writeUInt16LE(20, 6);            // version needed
  central.writeUInt16LE(0, 8);             // flags
  central.writeUInt16LE(0, 10);            // method
  central.writeUInt16LE(0, 12);            // mod time
  central.writeUInt16LE(0x5921, 14);       // mod date
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(contentBuf.length, 20);
  central.writeUInt32LE(contentBuf.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);            // extra
  central.writeUInt16LE(0, 32);            // comment
  central.writeUInt16LE(0, 34);            // disk
  central.writeUInt16LE(0, 36);            // internal attrs
  central.writeUInt32LE(0, 38);            // external attrs
  central.writeUInt32LE(0, 42);            // offset of local header

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);                // entries on this disk
  eocd.writeUInt16LE(1, 10);               // total entries
  eocd.writeUInt32LE(46 + nameBuf.length, 12); // central dir size
  eocd.writeUInt32LE(30 + nameBuf.length + contentBuf.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20);               // comment len

  return Buffer.concat([local, nameBuf, contentBuf, central, nameBuf, eocd]);
}

const outDir = path.join(ROOT, 'dist');
mkdirSync(outDir, { recursive: true });
const content = Buffer.from(jsonText, 'utf8');
const md2 = buildZip('macro.json', content);
const md2Path = path.join(outDir, 'macrodroid-interactive-qris.md2');
const jsonPath = path.join(outDir, 'macrodroid-interactive-qris.json');
writeFileSync(md2Path, md2);
writeFileSync(jsonPath, jsonText);

console.log('Ditulis:');
console.log('  ' + md2Path + `  (${md2.length} byte)`);
console.log('  ' + jsonPath);
console.log('\nINGAT: import .md2 bisa gagal (format proprietary).');
console.log('Panduan manual resmi: docs/macrodroid-interactive-qris.md');
console.log(`Isi placeholder <GANTI_DENGAN_SECRET> = PAYMENT_WEBHOOK_SECRET server (${BASE_URL}).`);
