-- ==============================================================================
-- CLOUDFLARE D1 (SQLITE) MIGRATION 1: KWITANSI, SURAT JALAN & TRANSAKSI MANUAL SUPERADMIN
-- ==============================================================================
-- Nama File: migrasi1.sql / migrasi1
-- Deskripsi: 
-- 1. Modul Kwitansi (Official Receipts) & Item Rincian Transaksi
-- 2. Modul Surat Jalan (Delivery Orders / Cargo) & Item Muatan Barang
-- 3. Modul Superadmin: Penetapan Harga Paket Sendiri & Rekening Transfer Manual
-- 4. Modul Transaksi Manual di Luar Aplikasi (Pencatatan Transfer, Bukti Bayar & Verifikasi)
-- 5. Multi-Tenant, User Isolation, Foreign Key Cascading & Index Performa Tinggi
--
-- Cara Menjalankan di Cloudflare Workers / Pages D1 via Wrangler CLI:
--
-- 1. Uji Coba di Database D1 Lokal:
--    npx wrangler d1 execute invoicecraft_db --local --file=./migrasi1.sql
--
-- 2. Terapkan Langsung ke Database D1 Cloudflare Produksi (Remote):
--    npx wrangler d1 execute invoicecraft_db --remote --file=./migrasi1.sql
-- ==============================================================================

-- Aktifkan Foreign Keys Enforcement untuk SQLite
PRAGMA foreign_keys = ON;

-- ==============================================================================
-- 1. TABEL KWITANSI (OFFICIAL PAYMENT RECEIPTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS kwitansis (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    
    -- Identitas Kwitansi
    receipt_number TEXT NOT NULL,
    reference_number TEXT,
    show_reference_number INTEGER DEFAULT 1,
    receipt_date DATE NOT NULL,
    sender_city TEXT DEFAULT 'Jakarta',
    status TEXT DEFAULT 'paid' CHECK(status IN ('paid', 'dp', 'installment', 'partial', 'deposit', 'cancelled')),
    show_status INTEGER DEFAULT 1,
    
    -- Format & Desain
    template TEXT DEFAULT 'classic' CHECK(template IN ('classic', 'modern', 'minimalist', 'detailed')),
    paper_format TEXT DEFAULT 'landscape' CHECK(paper_format IN ('landscape', 'a4')),
    accent_color TEXT DEFAULT '#2563eb',
    currency TEXT DEFAULT 'IDR',
    use_decimals INTEGER DEFAULT 0,
    has_watermark INTEGER DEFAULT 1,
    
    -- Data Pengirim / Kop Surat
    show_company_header INTEGER DEFAULT 1,
    sender_name TEXT,
    sender_address TEXT,
    sender_phone TEXT,
    sender_email TEXT,
    logo_url TEXT,
    
    -- Data Pembayar / Penerima Kwitansi
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_address TEXT,
    
    -- Rincian Pembayaran Pokok
    payment_for TEXT NOT NULL,
    amount REAL DEFAULT 0,
    show_terbilang INTEGER DEFAULT 1,
    custom_terbilang TEXT,
    enable_items INTEGER DEFAULT 0, -- 0: Nominal Tunggal, 1: Multi-Item Rincian
    
    -- Diskon & Pajak
    enable_discount INTEGER DEFAULT 0,
    discount_type TEXT DEFAULT 'percent' CHECK(discount_type IN ('percent', 'fixed')),
    discount_value REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    enable_tax INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 11,
    tax_amount REAL DEFAULT 0,
    
    -- Bea Meterai
    enable_meterai INTEGER DEFAULT 1, -- Kotak Meterai Rp 10.000
    add_meterai_fee INTEGER DEFAULT 0, -- Bebankan Rp 10.000 ke Total
    meterai_fee REAL DEFAULT 0,
    
    -- Total Kalkulasi
    subtotal REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,
    
    -- Metode Pembayaran
    show_payment_method INTEGER DEFAULT 1,
    payment_method TEXT DEFAULT 'Transfer Bank',
    bank_name TEXT,
    bank_account TEXT,
    bank_holder TEXT,
    cheque_number TEXT,
    
    -- Stempel Digital
    show_stamp INTEGER DEFAULT 1,
    stamp_text TEXT DEFAULT 'LUNAS',
    stamp_color TEXT DEFAULT 'red' CHECK(stamp_color IN ('red', 'blue', 'emerald')),
    
    -- Tanda Tangan & Otorisasi
    show_signature INTEGER DEFAULT 1,
    signer_name TEXT,
    signer_title TEXT,
    signature_data TEXT, -- Base64 Data URL
    
    -- QR Code & Catatan
    show_qr_code INTEGER DEFAULT 1,
    qr_payload TEXT,
    show_notes INTEGER DEFAULT 1,
    notes TEXT,
    
    -- Snapshot JSON Cadangan (untuk restore cepat di frontend)
    items_json TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. TABEL ITEM RINCIAN KWITANSI (UNTUK TEMPLATE DETAIL / VOUCHER KAS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS kwitansi_items (
    id TEXT PRIMARY KEY,
    kwitansi_id TEXT NOT NULL REFERENCES kwitansis(id) ON DELETE CASCADE,
    item_index INTEGER DEFAULT 0,
    name TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'Paket',
    price REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. TABEL SURAT JALAN (DELIVERY ORDERS / BUKTI PENGIRIMAN LOGISTIK)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS surat_jalans (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    
    -- Identitas Dokumen
    delivery_number TEXT NOT NULL,
    po_number TEXT,
    show_po_number INTEGER DEFAULT 1,
    invoice_number TEXT,
    show_invoice_number INTEGER DEFAULT 1,
    delivery_date DATE NOT NULL,
    sender_city TEXT DEFAULT 'Jakarta',
    status TEXT DEFAULT 'in_transit' CHECK(status IN ('in_transit', 'ready', 'delivered', 'completed', 'partial', 'draft')),
    show_status INTEGER DEFAULT 1,
    
    -- Format & Desain
    template TEXT DEFAULT 'warehouse' CHECK(template IN ('warehouse', 'corporate', 'minimalist', 'cargo')),
    paper_size TEXT DEFAULT 'a4' CHECK(paper_size IN ('a4', 'a5')),
    accent_color TEXT DEFAULT '#d97706',
    has_watermark INTEGER DEFAULT 1,
    
    -- Pihak Pengirim (Gudang Asal)
    show_company_header INTEGER DEFAULT 1,
    sender_name TEXT,
    sender_address TEXT,
    logo_url TEXT,
    show_sender_contact INTEGER DEFAULT 1,
    sender_pic TEXT,
    sender_phone TEXT,
    
    -- Pihak Penerima (Alamat Tujuan Serah-Terima)
    recipient_name TEXT NOT NULL,
    recipient_address TEXT,
    show_recipient_contact INTEGER DEFAULT 1,
    recipient_pic TEXT,
    recipient_phone TEXT,
    
    -- Informasi Ekspedisi & Armada Angkutan
    show_shipping_info INTEGER DEFAULT 1,
    driver_name TEXT,
    vehicle_type TEXT,
    plate_number TEXT,
    tracking_number TEXT,
    estimated_arrival TEXT,
    show_seal_number INTEGER DEFAULT 1,
    seal_number TEXT, -- Nomor Segel Keamanan Kontainer/Truk
    
    -- Konfigurasi Kolom Tabel
    show_sku_column INTEGER DEFAULT 1,
    show_item_condition INTEGER DEFAULT 1,
    
    -- Multi-Party Signatures (Penerima, Supir, Gudang, Otorisasi)
    show_multi_signature INTEGER DEFAULT 1, -- 1: 4 Kolom, 0: 3 Kolom Standar
    recipient_signer_name TEXT,
    driver_signer_name TEXT,
    warehouse_officer_name TEXT,
    authorizer_name TEXT,
    authorizer_title TEXT,
    show_digital_sign INTEGER DEFAULT 1,
    signature_data TEXT, -- Base64 Data URL
    
    -- Stempel Digital Logistik
    show_stamp INTEGER DEFAULT 1,
    stamp_text TEXT DEFAULT 'DIKIRIM',
    stamp_color TEXT DEFAULT 'amber' CHECK(stamp_color IN ('amber', 'emerald', 'blue', 'red')),
    
    -- QR Tracking & Ketentuan
    show_qr_code INTEGER DEFAULT 1,
    qr_payload TEXT,
    show_notes INTEGER DEFAULT 1,
    notes TEXT,
    
    -- Snapshot JSON Cadangan (untuk restore cepat di frontend)
    items_json TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. TABEL ITEM MUATAN / BARANG SURAT JALAN
-- ==============================================================================
CREATE TABLE IF NOT EXISTS surat_jalan_items (
    id TEXT PRIMARY KEY,
    surat_jalan_id TEXT NOT NULL REFERENCES surat_jalans(id) ON DELETE CASCADE,
    item_index INTEGER DEFAULT 0,
    sku TEXT,
    name TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'Colli',
    condition TEXT DEFAULT 'Segel Utuh',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. TABEL KONFIGURASI HARGA PAKET OLEH SUPERADMIN (SUPERADMIN PRICING CONTROL)
-- ==============================================================================
-- Digunakan ketika Superadmin mengubah tarif harga paket secara mandiri di halaman Superadmin
CREATE TABLE IF NOT EXISTS plan_price_configs (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,               -- Harga langganan (Rupiah) yang ditentukan Superadmin
    billing_interval TEXT DEFAULT 'month' CHECK(billing_interval IN ('month', 'year', 'lifetime', 'once')),
    description TEXT,                     -- Keterangan / deskripsi paket dari Superadmin
    payment_instructions TEXT,            -- Instruksi cara transfer manual yang ditentukan Superadmin
    updated_by TEXT REFERENCES users(id), -- Superadmin penentu harga
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 6. TABEL REKENING TUJUAN TRANSFER MANUAL MILIK PLATFORM / SUPERADMIN
-- ==============================================================================
-- Daftar rekening bank atau nomor e-wallet Superadmin untuk menerima transfer offline/manual
CREATE TABLE IF NOT EXISTS platform_payment_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,              -- BCA, Mandiri, BNI, BRI, QRIS
    account_number TEXT NOT NULL,         -- Nomor Rekening
    account_holder TEXT NOT NULL,         -- Atas Nama (A.N.)
    qris_image_url TEXT,                  -- URL Gambar QRIS jika ada
    instructions TEXT,                    -- Instruksi konfirmasi (misal: Kirim bukti transfer ke WA Admin)
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 7. TABEL TRANSAKSI PEMBAYARAN MANUAL DI LUAR APLIKASI (MANUAL OFFLINE TRANSACTIONS)
-- ==============================================================================
-- Mencatat seluruh transaksi pembayaran manual yang dikonfirmasi langsung oleh Superadmin
CREATE TABLE IF NOT EXISTS manual_transactions (
    id TEXT PRIMARY KEY,
    transaction_code TEXT UNIQUE NOT NULL, -- Kode unik transaksi, misal: TRX-M-202609-001
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    
    -- Finansial & Kesepakatan Harga Superadmin
    standard_price INTEGER NOT NULL DEFAULT 0,  -- Harga paket dasar
    agreed_price INTEGER NOT NULL,              -- Harga yang disepakati/ditetapkan Superadmin (manual deal)
    discount_amount INTEGER DEFAULT 0,          -- Potongan harga manual
    
    -- Masa Aktif Langganan
    duration_months INTEGER DEFAULT 1,          -- Durasi perpanjangan (1, 3, 6, 12 bulan, atau -1 untuk lifetime)
    start_date DATE NOT NULL,
    end_date DATE,                              -- Tanggal berakhir langganan
    
    -- Rincian Transfer Manual
    payment_method TEXT DEFAULT 'Transfer Bank Manual', -- BCA, Mandiri, Cash, QRIS Manual, dll.
    destination_account TEXT,                  -- Rekening tujuan Superadmin
    sender_account_name TEXT,                  -- Nama pengirim transfer
    sender_bank_name TEXT,                     -- Bank asal pengirim
    proof_image_url TEXT,                      -- Bukti transfer (gambar/screenshot/dokumen)
    
    -- Status & Verifikasi Superadmin
    status TEXT DEFAULT 'verified' CHECK(status IN ('pending', 'verified', 'rejected', 'refunded')),
    verified_by TEXT REFERENCES users(id),     -- Superadmin yang memverifikasi transaksi
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_notes TEXT,                          -- Catatan internal Superadmin
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. TABEL PENETAPAN HARGA KHUSUS PER PENGGUNA (USER CUSTOM PRICING DEALS)
-- ==============================================================================
-- Superadmin dapat menentukan harga spesial untuk pengguna/tenant tertentu (diskon partner/B2B)
CREATE TABLE IF NOT EXISTS user_custom_pricings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    custom_price INTEGER NOT NULL,             -- Harga khusus yang ditetapkan Superadmin
    billing_cycle TEXT DEFAULT 'month',        -- Periode ('month', 'year', 'lifetime')
    reason TEXT,                               -- Alasan harga kustom (misal: "Mitra Vendor Prioritas")
    is_active INTEGER DEFAULT 1,
    created_by TEXT REFERENCES users(id),      -- Superadmin
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id)
);

-- ==============================================================================
-- 9. INDEX PERFORMA TINGGI (UNTUK SPEED QUERY DI CLOUDFLARE EDGE D1)
-- ==============================================================================
-- Index Kwitansi
CREATE INDEX IF NOT EXISTS idx_kwitansis_tenant_id ON kwitansis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kwitansis_user_id ON kwitansis(user_id);
CREATE INDEX IF NOT EXISTS idx_kwitansis_receipt_number ON kwitansis(receipt_number);
CREATE INDEX IF NOT EXISTS idx_kwitansis_receipt_date ON kwitansis(receipt_date);
CREATE INDEX IF NOT EXISTS idx_kwitansis_status ON kwitansis(status);
CREATE INDEX IF NOT EXISTS idx_kwitansi_items_kwitansi_id ON kwitansi_items(kwitansi_id);

-- Index Surat Jalan
CREATE INDEX IF NOT EXISTS idx_surat_jalans_tenant_id ON surat_jalans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_surat_jalans_user_id ON surat_jalans(user_id);
CREATE INDEX IF NOT EXISTS idx_surat_jalans_delivery_number ON surat_jalans(delivery_number);
CREATE INDEX IF NOT EXISTS idx_surat_jalans_delivery_date ON surat_jalans(delivery_date);
CREATE INDEX IF NOT EXISTS idx_surat_jalans_status ON surat_jalans(status);
CREATE INDEX IF NOT EXISTS idx_surat_jalan_items_surat_jalan_id ON surat_jalan_items(surat_jalan_id);

-- Index Transaksi Manual & Harga Superadmin
CREATE INDEX IF NOT EXISTS idx_manual_transactions_user_id ON manual_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_transactions_status ON manual_transactions(status);
CREATE INDEX IF NOT EXISTS idx_manual_transactions_code ON manual_transactions(transaction_code);
CREATE INDEX IF NOT EXISTS idx_user_custom_pricings_user ON user_custom_pricings(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_price_configs_plan ON plan_price_configs(plan_id);

-- ==============================================================================
-- 10. SEED DATA AWAL REKENING PLATFORM & KONFIGURASI HARGA
-- ==============================================================================
INSERT OR IGNORE INTO platform_payment_accounts (id, bank_name, account_number, account_holder, instructions)
VALUES 
    ('pay_acc_01', 'Bank Central Asia (BCA)', '8830-1234-5678', 'PT MEGAKOM INDO SUKSES', 'Sertakan keterangan: NAMA & EMAIL saat transfer manual, lalu kirim bukti ke WhatsApp Admin.'),
    ('pay_acc_02', 'Bank Mandiri', '133-00-9876-5432', 'PT MEGAKOM INDO SUKSES', 'Konfirmasi instan ke Admin setelah transfer berhasil.');

INSERT OR IGNORE INTO plan_price_configs (id, plan_id, price, billing_interval, description, payment_instructions)
VALUES 
    ('cfg_free', 'free', 0, 'month', 'Paket gratis untuk kebutuhan pembuatan invoice dasar.', 'Gratis tanpa pembayaran.'),
    ('cfg_pro', 'pro', 79000, 'month', 'Paket Pro fitur lengkap tanpa watermark & ekspor tak terbatas.', 'Transfer manual Rp 79.000 ke BCA/Mandiri lalu konfirmasi.'),
    ('cfg_ent', 'enterprise', 249000, 'month', 'Paket Enterprise lengkap untuk agency & perusahaan.', 'Transfer manual Rp 249.000 ke BCA/Mandiri.');

-- ==============================================================================
-- SELESAI. SKEMA MIGRASI 1 SUKSES DIDEFINISIKAN & SIAP DIJALANKAN.
-- ==============================================================================
