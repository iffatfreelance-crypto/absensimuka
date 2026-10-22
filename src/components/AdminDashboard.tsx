import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Percent, 
  Search, 
  Plus, 
  Camera, 
  X, 
  Sparkles, 
  Trash2, 
  ScanFace,
  Upload,
  Edit3,
  Eye,
  CheckCircle2,
  Clock,
  Glasses
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { detectFaceAndExtractDescriptor } from '../lib/faceApi';
import { formatTimeHM } from '../lib/formatters';
import { ScannerHUD } from './ScannerHUD';
import type { Profile, Attendance } from '../types';

interface AdminDashboardProps {
  students: Profile[];
  attendances: Attendance[];
  onStudentsUpdated: () => void;
  onAttendanceLogged: (newAttendance: Attendance) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  attendances,
  onStudentsUpdated,
  onAttendanceLogged,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'kiosk'>('matrix');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sudah' | 'belum'>('all');

  // ==========================================
  // 1. CREATE MODAL STATE (Daftar Siswa Baru)
  // ==========================================
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [newNama, setNewNama] = useState<string>('');
  const [newNis, setNewNis] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [registerStatus, setRegisterStatus] = useState<string>('');
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const enrolVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isEnrolCamActive, setIsEnrolCamActive] = useState<boolean>(false);

  // ==========================================
  // 2. EDIT MODAL STATE (Perbarui Data Siswa)
  // ==========================================
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editNis, setEditNis] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editDescriptor, setEditDescriptor] = useState<number[] | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editStatus, setEditStatus] = useState<string>('');
  const editVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isEditCamActive, setIsEditCamActive] = useState<boolean>(false);

  // ==========================================
  // 3. READ DETAIL & RIWAYAT MODAL STATE
  // ==========================================
  const [detailStudent, setDetailStudent] = useState<Profile | null>(null);
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  // ==========================================
  // 4. DELETE CONFIRMATION MODAL STATE
  // ==========================================
  const [deletingStudent, setDeletingStudent] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Date constants
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalStudents = students.length;
    
    // Attendances today
    const todayAttendances = attendances.filter((a) => a.tanggal === todayStr);
    const checkedInUserIds = new Set(todayAttendances.map((a) => a.user_id));

    const hadirCount = students.filter((s) => checkedInUserIds.has(s.id)).length;
    const belumHadirCount = totalStudents - hadirCount;

    // Calculate average school attendance rate
    let totalPctSum = 0;
    students.forEach((s) => {
      const studentRecords = attendances.filter((a) => a.user_id === s.id);
      const studentHadir = studentRecords.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
      const pct = studentRecords.length === 0 ? 100 : Math.round((studentHadir / studentRecords.length) * 100);
      totalPctSum += pct;
    });

    const averageRate = totalStudents === 0 ? 100 : Math.round(totalPctSum / totalStudents);

    return { totalStudents, hadirCount, belumHadirCount, averageRate, checkedInUserIds };
  }, [students, attendances, todayStr]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        s.nama.toLowerCase().includes(q) || 
        (s.nis && s.nis.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q));

      const isCheckedIn = summary.checkedInUserIds.has(s.id);

      if (!matchesSearch) return false;
      if (filterStatus === 'sudah') return isCheckedIn;
      if (filterStatus === 'belum') return !isCheckedIn;
      return true;
    });
  }, [students, searchQuery, filterStatus, summary.checkedInUserIds]);

  // ==========================================
  // CAMERA HANDLERS: CREATE (ENROLMENT)
  // ==========================================
  const startEnrolCamera = async () => {
    try {
      setRegisterStatus('Mengakses kamera perangkat...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (enrolVideoRef.current) {
        enrolVideoRef.current.srcObject = stream;
        enrolVideoRef.current.onloadedmetadata = () => {
          enrolVideoRef.current?.play();
          setIsEnrolCamActive(true);
          setRegisterStatus('Kamera aktif. Posisikan wajah Anda lalu klik Pindai Wajah.');
        };
      }
    } catch (err) {
      console.error('Enrol cam error:', err);
      setRegisterStatus('Gagal mengakses kamera. Izinkan akses kamera pada browser.');
    }
  };

  const stopEnrolCamera = () => {
    if (enrolVideoRef.current && enrolVideoRef.current.srcObject) {
      const stream = enrolVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      enrolVideoRef.current.srcObject = null;
      setIsEnrolCamActive(false);
    }
  };

  const handleCaptureFace = async () => {
    if (!enrolVideoRef.current) return;
    setRegisterLoading(true);
    setRegisterStatus('Mengekstrak ciri biometrik wajah (128 vektor)...');

    try {
      const result = await detectFaceAndExtractDescriptor(enrolVideoRef.current);

      if (!result.descriptor || !result.box) {
        setRegisterStatus('Wajah tidak terdeteksi jelas. Posisikan wajah tepat menghadap kamera.');
        setRegisterLoading(false);
        return;
      }

      if (result.distanceStatus === 'too_far') {
        setRegisterStatus('⚠️ Posisi wajah terlalu jauh dari kamera! Silakan mendekat ke kamera.');
        setRegisterLoading(false);
        return;
      }

      if (result.distanceStatus === 'too_close') {
        setRegisterStatus('⚠️ Posisi wajah terlalu dekat! Mundurkan sedikit posisi kepala.');
        setRegisterLoading(false);
        return;
      }

      const descriptorArray = Array.from(result.descriptor);
      setCapturedDescriptor(descriptorArray);

      const canvas = document.createElement('canvas');
      canvas.width = enrolVideoRef.current.videoWidth || 640;
      canvas.height = enrolVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(enrolVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhotoUrl(dataUrl);
      }

      setRegisterStatus('Ciri wajah berhasil dipindai! Siap disimpan.');
      stopEnrolCamera();
    } catch (err) {
      console.error('Face capture error:', err);
      setRegisterStatus('Gagal memindai wajah.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRegisterLoading(true);
    setRegisterStatus('Menganalisis foto unggahan...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        try {
          const result = await detectFaceAndExtractDescriptor(img);
          if (!result.descriptor) {
            setRegisterStatus('Tidak ada wajah yang terdeteksi pada foto ini. Gunakan foto dengan wajah tampak jelas.');
            setRegisterLoading(false);
            return;
          }

          setCapturedDescriptor(Array.from(result.descriptor));
          setCapturedPhotoUrl(img.src);
          setRegisterStatus('Ciri wajah dari foto berhasil diekstrak!');
        } catch (err) {
          console.error('Upload face error:', err);
          setRegisterStatus('Gagal memproses foto.');
        } finally {
          setRegisterLoading(false);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // ==========================================
  // CREATE ACTION: SAVE NEW STUDENT
  // ==========================================
  const handleSaveStudent = async () => {
    if (!newNama.trim()) {
      setRegisterStatus('Nama lengkap siswa wajib diisi.');
      return;
    }
    if (!newNis.trim()) {
      setRegisterStatus('Nomor Induk Siswa (NIS) wajib diisi.');
      return;
    }
    if (!newUsername.trim()) {
      setRegisterStatus('Username login wajib diisi.');
      return;
    }
    if (!newPassword.trim()) {
      setRegisterStatus('Kata sandi login siswa wajib diisi.');
      return;
    }
    if (!capturedDescriptor) {
      setRegisterStatus('Harap lakukan scan wajah atau unggah foto siswa terlebih dahulu.');
      return;
    }

    setRegisterLoading(true);
    setRegisterStatus('Memeriksa ketersediaan akun...');

    try {
      const trimmedNis = newNis.trim();
      const trimmedUsername = newUsername.trim().toLowerCase();

      // Check if username or NIS is already taken
      const { data: conflict } = await supabase
        .from('profiles')
        .select('id, username, nis')
        .or(`username.ilike.${trimmedUsername},nis.eq.${trimmedNis}`)
        .maybeSingle();

      if (conflict) {
        if (conflict.username?.toLowerCase() === trimmedUsername) {
          throw new Error(`Username "${newUsername}" sudah digunakan. Silakan gunakan username lain.`);
        }
        if (conflict.nis === trimmedNis) {
          throw new Error(`NIS "${newNis}" sudah terdaftar di sistem.`);
        }
      }

      // Insert new student profile
      const newUserId = crypto.randomUUID();
      const { error } = await supabase.from('profiles').insert({
        id: newUserId,
        nama: newNama.trim(),
        nis: trimmedNis,
        username: trimmedUsername,
        password: newPassword.trim(),
        role: 'siswa',
        face_descriptor: capturedDescriptor,
        avatar_url: capturedPhotoUrl,
      });

      if (error) throw error;

      setRegisterStatus('Siswa baru berhasil didaftarkan!');
      onStudentsUpdated();

      setTimeout(() => {
        stopEnrolCamera();
        setIsRegisterOpen(false);
        setNewNama('');
        setNewNis('');
        setNewUsername('');
        setNewPassword('');
        setCapturedDescriptor(null);
        setCapturedPhotoUrl(null);
        setRegisterStatus('');
      }, 1000);

    } catch (err: unknown) {
      console.error('Save error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setRegisterStatus(`Gagal menyimpan: ${message}`);
    } finally {
      setRegisterLoading(false);
    }
  };

  // ==========================================
  // CAMERA HANDLERS: EDIT
  // ==========================================
  const startEditCamera = async () => {
    try {
      setEditStatus('Mengakses kamera untuk re-scan wajah...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (editVideoRef.current) {
        editVideoRef.current.srcObject = stream;
        editVideoRef.current.onloadedmetadata = () => {
          editVideoRef.current?.play();
          setIsEditCamActive(true);
          setEditStatus('Kamera aktif. Posisikan wajah lalu klik Pindai Wajah.');
        };
      }
    } catch (err) {
      console.error('Edit cam error:', err);
      setEditStatus('Gagal mengakses kamera.');
    }
  };

  const stopEditCamera = () => {
    if (editVideoRef.current && editVideoRef.current.srcObject) {
      const stream = editVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      editVideoRef.current.srcObject = null;
      setIsEditCamActive(false);
    }
  };

  const handleCaptureEditFace = async () => {
    if (!editVideoRef.current) return;
    setEditLoading(true);
    setEditStatus('Mengekstrak ciri biometrik wajah...');

    try {
      const result = await detectFaceAndExtractDescriptor(editVideoRef.current);
      if (!result.descriptor || !result.box) {
        setEditStatus('Wajah tidak terdeteksi. Posisikan wajah tegak menghadap kamera.');
        setEditLoading(false);
        return;
      }

      if (result.distanceStatus === 'too_far') {
        setEditStatus('⚠️ Posisi wajah terlalu jauh dari kamera! Silakan mendekat ke kamera.');
        setEditLoading(false);
        return;
      }

      if (result.distanceStatus === 'too_close') {
        setEditStatus('⚠️ Posisi wajah terlalu dekat! Mundurkan sedikit posisi kepala.');
        setEditLoading(false);
        return;
      }

      setEditDescriptor(Array.from(result.descriptor));

      const canvas = document.createElement('canvas');
      canvas.width = editVideoRef.current.videoWidth || 640;
      canvas.height = editVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(editVideoRef.current, 0, 0, canvas.width, canvas.height);
        setEditPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
      }

      setEditStatus('Sidik wajah baru berhasil dipindai!');
      stopEditCamera();
    } catch (err) {
      console.error('Edit face error:', err);
      setEditStatus('Gagal memindai wajah.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditLoading(true);
    setEditStatus('Menganalisis foto unggahan...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        try {
          const result = await detectFaceAndExtractDescriptor(img);
          if (!result.descriptor) {
            setEditStatus('Tidak ada wajah yang terdeteksi pada foto ini.');
            setEditLoading(false);
            return;
          }

          setEditDescriptor(Array.from(result.descriptor));
          setEditPhotoUrl(img.src);
          setEditStatus('Ciri wajah baru dari foto berhasil diekstrak!');
        } catch (err) {
          console.error('Edit upload error:', err);
          setEditStatus('Gagal memproses foto.');
        } finally {
          setEditLoading(false);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Open Edit Modal
  const handleOpenEdit = (student: Profile) => {
    setEditingStudent(student);
    setEditNama(student.nama || '');
    setEditNis(student.nis || '');
    setEditUsername(student.username || '');
    setEditPassword(student.password || '');
    setEditDescriptor(student.face_descriptor || null);
    setEditPhotoUrl(student.avatar_url || null);
    setEditStatus('');
  };

  // Save Edit Changes
  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    if (!editNama.trim()) {
      setEditStatus('Nama siswa wajib diisi.');
      return;
    }
    if (!editNis.trim()) {
      setEditStatus('NIS wajib diisi.');
      return;
    }
    if (!editUsername.trim()) {
      setEditStatus('Username login wajib diisi.');
      return;
    }

    setEditLoading(true);
    setEditStatus('Menyimpan perubahan ke database Supabase...');

    try {
      const trimmedUsername = editUsername.trim().toLowerCase();
      const trimmedNis = editNis.trim();

      // Check username collision with other students
      const { data: conflict } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', trimmedUsername)
        .neq('id', editingStudent.id)
        .maybeSingle();

      if (conflict) {
        throw new Error(`Username "${editUsername}" sudah dipakai oleh siswa lain.`);
      }

      const updateData: Record<string, unknown> = {
        nama: editNama.trim(),
        nis: trimmedNis,
        username: trimmedUsername,
        face_descriptor: editDescriptor,
        avatar_url: editPhotoUrl,
      };

      if (editPassword.trim()) {
        updateData.password = editPassword.trim();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', editingStudent.id);

      if (error) throw error;

      setEditStatus('Data siswa berhasil diperbarui!');
      onStudentsUpdated();

      setTimeout(() => {
        stopEditCamera();
        setEditingStudent(null);
      }, 1000);
    } catch (err: unknown) {
      console.error('Update error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setEditStatus(`Gagal memperbarui: ${message}`);
    } finally {
      setEditLoading(false);
    }
  };

  // ==========================================
  // DELETE ACTION: SAFE CASCADED REMOVAL
  // ==========================================
  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      // 1. Delete associated attendances
      await supabase.from('attendances').delete().eq('user_id', deletingStudent.id);

      // 2. Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', deletingStudent.id);
      if (error) throw error;

      onStudentsUpdated();
      setDeletingStudent(null);
    } catch (err: unknown) {
      console.error('Delete error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setDeleteError(`Gagal menghapus siswa: ${message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Detail Modal Statistics
  const detailStats = useMemo(() => {
    if (!detailStudent) return null;
    const records = attendances.filter((a) => a.user_id === detailStudent.id);
    const total = records.length;
    const hadir = records.filter((a) => a.status === 'hadir').length;
    const terlambat = records.filter((a) => a.status === 'terlambat').length;
    const izin = records.filter((a) => a.status === 'izin').length;
    const alpa = records.filter((a) => a.status === 'alpa').length;
    const pct = total === 0 ? 100 : Math.round(((hadir + terlambat) / total) * 100);
    return { records, total, hadir, terlambat, izin, alpa, pct };
  }, [detailStudent, attendances]);

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner & Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="badge badge-warning" style={{ marginBottom: '0.25rem' }}>
            PORTAL ADMINISTRATOR & GURU
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard Pengawasan Presensi</h2>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('matrix')}
            className="btn"
            style={{
              backgroundColor: activeTab === 'matrix' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              color: activeTab === 'matrix' ? 'var(--biometric-cyan)' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === 'matrix' ? 'var(--border-active)' : 'var(--border-subtle)'}`,
              minHeight: '40px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Users size={16} />
            <span>Rekap & Persentase Siswa</span>
          </button>

          <button
            onClick={() => setActiveTab('kiosk')}
            className="btn"
            style={{
              backgroundColor: activeTab === 'kiosk' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              color: activeTab === 'kiosk' ? 'var(--biometric-cyan)' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === 'kiosk' ? 'var(--border-active)' : 'var(--border-subtle)'}`,
              minHeight: '40px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <ScanFace size={16} />
            <span>Kiosk Scanner Umum</span>
          </button>

          <button
            onClick={() => {
              setIsRegisterOpen(true);
              setRegisterStatus('');
            }}
            className="btn btn-primary"
            style={{ minHeight: '40px' }}
          >
            <Plus size={16} />
            <span>Tambah Wajah Siswa</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        {/* Card 1: Total Siswa */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL SISWA TERDAFTAR</span>
            <Users size={18} style={{ color: 'var(--biometric-cyan)' }} />
          </div>
          <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary.totalStudents} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Siswa</span>
          </div>
        </div>

        {/* Card 2: Sudah Absen Hari Ini */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>SUDAH ABSEN HARI INI</span>
            <UserCheck size={18} style={{ color: 'var(--status-success)' }} />
          </div>
          <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--status-success)' }}>
            {summary.hadirCount} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Siswa</span>
          </div>
        </div>

        {/* Card 3: Belum Absen Hari Ini */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>BELUM ABSEN HARI INI</span>
            <UserX size={18} style={{ color: 'var(--status-danger)' }} />
          </div>
          <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--status-danger)' }}>
            {summary.belumHadirCount} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Siswa</span>
          </div>
        </div>

        {/* Card 4: Rata-rata Persentase */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>RATA-RATA KEHADIRAN</span>
            <Percent size={18} style={{ color: 'var(--status-warning)' }} />
          </div>
          <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--status-warning)' }}>
            {summary.averageRate}%
          </div>
        </div>
      </div>

      {/* VIEW 1: REKAP & PERSENTASE SISWA TABLE */}
      {activeTab === 'matrix' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Table Header Filter Toolbar */}
          <div style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIS, atau username..."
                className="input-field"
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFilterStatus('all')}
                className="btn btn-secondary"
                style={{
                  minHeight: '38px',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: filterStatus === 'all' ? 'var(--bg-elevated)' : 'transparent',
                }}
              >
                Semua ({students.length})
              </button>
              <button
                onClick={() => setFilterStatus('sudah')}
                className="btn btn-secondary"
                style={{
                  minHeight: '38px',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: filterStatus === 'sudah' ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--status-success)',
                }}
              >
                Sudah Absen ({summary.hadirCount})
              </button>
              <button
                onClick={() => setFilterStatus('belum')}
                className="btn btn-secondary"
                style={{
                  minHeight: '38px',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: filterStatus === 'belum' ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--status-danger)',
                }}
              >
                Belum Absen ({summary.belumHadirCount})
              </button>
            </div>
          </div>

          {/* Students Matrix Table */}
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Tidak ada data siswa yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.875rem 1.25rem' }}>FOTO & NAMA SISWA</th>
                    <th style={{ padding: '0.875rem 1.25rem' }}>NIS</th>
                    <th style={{ padding: '0.875rem 1.25rem' }}>STATUS HARI INI</th>
                    <th style={{ padding: '0.875rem 1.25rem' }}>PERSENTASE HADIR</th>
                    <th style={{ padding: '0.875rem 1.25rem' }}>SIDIK WAJAH</th>
                    <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st) => {
                    const todayLog = attendances.find((a) => a.user_id === st.id && a.tanggal === todayStr);
                    const stRecords = attendances.filter((a) => a.user_id === st.id);
                    const stHadir = stRecords.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
                    const pct = stRecords.length === 0 ? 100 : Math.round((stHadir / stRecords.length) * 100);

                    return (
                      <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--biometric-cyan)',
                              fontWeight: 700,
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}>
                              {st.avatar_url ? (
                                <img src={st.avatar_url} alt={st.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                st.nama.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{st.nama}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                @{st.username || 'tanpa-username'} · {st.role.toUpperCase()}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.875rem 1.25rem' }} className="mono">
                          {st.nis || '-'}
                        </td>

                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          {todayLog ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <span className="badge badge-success">SUDAH ABSEN</span>
                              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ({formatTimeHM(todayLog.jam_masuk)} WIB)
                              </span>
                            </div>
                          ) : (
                            <span className="badge badge-danger">BELUM ABSEN</span>
                          )}
                        </td>

                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="mono" style={{
                              fontWeight: 800,
                              color: pct >= 80 ? 'var(--status-success)' : 'var(--status-danger)',
                            }}>
                              {pct}%
                            </span>
                            <div style={{
                              width: '80px',
                              height: '6px',
                              backgroundColor: 'var(--bg-surface)',
                              borderRadius: 'var(--radius-full)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: pct >= 80 ? 'var(--status-success)' : 'var(--status-danger)',
                              }} />
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          {st.face_descriptor && Array.isArray(st.face_descriptor) && st.face_descriptor.length > 0 ? (
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                              <Sparkles size={11} />
                              <span>128-D AKTIF</span>
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                              BELUM DISCAN
                            </span>
                          )}
                        </td>

                        {/* FULL CRUD ACTION BUTTONS */}
                        <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                            {/* Read / History Button */}
                            <button
                              onClick={() => setDetailStudent(st)}
                              className="btn btn-secondary"
                              style={{ minHeight: '32px', padding: '0.25rem 0.5rem', color: 'var(--biometric-cyan)' }}
                              title="Lihat Riwayat Absensi"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEdit(st)}
                              className="btn btn-secondary"
                              style={{ minHeight: '32px', padding: '0.25rem 0.5rem', color: 'var(--status-warning)' }}
                              title="Edit Data Siswa"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeletingStudent(st)}
                              className="btn btn-secondary"
                              style={{ minHeight: '32px', padding: '0.25rem 0.5rem', color: 'var(--status-danger)' }}
                              title="Hapus Siswa"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: KIOSK SCANNER UMUM */}
      {activeTab === 'kiosk' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Mode Kiosk Presensi Sekolah</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Tempatkan perangkat ini di pintu masuk sekolah. Siswa cukup berdiri di depan kamera untuk melakukan presensi otomatis.
            </p>
          </div>
          <ScannerHUD
            registeredStudents={students}
            onAttendanceLogged={onAttendanceLogged}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: DAFTARKAN SISWA BARU (CREATE)                  */}
      {/* ======================================================== */}
      {isRegisterOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            maxWidth: '540px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Pendaftaran Siswa Baru</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Tambahkan akun siswa beserta sidik biometrik wajah ke database
                </p>
              </div>
              <button
                onClick={() => {
                  stopEnrolCamera();
                  setIsRegisterOpen(false);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Input Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Contoh: Budi Pratama"
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Nomor Induk Siswa (NIS) *
                  </label>
                  <input
                    type="text"
                    value={newNis}
                    onChange={(e) => setNewNis(e.target.value)}
                    placeholder="Contoh: 2026101"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Username Login *
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Contoh: budi"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Kata Sandi (Password) Login *
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contoh: siswa123"
                  className="input-field"
                  required
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Password ini akan digunakan siswa saat masuk ke aplikasi.
                </span>
              </div>

              {/* Face Capture Viewport */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Perekaman Sidik Wajah (Face Biometric) *
                </label>

                <div style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--status-warning)',
                  marginBottom: '0.75rem',
                }}>
                  <Glasses size={16} style={{ flexShrink: 0 }} />
                  <span><strong>Ketentuan Wajib:</strong> Calon siswa harus melepas kacamata, masker, atau penutup wajah saat memindai agar akurasi 100%.</span>
                </div>

                <div style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  backgroundColor: '#0f172a',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                }}>
                  <video
                    ref={enrolVideoRef}
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      display: isEnrolCamActive ? 'block' : 'none',
                    }}
                  />

                  {isEnrolCamActive && (
                    <div style={{
                      position: 'absolute',
                      width: '180px',
                      height: '240px',
                      borderRadius: '90px / 120px',
                      border: '2px dashed var(--biometric-cyan)',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {!isEnrolCamActive && capturedPhotoUrl && (
                    <img src={capturedPhotoUrl} alt="Captured Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}

                  {!isEnrolCamActive && !capturedPhotoUrl && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                      <Camera size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.8125rem' }}>Klik "Buka Kamera" atau unggah foto untuk mengekstrak 128-d sidik biometrik</p>
                    </div>
                  )}
                </div>

                {/* Enrolment Camera Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!isEnrolCamActive ? (
                    <button onClick={startEnrolCamera} type="button" className="btn btn-secondary" style={{ flex: 1 }}>
                      <Camera size={16} />
                      <span>{capturedPhotoUrl ? 'Ambil Ulang' : 'Buka Kamera'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleCaptureFace}
                      disabled={registerLoading}
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      <Sparkles size={16} />
                      <span>Pindai Wajah Sekarang</span>
                    </button>
                  )}

                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    <Upload size={16} />
                    <span>Upload Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Status Notice */}
              {registerStatus && (
                <div style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: capturedDescriptor ? 'var(--status-success-bg)' : 'var(--bg-card)',
                  border: `1px solid ${capturedDescriptor ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
                  fontSize: '0.8125rem',
                  color: capturedDescriptor ? 'var(--status-success)' : 'var(--text-secondary)',
                }}>
                  {registerStatus}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  stopEnrolCamera();
                  setIsRegisterOpen(false);
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>

              <button
                onClick={handleSaveStudent}
                disabled={registerLoading || !capturedDescriptor || !newNama.trim() || !newUsername.trim() || !newPassword.trim()}
                className="btn btn-primary"
              >
                {registerLoading ? 'Menyimpan...' : 'Simpan Siswa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT DATA SISWA & WAJAH (UPDATE)                */}
      {/* ======================================================== */}
      {editingStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            maxWidth: '540px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Edit Data Siswa</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Perbarui identitas, kredensial login, dan sidik wajah siswa
                </p>
              </div>
              <button
                onClick={() => {
                  stopEditCamera();
                  setEditingStudent(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Nomor Induk Siswa (NIS) *
                  </label>
                  <input
                    type="text"
                    value={editNis}
                    onChange={(e) => setEditNis(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Username Login *
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Kata Sandi (Password) Login
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru (kosongkan jika tidak diubah)"
                  className="input-field"
                />
              </div>

              {/* Face Biometric Re-scan Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Sidik Biometrik Wajah
                  </label>
                  {editDescriptor && editDescriptor.length > 0 ? (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      <CheckCircle2 size={12} />
                      <span>TERDAFTAR (128-D)</span>
                    </span>
                  ) : (
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                      BELUM TERDAFTAR
                    </span>
                  )}
                </div>

                <div style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--status-warning)',
                  marginBottom: '0.75rem',
                }}>
                  <Glasses size={16} style={{ flexShrink: 0 }} />
                  <span><strong>Ketentuan Biometrik:</strong> Wajib melepas kacamata, masker, atau topi saat merekam wajah baru agar akurasi 100%.</span>
                </div>

                <div style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  backgroundColor: '#0f172a',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                }}>
                  <video
                    ref={editVideoRef}
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      display: isEditCamActive ? 'block' : 'none',
                    }}
                  />

                  {isEditCamActive && (
                    <div style={{
                      position: 'absolute',
                      width: '180px',
                      height: '240px',
                      borderRadius: '90px / 120px',
                      border: '2px dashed var(--biometric-cyan)',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {!isEditCamActive && editPhotoUrl && (
                    <img src={editPhotoUrl} alt="Face Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}

                  {!isEditCamActive && !editPhotoUrl && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                      <Camera size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.8125rem' }}>Belum ada foto sidik wajah tersimpan</p>
                    </div>
                  )}
                </div>

                {/* Edit Camera Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!isEditCamActive ? (
                    <button onClick={startEditCamera} type="button" className="btn btn-secondary" style={{ flex: 1 }}>
                      <Camera size={16} />
                      <span>{editPhotoUrl ? 'Pindai Ulang Kamera' : 'Buka Kamera'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleCaptureEditFace}
                      disabled={editLoading}
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      <Sparkles size={16} />
                      <span>Ambil Wajah Sekarang</span>
                    </button>
                  )}

                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    <Upload size={16} />
                    <span>Upload Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditPhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Status Notice */}
              {editStatus && (
                <div style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8125rem',
                  color: 'var(--biometric-cyan)',
                }}>
                  {editStatus}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  stopEditCamera();
                  setEditingStudent(null);
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>

              <button
                onClick={handleSaveEdit}
                disabled={editLoading || !editNama.trim() || !editUsername.trim()}
                className="btn btn-primary"
              >
                {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: DETAIL & RIWAYAT ABSENSI SISWA (READ DETAIL)   */}
      {/* ======================================================== */}
      {detailStudent && detailStats && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            maxWidth: '680px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '2px solid var(--biometric-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--biometric-cyan)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  overflow: 'hidden',
                }}>
                  {detailStudent.avatar_url ? (
                    <img src={detailStudent.avatar_url} alt={detailStudent.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    detailStudent.nama.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <span className="badge badge-info" style={{ marginBottom: '0.25rem', fontSize: '0.7rem' }}>
                    PROFIL & RIWAYAT PRESENSI
                  </span>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: 800 }}>{detailStudent.nama}</h3>
                  <p className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    NIS: {detailStudent.nis || '-'} · USERNAME: @{detailStudent.username || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailStudent(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Stat Tiles */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PERSENTASE</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-success)' }}>
                  {detailStats.pct}%
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HADIR</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-success)' }}>
                  {detailStats.hadir}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TERLAMBAT</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-warning)' }}>
                  {detailStats.terlambat}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TOTAL LOG</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--biometric-cyan)' }}>
                  {detailStats.total}
                </div>
              </div>
            </div>

            {/* Attendance Logs Table */}
            <div>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} style={{ color: 'var(--biometric-cyan)' }} />
                <span>Riwayat Presensi Tercatat</span>
              </h4>

              {detailStats.records.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
                  Belum ada catatan presensi untuk siswa ini.
                </div>
              ) : (
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-elevated)', zIndex: 1 }}>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>TANGGAL</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>JAM MASUK</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>STATUS</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>AKURASI</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>FOTO BUKTI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailStats.records.map((rec) => (
                        <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }} className="mono">{rec.tanggal}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }} className="mono">{formatTimeHM(rec.jam_masuk)} WIB</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span className={`badge ${rec.status === 'hadir' ? 'badge-success' : rec.status === 'terlambat' ? 'badge-warning' : 'badge-danger'}`}>
                              {rec.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }} className="mono">
                            {rec.similarity_score ? `${Math.round(rec.similarity_score * 100)}%` : '-'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            {rec.foto_bukti_url ? (
                              <button
                                onClick={() => setZoomPhotoUrl(rec.foto_bukti_url || null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                title="Perbesar Foto Bukti"
                              >
                                <img
                                  src={rec.foto_bukti_url}
                                  alt="Bukti"
                                  style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                                />
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetailStudent(null)} className="btn btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: KONFIRMASI HAPUS SISWA (DELETE)                 */}
      {/* ======================================================== */}
      {deletingStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 'var(--radius-xl)',
            maxWidth: '440px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-danger-bg)',
              color: 'var(--status-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              border: '1px solid var(--status-danger)',
            }}>
              <Trash2 size={28} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem' }}>
              Hapus Data Siswa?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              Apakah Anda yakin ingin menghapus data siswa <strong>{deletingStudent.nama}</strong> (NIS: {deletingStudent.nis})? 
              Tindakan ini juga akan menghapus seluruh data riwayat presensinya secara permanen.
            </p>

            {deleteError && (
              <div style={{
                padding: '0.625rem',
                backgroundColor: 'var(--status-danger-bg)',
                color: 'var(--status-danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setDeletingStudent(null)}
                disabled={deleteLoading}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="btn btn-primary"
                style={{ flex: 1, backgroundColor: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: ZOOM FOTO BUKTI                                */}
      {/* ======================================================== */}
      {zoomPhotoUrl && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '1rem',
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Foto Bukti Presensi Wajah</span>
              <button onClick={() => setZoomPhotoUrl(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <img src={zoomPhotoUrl} alt="Bukti Presensi" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>
      )}
    </div>
  );
};
