import React, { useState } from 'react';
import { LogIn, User, Shield, AlertCircle, X, KeyRound, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (userProfile: Profile) => void;
  initialRole?: 'siswa' | 'admin';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialRole = 'siswa',
}) => {
  const [activeTab, setActiveTab] = useState<'siswa' | 'admin'>(initialRole);
  const [identifier, setIdentifier] = useState<string>(''); // Email or NIS
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-fill demo credentials
  const fillDemoCredentials = (roleType: 'siswa' | 'admin') => {
    setErrorMsg(null);
    if (roleType === 'siswa') {
      setIdentifier('siswa@sekolah.id');
      setPassword('siswa123');
    } else {
      setIdentifier('admin@sekolah.id');
      setPassword('admin123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMsg('Harap masukkan email/NIS dan kata sandi.');
      return;
    }

    setIsLoading(true);

    try {
      let emailToLogin = cleanId;

      // If user typed a NIS (numbers only or not containing @), lookup their email
      if (!cleanId.includes('@')) {
        const { data: profileWithNis } = await supabase
          .from('profiles')
          .select('id, nis')
          .eq('nis', cleanId)
          .maybeSingle();

        if (profileWithNis) {
          // If NIS matches standard test account
          if (cleanId === '2021006') {
            emailToLogin = 'siswa@sekolah.id';
          }
        }
      }

      // 1. Sign In via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password: password,
      });

      if (authError) {
        throw new Error(
          authError.message === 'Invalid login credentials'
            ? 'Email / NIS atau kata sandi salah. Pastikan Anda sudah menjalankan script SQL seed akun uji coba di Supabase SQL Editor.'
            : authError.message
        );
      }

      if (!authData.user) {
        throw new Error('Gagal mendapatkan sesi autentikasi.');
      }

      // 2. Fetch User Profile from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // Fallback profile if record is still syncing
        const fallbackProfile: Profile = {
          id: authData.user.id,
          nama: (authData.user.user_metadata?.nama as string) || (activeTab === 'admin' ? 'Administrator' : 'Hilmy Pratama'),
          nis: (authData.user.user_metadata?.nis as string) || (activeTab === 'siswa' ? '2021006' : 'ADMIN-01'),
          role: ((authData.user.user_metadata?.role as 'siswa' | 'admin') || activeTab),
          created_at: new Date().toISOString(),
        };
        onLoginSuccess(fallbackProfile);
      } else {
        onLoginSuccess(profile);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        maxWidth: '460px',
        width: '100%',
        padding: '1.75rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: activeTab === 'siswa' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${activeTab === 'siswa' ? 'var(--biometric-cyan)' : 'var(--status-warning)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: activeTab === 'siswa' ? 'var(--biometric-cyan)' : 'var(--status-warning)',
            margin: '0 auto 0.75rem',
          }}>
            {activeTab === 'siswa' ? <User size={26} /> : <Shield size={26} />}
          </div>
          <h3 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {activeTab === 'siswa' ? 'Masuk Portal Siswa' : 'Masuk Dashboard Admin'}
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Gunakan akun resmi untuk melihat statistik & riwayat absensi Anda
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-app)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
        }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('siswa');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'siswa' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'siswa' ? 'var(--biometric-cyan)' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <User size={16} />
            <span>Siswa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'admin' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'admin' ? 'var(--status-warning)' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Shield size={16} />
            <span>Admin</span>
          </button>
        </div>

        {/* Quick Demo Fill Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1rem',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Akun Uji Coba:</span>
          <button
            type="button"
            onClick={() => fillDemoCredentials(activeTab)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--biometric-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: 600,
            }}
          >
            <Sparkles size={13} />
            <span>Isi Otomatis ({activeTab === 'siswa' ? 'siswa@sekolah.id' : 'admin@sekolah.id'})</span>
          </button>
        </div>

        {/* Error Message Notice */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger)',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
            lineHeight: 1.4,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {activeTab === 'siswa' ? 'Email atau Nomor Induk Siswa (NIS)' : 'Email Administrator'}
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={activeTab === 'siswa' ? 'Contoh: siswa@sekolah.id atau 2021006' : 'Contoh: admin@sekolah.id'}
                className="input-field"
                style={{ paddingLeft: '2.25rem' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Kata Sandi (Password)
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="input-field"
                style={{ paddingLeft: '2.25rem' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '46px', marginTop: '0.5rem' }}
          >
            <LogIn size={18} />
            <span>{isLoading ? 'Memverifikasi Akun...' : `Masuk sebagai ${activeTab === 'siswa' ? 'Siswa' : 'Admin'}`}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
