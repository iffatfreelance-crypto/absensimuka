# AbsenMuka ⚡
**Sistem Presensi Biometrik Wajah Berbasis AI (128-d Vector Embedding) & Supabase Cloud**

Aplikasi presensi pengenalan wajah biometrik modern yang dirancang sesuai panduan standar desain **Nutlope/Hallmark** (bebas *AI-slop*, responsif di desktop & smartphone, ramah jempol mobile $\ge 44\text{px}$, dan mengutamakan integritas data riil).

---

## 🌟 Fitur Utama

1. **Biometric Face Scanner HUD:**
   - Deteksi wajah *real-time* langsung di browser/kamera HP menggunakan TensorFlow.js & TinyFaceDetector.
   - Ekstraksi 128 angka vektor (*face embedding*) unik setiap siswa.
   - **Tolak Wajah Asing:** Jika wajah di depan kamera bukan milik siswa terdaftar (jarak Euclidean $\ge 0.52$), absensi **DITOLAK**.
   - Efek suara biometrik berbasis Web Audio API (chime sukses saat diterima, tone peringatan saat ditolak).
   - Animasi selebrasi confetti saat absensi sukses dicatat.
   - Anti dobel-absen: Siswa tidak bisa absen lebih dari sekali pada hari yang sama.

2. **Portal Siswa:**
   - Kamera pemindai wajah mandiri (bisa menggunakan kamera depan selfie HP).
   - Indikator status kehadiran hari ini (Sudah Absen Masuk / Belum).
   - Visualisasi persentase kehadiran (%) otomatis.
   - Rincian kartu: Hadir, Terlambat, Izin, Alpa.
   - Tabel riwayat presensi dengan foto selfie bukti absensi.

3. **Dashboard Admin & Guru:**
   - 4 Kartu metrik: Total Siswa, Hadir Hari Ini, Belum Hadir, dan Rata-rata Kehadiran Sekolah.
   - Mode Kiosk Presensi Umum untuk gerbang/pintu masuk sekolah.
   - Tabel seluruh siswa lengkap dengan pencarian, filter status, dan persentase kehadiran masing-masing.
   - **Pendaftaran Wajah Siswa Baru (Enrolment):** Ambil foto wajah calon siswa via webcam atau unggah foto untuk mengekstrak vektor biometrik dan disimpan ke database Supabase.

4. **Multiplatform (Web & Android APK Ready):**
   - Berjalan mulus di Google Chrome/Safari laptop maupun browser smartphone.
   - Tombol **"Download APK"** langsung di navbar untuk mengunduh `absenmuka.apk`.
   - Siap dibungkus ke aplikasi Android native menggunakan Capacitor.

---

## 🛠️ Menjalankan di Komputer Lokal

```bash
# 1. Jalankan development server
npm run dev

# Aplikasi akan berjalan di:
# Local:   http://localhost:5173/
# Network: http://10.1.14.208:5173/ (bisa dibuka langsung dari HP di Wi-Fi yang sama)
```

---

## 📱 Panduan Membuat File APK Android (Capacitor)

Untuk meng-compile aplikasi ini menjadi file `.apk` murni yang bisa diinstal di Android:

```bash
# 1. Build aplikasi produksi
npm run build

# 2. Pasang Capacitor (jika belum ada)
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Inisialisasi proyek Capacitor
npx cap init AbsenMuka com.sekolah.absenmuka --web-dir dist

# 4. Tambahkan platform Android
npx cap add android

# 5. Sinkronkan file build ke Android Studio
npx cap sync android

# 6. Buka proyek di Android Studio untuk generate APK (Build -> Build Bundle(s) / APK(s) -> Build APK(s))
npx cap open android
```

---

## 🗄️ Struktur Database Supabase

- Tabel `profiles`: Data siswa, NIS, role, dan vektor sidik wajah `face_descriptor` (`jsonb`).
- Tabel `attendances`: Log kehadiran (user_id, tanggal, jam_masuk, status, skor kemiripan wajah, foto bukti).
- View `v_student_attendance_summary`: Menghitung persentase kehadiran otomatis.
- File SQL lengkap ada di folder [supabase/schema.sql](file:///d:/absenmuka/supabase/schema.sql).
