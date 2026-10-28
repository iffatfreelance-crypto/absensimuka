import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle, 
  ScanFace,
  Maximize2,
  Glasses
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { detectFaceFast, detectFaceAndExtractDescriptor, matchFaceWithStudents, captureVideoSnapshot, loadFaceModels } from '../lib/faceApi';
import { biometricAudio } from '../lib/audioFeedback';
import { supabase } from '../lib/supabase';
import { formatTimeHM } from '../lib/formatters';
import type { Profile, ScanState, Attendance } from '../types';

interface ScannerHUDProps {
  registeredStudents: Profile[];
  onAttendanceLogged?: (newAttendance: Attendance) => void;
  targetStudent?: Profile | null;
}

export const ScannerHUD: React.FC<ScannerHUDProps> = ({
  registeredStudents,
  onAttendanceLogged,
  targetStudent,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scanState, setScanState] = useState<ScanState>('standby');
  const scanStateRef = useRef<ScanState>('standby');
  useEffect(() => {
    scanStateRef.current = scanState;
  }, [scanState]);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [modelsReady, setModelsReady] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Posisikan wajah Anda di dalam bingkai oval');
  
  // Distance & Accessory state
  const [distanceStatus, setDistanceStatus] = useState<'optimal' | 'too_far' | 'too_close' | 'no_face'>('no_face');
  
  // Results
  const [verifiedStudent, setVerifiedStudent] = useState<Profile | null>(null);
  const [verifiedTime, setVerifiedTime] = useState<string>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<boolean>(false);

  // Tracking stats & Cooldown management
  const [fps] = useState<number>(30);
  const isProcessingRef = useRef<boolean>(false);
  const cooldownRef = useRef<boolean>(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoVerifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cooldownCountdown, setCooldownCountdown] = useState<number>(0);

  // Clean reset function to unfreeze the scanner anytime
  const resetScanner = useCallback(() => {
    if (autoVerifyTimerRef.current) {
      clearTimeout(autoVerifyTimerRef.current);
      autoVerifyTimerRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCooldownCountdown(0);
    isProcessingRef.current = false;
    cooldownRef.current = false;
    setScanState('standby');
    setDistanceStatus('no_face');
    setRejectReason('');
    setVerifiedStudent(null);
    setStatusMessage('Posisikan wajah Anda di dalam bingkai oval');

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // 1. Load Face Models on Mount
  useEffect(() => {
    let mounted = true;
    loadFaceModels().then((ready) => {
      if (mounted) {
        setModelsReady(ready);
        if (ready) {
          setStatusMessage('Posisikan wajah Anda di dalam bingkai oval');
        } else {
          setScanState('error');
          setStatusMessage('Gagal memuat model biometrik wajah. Coba muat ulang halaman.');
        }
      }
    });
    return () => { mounted = false; };
  }, []);

  // 2. Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          resetScanner();
        };
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setCameraActive(false);
      setScanState('permission-denied');
      setStatusMessage('Izin kamera ditolak atau kamera tidak ditemukan.');
    }
  }, [facingMode, resetScanner]);

  // 3. Stop Camera
  const stopCamera = useCallback(() => {
    if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScanState('standby');
    setStatusMessage('Kamera dinonaktifkan');
  }, []);

  // Switch Front/Rear Camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  useEffect(() => {
    if (modelsReady) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [modelsReady, startCamera, stopCamera]);

  // Start safe auto-reset countdown
  const startCooldown = useCallback((seconds: number) => {
    cooldownRef.current = true;
    setCooldownCountdown(seconds);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCooldownCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      resetScanner();
    }, seconds * 1000);
  }, [resetScanner]);

  // 4. Record Attendance in Supabase
  const logAttendanceToSupabase = async (student: Profile, score: number, photoSnapshot: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nowTime = formatTimeHM(new Date());

      // Check if already checked in today
      const { data: existing } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', student.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (existing) {
        setAlreadyCheckedIn(true);
        setVerifiedStudent(student);
        setVerifiedTime(formatTimeHM(existing.jam_masuk));
        setConfidenceScore(Math.round((existing.similarity_score || 0.95) * 100));
        setScanState('success');
        biometricAudio.playSuccess();
        setStatusMessage(`Presensi telah tercatat pukul ${formatTimeHM(existing.jam_masuk)} WIB`);
        startCooldown(4);
        return;
      }

      // Insert new attendance record
      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: student.id,
          tanggal: today,
          status: 'hadir',
          similarity_score: score / 100,
          foto_bukti_url: photoSnapshot,
        })
        .select('*, profiles(*)')
        .single();

      if (error) {
        console.error('Supabase attendance insert error:', error);
        setStatusMessage('Gagal menyimpan presensi ke database.');
        startCooldown(3);
      } else if (data) {
        setAlreadyCheckedIn(false);
        setVerifiedStudent(student);
        setVerifiedTime(nowTime);
        setConfidenceScore(score);
        setScanState('success');
        biometricAudio.playSuccess();

        // Celebration Confetti
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {
          // Ignore if confetti fails
        }

        if (onAttendanceLogged) {
          onAttendanceLogged(data);
        }
        startCooldown(4);
      }
    } catch (err) {
      console.error('Failed to log attendance:', err);
      startCooldown(3);
    }
  };

  // 5. Verification Execution
  const executeVerification = useCallback(async () => {
    if (!videoRef.current || !cameraActive || isProcessingRef.current || cooldownRef.current) return;

    if (autoVerifyTimerRef.current) {
      clearTimeout(autoVerifyTimerRef.current);
      autoVerifyTimerRef.current = null;
    }

    // Special check: If student logged in but has no face enrolled yet
    if (targetStudent && (!targetStudent.face_descriptor || targetStudent.face_descriptor.length === 0)) {
      biometricAudio.playReject();
      setScanState('rejected');
      setRejectReason('Akun Anda belum memiliki data sidik biometrik wajah. Harap hubungi Admin atau Guru untuk mendaftarkan wajah Anda di sistem.');
      setStatusMessage('Absen Ditolak: Sidik wajah belum terdaftar.');
      startCooldown(6);
      return;
    }

    isProcessingRef.current = true;
    setScanState('verifying');
    setStatusMessage('Memverifikasi data biometrik wajah...');

    try {
      // 1. Single-pass full biometric extraction with 4-second safety timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('VERIFICATION_TIMEOUT')), 4000)
      );

      const result = await Promise.race([
        detectFaceAndExtractDescriptor(videoRef.current),
        timeoutPromise
      ]);

      // BIOMETRIC VALIDATION CHECKS (Strict: Kacamata, Masker, Ruangan Gelap, Wajah Ganda, Jarak)
      if (result.validationFailed) {
        biometricAudio.playReject();
        setScanState('rejected');
        setRejectReason(result.validationMessage || 'Wajah tidak memenuhi standar biometrik yang ditentukan.');
        setStatusMessage(
          result.rejectReasonType === 'glasses_detected' ? 'Kacamata Terdeteksi: Harap lepas kacamata' :
          result.rejectReasonType === 'mask_detected' ? 'Masker Terdeteksi: Harap buka masker' :
          result.rejectReasonType === 'multiple_faces' ? 'Wajah Ganda: Hanya 1 orang diperbolehkan' :
          result.rejectReasonType === 'low_light' ? 'Ruangan Terlalu Gelap: Cari area lebih terang' :
          result.rejectReasonType === 'too_far' ? 'Jarak Terlalu Jauh: Silakan mendekat' :
          result.rejectReasonType === 'too_close' ? 'Terlalu Dekat: Mundurkan sedikit wajah' :
          'Validasi Wajah Ditolak'
        );
        startCooldown(3.5);
        return;
      }

      if (!result.descriptor || !result.box) {
        setScanState('standby');
        setStatusMessage('Wajah tidak terdeteksi jelas. Harap hadap tegak ke kamera.');
        isProcessingRef.current = false;
        return;
      }

      setStatusMessage('Mencocokkan ke database siswa...');

      // 3. PENCOCOKAN BIOMETRIK KETAT (Threshold 0.38 - Anti False Positive)
      const candidates = targetStudent ? [targetStudent] : registeredStudents;
      const matchResult = matchFaceWithStudents(result.descriptor, candidates, 0.38);

      if (matchResult.isMatch && matchResult.student) {
        // MATCHED: Verified Student -> Ambil bukti foto saat BERHASIL
        setStatusMessage('Menyimpan presensi...');
        const snapshot = captureVideoSnapshot(videoRef.current);
        await logAttendanceToSupabase(matchResult.student, matchResult.confidence, snapshot);
      } else {
        // NOT MATCHED: Unauthorized face or insufficient similarity
        biometricAudio.playReject();
        setScanState('rejected');
        setRejectReason(matchResult.errorReason || 'Wajah tidak cocok dengan data biometrik siswa terdaftar.');
        setStatusMessage('Absen Ditolak: Bukan wajah siswa yang terdaftar.');
        startCooldown(4);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'VERIFICATION_TIMEOUT') {
        setScanState('standby');
        setStatusMessage('Waktu pemindaian habis. Harap posisikan wajah tegak dan klik Pindai Lagi.');
      } else {
        console.error('Scan loop error:', err);
        setScanState('error');
        setStatusMessage('Terjadi gangguan saat memindai wajah. Silakan klik Coba Pindai Lagi.');
      }
      cooldownRef.current = false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [cameraActive, registeredStudents, targetStudent, startCooldown]);

  // 6. Automatic Face Tracker loop for HUD overlay
  useEffect(() => {
    if (!cameraActive || !modelsReady) return;

    let timer: ReturnType<typeof setTimeout>;
    let isActive = true;

    const detectLoop = async () => {
      // Pause detection loop while processing verification or in cooldown
      if (!isActive || !videoRef.current || isProcessingRef.current || cooldownRef.current || scanStateRef.current === 'verifying' || scanStateRef.current === 'success') {
        timer = setTimeout(detectLoop, 250);
        return;
      }

      try {
        const result = await detectFaceFast(videoRef.current);

        // Draw HUD corner reticles on canvas
        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (result.box) {
              const { x, y, width, height } = result.box;
              const scaleX = canvas.width / (videoRef.current.videoWidth || 640);
              const scaleY = canvas.height / (videoRef.current.videoHeight || 480);
              
              const bx = x * scaleX;
              const by = y * scaleY;
              const bw = width * scaleX;
              const bh = height * scaleY;

              ctx.strokeStyle = 
                result.distanceStatus === 'optimal' ? '#10b981' : 
                result.distanceStatus === 'too_far' || result.distanceStatus === 'too_close' ? '#f59e0b' : 
                '#0284c7';
              ctx.lineWidth = 2.5;
              const cornerSize = Math.min(22, bw / 4);

              // Top-Left
              ctx.beginPath();
              ctx.moveTo(bx, by + cornerSize);
              ctx.lineTo(bx, by);
              ctx.lineTo(bx + cornerSize, by);
              ctx.stroke();

              // Top-Right
              ctx.beginPath();
              ctx.moveTo(bx + bw - cornerSize, by);
              ctx.lineTo(bx + bw, by);
              ctx.lineTo(bx + bw, by + cornerSize);
              ctx.stroke();

              // Bottom-Left
              ctx.beginPath();
              ctx.moveTo(bx, by + bh - cornerSize);
              ctx.lineTo(bx, by + bh);
              ctx.lineTo(bx + cornerSize, by + bh);
              ctx.stroke();

              // Bottom-Right
              ctx.beginPath();
              ctx.moveTo(bx + bw - cornerSize, by + bh);
              ctx.lineTo(bx + bw, by + bh);
              ctx.lineTo(bx + bw, by + bh - cornerSize);
              ctx.stroke();
            }
          }
        }

        if (result.detection && !cooldownRef.current && !isProcessingRef.current) {
          setDistanceStatus(result.distanceStatus);

          if (result.distanceStatus === 'too_far') {
            if (autoVerifyTimerRef.current) {
              clearTimeout(autoVerifyTimerRef.current);
              autoVerifyTimerRef.current = null;
            }
            if (scanStateRef.current === 'detecting') setScanState('standby');
            setStatusMessage('Dekatkan posisi wajah ke kamera');
          } else if (result.distanceStatus === 'too_close') {
            if (autoVerifyTimerRef.current) {
              clearTimeout(autoVerifyTimerRef.current);
              autoVerifyTimerRef.current = null;
            }
            if (scanStateRef.current === 'detecting') setScanState('standby');
            setStatusMessage('Mundurkan sedikit posisi wajah');
          } else if (result.distanceStatus === 'optimal') {
            if (scanStateRef.current === 'standby') {
              setScanState('detecting');
              setStatusMessage('Jarak ideal! Menstabilkan...');
            }

            // Fast debounced trigger: only schedule once
            if (!autoVerifyTimerRef.current && !isProcessingRef.current) {
              autoVerifyTimerRef.current = setTimeout(() => {
                autoVerifyTimerRef.current = null;
                if (!cooldownRef.current && !isProcessingRef.current && scanStateRef.current !== 'success') {
                  executeVerification();
                }
              }, 250);
            }
          }
        } else if (!result.detection) {
          if (autoVerifyTimerRef.current) {
            clearTimeout(autoVerifyTimerRef.current);
            autoVerifyTimerRef.current = null;
          }
          if (scanStateRef.current === 'detecting' && !isProcessingRef.current) {
            setDistanceStatus('no_face');
            setScanState('standby');
            setStatusMessage('Posisikan wajah Anda di dalam bingkai oval');
          }
        }

      } catch (err) {
        console.error('Detection tracking error:', err);
      }

      timer = setTimeout(detectLoop, 200);
    };

    detectLoop();

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (autoVerifyTimerRef.current) {
        clearTimeout(autoVerifyTimerRef.current);
        autoVerifyTimerRef.current = null;
      }
    };
  }, [cameraActive, modelsReady, executeVerification]);

  return (
    <section style={{
      maxWidth: '680px',
      margin: '0 auto',
      width: '100%',
    }}>
      {/* Outer Card: Clean White, Subtle Hairline Border, Soft Natural Shadow */}
      <div style={{
        position: 'relative',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: `1.5px solid ${
          scanState === 'success' 
            ? 'var(--status-success)' 
            : scanState === 'rejected' 
            ? 'var(--status-danger)' 
            : 'var(--border-subtle)'
        }`,
        boxShadow: scanState === 'success' 
          ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)' 
          : '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}>
        {/* TOP CAMERA HEADER BAR (Clean, outside the camera viewport) */}
        <div className="mobile-compact-header" style={{
          padding: '0.625rem 1rem',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          {/* Left: Camera Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: cameraActive ? '#10b981' : '#94a3b8',
              boxShadow: cameraActive ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none',
            }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {cameraActive ? 'Kamera Aktif' : 'Kamera Mati'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {cameraActive ? `· ${fps} FPS` : ''}
            </span>
          </div>

          {/* Right: Mode Badge & Camera Flip Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {targetStudent ? (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--biometric-cyan)',
                backgroundColor: 'var(--status-info-bg)',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid var(--status-info-border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                Siswa: {targetStudent.nama}
              </span>
            ) : (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid var(--border-subtle)',
              }}>
                Kiosk Presensi ({registeredStudents.length} Siswa)
              </span>
            )}
            
            <button
              onClick={toggleFacingMode}
              className="btn btn-secondary"
              style={{ minHeight: '32px', padding: '0.25rem 0.625rem', fontSize: '0.75rem', borderRadius: '8px' }}
              title="Ganti Kamera Depan / Belakang"
            >
              <RefreshCw size={12} />
              <span>Putar</span>
            </button>
          </div>
        </div>

        {/* GUIDANCE BANNER: Fresh, Calm School Information Strip */}
        <div className="mobile-compact-header" style={{
          padding: '0.5rem 1rem',
          backgroundColor: distanceStatus === 'optimal' ? '#f0fdf4' : distanceStatus === 'too_far' || distanceStatus === 'too_close' ? '#fffbeb' : '#f8fafc',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          fontSize: '0.8125rem',
          flexWrap: 'wrap',
          transition: 'background-color 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155' }}>
            <Glasses size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
            <span>
              <strong>Wajib Lepas Aksesori:</strong> Kacamata, masker, & topi
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Jarak:</span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 
                distanceStatus === 'optimal' ? '#dcfce7' : 
                distanceStatus === 'too_far' || distanceStatus === 'too_close' ? '#fef3c7' : 
                '#f1f5f9',
              color: 
                distanceStatus === 'optimal' ? '#15803d' : 
                distanceStatus === 'too_far' || distanceStatus === 'too_close' ? '#b45309' : 
                '#64748b',
              border: `1px solid ${
                distanceStatus === 'optimal' ? '#86efac' : 
                distanceStatus === 'too_far' || distanceStatus === 'too_close' ? '#fde68a' : 
                '#e2e8f0'
              }`
            }}>
              {distanceStatus === 'optimal' 
                ? '✅ Jarak Ideal' 
                : distanceStatus === 'too_far' 
                ? '⚠️ Terlalu Jauh' 
                : distanceStatus === 'too_close' 
                ? '⚠️ Terlalu Dekat' 
                : 'Mencari Wajah'}
            </span>
          </div>
        </div>

        {/* CAMERA VIEWPORT (Clean, 100% Unobstructed Video Feed) */}
        <div className="scanner-viewport">
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              display: cameraActive ? 'block' : 'none',
            }}
          />

          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              zIndex: 10,
            }}
          />

          {/* Clean Subtle Scanning Beam */}
          {cameraActive && (scanState === 'detecting' || scanState === 'verifying') && (
            <div className="scan-laser" />
          )}

          {/* SLEEK BIOMETRIC OVAL GUIDE */}
          {cameraActive && scanState !== 'success' && scanState !== 'rejected' && (
            <div className="scanner-oval" style={{
              border: `2.5px ${distanceStatus === 'optimal' ? 'solid' : 'dashed'} ${
                distanceStatus === 'optimal' 
                  ? '#10b981' 
                  : distanceStatus === 'too_far' || distanceStatus === 'too_close' 
                  ? '#f59e0b' 
                  : 'rgba(255, 255, 255, 0.7)'
              }`,
              boxShadow: distanceStatus === 'optimal' 
                ? '0 0 24px rgba(16, 185, 129, 0.35)' 
                : distanceStatus === 'too_far' || distanceStatus === 'too_close'
                ? '0 0 20px rgba(245, 158, 11, 0.25)'
                : '0 0 20px rgba(0, 0, 0, 0.2)',
            }}>
              {/* Single Minimal Frosted Status Pill Below Oval */}
              <div style={{
                position: 'absolute',
                bottom: '-24px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: distanceStatus === 'optimal' ? '#a7f3d0' : '#ffffff',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '3px 10px',
                borderRadius: '9999px',
                border: `1px solid ${
                  distanceStatus === 'optimal' ? '#10b981' : 'rgba(255, 255, 255, 0.2)'
                }`,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              }}>
                {distanceStatus === 'optimal' 
                  ? '✨ Jarak Ideal · Tahan Posisi' 
                  : distanceStatus === 'too_far' 
                  ? 'Dekatkan wajah ke kamera' 
                  : distanceStatus === 'too_close' 
                  ? 'Mundurkan wajah sedikit' 
                  : 'Posisikan wajah di dalam oval'}
              </div>
            </div>
          )}

          {/* Camera Inactive State */}
          {!cameraActive && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center',
              gap: '1rem',
              backgroundColor: '#f8fafc',
              width: '100%',
              height: '100%',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
              }}>
                <CameraOff size={28} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                  Kamera Belum Aktif
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: '300px' }}>
                  Izinkan akses kamera di browser Anda untuk memulai presensi biometrik wajah.
                </p>
              </div>
              <button onClick={startCamera} className="btn btn-primary" style={{ minHeight: '40px' }}>
                <Camera size={16} />
                <span>Aktifkan Kamera</span>
              </button>
            </div>
          )}

          {/* SUCCESS OVERLAY (Clean & Fresh Hallmark Celebration) */}
          {scanState === 'success' && verifiedStudent && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 30,
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                border: '2px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                marginBottom: '0.5rem',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)',
              }}>
                <CheckCircle2 size={28} />
              </div>

              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#047857',
                backgroundColor: '#dcfce7',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid #86efac',
                marginBottom: '0.25rem',
              }}>
                {alreadyCheckedIn ? 'SUDAH ABSEN HARI INI' : 'PRESENSI BERHASIL'}
              </span>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: '0.125rem' }}>
                {verifiedStudent.nama}
              </h2>
              <p className="mono" style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                NIS: {verifiedStudent.nis || '-'}
              </p>

              <div style={{
                display: 'flex',
                gap: '1rem',
                backgroundColor: '#f8fafc',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '0.75rem',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 600, color: '#64748b' }}>WAKTU</div>
                  <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--biometric-cyan)' }}>
                    {formatTimeHM(verifiedTime) || '07:15'} WIB
                  </div>
                </div>
                <div style={{ width: '1px', backgroundColor: '#e2e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 600, color: '#64748b' }}>AKURASI</div>
                  <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10b981' }}>
                    {confidenceScore}% COCOK
                  </div>
                </div>
              </div>

              <button
                onClick={resetScanner}
                className="btn btn-secondary"
                style={{ minHeight: '34px', padding: '0.25rem 0.875rem', fontSize: '0.75rem' }}
              >
                <RefreshCw size={13} />
                <span>{cooldownCountdown > 0 ? `Pindai Ulang (${cooldownCountdown}s)` : 'Pindai Ulang'}</span>
              </button>
            </div>
          )}

          {/* REJECTED OVERLAY (Clean & Crisp Alert) */}
          {scanState === 'rejected' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 30,
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fff1f2',
                border: '2px solid #e11d48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e11d48',
                marginBottom: '0.5rem',
                boxShadow: '0 4px 15px rgba(225, 29, 72, 0.15)',
              }}>
                <XCircle size={28} />
              </div>

              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#be123c',
                backgroundColor: '#ffe4e6',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid #fecdd3',
                marginBottom: '0.25rem',
              }}>
                ABSEN DITOLAK
              </span>

              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: '0.25rem' }}>
                Wajah Tidak Memenuhi Syarat
              </h2>
              <p style={{
                fontSize: '0.75rem',
                color: '#475569',
                textAlign: 'center',
                maxWidth: '320px',
                lineHeight: 1.35,
                marginBottom: '0.625rem',
              }}>
                {rejectReason}
              </p>

              {cooldownCountdown > 0 && (
                <div style={{
                  fontSize: '0.6875rem',
                  color: '#64748b',
                  marginBottom: '0.625rem',
                }}>
                  Pindai ulang otomatis dalam <strong>{cooldownCountdown} detik</strong>...
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={resetScanner}
                  className="btn btn-primary"
                  style={{ minHeight: '36px', padding: '0.375rem 1rem', fontSize: '0.75rem' }}
                >
                  <RefreshCw size={13} />
                  <span>Coba Pindai Lagi</span>
                </button>
              </div>
            </div>
          )}

          {/* ERROR OVERLAY */}
          {scanState === 'error' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 30,
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fffbeb',
                border: '2px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                marginBottom: '0.5rem',
              }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                Pemindaian Terganggu
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', maxWidth: '300px', marginBottom: '0.875rem', lineHeight: 1.35 }}>
                {statusMessage}
              </p>
              <button onClick={() => { resetScanner(); startCamera(); }} className="btn btn-primary" style={{ minHeight: '38px', padding: '0.375rem 1rem', fontSize: '0.8125rem' }}>
                <RefreshCw size={14} />
                <span>Muat Ulang Kamera</span>
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM CARD: Status Information & Actions */}
        <div className="mobile-action-bar" style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}>
          {/* Status ticker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
              <ScanFace size={18} style={{ color: 'var(--biometric-cyan)', flexShrink: 0 }} />
              <span style={{
                color: 
                  scanState === 'rejected' ? '#e11d48' : 
                  scanState === 'success' ? '#10b981' : 
                  '#334155',
                fontWeight: 600,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}>
                {statusMessage}
              </span>
            </div>
            <span className="mono" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              STATE: {scanState.toUpperCase()}
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={scanState === 'rejected' || scanState === 'error' ? resetScanner : executeVerification}
              disabled={!cameraActive || scanState === 'verifying'}
              className="btn btn-primary"
              style={{ flex: 1, minHeight: '44px', fontWeight: 600 }}
            >
              {scanState === 'rejected' || scanState === 'error' ? (
                <>
                  <RefreshCw size={16} />
                  <span>Coba Pindai Lagi</span>
                </>
              ) : (
                <>
                  <Maximize2 size={16} />
                  <span>{scanState === 'verifying' ? 'Memverifikasi...' : 'Pindai & Absen Sekarang'}</span>
                </>
              )}
            </button>

            {cameraActive ? (
              <button onClick={stopCamera} className="btn btn-secondary" style={{ minHeight: '44px', fontWeight: 500 }}>
                <CameraOff size={16} />
                <span>Tutup</span>
              </button>
            ) : (
              <button onClick={startCamera} className="btn btn-secondary" style={{ minHeight: '44px', fontWeight: 500 }}>
                <Camera size={16} />
                <span>Buka</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
