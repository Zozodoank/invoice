# 🧾 Invoice Generator Pro (InvoiceCraft)

Aplikasi web modern, responsif, dan lengkap untuk membuat, mengelola, mencetak, dan mengekspor faktur / kwitansi / surat jalan secara instan. Backend memakai **Cloudflare Pages + Pages Functions + D1 (SQLite)** — Supabase sudah dilepas sepenuhnya.

> **Catatan:** Halaman statis (`index.html`) masih bisa dibuka langsung untuk mode luring (demo). Namun **login Google, penyimpanan data nyata ke D1, entitlement watermark, dan Portal Superadmin memerlukan backend** — jalankan via `wrangler pages dev` (lihat [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md)) agar `functions/api/*` aktif.

## 🚀 Cara Menjalankan
- **Mode demo luring:** buka `index.html` di browser (klik ganda).
- **Mode penuh (dengan API & auth):** `npx wrangler pages dev . --d1 DB` setelah membuat binding D1 + secret (`SESSION_SECRET`, `SUPERADMIN_EMAIL`). Detail di [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md). Arsitektur & sumber kebenaran dijelaskan di [`docs/architecture.md`](docs/architecture.md).

---

## 🌟 Fitur Utama

1. **Editor Interaktif & Pratinjau Real-Time (WYSIWYG)**:
   - Setiap perubahan nama, alamat, item, harga, diskon, atau pajak langsung terlihat secara real-time pada kertas A4 pratinjau.
   - Dilengkapi kontrol Zoom (Perkecil, Perbesar, Reset 100%).

2. **5 Template Desain Invoice Profesional**:
   - **Modern Slate**: Desain modern dengan aksen warna dan tabel berkelas.
   - **Minimalist Swiss**: Tampilan monokrom bersih, rapi, dan elegan.
   - **Executive Corporate**: Format resmi perusahaan dengan header bar formal.
   - **Creative Bold**: Desain kreatif dengan sentuhan gradasi warna dinamis.
   - **Thermal Receipt (80mm)**: Format struk/nota kasir mini siap cetak.

3. **Personalisasi & Branding**:
   - Upload logo bisnis/perusahaan (PNG/JPG).
   - Palet pilihan warna aksen identitas brand (Biru, Hijau Emerald, Ungu Violet, Merah, Amber, Navy, atau Custom Color Picker).
   - Pilihan status faktur: *Lunas (Paid), Menunggu Pembayaran (Pending), Jatuh Tempo (Overdue), Draft, Dibatalkan (Cancelled)* lengkap dengan kotak centang **Enable / Disable Status Faktur** (Tampilkan/Sembunyikan status badge pada invoice).
   - Kotak centang **Enable / Disable Tanggal Jatuh Tempo** (Tampilkan/Sembunyikan tanggal jatuh tempo pada invoice).
   - Kotak centang **Enable / Disable Syarat Pembayaran (Payment Terms)** (Tampilkan/Sembunyikan syarat pembayaran pada invoice).

4. **Multi-Mata Uang & Format Angka**:
   - Mendukung **IDR (Rp)**, **USD ($)**, **EUR (€)**, **GBP (£)**, **SGD (S$)**, **JPY (¥)**, **MYR (RM)**, dan **AUD (A$)**.
   - Dilengkapi opsi kotak centang **2 Desimal (,00)** untuk fleksibilitas tampilan nominal mata uang berdesimal atau bulat.
   - Pemisah ribuan dan desimal otomatis.

5. **Kalkulasi, Diskon & Fitur Pajak Fleksibel**:
   - Fitur **Enable / Disable Pajak (PPN)** dengan satu klik toggle switch.
   - Pilihan cepat tarif PPN 11%, 12%, 0%, atau kustom persen (otomatis non-aktif bila pajak dinonaktifkan).
   - Fitur **Enable / Disable Diskon Global** (% atau nominal) dengan satu klik toggle switch.
   - Perhitungan diskon per item (% atau nominal) & diskon global.
   - Ongkos kirim / biaya tambahan dan uang muka (DP).
   - Menghasilkan kalimat **Terbilang** otomatis dalam Bahasa Indonesia (*"Satu Juta Dua Ratus..."*) atau Bahasa Inggris.

6. **Rekening Pembayaran & QR Code**:
   - Tambah banyak rekening bank / e-wallet (BCA, Mandiri, BRI, QRIS, dll.).
   - Generator QR Code otomatis untuk scan tautan pembayaran atau verifikasi faktur.

7. **Tanda Tangan Digital (Canvas Signature Pad)**:
   - Goreskan tanda tangan langsung menggunakan mouse atau layar sentuh (touchscreen) pada smartphone/tablet.
   - Nama penandatangan & jabatan.

8. **Ekspor & Berbagi Sekali Klik**:
   - **Unduh PDF Berkualitas Tinggi**: Menggunakan `html2pdf.js` dengan resolusi tajam.
   - **Cetak Langsung (Print Preview)**: Dilengkapi CSS `@media print` presisi ukuran kertas A4 tanpa terpotong.
   - **Kirim ke WhatsApp**: Membuat format teks tagihan otomatis yang siap dikirim langsung ke nomor WhatsApp klien.
   - **Kirim via Email**: Tautan `mailto:` dengan subjek dan format email rapi.

9. **Manajemen Riwayat & Dashboard Faktur (LocalStorage)**:
   - Simpan invoice yang sedang dibuat ke riwayat lokal browser.
   - Modal riwayat lengkap dengan ringkasan statistik (Total Faktur, Total Nominal, Total Lunas, Total Pending).
   - Pencarian berdasarkan nama klien atau nomor faktur & filter status.
   - Ekspor & Impor Backup seluruh database invoice dalam format JSON.

10. **Tampilan Responsif & Dark Mode**:
    - Nyaman digunakan di layar desktop, laptop, tablet, maupun smartphone.
    - Toggle mode gelap (Dark Mode) dan mode terang (Light Mode).

11. **Portal Superadmin & Autentikasi Google OAuth (Otoritatif Server)**:
    - Sesi adalah **cookie HttpOnly/SameSite=Lax bertanda tangan HMAC**; peran `superadmin` diputuskan **server** dari kolom DB (`is_superadmin`) + kecocokan `SUPERADMIN_EMAIL`, bukan dari input klien.
    - Menonaktifkan `is_superadmin`/`is_active` langsung **mencabut akses** pada request berikutnya (guard membaca ulang DB).
    - Dashboard metrik pengguna, estimasi MRR (harga efektif per pengguna), dan status langganan — semuanya via API admin (`functions/api/admin/*`) ke D1.
    - CRUD pengguna, atur paket + masa aktif (addMonths dengan clamp akhir bulan; lifetime = flag, bukan sentinel tanggal), suspend/activate, dan atur harga paket.

12. **Proteksi Watermark Pintar (Entitlement Server)**:
    - **Belum login → selalu berwatermark.** Pendaftar baru mendapat **bonus 3 dokumen tanpa watermark** (1 invoice + 1 kwitansi + 1 surat jalan), dicatat di kolom DB `trial_*_used`.
    - Setelah bonus habis dan plan `free`/`expired` → watermark aktif lagi. **Superadmin & pelanggan berbayar aktif → bebas watermark** selamanya selama aktif.
    - `hasWatermark` adalah **read-only dari server** (`/api/entitlements`); klien tidak dapat menimpanya. Nilai yang sama dipakai template, PDF, cetak, WhatsApp, dan Email agar konsisten.

13. **Keamanan Frontend (XSS/CSP/Upload)**:
    - Helper `js/sanitize.js` (`esc`/`escAttr`/`safeColor`); upload logo/signature divalidasi MIME + ukuran lalu di-*re-encode* via canvas (buang markup SVG); *allow-list* template; CSP `meta` di tiap halaman; toast memakai `textContent`.

14. **Integrasi Cloudflare D1 (SQLite Database)**:
    - Skema database serverless SQLite pada `cloudflare_d1_schema.sql`; API berbasis file di `functions/` dengan binding `env.DB` dan guard `scopedUserId` (anti-IDOR).
