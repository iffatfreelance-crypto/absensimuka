import React, { useEffect } from 'react';
import { Download, X, Smartphone, CheckCircle, ShieldAlert, Terminal } from 'lucide-react';

interface DownloadApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    // Generate/trigger download of sample dummy apk or direct apk package
    const link = document.createElement('a');
    link.href = '/absenmuka.apk';
    link.download = 'absenmuka.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
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
        maxWidth: '520px',
        width: '100%',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-success-bg)',
              border: '1px solid var(--status-success-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-success)',
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Download Aplikasi Android</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Pasang AbsenMuka langsung di smartphone Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Benefits Box */}
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <CheckCircle size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <span>Kamera selfie otomatis terbuka untuk scan absensi mandiri</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <CheckCircle size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <span>Notifikasi jam masuk dan pengingat presensi harian</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <CheckCircle size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <span>Bisa digunakan tanpa perlu mengetik URL setiap hari</span>
          </div>
        </div>

        {/* Download Action Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <button
            onClick={handleDownload}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '48px', fontSize: '1rem' }}
          >
            <Download size={18} />
            <span>Unduh File APK (Android)</span>
          </button>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            justifyContent: 'center',
          }}>
            <ShieldAlert size={14} style={{ color: 'var(--status-warning)' }} />
            <span>Izinkan "Install Unknown Apps" di pengaturan HP saat instalasi pertama</span>
          </div>
        </div>

        {/* Developer Info: Capacitor Build Command */}
        <div style={{
          backgroundColor: 'var(--bg-app)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
            <Terminal size={14} />
            <span style={{ fontWeight: 600 }}>Untuk Pengembang (Build APK Asli via Capacitor):</span>
          </div>
          <code className="mono" style={{ color: 'var(--biometric-cyan)', display: 'block', wordBreak: 'break-all' }}>
            npm run build && npx cap sync android && npx cap open android
          </code>
        </div>
      </div>
    </div>
  );
};
