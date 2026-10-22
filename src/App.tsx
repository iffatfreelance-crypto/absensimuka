import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { DownloadApkModal } from './components/DownloadApkModal';
import { LoginPage } from './components/LoginPage';
import { supabase } from './lib/supabase';
import type { Profile, Attendance } from './types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Modals
  const [isDownloadApkOpen, setIsDownloadApkOpen] = useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // 1. Fetch Students & Attendances from Supabase
  const fetchData = useCallback(async () => {
    try {
      setErrorMsg(null);

      // Fetch Profiles (students)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'siswa')
        .order('nama', { ascending: true });

      if (profilesError) throw profilesError;
      setStudents(profilesData || []);

      // Fetch Attendances
      const { data: attData, error: attError } = await supabase
        .from('attendances')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false });

      if (attError) throw attError;
      setAttendances(attData || []);

    } catch (err: unknown) {
      console.error('Error fetching data from Supabase:', err);
      setErrorMsg('Gagal terhubung ke Supabase. Periksa koneksi internet atau script SQL database.');
    }
  }, []);

  // 2. Check Active Auth Session on Load
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setCurrentUser(profile);
          } else {
            const tempProfile: Profile = {
              id: session.user.id,
              nama: (session.user.user_metadata?.nama as string) || session.user.email?.split('@')[0] || 'User',
              nis: (session.user.user_metadata?.nis as string) || '',
              role: (session.user.user_metadata?.role as 'siswa' | 'admin') || 'siswa',
              created_at: new Date().toISOString(),
            };
            setCurrentUser(tempProfile);
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      }
    };

    initAuth();
    fetchData();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel('attendance-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendances' },
        (payload) => {
          console.log('Realtime new attendance:', payload);
          fetchData();
          setLiveToast({
            message: 'Presensi Baru Berhasil Dicatat (Realtime Sync)',
            type: 'success',
          });
          setTimeout(() => setLiveToast(null), 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setLiveToast({ message: 'Anda telah berhasil keluar.', type: 'info' });
      setTimeout(() => setLiveToast(null), 3000);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle Local Attendance Logged
  const handleAttendanceLogged = (newAtt: Attendance) => {
    setAttendances((prev) => [newAtt, ...prev.filter((a) => a.id !== newAtt.id)]);
    setLiveToast({
      message: `Presensi berhasil dicatat untuk ${newAtt.profiles?.nama || 'Siswa'}`,
      type: 'success',
    });
    setTimeout(() => setLiveToast(null), 4000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        activeView={currentUser ? (currentUser.role === 'admin' ? 'admin' : 'siswa') : 'kiosk'}
        onViewChange={() => {}}
        onOpenLogin={() => {}}
        onLogout={handleLogout}
        onOpenDownloadApk={() => setIsDownloadApkOpen(true)}
      />

      {/* Realtime Toast */}
      {liveToast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 90,
          backgroundColor: liveToast.type === 'success' ? 'var(--status-success)' : 'var(--status-info)',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease-out',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}>
          <CheckCircle2 size={18} />
          <span>{liveToast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, padding: '1.5rem 1rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {/* Error Notification */}
        {errorMsg && (
          <div style={{
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--status-danger)',
          }}>
            <AlertCircle size={20} />
            <div style={{ flex: 1 }}>{errorMsg}</div>
            <button onClick={fetchData} className="btn btn-secondary" style={{ minHeight: '34px', padding: '0.25rem 0.75rem' }}>
              Coba Lagi
            </button>
          </div>
        )}

        {/* KONDISI 1: BELUM LOGIN -> LANGSUNG TAMPILKAN HALAMAN LOGIN */}
        {!currentUser && (
          <LoginPage
            onLoginSuccess={(profile) => {
              setCurrentUser(profile);
              setLiveToast({
                message: `Selamat datang, ${profile.nama}!`,
                type: 'success',
              });
              setTimeout(() => setLiveToast(null), 3000);
            }}
          />
        )}

        {/* KONDISI 2: LOGIN SEBAGAI SISWA -> MASUK KE HALAMAN PRESENSI & STATISTIK SISWA */}
        {currentUser && currentUser.role === 'siswa' && (
          <StudentPortal
            currentUser={currentUser}
            students={students.length > 0 ? students : [currentUser]}
            attendances={attendances}
            onAttendanceLogged={handleAttendanceLogged}
          />
        )}

        {/* KONDISI 3: LOGIN SEBAGAI ADMIN -> MASUK KE DASHBOARD ADMIN REKAP STATISTIK */}
        {currentUser && currentUser.role === 'admin' && (
          <AdminDashboard
            students={students}
            attendances={attendances}
            onStudentsUpdated={fetchData}
            onAttendanceLogged={handleAttendanceLogged}
          />
        )}
      </main>

      {/* Download APK Modal */}
      <DownloadApkModal
        isOpen={isDownloadApkOpen}
        onClose={() => setIsDownloadApkOpen(false)}
      />

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '1.25rem 1rem',
        textAlign: 'center',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-surface)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong>AbsenMuka</strong> · Presensi Biometrik Wajah AI (128-d Embedding)
          </div>
          <div className="mono" style={{ fontSize: '0.75rem' }}>
            {currentUser ? `STATUS: TEROTENTIKASI SEBAGAI ${currentUser.role.toUpperCase()}` : 'STATUS: SILAKAN LOGIN'}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
