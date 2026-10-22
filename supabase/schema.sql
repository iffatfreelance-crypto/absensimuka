-- ============================================================
-- SKEMA DATABASE SUPABASE: ABSENSI SCAN WAJAH (ABSEN MUKA)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL: PROFILES
-- Menyimpan identitas siswa & admin, serta data vektor sidik wajah (128 angka float)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    nis VARCHAR(50) UNIQUE, -- Nomor Induk Siswa / Username
    role VARCHAR(20) NOT NULL DEFAULT 'siswa' CHECK (role IN ('siswa', 'admin')),
    face_descriptor JSONB, -- Array 128 angka vektor wajah, contoh: [-0.12, 0.08, 0.23, ...]
    avatar_url TEXT, -- Foto pendaftaran wajah siswa
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Index untuk mempercepat query pencarian siswa berdasarkan NIS & Role
CREATE INDEX IF NOT EXISTS idx_profiles_nis ON public.profiles(nis);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);


-- 3. TABEL: ATTENDANCES (RIWAYAT ABSENSI)
-- Mencatat setiap aksi absensi scan wajah yang berhasil
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tanggal DATE DEFAULT CURRENT_DATE NOT NULL,
    jam_masuk TIME DEFAULT (CURRENT_TIME AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'terlambat', 'izin', 'alpa')),
    similarity_score FLOAT, -- Skor kemiripan wajah (misal 0.92 atau 92%)
    foto_bukti_url TEXT, -- Foto selfie wajah saat siswa menekan tombol absen
    catatan TEXT, -- Catatan opsional (misal: "Izin sakit")
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,

    -- Mencegah siswa absen lebih dari sekali pada tanggal yang sama
    CONSTRAINT unique_attendance_per_day UNIQUE (user_id, tanggal)
);

-- Index untuk mempercepat pencarian data kehadiran berdasarkan tanggal dan user
CREATE INDEX IF NOT EXISTS idx_attendances_user_tanggal ON public.attendances(user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendances_tanggal ON public.attendances(tanggal);


-- 4. VIEW: REKAP STATISTIK KEHADIRAN SISWA
-- Memudahkan siswa & admin melihat total hadir, alpa, izin, dan persentase kehadiran
CREATE OR REPLACE VIEW public.v_student_attendance_summary AS
SELECT 
    p.id AS user_id,
    p.nama,
    p.nis,
    p.avatar_url,
    COUNT(a.id) FILTER (WHERE a.status = 'hadir') AS total_hadir,
    COUNT(a.id) FILTER (WHERE a.status = 'terlambat') AS total_terlambat,
    COUNT(a.id) FILTER (WHERE a.status = 'izin') AS total_izin,
    COUNT(a.id) FILTER (WHERE a.status = 'alpa') AS total_alpa,
    COUNT(a.id) AS total_absen_tercatat,
    -- Menghitung persentase kehadiran berdasarkan total catatan absensi
    CASE 
        WHEN COUNT(a.id) = 0 THEN 0
        ELSE ROUND(
            ((COUNT(a.id) FILTER (WHERE a.status IN ('hadir', 'terlambat')))::DECIMAL / COUNT(a.id)::DECIMAL) * 100, 
            2
        )
    END AS persentase_kehadiran
FROM 
    public.profiles p
LEFT JOIN 
    public.attendances a ON p.id = a.user_id
WHERE 
    p.role = 'siswa'
GROUP BY 
    p.id, p.nama, p.nis, p.avatar_url;


-- 5. FUNCTION & TRIGGER: AUTO INSERT PROFILE SAAT USER REGISTER DI AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nama, nis, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email),
        NEW.raw_user_meta_data->>'nis',
        COALESCE(NEW.raw_user_meta_data->>'role', 'siswa')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger dijalankan setiap ada user baru di auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Keamanan data: Siswa hanya bisa melihat datanya sendiri, Admin bisa melihat semua
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Policy Profiles:
-- 1. Semua user terotentikasi bisa membaca profil publik (untuk scan wajah mencocokkan nama)
CREATE POLICY "Profiles can be viewed by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 2. User hanya bisa mengupdate profil miliknya sendiri
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Policy Attendances:
-- 1. Siswa bisa membaca data absensinya sendiri; Admin bisa membaca semua
CREATE POLICY "Attendances read policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
    auth.uid() = id 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
    )
);

-- 2. Siswa bisa menginput absen miliknya sendiri
CREATE POLICY "Users can insert own attendance"
ON public.attendances FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Admin memiliki hak penuh untuk mengupdate/menghapus absensi jika diperlukan
CREATE POLICY "Admins have full access to attendances"
ON public.attendances FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
    )
);
