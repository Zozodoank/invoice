/**
 * scripts/local-preview-server.mjs — Dev-only preview server for this repo.
 *
 * The production runtime is Cloudflare Pages Functions + D1 (workerd). On some
 * Windows machines workerd fails to spawn ("write EOF" — missing VC++ runtime,
 * see cloudflare/workers-sdk#9900), so this harness runs the REAL application
 * code (functions/**) on Node with:
 *   - a minimal D1 shim over node:sqlite (prepare/bind/run/first/all),
 *   - the schema from cloudflare_d1_schema.sql applied idempotently,
 *   - file-based routing equivalent to Pages Functions ([id] -> params.id),
 *   - static assets served from the repo root (like Pages).
 *
 * Usage:  node scripts/local-preview-server.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { readDotVars } from './dotvars.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8788);

// ---------- env (same values Pages injects) ----------
// Parser sama dengan verify-api.mjs / generate-macro-md2.mjs (lihat dotvars.mjs).
const devVars = readDotVars(ROOT);
const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
const googleClientId = (toml.match(/^GOOGLE_CLIENT_ID\s*=\s*"([^"]+)"/m) || [])[1] || '';
const tz = (toml.match(/^TZ\s*=\s*"([^"]+)"/m) || [])[1] || 'Asia/Jakarta';

// ---------- D1 shim over node:sqlite ----------
const dbFile = path.join(ROOT, '.wrangler', 'state', 'preview.sqlite');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const sqlite = new DatabaseSync(dbFile);
sqlite.exec(fs.readFileSync(path.join(ROOT, 'cloudflare_d1_schema.sql'), 'utf8'));

const D1 = {
  prepare(sql) {
    const stmt = sqlite.prepare(sql);
    const call = (method) => (...args) => {
      try {
        if (method === 'all') return { results: stmt.all(...args) };
        if (method === 'first') { const r = stmt.get(...args); return r === undefined ? null : r; }
        if (method === 'run') { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) }, success: true }; }
        if (method === 'batch') { for (const q of args[0]) sqlite.exec(q); return []; }
      } catch (e) {
        console.error('[D1 shim] SQL failed:', sql, '\n  args:', JSON.stringify(args), '\n  err:', e.message);
        throw Object.assign(new Error(e.message), { status: 500 });
      }
    };
    const bound = {
      bind: (...vals) => ({
        run: call('run')(...vals),
        first: (col) => call('first')(...vals),
        all: (col) => call('all')(...vals),
        raw: () => call('all')(...vals).results,
        ...Object.fromEntries(['run', 'first', 'all'].map(m => [m, call(m)]))
      }),
      run: call('run'),
      first: call('first'),
      all: call('all'),
      batch: call('batch')
    };
    // bind(...) must return an object whose run/first/all actually receive vals:
    bound.bind = (...vals) => ({
      run: () => call('run')(...vals),
      first: () => call('first')(...vals),
      all: () => call('all')(...vals),
      raw: () => call('all')(...vals).results
    });
    return bound;
  }
};

const env = {
  DB: D1,
  SESSION_SECRET: devVars.SESSION_SECRET || 'insecure-dev-secret',
  SUPERADMIN_EMAIL: devVars.SUPERADMIN_EMAIL || '',
  // Shared secret the MacroDroid bridge sends as X-Payment-Key (dev value comes
  // from .dev.vars; in production it is a wrangler secret, never a var).
  PAYMENT_WEBHOOK_SECRET: devVars.PAYMENT_WEBHOOK_SECRET || '',
  GOOGLE_CLIENT_ID: googleClientId,
  TZ: tz,
  CF_PAGES: '1'
};

// ---------- Pages-Functions-equivalent routing ----------
const FN_ROOT = path.join(ROOT, 'functions');
const middleware = await import(pathToFileURL(path.join(FN_ROOT, '_middleware.js')).href);

/** Resolve a URL pathname to { file, params } using static-then-[id] segments. */
function route(pathname) {
  const rel = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const base = path.join(FN_ROOT, rel);
  if (fs.existsSync(base + '.js')) return { file: base + '.js', params: {} };
  if (fs.existsSync(path.join(base, 'index.js'))) return { file: path.join(base, 'index.js'), params: {} };
  // fall back: replace trailing dynamic segments with [id]
  const parts = rel.split('/');
  for (let i = parts.length - 1; i >= 1; i--) {
    const tryParts = [...parts.slice(0, i), '[id]', ...parts.slice(i + 1)];
    const cand = path.join(FN_ROOT, ...tryParts) + '.js';
    if (fs.existsSync(cand)) {
      return { file: cand, params: { id: parts[i], ...(parts.length > i + 2 ? { sub: parts.slice(i + 1, parts.length - 1).join('/') } : {}) } };
    }
  }
  return null;
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const match = route(url.pathname);
      if (!match) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Not found' })); }
      const mod = await import(pathToFileURL(match.file).href + '?v=' + Date.now());
      const method = req.method.toLowerCase();
      const handler = mod['onRequest' + method[0].toUpperCase() + method.slice(1)] || mod.onRequest;
      if (!handler) { res.writeHead(405); return res.end('Method not allowed'); }
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
        ? await new Promise((resolve) => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); })
        : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: body && body.length ? body : undefined });
      const context = {
        request, env, params: match.params, data: {},
        waitUntil() {}, passThroughOnException() {},
        next: async () => new Response(null, { status: 404 })
      };
      const mwRes = await middleware.onRequest({ ...context, next: async () => new Response(null, { status: 200 }) });
      // middleware only populates context.data; ignore its passthrough response
      void mwRes;
      const apiRes = await handler(context);
      const txt = await apiRes.text();
      // Forward every response header (Cache-Control, etc.) so the harness behaves
      // like Pages Functions; set-cookie is handled separately below.
      const outHeaders = {};
      apiRes.headers.forEach((v, k) => { if (k.toLowerCase() !== 'set-cookie') outHeaders[k] = v; });
      if (!outHeaders['content-type']) outHeaders['content-type'] = 'application/json';
      res.writeHead(apiRes.status, outHeaders);
      const cookies = apiRes.headers.getSetCookie ? apiRes.headers.getSetCookie() : [];
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      return res.end(txt);
    }
    // static assets
    let file = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const abs = path.join(ROOT, file);
    if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(abs)] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    res.writeHead(e.status === 400 ? 400 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => console.log(`InvoiceCraft preview (real functions code + node:sqlite D1): http://localhost:${PORT}`));
