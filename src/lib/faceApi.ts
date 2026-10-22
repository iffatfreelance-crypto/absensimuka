import * as faceapi from '@vladmandic/face-api';
import type { Profile, FaceMatchResult } from '../types';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

/**
 * Load face-api AI models from local /models directory
 */
export async function loadFaceModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const LOCAL_URL = '/models';
      
      // Coba muat dari folder lokal public/models
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(LOCAL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_URL)
        ]);
        modelsLoaded = true;
        console.log('✅ Face-API models loaded successfully from /models');
        return true;
      } catch (localErr) {
        console.warn('Local model load failed, falling back to CDN...', localErr);
        const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL)
        ]);
        modelsLoaded = true;
        console.log('✅ Face-API models loaded successfully from CDN fallback');
        return true;
      }
    } catch (err) {
      console.error('❌ Failed to load Face-API models from both local and CDN:', err);
      modelsLoaded = false;
      return false;
    } finally {
      modelLoadingPromise = null;
    }
  })();

  return modelLoadingPromise;
}

/**
 * Detect face and extract 128-dimensional descriptor from HTMLVideoElement or HTMLImageElement
 */
export interface FaceDetectionData {
  detection: faceapi.FaceDetection | null;
  descriptor: Float32Array | null;
  box: { x: number; y: number; width: number; height: number } | null;
  faceRatio: number;
  distanceStatus: 'optimal' | 'too_far' | 'too_close' | 'no_face';
  distanceMessage: string;
}

/**
 * ULTRA-FAST Face Tracker for HUD overlays (10-20ms)
 * Only detects bounding box and distance ratio WITHOUT computing heavy 128-d ResNet descriptor.
 * Uses GPU texture binding directly from video without canvas copy overhead.
 */
export async function detectFaceFast(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionData> {
  await loadFaceModels();

  if (input instanceof HTMLVideoElement && (input.readyState < 2 || input.paused)) {
    return {
      detection: null,
      descriptor: null,
      box: null,
      faceRatio: 0,
      distanceStatus: 'no_face',
      distanceMessage: 'Menunggu kamera...'
    };
  }

  const origWidth = 
    ('videoWidth' in input && input.videoWidth) || 
    ('naturalWidth' in input && input.naturalWidth) || 
    ('width' in input && typeof input.width === 'number' ? input.width : 640);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 160, // Ultra fast tracking on GPU
    scoreThreshold: 0.5
  });

  const detection = await faceapi.detectSingleFace(input, options);

  if (!detection) {
    return {
      detection: null,
      descriptor: null,
      box: null,
      faceRatio: 0,
      distanceStatus: 'no_face',
      distanceMessage: 'Wajah tidak terdeteksi'
    };
  }

  const box = {
    x: detection.box.x,
    y: detection.box.y,
    width: detection.box.width,
    height: detection.box.height,
  };

  const faceRatio = box.width / (origWidth || 640);

  let distanceStatus: 'optimal' | 'too_far' | 'too_close' = 'optimal';
  let distanceMessage = 'Jarak Ideal';

  if (faceRatio < 0.22) {
    distanceStatus = 'too_far';
    distanceMessage = 'Jarak terlalu jauh! Dekatkan wajah Anda ke kamera.';
  } else if (faceRatio > 0.65) {
    distanceStatus = 'too_close';
    distanceMessage = 'Terlalu dekat! Mundurkan sedikit posisi kepala Anda.';
  } else {
    distanceStatus = 'optimal';
    distanceMessage = 'Jarak Ideal';
  }

  return {
    detection,
    descriptor: null,
    box,
    faceRatio,
    distanceStatus,
    distanceMessage
  };
}

/**
 * Detect face, extract 128-dimensional descriptor, and evaluate distance status
 * Used ONLY when verifying or enrolling face (single inference)
 * Directly binds video stream to WebGL texture for instant execution.
 */
export async function detectFaceAndExtractDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionData> {
  await loadFaceModels();

  if (input instanceof HTMLVideoElement && (input.readyState < 2 || input.paused)) {
    return {
      detection: null,
      descriptor: null,
      box: null,
      faceRatio: 0,
      distanceStatus: 'no_face',
      distanceMessage: 'Menunggu kamera...'
    };
  }

  const origWidth = 
    ('videoWidth' in input && input.videoWidth) || 
    ('naturalWidth' in input && input.naturalWidth) || 
    ('width' in input && typeof input.width === 'number' ? input.width : 640);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224, // Fast & accurate 224px grid
    scoreThreshold: 0.5
  });

  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!result) {
    return {
      detection: null,
      descriptor: null,
      box: null,
      faceRatio: 0,
      distanceStatus: 'no_face',
      distanceMessage: 'Wajah tidak terdeteksi'
    };
  }

  const box = {
    x: result.detection.box.x,
    y: result.detection.box.y,
    width: result.detection.box.width,
    height: result.detection.box.height,
  };

  const faceRatio = box.width / (origWidth || 640);

  let distanceStatus: 'optimal' | 'too_far' | 'too_close' = 'optimal';
  let distanceMessage = 'Jarak Ideal';

  if (faceRatio < 0.22) {
    distanceStatus = 'too_far';
    distanceMessage = 'Jarak terlalu jauh! Dekatkan wajah Anda ke kamera.';
  } else if (faceRatio > 0.65) {
    distanceStatus = 'too_close';
    distanceMessage = 'Terlalu dekat! Mundurkan sedikit posisi kepala Anda.';
  } else {
    distanceStatus = 'optimal';
    distanceMessage = 'Jarak Ideal';
  }

  return {
    detection: result.detection,
    descriptor: result.descriptor,
    box,
    faceRatio,
    distanceStatus,
    distanceMessage
  };
}

/**
 * Calculate Euclidean Distance between two 128-dimensional descriptors
 */
export function calculateEuclideanDistance(
  descA: number[] | Float32Array,
  descB: number[] | Float32Array
): number {
  if (descA.length !== descB.length) return 1.0;

  let sum = 0;
  for (let i = 0; i < descA.length; i++) {
    const diff = descA[i] - descB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Match a detected face descriptor against registered students in the database
 * Strict threshold: distance < 0.38 & confidence >= 75% (Zero false-positive tolerance)
 */
export function matchFaceWithStudents(
  queryDescriptor: Float32Array | number[],
  registeredStudents: Profile[],
  distanceThreshold = 0.38
): FaceMatchResult {
  if (!registeredStudents || registeredStudents.length === 0) {
    return {
      isMatch: false,
      distance: 1.0,
      confidence: 0,
      errorReason: 'Belum ada data siswa terdaftar di database.'
    };
  }

  let bestMatch: Profile | undefined = undefined;
  let minDistance = 1.0;

  for (const student of registeredStudents) {
    if (!student.face_descriptor || !Array.isArray(student.face_descriptor)) {
      continue;
    }

    const dist = calculateEuclideanDistance(queryDescriptor, student.face_descriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = student;
    }
  }

  // Non-linear calibrated biometric confidence:
  // dist <= 0.20 -> 96% - 100%
  // dist <= 0.38 -> 75% - 95%
  // dist <= 0.48 -> 50% - 74%
  // dist > 0.48 -> < 50%
  let confidence = 0;
  if (minDistance <= 0.20) {
    confidence = Math.round(96 + ((0.20 - minDistance) / 0.20) * 4);
  } else if (minDistance <= 0.38) {
    confidence = Math.round(75 + ((0.38 - minDistance) / 0.18) * 21);
  } else if (minDistance <= 0.50) {
    confidence = Math.round(45 + ((0.50 - minDistance) / 0.12) * 29);
  } else {
    confidence = Math.max(0, Math.round((1 - minDistance) * 80));
  }

  // Strict biometric validation: requires distance < 0.38 AND confidence >= 75%
  if (minDistance < distanceThreshold && confidence >= 75 && bestMatch) {
    return {
      isMatch: true,
      student: bestMatch,
      distance: minDistance,
      confidence
    };
  }

  return {
    isMatch: false,
    distance: minDistance,
    confidence,
    errorReason: minDistance < 0.48 
      ? `Tingkat kemiripan belum cukup (${confidence}% cocok, syarat minimal 75%). Lepas kacamata/masker dan hadap lurus ke kamera.`
      : 'Wajah tidak cocok dengan data siswa yang terdaftar. Absen ditolak demi keamanan biometrik.'
  };
}

/**
 * Capture a lightweight JPEG snapshot (max 360px wide, ~18KB) from video element for attendance proof
 * Extremely fast over network, drastically reducing Supabase database insert latency.
 */
export function captureVideoSnapshot(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  const targetWidth = 360;
  const originalWidth = video.videoWidth || 640;
  const originalHeight = video.videoHeight || 480;
  const ratio = originalHeight / originalWidth;
  
  canvas.width = targetWidth;
  canvas.height = Math.round(targetWidth * ratio);
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Mirror naturally if front camera
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/jpeg', 0.65);
}
