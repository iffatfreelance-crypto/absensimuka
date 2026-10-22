export type UserRole = 'siswa' | 'admin';

export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'alpa';

export interface Profile {
  id: string;
  nama: string;
  nis: string;
  username?: string | null;
  password?: string | null;
  role: UserRole;
  face_descriptor?: number[] | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  tanggal: string;
  jam_masuk: string;
  status: AttendanceStatus;
  similarity_score?: number | null;
  foto_bukti_url?: string | null;
  catatan?: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface StudentSummary {
  user_id: string;
  nama: string;
  nis: string;
  avatar_url?: string | null;
  total_hadir: number;
  total_terlambat: number;
  total_izin: number;
  total_alpa: number;
  total_absen_tercatat: number;
  persentase_kehadiran: number;
}

export type ScanState = 
  | 'standby'           // Ready, waiting for face in camera frame
  | 'detecting'         // Face detected, tracking box
  | 'verifying'         // Extracting 128-d descriptor & querying DB
  | 'success'           // Verified & attendance logged!
  | 'rejected'          // Face unrecognized or mismatched
  | 'error'             // Generic error (camera / network)
  | 'permission-denied'; // Camera permission blocked

export interface FaceMatchResult {
  isMatch: boolean;
  student?: Profile;
  distance: number;
  confidence: number;
  errorReason?: string;
}
