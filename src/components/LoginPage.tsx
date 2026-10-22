import React, { useState } from 'react';
import { LogIn, KeyRound, User, AlertCircle, ScanFace } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface LoginPageProps {
  onLoginSuccess: (userProfile: Profile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState<string>(''); // Username or NIS
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMsg('Harap masukkan username/NIS dan kata sandi.');
      return;
    }

    setIsLoading(true);

    try {
      // Cari user di tabel profiles berdasarkan username ATAU NIS (case-insensitive)
      const sanitized = cleanId.replace(/[(),\s]/g, '');
      const { data: matchedUser, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.${sanitized},nis.ilike.${sanitized}`)
        .eq('password', password)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (!matchedUser) {
        throw new Error('Username / NIS atau kata sandi salah. Silakan periksa kembali.');
      }

      // 2. Berhasil masuk! Oper profil ke aplikasi induk untuk diarahkan otomatis sesuai rolenya
      onLoginSuccess(matchedUser);

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
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 1rem',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        maxWidth: '440px',
        width: '100%',
        padding: '2.25rem 2rem',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        animation: 'fadeIn 0.25s ease-out',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--biometric-cyan)',
            margin: '0 auto 1rem',
            boxShadow: '0 4px 12px var(--biometric-cyan-glow)',
          }}>
            <ScanFace size={32} />
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>
            Absen<span style={{ color: 'var(--biometric-cyan)' }}>Muka</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Masukkan akun Anda untuk melanjutkan
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            padding: '0.875rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger)',
            fontSize: '0.8125rem',
            marginBottom: '1.25rem',
            lineHeight: 1.4,
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Universal Single Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Username atau Nomor Induk Siswa (NIS)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Masukkan username atau NIS..."
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Kata Sandi (Password)
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '48px', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            <LogIn size={18} />
            <span>{isLoading ? 'Memeriksa Akun...' : 'Masuk Sekarang'}</span>
          </button>
        </form>

        {/* Helper Note */}
        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1rem',
        }}>
          Sistem akan secara otomatis mendeteksi peran akun Anda (<strong>Siswa</strong> untuk scan kehadiran atau <strong>Admin</strong> untuk pengawasan statistik).
        </div>
      </div>
    </div>
  );
};
