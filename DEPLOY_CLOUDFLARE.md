# 🚀 Panduan Deploy InvoiceCraft ke Cloudflare Pages + Functions + D1

Arsitektur backend aplikasi ini adalah **Cloudflare Pages** (aset statis) + **Pages Functions** (API di folder `functions/`) + **D1** (SQLite). Autentikasi Google OAuth, penyimpanan dokumen, entitlement watermark, dan Portal Superadmin semuanya dilayani oleh Functions dan membaca/menulis D1 — **Supabase sudah dilepas**.

> Keamanan: **jangan pernah** meng-commit atau mengunggah `.env`, kunci rahasia, atau ekspor backup berisi data pengguna. Semua secret dibuat lewat `wrangler secret put`, bukan di file.

---

## 📌 Prasyarat

- Node.js 18+ (untuk `npx wrangler`).
- Akun Cloudflare dengan akses **Pages** dan **D1**.
- **Google OAuth Client ID** (tipe *Web application*) dari Google Cloud Console. Authorized JavaScript origins = domain situs Anda (mis. `https://nama-anda.pages.dev` dan `http://localhost:8788`).

---

## 1️⃣ Buat Database D1 & Terapkan Skema

```bash
# dari folder proyek (root repo), JANGAN memakai path absolut privat
npx wrangler d1 create invoicemega_db
```

Salin `database_id` yang dicetak ke `wrangler.toml` (`[[d1_databases]]`). Lalu terapkan skema:

```bash
# produksi
npx wrangler d1 execute invoicemega_db --remote --file=./cloudflare_d1_schema.sql
```

> ⚠️ **Windows:** `--local` sering gagal dengan `X [ERROR] write EOF` (workerd butuh VC++ redistributable — cloudflare/workers-sdk#9900). Untuk uji luring jalankan `node scripts/local-preview-server.mjs` yang menerapkan skema yang sama lewat `node:sqlite`, jadi tidak perlu `--local` sama sekali.

> Skema tunggal `cloudflare_d1_schema.sql` sudah memuat tabel `users`, `plans`, `invoices/invoice_items`, `kwitansis/kwitansi_items`, `surat_jalans/surat_jalan_items`, `billing_config` (tarif per-dokumen + QRIS statis), dan `document_payments` (pencocokan nominal via suffix 2 digit), beserta baris seed `is_superadmin = 1` untuk email superadmin. Semua statement idempotent (`IF NOT EXISTS` / `OR IGNORE`) sehingga aman dijalankan berulang **untuk membuat database baru dari nol** (`--remote` untuk produksi) — tetapi lihat catatan ALTER di bawah untuk database yang sudah berisi tabel lama. File `migrasi1`/`migrasi1.sql` lama sudah dihapus — tidak perlu dijalankan. Setelah skema diterapkan, unggah gambar QRIS statis Anda lewat kartu **Tarif & QRIS** di halaman superadmin.

Verifikasi hasil migrasi (kolom & foreign key benar):

```bash
npx wrangler d1 execute invoicemega_db --remote --command "PRAGMA foreign_key_check;"
npx wrangler d1 execute invoicemega_db --remote --json --command "SELECT email, is_superadmin, is_active, plan FROM users WHERE email='megakomindo@gmail.com'"
```

> ⚠️ **Penting saat menambah kolom baru:** statement `CREATE TABLE IF NOT EXISTS` **tidak mengubah tabel yang sudah ada** — tabel lama tetap kehilangan kolom baru dan Functions akan error `no such column`. Kalau skema bertambah, buat database baru lalu terapkan file ini, atau jalankan `ALTER TABLE ... ADD COLUMN` secara manual. (2026-10-22: produksi pindah dari `invoicecraft_db` ber-skema lama ke `invoicemega_db`; cadangan lama di `backups/`, tidak di-commit.)

---

## 2️⃣ Konfigurasi Binding & Variabel (`wrangler.toml`)

```toml
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "invoicemega_db"
database_id = "<database_id_anda>"

[vars]
GOOGLE_CLIENT_ID = "<CLIENT_ID publik>"
TZ = "Asia/Jakarta"
```

`GOOGLE_CLIENT_ID` boleh publik (baca lewat `/api/config`). **Jangan** menaruh secret di sini.

---

## 3️⃣ Secret (Hanya via `wrangler secret`)

```bash
# untuk pratinjau lokal, letakkan di .dev.vars (SUDAH di-gitignore):
#   SESSION_SECRET=<acak panjang>
#   SUPERADMIN_EMAIL=megakomindo@gmail.com
#   PAYMENT_WEBHOOK_SECRET=<acak, sama dengan yang dipakai di makro MacroDroid>

# untuk produksi Pages (nama proyek = "invoice", lihat wrangler.toml `name`):
npx wrangler pages secret put SESSION_SECRET          --project-name=invoice
npx wrangler pages secret put SUPERADMIN_EMAIL        --project-name=invoice
npx wrangler pages secret put PAYMENT_WEBHOOK_SECRET  --project-name=invoice

# daftar nama secret (nilai tidak pernah bisa dibaca ulang):
npx wrangler pages secret list --project-name=invoice
```

- `SESSION_SECRET` — kunci HMAC untuk menandatangani cookie sesi.
- `SUPERADMIN_EMAIL` — email yang **boleh** memegang peran superadmin (harus **juga** punya `users.is_superadmin = 1` di DB agar akses diberikan; ini menggandakan kunci sehingga promosi tak mungkin dari input klien).
- `PAYMENT_WEBHOOK_SECRET` — kunci bersama header `X-Payment-Key` pada `POST /api/payments/confirm`; dipanggil makro MacroDroid (bukan browser) saat notifikasi pembayaran QRIS statis masuk. Rotasi = ulangi `secret put` + perbarui makro.

---

## 4️⃣ Jalankan Secara Lokal

```bash
npx wrangler pages dev . --d1 DB=invoicemega_db
```

Buka `http://localhost:8788`. Coba alur: `auth.html` (login Google) → `/api/me` → buat dokumen (tersimpan ke D1) → `/api/entitlements` (watermark) → Portal Superadmin (`superadmin.html`, hanya muncul bila role server = superadmin).

### Alternatif bila `wrangler` gagal di Windows (`X [ERROR] write EOF`)

Error itu datang dari runtime **workerd** bawaan wrangler (bug known: cloudflare/workers-sdk#9900 — biasanya karena Visual C++ Redistributable belum ada: `winget install Microsoft.VCRedist.2015+.x64`). Sebagai cadangan uji, repo ini menyediakan **preview server Node** yang menjalankan **kode `functions/` yang sama** di atas `node:sqlite` (rute & binding sama seperti Pages):

```bash
node scripts/local-preview-server.mjs 8788   # serves app + API di http://localhost:8788
node scripts/verify-api.mjs 8788             # 88 assertion auth/trial/watermark/admin/IDOR
node scripts/verify-units.mjs                # 13 pengecekan esc/safeColor/format/kalkulasi PPN
```

> Preview server hanya untuk uji luring — deploy produksi tetap lewat `wrangler pages deploy` (Pages Functions + D1 asli).
>
> Berkas `.dev.vars` kini juga dibaca oleh `scripts/verify-api.mjs` dan
> `scripts/generate-macro-md2.mjs` (parser bersama di `scripts/dotvars.mjs`), jadi
> ketiga tool memakai kunci yang sama. Bila `.dev.vars` tidak terbaca, keduanya
> mencetak peringatan `!!` dan jatuh ke placeholder publik — jangan diabaikan.

---

## 5️⃣ Deploy

### Metode A — Wrangler CLI (menyertakan Functions)
```bash
npx wrangler pages deploy . --project-name=invoice
```
> Direktori kerja ikut ter-upload apa adanya (`.gitignore` **tidak** dibaca). Berkas
> dev yang mengandung secret (`.dev.vars`, `.env`, `dist/`, `backups/`, `.wrangler/`)
> dilindungi oleh `.pageignore` di root repo — jangan hapus berkas itu, dan jangan
> simpan artefak bera-secret di luar daftar tersebut.

### Metode B — Terhubung ke GitHub (Continuous Deployment)
```bash
git init && git add . && git commit -m "InvoiceCraft: Cloudflare Pages + Functions + D1"
git branch -M main
git remote add origin https://github.com/Zozodoank/invoice.git
git push -u origin main
```
Di Dashboard: **Workers & Pages → Create application → Pages → Connect to Git**.
- *Framework preset*: **None**
- *Build command*: (kosong)
- *Build output directory*: `.`

Setelah proyek terhubung, tambahkan **tiga hal berikut di dashboard** — `wrangler.toml`
TIDAK dipakai untuk ini pada build Git, jadi ketinggalan satu saja membuat API error:
1. **Settings → Environment variables** (Variable): `GOOGLE_CLIENT_ID`, `TZ = Asia/Jakarta`
2. **Settings → Environment variables** (Secrets manager): `SESSION_SECRET`, `SUPERADMIN_EMAIL`, `PAYMENT_WEBHOOK_SECRET`
3. **Settings → Functions → Add bindings → D1**: *binding name* **`DB`**, database **`invoicemega_db`**
   (kalau yang terpasang `invoicecraft_db` ber-skema lama, semua query gagal `no such column`/`no such table`)

> Jangan sampai tertukar dengan **Worker + Settings → Builds**: Worker tidak mengenal folder
> `functions/` dan deploy-nya akan gagal dengan `Missing entry-point to Worker script`.

### Metode C — Direct Upload
Folder proyek (termasuk `functions/`) bisa di-*drag & drop* lewat **Workers & Pages → Upload assets**. Pastikan binding D1 (`DB`) ditambahkan di **Settings → Functions → D1 database bindings**, dan secret ditambahkan di tab yang sama. Folder yang diunggah harus hasil checkout Git (bukan working copy), agar `.dev.vars`/`backups/` tidak ikut naik; `.pageignore` menjadi penjaga kedua.

---

## 6️⃣ Custom Domain (Opsional)

Buka proyek → tab **Custom domains** → **Set up a custom domain** → masukkan domain. Sertifikat HTTPS diterbitkan otomatis. Perbarui **Authorized JavaScript origins** di Google Cloud Console dengan domain baru.

---

## ✅ Checklist Pasca-Deploy

- [ ] **Binding D1 benar**: `GET /api/admin/billing` dengan sesi superadmin → `200` berisi `pricePromo`/`priceNormal`. Bila `500 no such table: billing_config`, binding masih menunjuk `invoicecraft_db`.
- [ ] Login Google menghasilkan cookie sesi HttpOnly & `/api/me` mengembalikan identitas + `role`.
- [ ] `GET /api/config` → `200` (bukti `GOOGLE_CLIENT_ID`/`TZ` terbaca), `GET /api/me` tanpa login → `401` (bukan `500`).
- [ ] QRIS statis sudah diunggah (`/api/admin/billing` → `qrisImage` terisi), karena tanpa itu alur bayar per-dokumen tidak berjalan.
- [ ] Non-superadmin **tidak** bisa membuka `superadmin.html` (dashboard tersembunyi; endpoint admin menolak 403).
- [ ] Pendaftar baru melihat banner bonus 3 dokumen; dokumen ke-4 berwatermark.
- [ ] Dokumen tersimpan/hilang sesuai `user_id` (uji: logout & login akun lain → daftar terpisah).
- [ ] Tidak ada file `.env` / secret / backup yang ter-commit.
