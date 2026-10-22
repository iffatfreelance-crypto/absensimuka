-- ============================================================
-- SQL: MENAMBAHKAN KOLOM USERNAME & PASSWORD KE TABEL PROFILES
-- ============================================================

-- 1. TAMBAHKAN KOLOM USERNAME & PASSWORD JIKA BELUM ADA
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- 2. PASTIKAN INDEX UNTUK PERFORMA LOGIN CEPAT
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 3. PASTIKAN IZIN (RLS) TIDAK MENGHALANGI LOGIN & CRUD
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public profiles insert" ON public.profiles;
CREATE POLICY "Public profiles insert" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public profiles update" ON public.profiles;
CREATE POLICY "Public profiles update" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public profiles delete" ON public.profiles;
CREATE POLICY "Public profiles delete" ON public.profiles FOR DELETE USING (true);

-- Policy untuk tabel attendances
DROP POLICY IF EXISTS "Public attendances read" ON public.attendances;
CREATE POLICY "Public attendances read" ON public.attendances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public attendances insert" ON public.attendances;
CREATE POLICY "Public attendances insert" ON public.attendances FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public attendances update" ON public.attendances;
CREATE POLICY "Public attendances update" ON public.attendances FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public attendances delete" ON public.attendances;
CREATE POLICY "Public attendances delete" ON public.attendances FOR DELETE USING (true);


-- 4. MASUKKAN 2 AKUN UJI COBA LANGSUNG KE TABEL PROFILES
-- Akun 1: Admin (username: admin / password: admin123)
-- Akun 2: Siswa (username: hilmy / password: siswa123 / nis: 2021006)

INSERT INTO public.profiles (id, nama, nis, username, password, role)
VALUES 
    (
        'a0000000-0000-0000-0000-000000000001',
        'Administrator Sekolah',
        'ADMIN-01',
        'admin',
        'admin123',
        'admin'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'Hilmy Pratama',
        '2021006',
        'hilmy',
        'siswa123',
        'siswa'
    )
ON CONFLICT (id) DO UPDATE SET 
    nama = EXCLUDED.nama,
    nis = EXCLUDED.nis,
    username = EXCLUDED.username,
    password = EXCLUDED.password,
    role = EXCLUDED.role;
