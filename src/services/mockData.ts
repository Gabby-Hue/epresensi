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

const todayStr = new Date().toISOString().split('T')[0];

export const INITIAL_ATTENDANCES: AttendanceRecord[] = [
  {
    id: 'att-101',
    userId: 'usr-emp-1',
    userName: 'Ahmad Fauzi',
    userEmail: 'ahmad.fauzi@presensi.co.id',
    type: 'luring',
    sessionType: 'masuk',
    status: 'hadir',
    date: todayStr,
    clockInTime: `${todayStr}T08:14:22.000Z`,
    latitude: -6.20875,
    longitude: 106.84558,
    distanceMeters: 24,
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
    createdAt: `${todayStr}T08:14:22.000Z`,
  },
  {
    id: 'att-102',
    userId: 'usr-emp-2',
    userName: 'Siti Nurhaliza',
    userEmail: 'siti.nurhaliza@presensi.co.id',
    type: 'daring',
    sessionType: 'masuk',
    status: 'hadir',
    date: todayStr,
    clockInTime: `${todayStr}T08:45:10.000Z`,
    latitude: -6.2201,
    longitude: 106.8123,
    distanceMeters: 3800,
    reason: 'Kunjungan Klien ke BSD Tech Park & Work from Anywhere',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
    createdAt: `${todayStr}T08:45:10.000Z`,
  },
  {
    id: 'att-103',
    userId: 'usr-emp-1',
    userName: 'Ahmad Fauzi',
    userEmail: 'ahmad.fauzi@presensi.co.id',
    type: 'luring',
    sessionType: 'pulang',
    status: 'hadir',
    date: todayStr,
    clockInTime: `${todayStr}T17:05:00.000Z`,
    latitude: -6.20875,
    longitude: 106.84558,
    distanceMeters: 22,
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
    createdAt: `${todayStr}T17:05:00.000Z`,
  },
];
