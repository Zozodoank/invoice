# 🧾 Invoice Generator Pro (InvoiceCraft)

Aplikasi web modern, responsif, dan lengkap untuk membuat, mengelola, mencetak, dan mengekspor faktur / invoice tagihan secara instan tanpa perlu instalasi server atau dependensi tambahan.

## 🚀 Cara Menjalankan
Cukup buka file `index.html` langsung di browser favorit Anda (Google Chrome, Microsoft Edge, Mozilla Firefox, Opera, atau Safari) dengan klik ganda (*double-click*).

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
   - Pilihan status faktur: *Lunas (Paid), Menunggu Pembayaran (Pending), Jatuh Tempo (Overdue), Draft, Dibatalkan (Cancelled)*.

4. **Multi-Mata Uang & Format Angka**:
   - Mendukung **IDR (Rp)**, **USD ($)**, **EUR (€)**, **GBP (£)**, **SGD (S$)**, **JPY (¥)**, **MYR (RM)**, dan **AUD (A$)**.
   - Pemisah ribuan dan desimal otomatis.

5. **Kalkulasi, Diskon & Fitur Pajak Fleksibel**:
   - Fitur **Enable / Disable Pajak (PPN)** dengan satu klik toggle switch.
   - Pilihan cepat tarif PPN 11%, 12%, 0%, atau kustom persen (otomatis non-aktif bila pajak dinonaktifkan).
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
