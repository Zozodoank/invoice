-- ==============================================================================
-- CLOUDFLARE D1 DATABASE SCHEMA (SQLITE) - INVOICE GENERATOR PRO
-- ==============================================================================
-- Cara Menjalankan di Cloudflare Workers / Pages D1:
-- 1. Buat database D1:
--    npx wrangler d1 create invoicemega_db
--
-- 2. Jalankan skema ini ke database remote (produksi):
--    npx wrangler d1 execute invoicemega_db --remote --file=./cloudflare_d1_schema.sql
--    (hindari --local di Windows: workerd gagal spawn dengan "write EOF";
--     pakai `node scripts/local-preview-server.mjs` yang menerapkan file ini)
--
-- PENTING: semua CREATE memakai IF NOT EXISTS, jadi file ini MENGISI database baru.
-- Untuk database yang sudah punya tabel versi lama, kolom baru TIDAK akan bertambah
-- (error "no such column") - buat database baru atau jalankan ALTER TABLE sendiri.
-- ==============================================================================

-- 1. TABEL PENGGUNA (USERS & OAUTH)
-- Sumber kebenaran untuk role/plan/watermark/trial. Tidak pernah dipercaya dari
-- klien: kolom is_superadmin & plan hanya ditulis oleh Functions (server).
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,
    company TEXT,
    oauth_provider TEXT DEFAULT 'google',
    oauth_id TEXT,
    is_superadmin INTEGER DEFAULT 0, -- 1: Superadmin, 0: Normal User (server-only)
    plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'inactive' CHECK(subscription_status IN ('active', 'inactive', 'expired', 'suspended')),
    subscription_expires_at DATETIME, -- NULL = belum/selamanya(free); '2099...' TIDAK dipakai lagi
    is_lifetime INTEGER DEFAULT 0,    -- 1 = langganan seumur hidup (bukan sentinel tanggal)
    effective_price INTEGER DEFAULT 0, -- harga kesepakatan terakhir (untuk MRR)
    billing_interval TEXT DEFAULT 'month', -- 'month' | 'year'
    notes TEXT,
    -- Bonus pendaftar baru: 1 dokumen tanpa watermark per jenis (invoice/kwitansi/surat jalan)
    trial_invoice_used INTEGER DEFAULT 0,
    trial_kwitansi_used INTEGER DEFAULT 0,
    trial_surat_jalan_used INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,      -- 0 = akun dinonaktifkan (suspend) -> akses dicabut
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABEL PAKET LANGGANAN (SUBSCRIPTION TIERS)
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL, -- dalam Rupiah
    billing_interval TEXT DEFAULT 'month', -- 'month' atau 'year'
    max_invoices_per_month INTEGER DEFAULT 5, -- -1 untuk unlimited
    max_templates INTEGER DEFAULT 1,
    can_use_qr INTEGER DEFAULT 0,
    can_use_signature INTEGER DEFAULT 0,
    can_export_whatsapp INTEGER DEFAULT 1,
    has_watermark INTEGER DEFAULT 1, -- 1: Muncul Watermark 'CONTOH INVOICE', 0: Bebas Watermark
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL TENANT / ORGANISASI / WORKSPACE
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'inactive' CHECK(subscription_status IN ('active', 'inactive', 'expired', 'suspended')),
    subscription_expires_at DATETIME, -- NULL untuk Free / Expired
    is_active INTEGER DEFAULT 1, -- 1: Aktif, 0: Suspended
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABEL REKENING BANK TENANT
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABEL BUKU KONTAK / KLIEN (CLIENTS)
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_id TEXT, -- NPWP
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABEL INVOICES (FAKTUR TAGIHAN)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    reference_number TEXT,
    title TEXT DEFAULT 'INVOICE',
    invoice_date DATE NOT NULL,
    due_date DATE,
    show_due_date INTEGER DEFAULT 1,
    payment_terms TEXT,
    show_payment_terms INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK(status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
    show_status INTEGER DEFAULT 1,
    use_decimals INTEGER DEFAULT 0,
    has_watermark INTEGER DEFAULT 1, -- 1: Ada watermark CONTOH INVOICE jika belum login / subscription inactive
    
    -- Branding & Desain
    template TEXT DEFAULT 'modern',
    accent_color TEXT DEFAULT '#2563eb',
    currency TEXT DEFAULT 'IDR',
    language TEXT DEFAULT 'id',
    logo_url TEXT,
    signature_url TEXT,
    
    -- Snapshot Pengirim
    sender_name TEXT,
    sender_email TEXT,
    sender_phone TEXT,
    sender_address TEXT,
    sender_tax_id TEXT,
    sender_website TEXT,
    
    -- Snapshot Penerima
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    client_address TEXT,
    client_tax_id TEXT,
    
    -- Kalkulasi & Nilai
    subtotal REAL DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    discount_value REAL DEFAULT 0,
    enable_discount INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    enable_tax INTEGER DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    shipping_fee REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    down_payment REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    
    -- Detail & Catatan
    notes TEXT,
    terms TEXT,
    signer_name TEXT,
    signer_title TEXT,
    qr_payload TEXT,
    show_qr_code INTEGER DEFAULT 1,
    
    -- JSON Data Backup (items & bank snapshot)
    items_json TEXT,
    banks_json TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABEL ITEM INVOICE
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_index INTEGER DEFAULT 0,
    name TEXT NOT NULL,
    description TEXT,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'Pcs',
    price REAL DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    discount_value REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABEL LOG AKTIVITAS (AUDIT LOGS)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 9. TABEL KWITANSI (RECEIPT) + ITEM
-- ==============================================================================
CREATE TABLE IF NOT EXISTS kwitansis (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    receipt_date DATE NOT NULL,
    show_reference_number INTEGER DEFAULT 1,
    reference_number TEXT,
    client_name TEXT NOT NULL,
    client_address TEXT,
    payment_for TEXT NOT NULL,
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    use_decimals INTEGER DEFAULT 0,
    method TEXT,
    enable_discount INTEGER DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    discount_value REAL DEFAULT 0,
    enable_tax INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    meterai_fee INTEGER DEFAULT 0,
    stamp_color TEXT DEFAULT 'black',
    show_terbilangan INTEGER DEFAULT 1,
    show_signature INTEGER DEFAULT 1,
    show_qr_code INTEGER DEFAULT 0,
    qr_payload TEXT,
    template TEXT DEFAULT 'classic',
    accent_color TEXT DEFAULT '#059669',
    logo_url TEXT,
    signature_url TEXT,
    signer_name TEXT,
    signer_title TEXT,
    sender_name TEXT,
    notes TEXT,
    status TEXT DEFAULT 'paid' CHECK(status IN ('draft','paid','void','pending')),
    has_watermark INTEGER DEFAULT 1,
    items_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kwitansi_items (
    id TEXT PRIMARY KEY,
    kwitansi_id TEXT NOT NULL REFERENCES kwitansis(id) ON DELETE CASCADE,
    item_index INTEGER DEFAULT 0,
    name TEXT NOT NULL,
    description TEXT,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'Pcs',
    price REAL DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    discount_value REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 10. TABEL SURAT JALAN (DELIVERY NOTE) + ITEM
-- ==============================================================================
CREATE TABLE IF NOT EXISTS surat_jalans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_number TEXT NOT NULL,
    delivery_date DATE NOT NULL,
    reference_number TEXT,
    recipient_name TEXT NOT NULL,
    recipient_address TEXT,
    recipient_pic TEXT,
    recipient_phone TEXT,
    sender_name TEXT,
    sender_address TEXT,
    sender_pic TEXT,
    driver_name TEXT,
    driver_signer_name TEXT,
    warehouse_officer_name TEXT,
    vehicle TEXT,
    po_number TEXT,
    seal_number TEXT,
    delivery_instructions TEXT,
    notes TEXT,
    status TEXT DEFAULT 'in_transit' CHECK(status IN ('draft','in_transit','delivered','cancelled')),
    template TEXT DEFAULT 'corporate',
    accent_color TEXT DEFAULT '#d97706',
    paper_size TEXT NOT NULL DEFAULT 'a4' CHECK (paper_size IN ('a4','a5-landscape')),
    logo_url TEXT,
    signature_url TEXT,
    show_sku_column INTEGER DEFAULT 0,
    show_item_condition INTEGER DEFAULT 0,
    show_seal_number INTEGER DEFAULT 1,
    show_po_number INTEGER DEFAULT 1,
    show_signatures INTEGER DEFAULT 1,
    has_watermark INTEGER DEFAULT 1,
    items_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS surat_jalan_items (
    id TEXT PRIMARY KEY,
    surat_jalan_id TEXT NOT NULL REFERENCES surat_jalans(id) ON DELETE CASCADE,
    item_index INTEGER DEFAULT 0,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'Pcs',
    condition TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 11. KONFIGURASI TARIF PER-DOKUMEN + QRIS STATIS (single row 'default')
-- ==============================================================================
-- promo_active=1 DAN tanggal Jakarta berada dalam [promo_start, promo_end]
-- -> tarif per dokumen = price_promo; selain itu price_normal.
-- qris_image: data URL PNG/JPEG QRIS statis milik merchant (diunggah superadmin).
CREATE TABLE IF NOT EXISTS billing_config (
    id TEXT PRIMARY KEY CHECK (id = 'default'),
    price_promo INTEGER NOT NULL DEFAULT 1000,
    price_normal INTEGER NOT NULL DEFAULT 2000,
    promo_active INTEGER NOT NULL DEFAULT 1,
    promo_start DATE,            -- YYYY-MM-DD, NULL = mulai kapan pun
    promo_end DATE,              -- YYYY-MM-DD inklusif, NULL = tanpa batas
    qris_image TEXT,             -- data URL QRIS statis dari merchant
    qris_note TEXT,              -- instruksi singkat untuk user
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO billing_config (id) VALUES ('default');

-- ==============================================================================
-- 12. PEMBAYARAN PER-DOKUMEN VIA QRIS STATIS
-- ==============================================================================
-- QRIS statis tidak bisa membedakan transaksi, jadi server menempelkan 2 digit
-- unik (suffix 10..99) sebagai akhiran nominal: total_amount = base + suffix.
-- MacroDroid membaca notifikasi bank/e-wallet lalu memanggil
-- POST /api/payments/confirm {amount} -> baris pending yang cocok jadi 'paid'
-- dan dokumen terkait di-flip has_watermark=0.
CREATE TABLE IF NOT EXISTS document_payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('invoice','kwitansi','surat-jalan')),
    doc_id TEXT NOT NULL,
    base_amount INTEGER NOT NULL,        -- tarif efektif saat intent dibuat
    suffix INTEGER NOT NULL,             -- 10..99 (2 digit unik)
    total_amount INTEGER NOT NULL UNIQUE, -- base + suffix; kunci pencocokan notif
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME
);

-- ==============================================================================
-- INDEX UNTUK PERFORMA QUERY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_doc_payments_doc ON document_payments(doc_type, doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_payments_status ON document_payments(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_sub_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id2 ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_kwitansis_user_id ON kwitansis(user_id);
CREATE INDEX IF NOT EXISTS idx_kwitansi_items_kwitansi_id ON kwitansi_items(kwitansi_id);
CREATE INDEX IF NOT EXISTS idx_surat_jalans_user_id ON surat_jalans(user_id);
CREATE INDEX IF NOT EXISTS idx_surat_jalan_items_sj_id ON surat_jalan_items(surat_jalan_id);

-- ==============================================================================
-- SEED DATA PAKET DEFAULT DENGAN ATRIBUT WATERMARK
-- ==============================================================================
INSERT OR IGNORE INTO plans (id, name, price, billing_interval, max_invoices_per_month, max_templates, can_use_qr, can_use_signature, can_export_whatsapp, has_watermark)
VALUES 
    ('free', 'Free Starter', 0, 'month', 5, 1, 0, 0, 1, 1), -- Watermark 'CONTOH INVOICE' Aktif
    ('pro', 'Pro Member', 79000, 'month', -1, 5, 1, 1, 1, 0), -- Bebas Watermark
    ('enterprise', 'Enterprise / Agency', 249000, 'month', -1, 5, 1, 1, 1, 0); -- Bebas Watermark

-- ==============================================================================
-- SEED DATA SUPERADMIN UTAMA
-- ==============================================================================
INSERT OR IGNORE INTO users (id, email, name, avatar_url, phone, is_superadmin, plan, subscription_status, is_lifetime, is_active)
VALUES (
    'usr_superadmin_01',
    'megakomindo@gmail.com',
    'Super Administrator',
    'https://api.dicebear.com/7.x/bottts/svg?seed=SuperAdmin',
    '0812-3456-7890',
    1,
    'enterprise',
    'active',
    1,
    1
);

INSERT OR IGNORE INTO tenants (id, owner_id, name, slug, plan, subscription_status, subscription_expires_at, is_active)
VALUES (
    'ten_superadmin_01',
    'usr_superadmin_01',
    'Megakomindo Master Workspace',
    'megakomindo-master-workspace',
    'enterprise',
    'active',
    '2099-12-31 23:59:59',
    1
);
