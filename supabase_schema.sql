-- ==============================================================================
-- SKEMA DATABASE MULTI-TENANT SUPABASE - INVOICE GENERATOR PRO
-- Didesain untuk Superadmin (jho.j80@gmail.com) & Tenant Admins
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABEL UTAMA (MULTI-TENANCY CORE)
-- ==============================================================================

-- A. Tabel Tenants (Organisasi / Perusahaan)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- B. Tabel Profiles (Menyimpan profil pengguna yang terhubung dengan auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    is_superadmin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- C. Tabel Tenant Members (Hubungan many-to-many user ke tenant beserta role)
CREATE TABLE IF NOT EXISTS public.tenant_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tenant_id, user_id)
);

-- ==============================================================================
-- 3. TABEL BISNIS INVOICE & DATA TENANT
-- ==============================================================================

-- D. Tabel Rekening Bank Tenant
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    account_holder VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- E. Tabel Klien / Kontak Penagihan
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(100), -- NPWP
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- F. Tabel Invoices (Faktur Utama)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100),
    title VARCHAR(100) DEFAULT 'INVOICE',
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    payment_terms VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
    
    -- Branding & Styling
    template VARCHAR(50) DEFAULT 'modern',
    accent_color VARCHAR(50) DEFAULT '#2563eb',
    currency VARCHAR(10) DEFAULT 'IDR',
    language VARCHAR(10) DEFAULT 'id',
    
    -- Pengirim Snapshot
    sender_name VARCHAR(255),
    sender_address TEXT,
    sender_email VARCHAR(255),
    sender_phone VARCHAR(50),
    sender_tax_id VARCHAR(100),
    sender_website VARCHAR(255),
    logo_url TEXT,

    -- Penerima Snapshot
    client_name VARCHAR(255),
    client_address TEXT,
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_tax_id VARCHAR(100),

    -- Kalkulasi Keuangan
    subtotal NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(15, 2) DEFAULT 0,
    enable_tax BOOLEAN DEFAULT true,
    tax_rate NUMERIC(5, 2) DEFAULT 11,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    shipping_fee NUMERIC(15, 2) DEFAULT 0,
    grand_total NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    down_payment NUMERIC(15, 2) DEFAULT 0,
    balance_due NUMERIC(15, 2) DEFAULT 0 NOT NULL,

    -- Tanda Tangan & QR
    notes TEXT,
    terms TEXT,
    show_qr_code BOOLEAN DEFAULT true,
    qr_payload TEXT,
    signer_name VARCHAR(255),
    signer_title VARCHAR(255),
    signature_url TEXT,

    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tenant_id, invoice_number)
);

-- G. Tabel Invoice Items (Rincian Barang/Jasa)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity NUMERIC(12, 4) DEFAULT 1 NOT NULL,
    unit VARCHAR(50) DEFAULT 'Pcs',
    unit_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(15, 2) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    total_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    sort_order INT DEFAULT 0
);

-- H. Tabel Activity Logs (Audit Trail untuk Admin & Superadmin)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g. 'invoice.create', 'invoice.paid', 'tenant.update'
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 4. HELPER FUNCTIONS UNTUK ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Cek apakah user saat ini adalah Superadmin (berdasarkan email jho.j80@gmail.com atau flag is_superadmin)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        (auth.jwt() ->> 'email' = 'jho.j80@gmail.com')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_superadmin = true
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ambil semua tenant_id yang dimiliki oleh user saat ini
CREATE OR REPLACE FUNCTION public.get_auth_tenant_ids()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cek apakah user memiliki role admin/owner di tenant tertentu
CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_superadmin() THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = target_tenant_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 5. AKTIFKAN ROW LEVEL SECURITY (RLS) PADA SEMUA TABEL
-- ==============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. KEBIJAKAN KEAMANAN (RLS POLICIES)
-- ==============================================================================

-- ----- A. TENANTS POLICIES -----
CREATE POLICY "Superadmin Full Access to Tenants" ON public.tenants
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Tenant Members can view their own tenant" ON public.tenants
    FOR SELECT USING (id IN (SELECT public.get_auth_tenant_ids()));

CREATE POLICY "Tenant Admin can update their tenant" ON public.tenants
    FOR UPDATE USING (public.is_tenant_admin(id));

-- ----- B. PROFILES POLICIES -----
CREATE POLICY "Superadmin Full Access to Profiles" ON public.profiles
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Users can view and update their own profile" ON public.profiles
    FOR ALL USING (id = auth.uid());

CREATE POLICY "Members can view profiles of co-members in same tenant" ON public.profiles
    FOR SELECT USING (
        id IN (
            SELECT tm2.user_id FROM public.tenant_members tm1
            JOIN public.tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
            WHERE tm1.user_id = auth.uid()
        )
    );

-- ----- C. TENANT MEMBERS POLICIES -----
CREATE POLICY "Superadmin Full Access to Members" ON public.tenant_members
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Members can view members in their tenants" ON public.tenant_members
    FOR SELECT USING (tenant_id IN (SELECT public.get_auth_tenant_ids()));

CREATE POLICY "Tenant Admin can manage members" ON public.tenant_members
    FOR ALL USING (public.is_tenant_admin(tenant_id));

-- ----- D. BANK ACCOUNTS POLICIES -----
CREATE POLICY "Superadmin Full Access to Bank Accounts" ON public.bank_accounts
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Members can view tenant bank accounts" ON public.bank_accounts
    FOR SELECT USING (tenant_id IN (SELECT public.get_auth_tenant_ids()));

CREATE POLICY "Tenant Admin can manage bank accounts" ON public.bank_accounts
    FOR ALL USING (public.is_tenant_admin(tenant_id));

-- ----- E. CLIENTS POLICIES -----
CREATE POLICY "Superadmin Full Access to Clients" ON public.clients
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Members can view their tenant clients" ON public.clients
    FOR SELECT USING (tenant_id IN (SELECT public.get_auth_tenant_ids()));

CREATE POLICY "Tenant Admin & Members can insert/update clients" ON public.clients
    FOR ALL USING (tenant_id IN (SELECT public.get_auth_tenant_ids()));

-- ----- F. INVOICES POLICIES -----
CREATE POLICY "Superadmin Full Access to Invoices" ON public.invoices
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Members can view their tenant invoices" ON public.invoices
    FOR SELECT USING (tenant_id IN (SELECT public.get_auth_tenant_ids()));

CREATE POLICY "Tenant Admin & Members can insert/update invoices" ON public.invoices
    FOR ALL USING (tenant_id IN (SELECT public.get_auth_tenant_ids()));

-- ----- G. INVOICE ITEMS POLICIES -----
CREATE POLICY "Superadmin Full Access to Invoice Items" ON public.invoice_items
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Members can view invoice items of their tenant invoices" ON public.invoice_items
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM public.invoices WHERE tenant_id IN (SELECT public.get_auth_tenant_ids())
        )
    );

CREATE POLICY "Members can manage invoice items of their tenant invoices" ON public.invoice_items
    FOR ALL USING (
        invoice_id IN (
            SELECT id FROM public.invoices WHERE tenant_id IN (SELECT public.get_auth_tenant_ids())
        )
    );

-- ----- H. ACTIVITY LOGS POLICIES -----
CREATE POLICY "Superadmin Full Access to Activity Logs" ON public.activity_logs
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Tenant Admin can view their tenant activity logs" ON public.activity_logs
    FOR SELECT USING (public.is_tenant_admin(tenant_id));

CREATE POLICY "System can insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 7. AUTO-TRIGGER: REGISTRASI USER BARU & PENETAPAN SUPERADMIN
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    is_user_superadmin BOOLEAN := false;
BEGIN
    -- Cek apakah email yang mendaftar adalah email Superadmin utama
    IF NEW.email = 'megakomindo@gmail.com' THEN
        is_user_superadmin := true;
    END IF;

    -- 1. Masukkan profil baru
    INSERT INTO public.profiles (id, email, full_name, is_superadmin)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        is_user_superadmin
    );

    -- 2. Buat Tenant Default untuk user yang baru mendaftar
    INSERT INTO public.tenants (name, slug, plan)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'company_name', split_part(NEW.email, '@', 1) || ' Workspace'),
        LOWER(REPLACE(split_part(NEW.email, '@', 1), '.', '-')) || '-' || SUBSTRING(NEW.id::text, 1, 6),
        CASE WHEN is_user_superadmin THEN 'enterprise' ELSE 'free' END
    )
    RETURNING id INTO new_tenant_id;

    -- 3. Jadikan user sebagai 'owner' pada tenant miliknya
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (new_tenant_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger pada tabel auth.users Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. INDEX OPTIMASI QUERY MULTI-TENANT
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_tenant ON public.tenant_members(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON public.activity_logs(tenant_id);
