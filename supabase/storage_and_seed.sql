-- ============================================================
-- KONFIGURASI STORAGE & DATA CONTOH (SEED DATA) SUPABASE
-- ============================================================

-- 1. SETUP BUCKET STORAGE
-- Bucket untuk menyimpan foto wajah profil dan foto bukti saat scan absen
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('face-avatars', 'face-avatars', true),
    ('attendance-proofs', 'attendance-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy Storage: Izinkan siapapun yang login mengunduh/melihat foto
CREATE POLICY "Public read storage"
ON storage.objects FOR SELECT
USING (bucket_id IN ('face-avatars', 'attendance-proofs'));

-- Izinkan user terotentikasi mengunggah foto
CREATE POLICY "Authenticated upload storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('face-avatars', 'attendance-proofs'));
