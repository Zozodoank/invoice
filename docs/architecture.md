# Arsitektur InvoiceCraft

Dokumen ini adalah **sumber kebenaran** tunggal untuk memahami sistem, kontrak data, dan status fitur (documented / implemented / planned). Lihat juga [`DEPLOY_CLOUDFLARE.md`](../DEPLOY_CLOUDFLARE.md) untuk panduan deploy.

---

## 1. Ringkasan Arsitektur

```
Browser (HTML/JS statis, di-host Cloudflare Pages)
   │  fetch credentials:'include'  (js/api.js)
   ▼
Cloudflare Pages Functions  (folder functions/, file-based routing)
   │  env.DB (binding D1)  +  env secrets (SESSION_SECRET, SUPERADMIN_EMAIL)
   ▼
Cloudflare D1 (SQLite)      — satu-satunya penyimpanan data nyata
```

- **Supabase dilepas total** — tidak ada klien/RPC Supabase lagi; `cloudflare_d1_schema.sql` adalah skema tunggal.
- **Browser tidak pernah dipercaya.** Sesi, role, plan, watermark, dan kuota trial selalu diputuskan server dari kolom DB.
- **`localStorage` hanya mirror** (cache luring) bernamespace `key::<userId>`; sumber kebenaran tetap D1 via API. Mode luring murni (buka `index.html` via `file://`) tetap jalan sebagai demo, tanpa login/sinkronisasi.

## 2. Keamanan & Model Data (prinsip)

| Prinsip | Implementasi |
|---|---|
| Sesi server-signed | Cookie HttpOnly/Secure/SameSite=Lax berisi payload + HMAC-SHA256 (`SESSION_SECRET`); diverifikasi di `functions/_middleware.js` → `context.data.session` |
| Login Google | ID token diverifikasi via JWKS RS256 + cek `aud`/`iss`/`exp`/`email_verified` (`functions/_shared/google.js` → `POST /api/auth/google`) |
| Role superadmin | **Dua kunci**: `email === env.SUPERADMIN_EMAIL` **DAN** kolom DB `users.is_superadmin = 1`. Tidak pernah dibaca dari bodyrequest |
| Pencabutan akses | Guard (`requireAuth`/`requireSuperadmin`) membaca ulang baris `users` tiap request → menonaktifkan `is_active`/`is_superadmin` mencabut akses seketika |
| Anti-IDOR | Semua query dokumen `WHERE user_id = ?` dari sesi (`scopedUserId`), bukan dari body |
| Watermark otoritatif | `has_watermark` dihitung & disimpan server saat `POST /api/{doc}` (`_shared/entitlements.js` + `docstore.js`); klien read-only. Verifikasi ulang pra-ekspor: `POST /api/export/verify` |
| XSS | `js/sanitize.js` (`esc`/`escAttr`/`safeColor`), toast `textContent`, delegasi event pengganti inline `onclick` (Portal Superadmin), CSP meta di semua halaman, allow-list template, re-encode upload logo/signature via canvas |
| Tarif & pembayaran otoritatif | Harga efektif (promo vs normal + jendela tanggal Asia/Jakarta), suffix 2 digit unik, dan status lunas selalu dihitung server (`_shared/billing.js`). `/api/payments/confirm` tanpa sesi — dilindungi secret `X-Payment-Key` (bandingkan konstan-waktu); bocoran secret hanya bisa melunasi nominal pending yang memang ada, tak menyentuh role/plan |

## 3. Kontrak Frontend ↔ Backend

- Peta kanonik field didefinisikan **satu kali** di [`js/db-mapping.js`](../js/db-mapping.js) (camelCase UI ↔ snake_case DB). Worker (`functions/_shared/docstore.js`) meng-echo nama kolom yang sama — field yang dirender = field yang dikirim API = kolom DB.
- `items` dokumen disimpan dua jalur: snapshot `items_json` (otoritatif saat load) **dan** baris tabel `*_items` (ternormalisasi, untuk query/report nanti).
- Total uang invoice dihitung **otoritatif di server** (`_shared/calc.js`, meniru `js/calculations.js`): line-total bersifat *tax-exclusive*, PPN = pajak item + pajak global, `enableDiscount/enableTax` hanya aktif bila `=== true`.

## 4. Peta Endpoint

| Rute (Functions) | Metode | Fungsi | Guard |
|---|---|---|---|
| `/api/config` | GET | `GOOGLE_CLIENT_ID` publik (satu sumber) | publik |
| `/api/auth/google` | POST | Verifikasi credential → upsert user → cookie sesi | publik |
| `/api/auth/logout` | POST | Hapus cookie sesi | login |
| `/api/me` | GET | Identitas + role dari DB | login |
| `/api/entitlements` | GET | Snapshot watermark/trial/plan dari DB | login |
| `/api/invoices`, `/api/kwitansis`, `/api/surat-jalans` | GET/POST | Daftar milik user; simpan (validasi + server totals + konsumsi trial) | login |
| `/api/{doc}/:id` | DELETE | Hapus (scoped `user_id`) | login |
| `/api/export/verify` | POST | Konfirmasi `hasWatermark` final pra-ekspor (DB, tak bisa di-override klien) | login |
| `/api/admin/users` | GET/POST | List/search + create user | superadmin |
| `/api/admin/users/:id` | PUT/DELETE | Update field non-privilese; delete (proteksi akun superadmin) | superadmin |
| `/api/admin/users/:id/status` | POST | Suspend/activate (proteksi superadmin) | superadmin |
| `/api/admin/users/:id/plan` | POST | Set plan/interval/harga efektif/lifetime/expiry (addMonths clamp) | superadmin |
| `/api/admin/plans` | GET/POST | Daftar & upsert harga paket | superadmin |
| `/api/admin/billing` | GET/POST | Tarif per-dokumen (promo/normal), jendela masa promo, gambar QRIS statis | superadmin |
| `/api/admin/payments` | GET | Statistik + riwayat pembayaran QRIS | superadmin |
| `/api/payments/intent` | POST | Request bayar 1 dokumen → nominal = tarif efektif + suffix 2 digit unik (scoped `user_id`; `alreadyClean` bila tak perlu bayar) | login |
| `/api/payments/status` | POST | Poll status pembayaran milik sendiri | login |
| `/api/payments/confirm` | POST | Konfirmasi dari **makro MacroDroid** (bukan browser): header `X-Payment-Key` + `{amount}` → cocok pending → lunas + flip `has_watermark=0` dokumen | secret webhook |

## 5. Status Fitur: Documented / Implemented / Planned

| Fitur | Documented (README/UI) | Implemented (kode) | Planned / Catatan |
|---|---|---|---|
| Login Google OAuth + sesi HttpOnly | ✅ | ✅ | Email+password **tidak** ada (Google-only) |
| Portal Superadmin (CRUD user, plan, suspend, MRR) | ✅ | ✅ | — |
| Watermark server-authoritative + bonus 3 dokumen trial | ✅ | ✅ | Watermark tetap dirender klien (html2pdf) — batasan diterima; keandalan dijaga `/api/export/verify` |
| CRUD dokumen ke D1 + mirror localStorage bernamespace | ✅ | ✅ | Rekonsiliasi data lama → lihat backlog |
| Kalkulasi PPN/diskon otoritatif (server = klien) | ✅ | ✅ | — |
| Tanggal WIB (`Asia/Jakarta`, `dd/mm/yyyy`), multi-mata-uang, slug nama file | ✅ | ✅ | — |
| Proteksi XSS/CSP/upload | ✅ | ✅ (bertahap) | `esc()` belum 100% di semua baris template lama → sapu penuh = follow-up; `script-src 'self'` aktif hanya setelah semua inline handler hilang |
| Multi-tenant (`tenant_id`) | ❌ | ❌ (kolom ada, tak dipakai) | Ditunda — UI tidak mendukung; kepemilikan kini per `user_id` |
| **SUKET** (`daftar_suket`) | ❌ | ❌ | **Backlog** — diminta di brief awal, belum pernah ada implementasinya |
| Field **RT/RW** alamat | ❌ | ❌ | **Backlog** |
| **Volume m³** auto-calc (P×L×T/1000) | ❌ | ❌ | **Backlog** — header kolom terkait sudah dinamai ulang "Qty" agar tidak menyesatkan |
| **Cascade alih-kepemilikan** dokumen | ❌ | ❌ | **Backlog** |
| **QRIS EMVCo** dinamis (payload dibuat server) | ❌ | ❌ | **Backlog** — yang aktif kini **QRIS statis + suffix 2 digit** via MacroDroid (baris di bawah) |
| **Tarif per-dokumen QRIS statis** (promo Rp 1.000 / normal Rp 2.000, masa promo diatur superadmin; konfirmasi via MacroDroid → watermark hilang per dokumen) | ✅ (`docs/macrodroid-interactive-qris.md`) | ✅ (`billing_config`, `document_payments`, `/api/admin/billing`, `/api/payments/*`) | Generator `.wrangler/tmp/macro-out/*.md2` best-effort (format proprietary; hasil memuat secret, sengaja di luar root aset Pages) — panduan manual jalur resmi |
| Impor backup localStorage lama → D1 sekali jalan | ❌ | ❌ | **Backlog** (`/api/import/local` — validasi per-record, merge, bukan overwrite buta) |

> Fitur berstatus **Backlog** tidak aktif di UI dan tidak dijanjikan README. Kolom DB yang belum terpakai dibiarkan kosong (default aman), bukan dihapus, agar migrasi berikutnya tidak destruktif.

## 6. Konfigurasi & Secret

| Nama | Bentuk | Lokasi |
|---|---|---|
| `DB` (binding D1 `invoicemega_db`) | Binding | Dashboard Pages: **Settings → Functions → D1** (build Git mengabaikan `[[d1_databases]]` di `wrangler.toml`; bagian itu hanya dokumentasi + dipakai `wrangler pages dev`) |
| `GOOGLE_CLIENT_ID`, `TZ` | Var publik | `wrangler.toml` `[vars]` (dev) + dashboard Variables (produksi) |
| `SESSION_SECRET`, `SUPERADMIN_EMAIL` | Secret | `wrangler pages secret put --project-name=invoice` (prod) / `.dev.vars` (lokal, gitignored) |
| `PAYMENT_WEBHOOK_SECRET` | Secret | Kunci `X-Payment-Key` untuk `/api/payments/confirm` (makro MacroDroid); `wrangler pages secret put` / `.dev.vars` |

`.dev.vars` dibaca oleh **tiga** tool lewat parser bersama `scripts/dotvars.mjs`:
`local-preview-server.mjs` (menyalanya server), `verify-api.mjs` (membuat cookie
superadmin untuk uji), dan `generate-macro-md2.mjs` (mengisi `X-Payment-Key`).
File itu adalah satu-satunya tempat nilai secret bisa dilihat kembali, jadi jangan
dihapus. Root aset Pages = seluruh repo (`pages_build_output_dir = "."`), sehingga
berkas dev (`.dev.vars`, `dist/`, `backups/`, `.wrangler/`) dikecualikan dari upload
oleh `.pageignore` di root repo.

Skema: `cloudflare_d1_schema.sql` (diterapkan via `wrangler d1 execute`). File `supabase_schema.sql`/`migrasi1*` lama sudah dihapus dari repo.
