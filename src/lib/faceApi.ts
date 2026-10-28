import * as faceapi from '@vladmandic/face-api';
import type { Profile, FaceMatchResult } from '../types';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

/**
 * Load face-api AI models from local /models directory or fallback CDN
 */
export async function loadFaceModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const LOCAL_URL = '/models';
      
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_URL),
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
 * Result data from face detection and biometric validation
 */
export interface FaceDetectionData {
  detection: faceapi.FaceDetection | null;
  descriptor: Float32Array | null;
  box: { x: number; y: number; width: number; height: number } | null;
  faceRatio: number;
  distanceStatus: 'optimal' | 'too_far' | 'too_close' | 'no_face';
  distanceMessage: string;
  // Biometric Condition Validations
  validationFailed?: boolean;
  rejectReasonType?: 'multiple_faces' | 'low_light' | 'glasses_detected' | 'mask_detected' | 'too_far' | 'too_close' | 'no_face';
  validationMessage?: string;
}

/**
 * Helper: Detect whether the person is wearing glasses using 68 face landmarks & nose bridge gradient
 */
function detectGlassesPresence(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  landmarks: faceapi.FaceLandmarks68
): { hasGlasses: boolean; score: number } {
  try {
    const p = landmarks.positions;
    if (!p || p.length < 68) return { hasGlasses: false, score: 0 };

    // Points: 39 (inner right eye), 42 (inner left eye), 27 (top nose bridge)
    const p39 = p[39];
    const p42 = p[42];
    const p27 = p[27];

    const bridgeDist = Math.hypot(p42.x - p39.x, p42.y - p39.y);
    if (bridgeDist <= 0) return { hasGlasses: false, score: 0 };

    // 1. Sample the nasal bridge region between eyes where glasses bridge bar sits
    const sampleCanvas = document.createElement('canvas');
    const sw = 32;
    const sh = 16;
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return { hasGlasses: false, score: 0 };

    const sx = Math.min(p39.x, p42.x) + bridgeDist * 0.12;
    const sy = Math.min(p39.y, p42.y, p27.y) - bridgeDist * 0.25;
    const sWidth = Math.max(8, bridgeDist * 0.76);
    const sHeight = Math.max(8, bridgeDist * 0.55);

    ctx.drawImage(input, sx, sy, sWidth, sHeight, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh).data;

    let totalEdge = 0;
    let highEdgeCount = 0;
    const gray: number[] = [];

    for (let i = 0; i < imgData.length; i += 4) {
      gray.push(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]);
    }

    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const idx = y * sw + x;
        const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
        const gy = Math.abs(gray[idx + sw] - gray[idx - sw]);
        const grad = Math.hypot(gx, gy);
        totalEdge += grad;
        if (grad > 22) highEdgeCount++;
      }
    }

    const avgEdge = totalEdge / ((sw - 2) * (sh - 2));
    const edgeRatio = highEdgeCount / ((sw - 2) * (sh - 2));

    // 2. Check specular reflections around eye orbits (lenses reflect bright light spots)
    const eyeCanvas = document.createElement('canvas');
    eyeCanvas.width = 40;
    eyeCanvas.height = 20;
    const eyeCtx = eyeCanvas.getContext('2d');
    let specularCount = 0;

    if (eyeCtx) {
      const eyeMinX = p[36].x;
      const eyeMaxX = p[45].x;
      const eyeW = Math.max(20, eyeMaxX - eyeMinX);
      const eyeH = Math.max(15, bridgeDist * 0.95);
      const eyeY = Math.min(p[37].y, p[44].y) - 6;

      eyeCtx.drawImage(input, eyeMinX, eyeY, eyeW, eyeH, 0, 0, 40, 20);
      const eyeData = eyeCtx.getImageData(0, 0, 40, 20).data;
      for (let i = 0; i < eyeData.length; i += 4) {
        const r = eyeData[i];
        const g = eyeData[i + 1];
        const b = eyeData[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 210) specularCount++;
      }
    }

    const specularRatio = specularCount / (40 * 20);

    // 3. Check under-eye frame rim edge (below landmarks 40, 41 and 46, 47)
    let underEyeEdge = 0;
    const underEyeCanvas = document.createElement('canvas');
    underEyeCanvas.width = 30;
    underEyeCanvas.height = 12;
    const underCtx = underEyeCanvas.getContext('2d');
    if (underCtx) {
      const leftUnderX = p[41].x - 8;
      const leftUnderY = p[41].y + 2;
      underCtx.drawImage(input, leftUnderX, leftUnderY, 24, 10, 0, 0, 30, 12);
      const underData = underCtx.getImageData(0, 0, 30, 12).data;
      for (let i = 4; i < underData.length - 4; i += 4) {
        const diff = Math.abs(underData[i] - underData[i - 4]);
        if (diff > 25) underEyeEdge++;
      }
    }
    const underEyeRatio = underEyeEdge / (30 * 12);

    // Glasses criteria: strong nasal bridge frame edge, lens glare, or frame rim under eye
    const glassesScore = avgEdge * 0.55 + edgeRatio * 45 + specularRatio * 35 + underEyeRatio * 30;
    const hasGlasses = avgEdge > 17 || edgeRatio > 0.13 || glassesScore > 21 || specularRatio > 0.055;

    return { hasGlasses, score: glassesScore };
  } catch (err) {
    console.warn('Glasses detection check warning:', err);
    return { hasGlasses: false, score: 0 };
  }
}

/**
 * Helper: Detect whether the person is wearing a face mask or covering their mouth
 */
function detectMaskPresence(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  landmarks: faceapi.FaceLandmarks68
): { hasMask: boolean; score: number } {
  try {
    const p = landmarks.positions;
    if (!p || p.length < 68) return { hasMask: false, score: 0 };

    // Landmarks 48-67: Mouth outer and inner lips
    // Landmark 33: Subnasale (under nose)
    // Landmark 8: Chin
    const mouthLeft = p[48];
    const mouthRight = p[54];
    const noseBottom = p[33];
    const chin = p[8];

    const mouthW = Math.max(15, mouthRight.x - mouthLeft.x);
    const mouthH = Math.max(12, chin.y - noseBottom.y);

    const canvas = document.createElement('canvas');
    const sw = 32;
    const sh = 32;
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { hasMask: false, score: 0 };

    ctx.drawImage(input, mouthLeft.x - mouthW * 0.2, noseBottom.y, mouthW * 1.4, mouthH, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh).data;

    let lipChromaCount = 0;
    let totalPixels = sw * sh;
    let rSum = 0, gSum = 0, bSum = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      rSum += r;
      gSum += g;
      bSum += b;

      // Natural human lips have distinct reddish chroma compared to green & blue
      const lipChroma = r - (g + b) / 2;
      if (lipChroma > 14) {
        lipChromaCount++;
      }
    }

    const lipRatio = lipChromaCount / totalPixels;
    const avgR = rSum / totalPixels;
    const avgG = gSum / totalPixels;
    const avgB = bSum / totalPixels;

    // Detect various mask colors: Medical cyan/blue, black/dark, white, green
    const isBlueCloth = avgB > avgR + 10 && avgB > avgG; // Medical blue/cyan mask
    const isDarkCloth = avgR < 48 && avgG < 48 && avgB < 48; // Black mask
    const isWhiteCloth = avgR > 175 && avgG > 175 && avgB > 175 && Math.abs(avgR - avgG) < 18 && Math.abs(avgR - avgB) < 18; // White medical mask
    const isGreenCloth = avgG > avgR + 12 && avgG > avgB; // Surgical green mask

    const hasMask = lipRatio < 0.055 || isBlueCloth || isDarkCloth || isWhiteCloth || isGreenCloth;

    return { hasMask, score: lipRatio };
  } catch (err) {
    console.warn('Mask detection check warning:', err);
    return { hasMask: false, score: 0 };
  }
}

/**
 * ULTRA-FAST Face Tracker for HUD overlays (10-20ms)
 * Only detects bounding box and distance ratio WITHOUT heavy descriptor computation.
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
    inputSize: 160,
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
 * Full biometric extraction and STRICT multi-condition validation:
 * 1. Wajah Ganda (Multiple Faces) - Ditolak jika > 1 orang
 * 2. Pencahayaan Ruangan (Low Light) - Ditolak jika terlalu gelap (< 48 lux)
 * 3. Kacamata (Glasses) - Ditolak jika mengenakan kacamata
 * 4. Masker (Mask) - Ditolak jika mulut/hidung tertutup kain
 * 5. Jarak (Distance) - Ditolak jika terlalu jauh/dekat
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
      distanceMessage: 'Menunggu kamera...',
      validationFailed: true,
      rejectReasonType: 'no_face',
      validationMessage: 'Kamera sedang mempersiapkan stream video...'
    };
  }

  const origWidth = 
    ('videoWidth' in input && input.videoWidth) || 
    ('naturalWidth' in input && input.naturalWidth) || 
    ('width' in input && typeof input.width === 'number' ? input.width : 640);

  const origHeight = 
    ('videoHeight' in input && input.videoHeight) || 
    ('naturalHeight' in input && input.naturalHeight) || 
    ('height' in input && typeof input.height === 'number' ? input.height : 480);

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.42
  });

  // ========================================================
  // ATURAN 1: DETEKSI WAJAH GANDA (Anti Multiple Faces / Joki)
  // ========================================================
  const allDetections = await faceapi.detectAllFaces(input, detectorOptions);

  if (allDetections.length > 1) {
    const firstBox = {
      x: allDetections[0].box.x,
      y: allDetections[0].box.y,
      width: allDetections[0].box.width,
      height: allDetections[0].box.height,
    };
    return {
      detection: allDetections[0],
      descriptor: null,
      box: firstBox,
      faceRatio: firstBox.width / (origWidth || 640),
      distanceStatus: 'no_face',
      distanceMessage: 'Wajah Ganda',
      validationFailed: true,
      rejectReasonType: 'multiple_faces',
      validationMessage: `Terdeteksi ${allDetections.length} wajah di kamera! Pastikan hanya Anda sendiri di depan kamera tanpa orang lain di samping atau belakang.`
    };
  }

  if (allDetections.length === 0) {
    return {
      detection: null,
      descriptor: null,
      box: null,
      faceRatio: 0,
      distanceStatus: 'no_face',
      distanceMessage: 'Wajah tidak terdeteksi',
      validationFailed: true,
      rejectReasonType: 'no_face',
      validationMessage: 'Wajah tidak terdeteksi. Posisikan wajah tegak lurus tepat menghadap kamera.'
    };
  }

  // ========================================================
  // EKSTRAKSI LANDMARKS & DESKRIPTOR 128-DIMENSI
  // ========================================================
  const result = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!result || !result.landmarks) {
    return {
      detection: null,
      descriptor: null,
      box: null,
      faceRatio: 0,
      distanceStatus: 'no_face',
      distanceMessage: 'Wajah tidak terdeteksi jelas',
      validationFailed: true,
      rejectReasonType: 'no_face',
      validationMessage: 'Wajah tidak terdeteksi dengan jelas. Harap hadap lurus ke kamera.'
    };
  }

  const box = {
    x: result.detection.box.x,
    y: result.detection.box.y,
    width: result.detection.box.width,
    height: result.detection.box.height,
  };

  const faceRatio = box.width / (origWidth || 640);

  // ========================================================
  // ATURAN 2: DETEKSI JARAK (Distance Check)
  // ========================================================
  let distanceStatus: 'optimal' | 'too_far' | 'too_close' = 'optimal';
  let distanceMessage = 'Jarak Ideal';

  if (faceRatio < 0.22) {
    distanceStatus = 'too_far';
    distanceMessage = 'Jarak terlalu jauh! Dekatkan wajah Anda ke kamera.';
    return {
      detection: result.detection,
      descriptor: null,
      box,
      faceRatio,
      distanceStatus,
      distanceMessage,
      validationFailed: true,
      rejectReasonType: 'too_far',
      validationMessage: 'Posisi wajah Anda terlalu jauh dari kamera! Silakan mendekat hingga pas di dalam bingkai oval.'
    };
  } else if (faceRatio > 0.65) {
    distanceStatus = 'too_close';
    distanceMessage = 'Terlalu dekat! Mundurkan sedikit posisi kepala Anda.';
    return {
      detection: result.detection,
      descriptor: null,
      box,
      faceRatio,
      distanceStatus,
      distanceMessage,
      validationFailed: true,
      rejectReasonType: 'too_close',
      validationMessage: 'Posisi wajah Anda terlalu dekat dengan kamera! Silakan mundurkan sedikit posisi kepala Anda.'
    };
  }

  // ========================================================
  // ATURAN 3: DETEKSI RUANGAN GELAP (Low Light / Dark Room)
  // ========================================================
  try {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 64;
    sampleCanvas.height = 64;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (sampleCtx) {
      const sx = Math.max(0, box.x);
      const sy = Math.max(0, box.y);
      const sw = Math.min(origWidth - sx, box.width);
      const sh = Math.min(origHeight - sy, box.height);

      sampleCtx.drawImage(input, sx, sy, sw, sh, 0, 0, 64, 64);
      const imgData = sampleCtx.getImageData(0, 0, 64, 64).data;

      let sumLum = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        sumLum += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
      }
      const avgLuminance = sumLum / (64 * 64);

      if (avgLuminance < 48) {
        return {
          detection: result.detection,
          descriptor: null,
          box,
          faceRatio,
          distanceStatus,
          distanceMessage: 'Ruangan Gelap',
          validationFailed: true,
          rejectReasonType: 'low_light',
          validationMessage: `Pencahayaan ruangan terlalu gelap (${Math.round(avgLuminance)}/255). Harap cari area dengan pencahayaan yang lebih terang.`
        };
      }
    }
  } catch (err) {
    console.warn('Luminance check error:', err);
  }

  // ========================================================
  // ATURAN 4: DETEKSI KACAMATA (Glasses Detection)
  // ========================================================
  const glassesCheck = detectGlassesPresence(input, result.landmarks);
  if (glassesCheck.hasGlasses) {
    return {
      detection: result.detection,
      descriptor: null,
      box,
      faceRatio,
      distanceStatus,
      distanceMessage: 'Kacamata Terdeteksi',
      validationFailed: true,
      rejectReasonType: 'glasses_detected',
      validationMessage: 'Terdeteksi mengenakan kacamata! Harap lepas kacamata Anda terlebih dahulu sebelum absen.'
    };
  }

  // ========================================================
  // ATURAN 5: DETEKSI MASKER / PENUTUP WAJAH (Mask Detection)
  // ========================================================
  const maskCheck = detectMaskPresence(input, result.landmarks);
  if (maskCheck.hasMask) {
    return {
      detection: result.detection,
      descriptor: null,
      box,
      faceRatio,
      distanceStatus,
      distanceMessage: 'Masker Terdeteksi',
      validationFailed: true,
      rejectReasonType: 'mask_detected',
      validationMessage: 'Wajah tertutup masker atau kain! Harap buka masker agar seluruh wajah tampak jelas.'
    };
  }

  // ========================================================
  // VALIDASI LOLOS SEMUANYA -> Kembalikan Deskriptor Wajah Valid
  // ========================================================
  return {
    detection: result.detection,
    descriptor: result.descriptor,
    box,
    faceRatio,
    distanceStatus,
    distanceMessage,
    validationFailed: false
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
 * Match a face descriptor with registered students using strict Euclidean distance threshold
 */
export function matchFaceWithStudents(
  targetDescriptor: Float32Array,
  students: Profile[],
  distanceThreshold = 0.38
): FaceMatchResult {
  if (!students || students.length === 0) {
    return {
      isMatch: false,
      distance: 1.0,
      confidence: 0,
      errorReason: 'Tidak ada data siswa terdaftar di database untuk dicocokkan.'
    };
  }

  let minDistance = 1.0;
  let bestMatch: Profile | null = null;

  for (const student of students) {
    if (!student.face_descriptor || student.face_descriptor.length !== 128) {
      continue;
    }

    const dist = calculateEuclideanDistance(targetDescriptor, student.face_descriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = student;
    }
  }

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
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/jpeg', 0.7);
}
