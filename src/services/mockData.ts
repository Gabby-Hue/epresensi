import { AttendanceRecord, OfficeSettings, UserProfile } from '../types/attendance';

export const INITIAL_OFFICE_SETTINGS: OfficeSettings = {
  id: 'off-001',
  officeName: 'Headquarter Gedung Presensi Utama',
  latitude: -6.2088,
  longitude: 106.8456,
  radiusMeters: 150,
  updatedAt: new Date().toISOString(),
};

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-admin-1',
    email: 'admin@presensi.co.id',
    fullName: 'Budi Santoso (Admin HR)',
    role: 'admin',
    department: 'Human Capital',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    id: 'usr-emp-1',
    email: 'ahmad.fauzi@presensi.co.id',
    fullName: 'Ahmad Fauzi',
    role: 'employee',
    department: 'Engineering',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'usr-emp-2',
    email: 'siti.nurhaliza@presensi.co.id',
    fullName: 'Siti Nurhaliza',
    role: 'employee',
    department: 'Marketing',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
];

export const INITIAL_ATTENDANCES: AttendanceRecord[] = [];
