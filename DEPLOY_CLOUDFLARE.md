# 🚀 Panduan Lengkap Deploy Invoice Generator ke Cloudflare Pages

Panduan ini menjelaskan cara mempublikasikan website **Invoice Generator Pro** ke **Cloudflare Pages** secara gratis, super cepat, memiliki sertifikat SSL otomatis, dan performa CDN global tanpa batas kuota bandwidth.

---

## 📌 Ringkasan 3 Metode Deploy

| Metode | Tingkat Kesulitan | Waktu | Cocok Untuk |
|---|---|---|---|
| **Metode 1: Direct Upload (Drag & Drop)** | ⭐ Sangat Mudah | ~1 Menit | Pemula / Tanpa Git |
| **Metode 2: Terhubung ke GitHub / GitLab** | ⭐⭐ Mudah | ~3 Menit | Update otomatis saat push kode |
| **Metode 3: Cloudflare Wrangler CLI** | ⭐⭐⭐ Menengah | ~2 Menit | Developer / Terminal |

---

## ⚡ METODE 1: Direct Upload (Paling Cepat - 1 Menit)

Metode ini tidak memerlukan instalasi Git ataupun Node.js.

### Langkah-langkah:
1. **Buka Dashboard Cloudflare**:
   - Kunjungi [https://dash.cloudflare.com](https://dash.cloudflare.com) dan login ke akun Cloudflare Anda.
2. **Navigasi ke Menu Pages**:
   - Pada sidebar kiri, klik menu **Workers & Pages** -> pilih **Create application**.
   - Pilih tab **Pages** -> klik tombol **Upload assets** (*Direct Upload*).
3. **Beri Nama Proyek**:
   - Masukkan *Project name*, contoh: `invoice-generator-pro`.
4. **Unggah Folder Proyek**:
   - Tarik (*drag-and-drop*) seluruh folder proyek `invoice-generator` (yang berisi `index.html`, `css/`, dan `js/`) ke kotak unggah Cloudflare.
   - Atau klik *Select folder* lalu pilih folder:
     `C:\Users\SEMOGA AWET\.gemini\antigravity\scratch\invoice-generator`
5. **Klik "Deploy site"**:
   - Cloudflare akan memproses dan website Anda langsung aktif dengan domain gratis:
     👉 `https://invoice-generator-pro.pages.dev`

---

## 🔄 METODE 2: Deploy via GitHub (Continuous Deployment)

Jika Anda ingin website otomatis terupdate setiap kali melakukan perubahan kode:

### Langkah-langkah:
1. **Push Proyek ke Repository GitHub**:
   - Buat repository baru di GitHub (misal: `invoice-generator-pro`).
   - Push berkas dari komputer Anda ke repository tersebut:
     ```bash
     git init
     git add .
     git commit -m "Initial release Invoice Generator"
     git branch -M main
     git remote add origin https://github.com/USERNAME/invoice-generator-pro.git
     git push -u origin main
     ```
2. **Hubungkan di Cloudflare Pages**:
   - Masuk ke **Cloudflare Dashboard** -> **Workers & Pages** -> **Create application** -> **Pages**.
   - Pilih **Connect to Git** dan hubungkan akun GitHub Anda.
   - Pilih repository `invoice-generator-pro`.
3. **Pengaturan Build**:
   - *Framework preset*: **None** (Plain HTML/JS)
   - *Build command*: (Biarkan kosong)
   - *Build output directory*: `.` (atau biarkan kosong/root)
4. **Klik "Save and Deploy"**:
   - Selesai! Setiap kali Anda melakukan `git push`, Cloudflare Pages akan otomatis mem-build dan memperbarui website secara instan.

---

## 💻 METODE 3: Deploy via Wrangler CLI (Command Line)

Jika Anda menyukai deployment langsung via terminal/PowerShell:

1. **Instal & Login Wrangler**:
   ```powershell
   npx wrangler login
   ```
2. **Deploy Langsung Folder ke Cloudflare Pages**:
   ```powershell
   cd "C:\Users\SEMOGA AWET\.gemini\antigravity\scratch\invoice-generator"
   npx wrangler pages deploy . --project-name=invoice-generator-pro
   ```

---

## 🌐 Menghubungkan Custom Domain Sendiri (Opsional)

Jika Anda memiliki domain pribadi (misal: `faktur.perusahaananda.com` atau `invoicemu.com`):

1. Masuk ke halaman proyek di **Cloudflare Dashboard** -> **Workers & Pages** -> pilih proyek `invoice-generator-pro`.
2. Klik tab **Custom domains**.
3. Klik tombol **Set up a custom domain**.
4. Masukkan nama domain/subdomain Anda (misal: `invoice.domainanda.com`).
5. Klik **Continue** -> Cloudflare akan otomatis mengonfigurasi DNS Record dan menerbitkan sertifikat SSL/HTTPS gratis.

---

## 🛡️ Pengaturan Supabase di Cloudflare Pages (Jika Menggunakan Database)

Jika mengintegrasikan Supabase Client ke frontend:
1. Pada proyek Cloudflare Pages, buka tab **Settings** -> **Environment variables**.
2. Tambahkan variabel:
   - `SUPABASE_URL`: `https://xxxxxxxxxxxx.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. Variabel ini siap digunakan oleh frontend script.
