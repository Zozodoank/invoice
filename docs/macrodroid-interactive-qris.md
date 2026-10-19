# 📱 Makro MacroDroid — Konfirmasi Pembayaran QRIS "Interactive QRIS"

Makro ini menjembatani **QRIS statis** dengan backend InvoiceCraft. Karena QRIS
statis tidak bisa membedakan transaksi, server menempelkan **2 digit unik** pada
nominal (mis. tarif promo Rp 1.000 + kode `37` → user membayar **Rp 1.037**).
Makro membaca notifikasi masuk dari aplikasi bank/e-wallet merchant, mengekstrak
nominal, lalu melaporkan ke `POST /api/payments/confirm`. Jika nominal cocok
dengan pembayaran `pending`, dokumen itu otomatis **bebas watermark**.

> File `.md2` hasil generator (`node scripts/generate-macro-md2.mjs`) bersifat
> **best-effort** — format ekspor MacroDroid proprietary dan bisa berubah antar
> versi, sehingga import bisa gagal. **Panduan manual di bawah adalah jalur
> resmi**; gunakan .md2 hanya sebagai percobaan cepat.

---

## 0. Persiapan (sekali)

1. Deploy Pages + secret: `npx wrangler pages secret put PAYMENT_WEBHOOK_SECRET`
   (nilai = kunci acak yang juga Anda masukkan di makro ini; lihat DEPLOY_CLOUDFLARE.md §3).
2. Ganti seluruh `<APP.pages.dev>` di bawah dengan URL produksi Anda.
3. Di HP: pasang **MacroDroid**, izinkan akses notifikasi (Settings → MacroDroid →
   Notification Access), matikan **battery optimization** untuk MacroDroid, dan
   aktifkan **auto-start / keep-alive** (agar makro tidak tertidur).

## 1. Trigger

- **Pemicu → Notifikasi → Notifikasi Diterima (Notification Received)**
- Pilih aplikasi sumber notifikasi pembayaran merchant Anda (contoh: BRImo, BCA
  mobile, DANA, OVO, ShopeePay, GoPay, atau aplikasi "Interactive QRIS" jika ia
  yang memunculkan notifikasi dana masuk). Boleh lebih dari satu aplikasi.
- Tambahkan **Pembatas (Constraint)**:
  - *Teks notifikasi mengandung* → `QRIS` (atau kata kunci lain yang selalu
    muncul di notif dana masuk aplikasi Anda, mis. `dana masuk` / `received`).
  - *Cooldown (Konstrain)* → 15 detik (mencegah eksekusi dobel untuk notif yang sama).

## 2. Aksi (urut atas → bawah)

1. **Variabel → Set Variable** `%amtRaw` (Local String) =
   regex `[0-9]{1,3}(\.[0-9]{3})+|[0-9]+` diambil dari *Notification Text*,
   pilih cocok **terakhir** (notif biasanya menulis nominal paling besar/terakhir,
   mis. "Anda telah menerima pembayaran **Rp 1.037,00** via QRIS").
   > Sesuaikan bila format notif aplikasi Anda berbeda — yang penting hasil
   > `%amtRaw` adalah angka nominal rupiah dengan titik ribuan.
2. **Variabel → Set Variable** `%amt` (Local Integer) =
   `%amtRaw%` dengan penghapusan karakter `.` (gunakan Replace/RegEx: `[^0-9]` → ``)
   lalu konversi ke integer. Contoh: `1.037,00` → `1037`.
   > Jika notif menampilkan sen (`103700` untuk Rp 1.037,00), bagi 100 lebih dulu.
3. **Network → HTTP Post**
   - URL: `https://<APP.pages.dev>/api/payments/confirm`
   - Body (Raw / application/json): `{"amount": %amt%}`
   - Header: `X-Payment-Key: <PAYMENT_WEBHOOK_SECRET>` dan `Content-Type: application/json`
   - Simpan respons → `%httpResp%` (Store Response = Output Variable).
4. **Dialog → Toast / Popup** (opsional, hanya bila perlu debug):
   tampilkan `%httpResp%` — respons `{"matched":true,...}` berarti pembayaran
   tercatat; `{"matched":false}` berarti nominal tidak dikenal (abaikan).

## 3. Verifikasi end-to-end

1. Buka `superadmin.html` → kartu **Tarif & QRIS**: aktifkan promo (Rp 1.000),
   unggah gambar QRIS statis merchant, simpan.
2. Sebagai user free (kredit trial habis): simpan invoice → ber-watermark →
   klik **Bayar QRIS** di riwayat → muncul mis. `Rp 1.037`.
3. Bayar nominal **persis** itu dari aplikasi pembeli ke QRIS merchant Anda.
4. Saat notifikasi dana masuk di HP → makro berjalan → dalam ≤ 16 detik modal
   user mendeteksi **lunas** dan preview bebas watermark.
5. Cek di superadmin: baris "Riwayat QRIS" bertambah `1 lunas` + omzet.

## 4. Pemecahan masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| Toast `{"matched":false}` terus | Regex nominal salah ambil angka lain (mis. no. referensi) | Persempit konstrain teks & ambil cocok setelah kata "Rp" |
| Makro tidak jalan saat layar mati | Doze/battery optimization | Matikan optimasi baterai + battery saver untuk MacroDroid |
| `401` | `X-Payment-Key` ≠ secret server | Samakan nilai, jangan ada spasi |
| Nominal > Rp 10 juta ditolak | Batas validasi endpoint | Wajar — tarif per dokumen kecil |
| `Slot pembayaran penuh` (503) | Semua suffix 10–99 base sama sedang pending | Tunggu ≤24 jam (pending kedaluwarsa otomatis) atau selesaikan pembayaran yang menggantung |
