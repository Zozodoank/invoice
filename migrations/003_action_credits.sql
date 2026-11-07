-- migrations/003_action_credits.sql
-- Migrasi untuk sistem Kredit Per Aksi (Print & Unduh PDF)
-- Setiap user baru mendapatkan 3 bonus kredit cetak/unduh (print_credits = 3).
-- Setiap aksi cetak atau unduh PDF mengonsumsi 1 kredit.
-- Jika kredit habis, user dapat membeli kredit seharga Rp 1.000 (promo) via QRIS dinamis.

ALTER TABLE users ADD COLUMN print_credits INTEGER DEFAULT 3;
UPDATE users SET print_credits = 3 WHERE print_credits IS NULL;
