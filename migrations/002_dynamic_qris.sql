-- migrations/002_dynamic_qris.sql
-- Untuk database D1 YANG SUDAH ADA (produksi). Database baru cukup memakai cloudflare_d1_schema.sql.
-- Jalankan SEKALI:
--   npx wrangler d1 execute invoicemega_db --remote --file=migrations/002_dynamic_qris.sql
--
-- Perubahan:
--  1. billing_config.qris_static_payload  : teks payload QRIS statis (untuk QRIS dinamis).
--  2. document_payments.total_amount tidak lagi UNIQUE global. Keunikan hanya antar baris 'pending'
--     (indeks parsial), sehingga kode unik 'paid'/'expired' bisa dipakai ulang. Tanpa ini slot
--     kode unik habis permanen karena setiap pembayaran menahan nominalnya selamanya.

ALTER TABLE billing_config ADD COLUMN qris_static_payload TEXT;

CREATE TABLE document_payments_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('invoice','kwitansi','surat-jalan','credit')),
    doc_id TEXT NOT NULL,
    base_amount INTEGER NOT NULL,
    suffix INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME
);
INSERT INTO document_payments_new (id, user_id, doc_type, doc_id, base_amount, suffix, total_amount, status, created_at, paid_at)
    SELECT id, user_id, doc_type, doc_id, base_amount, suffix, total_amount, status, created_at, paid_at FROM document_payments;
DROP TABLE document_payments;
ALTER TABLE document_payments_new RENAME TO document_payments;

CREATE INDEX IF NOT EXISTS idx_doc_payments_doc ON document_payments(doc_type, doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_payments_status ON document_payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_payments_pending_amount ON document_payments(total_amount) WHERE status = 'pending';

