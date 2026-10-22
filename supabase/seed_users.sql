-- ============================================================
-- SQL UNTUK 2 AKUN UJI COBA & PERBAIKAN PERMISSION RLS
-- ============================================================

-- 1. PASTIKAN EKSTENSI PGCRYPTO AKTIF
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PERBAIKI STRUKTUR FOREIGN KEY PADA PROFILES (AGAR FLEKSIBEL)
-- Hapus batasan foreign key ketat jika ada, agar admin bisa menambahkan data profil langsung
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. PERBAIKI ATURAN ROW LEVEL SECURITY (RLS)
-- Izinkan SELECT untuk umum & terotentikasi (agar mesin scanner bisa mencocokkan wajah)
DROP POLICY IF EXISTS "Profiles can be viewed by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
CREATE POLICY "Public profiles read"
ON public.profiles FOR SELECT
USING (true);

-- Izinkan INSERT & UPDATE untuk profil (admin atau user terkait)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile update" ON public.profiles;
CREATE POLICY "Allow profile insert"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow profile update"
ON public.profiles FOR UPDATE
USING (true);

-- Perbaiki Policy Attendances
DROP POLICY IF EXISTS "Attendances read policy" ON public.attendances;
DROP POLICY IF EXISTS "Public attendances read" ON public.attendances;
CREATE POLICY "Public attendances read"
ON public.attendances FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendances;
DROP POLICY IF EXISTS "Public attendances insert" ON public.attendances;
CREATE POLICY "Public attendances insert"
ON public.attendances FOR INSERT
WITH CHECK (true);


-- 4. BUAT 2 AKUN DI AUTH.USERS (ADMIN & SISWA)
-- Menggunakan pgcrypto untuk enkripsi bcrypt password standar Supabase

DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_siswa_id UUID := 'b0000000-0000-0000-0000-000000000002';
BEGIN
    -- Hapus akun lama jika ada agar bersih
    DELETE FROM auth.users WHERE email IN ('admin@sekolah.id', 'siswa@sekolah.id');
    DELETE FROM public.profiles WHERE id IN (v_admin_id, v_siswa_id) OR nis = '2021006';

    -- A. INSERT AKUN 1: ADMIN (admin@sekolah.id / admin123)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_admin_id,
        'authenticated',
        'authenticated',
        'admin@sekolah.id',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"nama":"Administrator Sekolah","role":"admin"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    -- Simpan profil Admin di tabel profiles
    INSERT INTO public.profiles (id, nama, nis, role)
    VALUES (v_admin_id, 'Administrator Sekolah', 'ADMIN-01', 'admin')
    ON CONFLICT (id) DO UPDATE SET 
        nama = EXCLUDED.nama,
        role = EXCLUDED.role;


    -- B. INSERT AKUN 2: SISWA (siswa@sekolah.id / siswa123) - Hilmy Pratama
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_siswa_id,
        'authenticated',
        'authenticated',
        'siswa@sekolah.id',
        crypt('siswa123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"nama":"Hilmy Pratama","nis":"2021006","role":"siswa"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    -- Simpan profil Siswa di tabel profiles
    INSERT INTO public.profiles (id, nama, nis, role)
    VALUES (v_siswa_id, 'Hilmy Pratama', '2021006', 'siswa')
    ON CONFLICT (id) DO UPDATE SET 
        nama = EXCLUDED.nama,
        nis = EXCLUDED.nis,
        role = EXCLUDED.role;

END $$;
