export type UserRole = 'admin' | 'employee';

export type AttendanceType = 'luring' | 'daring' | 'izin_sakit';

export type SessionType = 'masuk' | 'pulang' | 'izin_sakit';

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  avatarUrl?: string;
  createdBy?: string | null;
}

export interface OfficeSettings {
  id: string;
  officeName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: AttendanceType;
  sessionType: SessionType;
  status: AttendanceStatus;
  date: string; // YYYY-MM-DD
  clockInTime: string; // ISO string
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  reason?: string;
  startDate?: string;
  endDate?: string;
  photoUrl?: string;
  documentUrl?: string;
  createdAt: string;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
