import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Percent, 
  CheckCircle2, 
  AlertCircle, 
  ScanFace, 
  History,
  Image as ImageIcon
} from 'lucide-react';
import { ScannerHUD } from './ScannerHUD';
import { formatTimeHM } from '../lib/formatters';
import type { Profile, Attendance } from '../types';

interface StudentPortalProps {
  students: Profile[];
  attendances: Attendance[];
  onAttendanceLogged: (newAttendance: Attendance) => void;
  currentUser?: Profile | null;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  students,
  attendances,
  onAttendanceLogged,
  currentUser,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(currentUser ? currentUser.id : '');
  const [activeTab, setActiveTab] = useState<'scan' | 'stats' | 'history'>('scan');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<string | null>(null);

  // Sync selectedStudentId with currentUser or first student
  useEffect(() => {
    if (currentUser) {
      setSelectedStudentId(currentUser.id);
    } else if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [currentUser, students, selectedStudentId]);

  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Filter attendances for current student
  const studentAttendances = useMemo(() => {
    if (!selectedStudentId) return [];
    return attendances.filter((a) => a.user_id === selectedStudentId);
  }, [attendances, selectedStudentId]);

  // Check today's status
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayAttendance = useMemo(() => {
    return studentAttendances.find((a) => a.tanggal === todayStr) || null;
  }, [studentAttendances, todayStr]);

  // Calculate stats for current student
  const stats = useMemo(() => {
    const total = studentAttendances.length;
    const hadir = studentAttendances.filter((a) => a.status === 'hadir').length;
    const terlambat = studentAttendances.filter((a) => a.status === 'terlambat').length;
    const izin = studentAttendances.filter((a) => a.status === 'izin').length;
    const alpa = studentAttendances.filter((a) => a.status === 'alpa').length;

    const percentage = total === 0 ? 100 : Math.round(((hadir + terlambat) / total) * 100);

    return { total, hadir, terlambat, izin, alpa, percentage };
  }, [studentAttendances]);

  const handleAttendanceLogged = useCallback((newAtt: Attendance) => {
    onAttendanceLogged(newAtt);
  }, [onAttendanceLogged]);

  if (students.length === 0) {
    return (
      <div style={{
        maxWidth: '680px',
        margin: '2rem auto',
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-subtle)',
      }}>
        <AlertCircle size={40} style={{ color: 'var(--status-warning)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Belum Ada Data Siswa</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Database Supabase belum memiliki siswa terdaftar. Beralih ke <strong>Mode Admin</strong> di pojok kanan atas untuk menambahkan siswa baru beserta contoh sidik wajahnya.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Student Profile Switcher & Today's Status Banner */}
      <div className="card" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-elevated)',
            border: '2px solid var(--border-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--biometric-cyan)',
            fontWeight: 800,
            fontSize: '1.25rem',
            overflow: 'hidden',
          }}>
            {currentStudent?.avatar_url ? (
              <img src={currentStudent.avatar_url} alt={currentStudent.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              currentStudent?.nama.charAt(0).toUpperCase() || 'S'
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              {currentUser ? (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--biometric-cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
                    PROFIL SISWA AKTIF
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{currentStudent?.nama}</h2>
                </div>
              ) : (
                <>
                  <label htmlFor="studentSelect" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    PILIH SISWA:
                  </label>
                  <select
                    id="studentSelect"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nama} ({st.nis || 'No NIS'})
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <p className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              NIS: {currentStudent?.nis || '-'} · SIDIK WAJAH: {currentStudent?.face_descriptor ? 'TERDAFTAR' : 'BELUM AKTIF'}
            </p>
          </div>
        </div>

        {/* Status Absen Hari Ini */}
        <div>
          {todayAttendance ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              backgroundColor: 'var(--status-success-bg)',
              border: '1px solid var(--status-success-border)',
              padding: '0.625rem 1rem',
              borderRadius: 'var(--radius-md)',
            }}>
              <CheckCircle2 size={20} style={{ color: 'var(--status-success)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 700 }}>
                  SUDAH ABSEN HARI INI
                </div>
                <div className="mono" style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Pukul {formatTimeHM(todayAttendance.jam_masuk)} WIB
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              backgroundColor: 'var(--status-warning-bg)',
              border: '1px solid var(--status-warning-border)',
              padding: '0.625rem 1rem',
              borderRadius: 'var(--radius-md)',
            }}>
              <Clock size={20} style={{ color: 'var(--status-warning)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)', fontWeight: 700 }}>
                  BELUM ABSEN HARI INI
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Silakan scan wajah sekarang
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.5rem',
      }}>
        <button
          onClick={() => setActiveTab('scan')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'scan' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            color: activeTab === 'scan' ? 'var(--biometric-cyan)' : 'var(--text-secondary)',
            border: `1px solid ${activeTab === 'scan' ? 'var(--border-active)' : 'var(--border-subtle)'}`,
            padding: '0.5rem 1rem',
            minHeight: '40px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ScanFace size={18} />
          <span>Kamera Scan Wajah</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'stats' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            color: activeTab === 'stats' ? 'var(--biometric-cyan)' : 'var(--text-secondary)',
            border: `1px solid ${activeTab === 'stats' ? 'var(--border-active)' : 'var(--border-subtle)'}`,
            padding: '0.5rem 1rem',
            minHeight: '40px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Percent size={18} />
          <span>Persentase & Statistik</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'history' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            color: activeTab === 'history' ? 'var(--biometric-cyan)' : 'var(--text-secondary)',
            border: `1px solid ${activeTab === 'history' ? 'var(--border-active)' : 'var(--border-subtle)'}`,
            padding: '0.5rem 1rem',
            minHeight: '40px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <History size={18} />
          <span>Riwayat Absensi ({studentAttendances.length})</span>
        </button>
      </div>

      {/* TAB 1: SCANNER */}
      {activeTab === 'scan' && (
        <ScannerHUD
          registeredStudents={students}
          targetStudent={currentStudent}
          onAttendanceLogged={handleAttendanceLogged}
        />
      )}

      {/* TAB 2: STATISTIK & PERSENTASE SAYA */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Main Percentage Showcase Card */}
          <div className="card" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            padding: '2rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-active)',
          }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '0.5rem' }}>
                INDIKATOR KINERJA KEHADIRAN
              </span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Persentase Kehadiran Siswa
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '420px' }}>
                Dihitung secara otomatis dari catatan kehadiran presensi wajah Anda. Batas minimal kelulusan sekolah adalah 80%.
              </p>
            </div>

            {/* Circular Progress Gauge */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: `6px solid ${stats.percentage >= 80 ? 'var(--status-success)' : 'var(--status-danger)'}`,
              boxShadow: 'var(--shadow-md)',
            }}>
              <span className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stats.percentage}%
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {stats.percentage >= 80 ? 'SANGAT BAIK' : 'PERLU PERBAIKAN'}
              </span>
            </div>
          </div>

          {/* Breakdown Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>HADIR TEPAT WAKTU</span>
                <span className="badge badge-success">HADIR</span>
              </div>
              <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--status-success)' }}>
                {stats.hadir} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Hari</span>
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>TERLAMBAT</span>
                <span className="badge badge-warning">TELAT</span>
              </div>
              <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--status-warning)' }}>
                {stats.terlambat} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Hari</span>
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>IZIN / SAKIT</span>
                <span className="badge badge-info">IZIN</span>
              </div>
              <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--status-info)' }}>
                {stats.izin} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Hari</span>
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>ALPA / TANPA KETERANGAN</span>
                <span className="badge badge-danger">ALPA</span>
              </div>
              <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--status-danger)' }}>
                {stats.alpa} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Hari</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT ABSENSI SAYA */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.125rem' }}>Riwayat Presensi Saya</h3>
            <span className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Total: {studentAttendances.length} Catatan
            </span>
          </div>

          {studentAttendances.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Belum ada data kehadiran untuk siswa ini.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 1.25rem' }}>TANGGAL</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>JAM MASUK</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>STATUS</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>AKURASI WAJAH</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>BUKTI FOTO</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAttendances.map((att) => (
                    <tr key={att.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={15} style={{ color: 'var(--biometric-cyan)' }} />
                          <span style={{ fontWeight: 600 }}>{att.tanggal}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }} className="mono">
                        {formatTimeHM(att.jam_masuk)} WIB
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span className={`badge ${
                          att.status === 'hadir' ? 'badge-success' : att.status === 'terlambat' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {att.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem', color: 'var(--status-success)', fontWeight: 600 }} className="mono">
                        {att.similarity_score ? `${Math.round(att.similarity_score * 100)}% Cocok` : 'Terverifikasi'}
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        {att.foto_bukti_url ? (
                          <button
                            onClick={() => setSelectedPhotoModal(att.foto_bukti_url || null)}
                            className="btn btn-secondary"
                            style={{ minHeight: '32px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            <ImageIcon size={14} />
                            <span>Lihat Foto</span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Snapshot Photo Preview Modal */}
      {selectedPhotoModal && (
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
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '480px',
            width: '100%',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Bukti Foto Selfie Saat Presensi</h4>
            <img src={selectedPhotoModal} alt="Bukti Presensi" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }} />
            <button onClick={() => setSelectedPhotoModal(null)} className="btn btn-secondary" style={{ width: '100%' }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
