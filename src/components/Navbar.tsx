import React from 'react';
import { ScanFace, Shield, User, Download, LogOut } from 'lucide-react';
import type { Profile } from '../types';

interface NavbarProps {
  currentUser: Profile | null;
  activeView: 'kiosk' | 'siswa' | 'admin';
  onViewChange: (view: 'kiosk' | 'siswa' | 'admin') => void;
  onOpenLogin?: (role?: 'siswa' | 'admin') => void;
  onLogout: () => void;
  onOpenDownloadApk: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeView,
  onViewChange,
  onLogout,
  onOpenDownloadApk,
}) => {
  return (
    <header style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        {/* Brand & Logo */}
        <div 
          onClick={() => onViewChange(currentUser ? (currentUser.role === 'admin' ? 'admin' : 'siswa') : 'kiosk')} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}
          title="Ke Halaman Utama"
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--biometric-cyan)',
            boxShadow: '0 2px 8px var(--biometric-cyan-glow)',
            flexShrink: 0,
          }}>
            <ScanFace size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.0625rem', letterSpacing: '-0.02em' }}>
                Absen<span style={{ color: 'var(--biometric-cyan)' }}>Muka</span>
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.625rem', padding: '0.1rem 0.4rem' }}>
                v1.0
              </span>
            </div>
            <p className="hide-on-mobile" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Presensi Biometrik Wajah
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>

          {/* Download APK Button */}
          <button
            onClick={onOpenDownloadApk}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', minHeight: '34px', padding: '0.25rem 0.625rem' }}
            title="Download Aplikasi Android (.APK)"
          >
            <Download size={14} style={{ color: 'var(--status-success)' }} />
            <span>APK</span>
          </button>

          {/* User Auth Section (Only displayed when logged in) */}
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {/* User badge */}
              <div 
                onClick={() => onViewChange(currentUser.role === 'admin' ? 'admin' : 'siswa')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  backgroundColor: 'var(--bg-card)',
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${activeView === currentUser.role ? 'var(--border-active)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  minHeight: '34px',
                }}
                title="Buka Halaman Saya"
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.role === 'admin' ? 'var(--status-warning-bg)' : 'var(--status-info-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: currentUser.role === 'admin' ? 'var(--status-warning)' : 'var(--status-info)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: `1px solid ${currentUser.role === 'admin' ? 'var(--status-warning-border)' : 'var(--status-info-border)'}`,
                  flexShrink: 0,
                }}>
                  {currentUser.role === 'admin' ? <Shield size={13} /> : <User size={13} />}
                </div>
                <div style={{ lineHeight: 1.1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentUser.nama.split(' ')[0]}
                  </div>
                  <div className="hide-on-mobile" style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {currentUser.role}
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ minHeight: '34px', padding: '0.25rem 0.5rem', color: 'var(--status-danger)' }}
                title="Keluar (Logout)"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
