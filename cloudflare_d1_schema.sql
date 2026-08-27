-- ==============================================================================
-- CLOUDFLARE D1 DATABASE SCHEMA (SQLITE) - INVOICE GENERATOR PRO
-- ==============================================================================
-- Cara Menjalankan di Cloudflare Workers / Pages D1:
-- 1. Buat database D1:
--    npx wrangler d1 create invoicecraft_db
--
-- 2. Jalankan skema ini ke database lokal/remote:
--    Local:  npx wrangler d1 execute invoicecraft_db --local --file=./cloudflare_d1_schema.sql
--    Remote: npx wrangler d1 execute invoicecraft_db --remote --file=./cloudflare_d1_schema.sql
-- ==============================================================================

-- 1. TABEL PENGGUNA (USERS & OAUTH)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,
    oauth_provider TEXT DEFAULT 'google',
    oauth_id TEXT,
    is_superadmin INTEGER DEFAULT 0, -- 1: Superadmin, 0: Normal User
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
    subscription_expires_at DATETIME, -- NULL untuk Free / Lifetime
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
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    
    -- Branding & Desain
    template TEXT DEFAULT 'modern',
    accent_color TEXT DEFAULT '#2563eb',
    currency TEXT DEFAULT 'IDR',
    language TEXT DEFAULT 'id',
    
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
    enable_discount INTEGER DEFAULT 1,
    tax_rate REAL DEFAULT 11,
    enable_tax INTEGER DEFAULT 1,
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
-- INDEX UNTUK PERFORMA QUERY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);

-- ==============================================================================
-- SEED DATA PAKET DEFAULT
-- ==============================================================================
INSERT OR IGNORE INTO plans (id, name, price, billing_interval, max_invoices_per_month, max_templates, can_use_qr, can_use_signature, can_export_whatsapp)
VALUES 
    ('free', 'Free Starter', 0, 'month', 5, 1, 0, 0, 1),
    ('pro', 'Pro Member', 79000, 'month', -1, 5, 1, 1, 1),
    ('enterprise', 'Enterprise / Agency', 249000, 'month', -1, 5, 1, 1, 1);

-- ==============================================================================
-- SEED DATA DUMMY SUPERADMIN
-- CATATAN: Email 'dumy@mail.com' di bawah ini adalah placeholder.
-- Anda dapat mengubahnya ke email Superadmin asli Anda (misal: megakomindo@gmail.com) di Cloudflare D1.
-- ==============================================================================
INSERT OR IGNORE INTO users (id, email, name, avatar_url, phone, is_superadmin)
VALUES (
    'usr_superadmin_dummy',
    'dumy@mail.com',
    'Super Administrator',
    'https://api.dicebear.com/7.x/bottts/svg?seed=SuperAdmin',
    '0812-3456-7890',
    1
);

INSERT OR IGNORE INTO tenants (id, owner_id, name, slug, plan, subscription_expires_at, is_active)
VALUES (
    'ten_superadmin_dummy',
    'usr_superadmin_dummy',
    'Master Superadmin Workspace',
    'master-superadmin-workspace',
    'enterprise',
    '2099-12-31 23:59:59',
    1
);
