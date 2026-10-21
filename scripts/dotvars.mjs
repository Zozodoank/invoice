/**
 * scripts/dotvars.mjs — satu parser untuk file bergaya .dev.vars.
 *
 * Dipakai bersama oleh local-preview-server.mjs, verify-api.mjs dan
 * generate-macro-md2.mjs supaya server luring, harness uji, dan generator makro
 * SELALU membaca kunci yang sama (kutipan, komentar baris, dan CRLF ditangani
 * di satu tempat). Nilai sengaja TIDAK dipotong dari tanda '#' di dalamnya,
 * karena secret acak boleh memuat karakter tersebut.
 */
import fs from 'node:fs';
import path from 'node:path';

export function readDotVars(rootDir, file = '.dev.vars') {
  const full = path.isAbsolute(file) ? file : path.join(rootDir, file);
  const out = {};
  if (!fs.existsSync(full)) return out;
  for (const rawLine of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = stripQuotes(m[2].trim());
  }
  return out;
}

/** "abc" | 'abc' | `abc` -> abc; nilai tanpa kutip dikembalikan apa adanya. */
function stripQuotes(value) {
  const m = value.match(/^(['"`])([\s\S]*)\1$/);
  return m ? m[2] : value;
}
