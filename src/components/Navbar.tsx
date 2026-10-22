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
          onClick={() => onViewChange('kiosk')} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          title="Ke Halaman Utama"
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--biometric-cyan)',
            boxShadow: '0 2px 8px var(--biometric-cyan-glow)',
          }}>
            <ScanFace size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
                Absen<span style={{ color: 'var(--biometric-cyan)' }}>Muka</span>
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                v1.0
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Presensi Biometrik Wajah
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>

          {/* Download APK Button */}
          <button
            onClick={onOpenDownloadApk}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', minHeight: '38px', padding: '0.375rem 0.75rem' }}
            title="Download Aplikasi Android (.APK)"
          >
            <Download size={15} style={{ color: 'var(--status-success)' }} />
            <span>APK</span>
          </button>

          {/* User Auth Section (Only displayed when logged in) */}
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* User badge */}
              <div 
                onClick={() => onViewChange(currentUser.role === 'admin' ? 'admin' : 'siswa')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${activeView === currentUser.role ? 'var(--border-active)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                }}
                title="Buka Halaman Saya"
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.role === 'admin' ? 'var(--status-warning-bg)' : 'var(--status-info-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: currentUser.role === 'admin' ? 'var(--status-warning)' : 'var(--status-info)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: `1px solid ${currentUser.role === 'admin' ? 'var(--status-warning-border)' : 'var(--status-info-border)'}`,
                }}>
                  {currentUser.role === 'admin' ? <Shield size={14} /> : <User size={14} />}
                </div>
                <div style={{ lineHeight: 1.1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentUser.nama.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {currentUser.role}
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ minHeight: '38px', padding: '0.375rem 0.625rem', color: 'var(--status-danger)' }}
                title="Keluar (Logout)"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
