import { apiFetch, clearToken, setToken } from '../lib/api';
import {
  ApprovalStatus,
  AttendanceRecord,
  AttendanceType,
  OfficeSettings,
  SessionType,
  UserProfile,
} from '../types/attendance';
import { getDeviceInfo } from './deviceService';
import { todayWIB } from '../utils/dates';

let currentOfficeSettings: OfficeSettings = {
  id: '1',
  officeName: 'Kantor Utama',
  latitude: -6.2088,
  longitude: 106.8456,
  radiusMeters: 150,
  color: '#2196F3',
  updatedAt: new Date().toISOString(),
};

let cachedOffices: OfficeSettings[] = [currentOfficeSettings];

const FIXED_OFFICE_ID = '1';

function isHexColor(v: any): boolean {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
}

// Backend mengembalikan id numerik (MySQL AUTO_INCREMENT) —
// frontend tetap pakai string supaya sisa UI tidak berubah.
function mapUser(u: any): UserProfile {
  return {
    id: String(u.id),
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    department: u.department,
    companyId: u.companyId != null ? String(u.companyId) : null,
    companyName: u.companyName ?? undefined,
    avatarUrl: u.avatarUrl,
    createdBy: u.createdBy != null ? String(u.createdBy) : null,
    phoneNumber: u.phoneNumber ?? undefined,
    deviceModel: u.deviceModel ?? undefined,
    deviceId: u.deviceId ?? undefined,
  };
}

function mapOffice(o: any): OfficeSettings {
  return {
    id: String(o.id),
    officeName: o.officeName || 'Kantor',
    latitude: Number(o.latitude),
    longitude: Number(o.longitude),
    radiusMeters: Number(o.radiusMeters),
    color: isHexColor(o.color) ? o.color : '#2196F3',
    companyId: o.companyId != null ? String(o.companyId) : null,
    updatedAt: o.updatedAt,
  };
}

function mapRecord(r: any): AttendanceRecord {
  return {
    id: String(r.id),
    userId: r.userId != null ? String(r.userId) : r.userEmail,
    userName: r.userName,
    userEmail: r.userEmail,
    type: r.type,
    sessionType: r.sessionType || 'masuk',
    status: r.status,
    date: r.date,
    clockInTime: r.clockInTime,
    companyId: r.companyId != null ? String(r.companyId) : null,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceMeters: r.distanceMeters,
    officeName: r.officeName ?? undefined,
    officeColor: r.officeColor ?? null,
    reason: r.reason,
    startDate: r.startDate,
    endDate: r.endDate,
    photoUrl: r.photoUrl,
    documentUrl: r.documentUrl,
    createdAt: r.createdAt,
    approvalStatus: (r.approvalStatus as ApprovalStatus) || 'approved',
    reviewedBy: r.reviewedBy != null ? String(r.reviewedBy) : null,
    reviewedAt: r.reviewedAt ?? null,
    reviewNote: r.reviewNote ?? null,
  };
}

// Backend menerima email apa adanya — normalisasi input asal admin tetap terdaftar
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function toAuthEmail(raw: string): { authEmail: string; mapped: boolean } {
  const t = raw.trim().toLowerCase();
  if (isValidEmail(t)) return { authEmail: t, mapped: false };
  // tanpa @ -> tambah @epresensi.com ; tanpa titik di domain -> tambah .com
  if (!t.includes('@')) return { authEmail: `${t}@epresensi.com`, mapped: true };
  const [local, domain] = t.split('@');
  const dom = domain.includes('.') ? domain : `${domain}.com`;
  return { authEmail: `${local}@${dom}`, mapped: true };
}

export class AttendanceService {
  /**
   * Login via backend (JWT) + device lock (dicek di server)
   */
  static async signInWithEmail(email: string, pass: string): Promise<{ user: UserProfile | null; error: string | null }> {
    const raw = email.trim();
    const { authEmail } = toAuthEmail(raw);
    try {
      const dev = await getDeviceInfo();
      const data = await apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          email: authEmail,
          password: pass,
          deviceModel: (dev as any).modelName ?? (dev as any).model ?? null,
          deviceId: (dev as any).deviceId ?? (dev as any).id ?? null,
        },
      });
      await setToken(data.token);
      return { user: mapUser(data.user), error: null };
    } catch (e: any) {
      await clearToken();
      return { user: null, error: e?.message || 'Login gagal. Coba lagi.' };
    }
  }

  static async signOut(): Promise<void> {
    try {
      await clearToken();
    } catch {}
  }

  static async getCurrentProfile(_userId?: string): Promise<UserProfile | null> {
    try {
      const data = await apiFetch<{ user: any }>('/me');
      return mapUser(data.user);
    } catch {
      return null;
    }
  }

  static async updateAvatar(userId: string, avatarUrl: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    // Urutan: /me/avatar dulu (milik sendiri, pasti boleh), baru fallback /users/:id.
    // Alasan: server VPS lama belum punya /me/avatar dan PATCH /users/:id masih admin-only,
    // sehingga karyawan gagal simpan avatar dengan pesan 404 HTML yang menyesatkan.
    try {
      const data = await apiFetch<{ user: any }>('/me/avatar', {
        method: 'PATCH',
        body: { avatarUrl },
      });
      return { success: true, user: mapUser(data.user) };
    } catch (first: any) {
      // Kalau server lama (404 = endpoint belum ada), langsung kasih pesan jelas
      // tanpa coba fallback yang juga pasti gagal.
      if (first?.status === 404) {
        return {
          success: false,
          message: 'Server belum mendukung ubah foto profil (perlu update backend ke versi terbaru).',
        };
      }
      try {
        const data = await apiFetch<{ user: any }>(`/users/${userId}`, {
          method: 'PATCH',
          body: { avatarUrl },
        });
        return { success: true, user: mapUser(data.user) };
      } catch (e: any) {
        return { success: false, message: e?.message || 'Gagal memperbarui foto profil' };
      }
    }
  }

  /**
   * Admin mendaftarkan akun karyawan. Email asal tetap diterima (mapping ke @epresensi.com bila invalid)
   * Urutan form admin: Nama, Departemen, Email, Password
   */
  static async createEmployeeAccount(params: {
    email: string;
    password: string;
    fullName: string;
    department?: string;
    createdBy?: string | null;
    role?: 'employee' | 'admin';
    companyId?: string | null;
  }): Promise<{ success: boolean; message: string }> {
    const cleanName = params.fullName.trim();
    const typedRaw = params.email.trim();
    if (!cleanName || !typedRaw || !params.password) {
      return { success: false, message: 'Lengkapi nama, departemen, email, dan kata sandi dulu.' };
    }
    if (params.password.length < 6) return { success: false, message: 'Kata sandi minimal 6 karakter.' };

    const { authEmail, mapped } = toAuthEmail(typedRaw);

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: {
          email: authEmail,
          password: params.password,
          fullName: cleanName,
          role: params.role || 'employee',
          department: params.department?.trim() || 'General',
          companyId: params.companyId ?? undefined,
        },
      });
      const label = params.role === 'admin' ? 'admin cabang' : 'karyawan';
      return {
        success: true,
        message: mapped
          ? `Akun ${label} ${cleanName} (${typedRaw}) berhasil dibuat. Untuk masuk, ketik persis "${typedRaw}" + kata sandi yang didaftarkan.`
          : `Akun ${label} ${cleanName} (${typedRaw}) berhasil dibuat.`,
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal membuat akun. Periksa koneksi lalu coba lagi.' };
    }
  }

  static async updateEmployeeAccount(params: {
    id: string;
    fullName: string;
    department?: string;
  }): Promise<{ success: boolean; message: string }> {
    const cleanName = params.fullName.trim();
    if (!cleanName) return { success: false, message: 'Nama tidak boleh kosong.' };
    try {
      await apiFetch(`/users/${params.id}`, {
        method: 'PATCH',
        body: { fullName: cleanName, department: params.department?.trim() || 'General' },
      });
      return { success: true, message: `Data ${cleanName} berhasil diperbarui.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memperbarui data.' };
    }
  }

  static async deleteEmployeeAccount(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiFetch(`/users/${id}`, { method: 'DELETE' });
      return { success: true, message: 'Akun berhasil dihapus.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus akun.' };
    }
  }

  // Ubah kata sandi pengguna / admin cabang oleh Superadmin atau Admin
  static async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiFetch(`/users/${id}`, {
        method: 'PATCH',
        body: { password: newPassword },
      });
      return { success: true, message: 'Kata sandi berhasil diperbarui.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memperbarui kata sandi.' };
    }
  }

  // Reset kunci perangkat — hanya admin bisa panggil ini
  static async resetEmployeeDevice(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiFetch(`/users/${id}/reset-device`, { method: 'PATCH' });
      return { success: true, message: 'Kunci perangkat direset. Karyawan bisa login dari HP baru.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal reset perangkat.' };
    }
  }

  // Akun pertama (DB kosong): superadmin tanpa token, login langsung bila sudah ada.
  static async bootstrapInitialAdmin(): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const adminEmail = 'admin@admin.com';
    const adminPass = '123456';
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        auth: false,
        body: {
          email: adminEmail,
          password: adminPass,
          fullName: 'Superadmin Presensi',
          role: 'superadmin',
          department: 'Human Capital',
        },
      });
    } catch (e: any) {
      // 409 = admin sudah ada, lanjut login. Error lain = backend mati.
      if ((e as any)?.status !== 409) {
        return { success: false, message: e?.message || 'Gagal bootstrap admin.' };
      }
    }
    const login = await this.signInWithEmail(adminEmail, adminPass);
    if (login.user) {
      return { success: true, message: `Akun Admin (${adminEmail} / ${adminPass}) siap!`, user: login.user };
    }
    return { success: false, message: login.error || 'Gagal bootstrap admin.' };
  }

  static async getOfficeSettings(): Promise<OfficeSettings> {
    const offices = await this.getOfficeList();
    if (offices.length > 0) currentOfficeSettings = offices[0];
    return currentOfficeSettings;
  }

  /** Semua titik kantor, urut dari yang paling baru. */
  static async getOfficeList(): Promise<OfficeSettings[]> {
    try {
      const data = await apiFetch<{ offices: any[] }>('/offices');
      const mapped = (data.offices || []).map(mapOffice);
      mapped.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      if (mapped.length > 0) currentOfficeSettings = mapped[0];
      return mapped;
    } catch {
      return [];
    }
  }

  /** Tambah titik kantor baru (nama + koordinat + radius + warna custom). */
  static async addOffice(params: {
    officeName: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    color?: string;
  }): Promise<{ success: boolean; message: string; office?: OfficeSettings }> {
    const name = params.officeName.trim();
    if (!name) return { success: false, message: 'Nama kantor tidak boleh kosong.' };
    if (!isFinite(params.latitude) || !isFinite(params.longitude)) {
      return { success: false, message: 'Koordinat tidak valid.' };
    }
    if (!Number.isInteger(params.radiusMeters) || params.radiusMeters <= 0) {
      return { success: false, message: 'Radius harus bilangan bulat positif (meter).' };
    }
    const officeColor = isHexColor(params.color) ? (params.color as string) : '#2196F3';
    try {
      const data = await apiFetch<{ office: any }>('/offices', {
        method: 'POST',
        body: {
          officeName: name,
          latitude: params.latitude,
          longitude: params.longitude,
          radiusMeters: params.radiusMeters,
          color: officeColor,
        },
      });
      const office = mapOffice(data.office);
      await this.getOfficeList();
      return { success: true, message: `Titik ${name} berhasil ditambahkan.`, office };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menambah titik kantor.' };
    }
  }

  /** Ubah nama / titik / radius / warna kantor tertentu. */
  static async updateOffice(
    id: string,
    params: { officeName: string; latitude: number; longitude: number; radiusMeters: number; color?: string }
  ): Promise<{ success: boolean; message: string }> {
    const name = params.officeName.trim();
    if (!name) return { success: false, message: 'Nama kantor tidak boleh kosong.' };
    if (!isFinite(params.latitude) || !isFinite(params.longitude)) {
      return { success: false, message: 'Koordinat tidak valid.' };
    }
    if (!Number.isInteger(params.radiusMeters) || params.radiusMeters <= 0) {
      return { success: false, message: 'Radius harus bilangan bulat positif (meter).' };
    }
    const officeColor = isHexColor(params.color) ? (params.color as string) : '#2196F3';
    try {
      await apiFetch(`/offices/${id}`, {
        method: 'PATCH',
        body: {
          officeName: name,
          latitude: params.latitude,
          longitude: params.longitude,
          radiusMeters: params.radiusMeters,
          color: officeColor,
        },
      });
      await this.getOfficeList();
      return { success: true, message: `Titik ${name} berhasil diperbarui.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memperbarui titik kantor.' };
    }
  }

  /** Hapus titik kantor. API menjadi sumber kebenaran; jumlah titik valid ditangani server. */
  static async deleteOffice(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiFetch(`/offices/${id}`, { method: 'DELETE' });
      await this.getOfficeList();
      return { success: true, message: 'Titik kantor dihapus.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus titik kantor.' };
    }
  }

  static async updateOfficeSettings(newSettings: Partial<OfficeSettings>): Promise<OfficeSettings> {
    currentOfficeSettings = { ...currentOfficeSettings, ...newSettings, updatedAt: new Date().toISOString() };
    try {
      const list = await this.getOfficeList();
      const targetId = list.length > 0 && list[0].id ? list[0].id : FIXED_OFFICE_ID;
      await apiFetch(`/offices/${targetId}`, {
        method: 'PATCH',
        body: {
          officeName: currentOfficeSettings.officeName,
          latitude: currentOfficeSettings.latitude,
          longitude: currentOfficeSettings.longitude,
          radiusMeters: currentOfficeSettings.radiusMeters,
          color: currentOfficeSettings.color,
        },
      });
      currentOfficeSettings.id = targetId;
      await this.getOfficeList();
    } catch {}
    return currentOfficeSettings;
  }

  static async getAllUsers(companyId?: string): Promise<UserProfile[]> {
    try {
      const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
      const data = await apiFetch<{ users: any[] }>(`/users${q}`);
      if (!data.users) return [];
      return data.users.map(mapUser);
    } catch {
      return [];
    }
  }

  static async getTodayAttendances(): Promise<AttendanceRecord[]> {
      const today = todayWIB();
    try {
      const data = await apiFetch<{ attendances: any[] }>(`/attendances?month=${today.slice(0, 7)}`);
      if (!data.attendances || data.attendances.length === 0) return [];
      return data.attendances.map(mapRecord).filter((r) => r.date === today);
    } catch {
      return [];
    }
  }

  static async getUserAttendances(userId: string): Promise<AttendanceRecord[]> {
    try {
      const data = await apiFetch<{ attendances: any[] }>(`/attendances?user_id=${encodeURIComponent(userId)}`);
      if (!data.attendances || data.attendances.length === 0) return [];
      return data.attendances.map(mapRecord);
    } catch {
      return [];
    }
  }

  static async submitAttendance(params: {
    user: UserProfile;
    type: AttendanceType;
    sessionType?: SessionType;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    officeName?: string;
    officeColor?: string;
    reason?: string;
    startDate?: string;
    endDate?: string;
    photoUrl?: string;
    documentUrl?: string;
  }): Promise<AttendanceRecord> {
    const now = new Date();
        const today = todayWIB(now);
    const status = params.type === 'izin_sakit' ? 'izin' : 'hadir';
    const sType = params.sessionType || (params.type === 'izin_sakit' ? 'izin_sakit' : 'masuk');

    try {
      const data = await apiFetch<{ attendance: any }>('/attendances', {
        method: 'POST',
        body: {
          type: params.type,
          sessionType: sType,
          status,
          date: today,
          clockInTime: now.toISOString(),
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          distanceMeters: params.distanceMeters ?? null,
          officeName: params.officeName ?? null,
          officeColor: params.officeColor ?? null,
          reason: params.reason ?? null,
          startDate: params.startDate || today,
          endDate: params.endDate || today,
          photoUrl: params.photoUrl ?? null,
          documentUrl: params.documentUrl ?? null,
        },
      });
      return mapRecord(data.attendance);
    } catch (err: any) {
      const msg = err?.message || 'Gagal menyimpan presensi ke server.';
      console.error('[API] submitAttendance gagal:', msg);
      throw new Error(msg);
    }
  }

  static async getUserTodayStatus(userId: string): Promise<AttendanceRecord | null> {
      const today = todayWIB();
    const recs = await this.getUserAttendances(userId);
    return recs.find((r) => r.date === today) || null;
  }

  /** Antrean pengajuan izin/sakit yang menunggu keputusan admin. */
  static async getCompanies(): Promise<{ id: string; name: string }[]> {
    try {
      const data = await apiFetch<{ companies: any[] }>('/companies');
      return (data.companies || []).map((c: any) => ({ id: String(c.id), name: c.name }));
    } catch {
      return [];
    }
  }

  static async createCompany(name: string): Promise<{ success: boolean; message: string }> {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, message: 'Nama PT tidak boleh kosong.' };
    try {
      await apiFetch('/companies', { method: 'POST', body: { name: trimmed } });
      return { success: true, message: `PT ${trimmed} berhasil dibuat.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal membuat PT.' };
    }
  }

  static async deleteCompany(id: string, force = false): Promise<{ success: boolean; message: string }> {
    try {
      const q = force ? '?force=true' : '';
      await apiFetch(`/companies/${id}${q}`, { method: 'DELETE' });
      return { success: true, message: 'PT berhasil dihapus.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus PT.' };
    }
  }

  static async getPendingApprovals(): Promise<AttendanceRecord[]> {
    try {
      const data = await apiFetch<{ attendances: any[] }>('/attendances?approval=pending');
      if (!data.attendances || data.attendances.length === 0) return [];
      return data.attendances.map(mapRecord);
    } catch {
      return [];
    }
  }

  static async getAllAttendances(): Promise<AttendanceRecord[]> {
    try {
      const data = await apiFetch<{ attendances: any[] }>('/attendances');
      return (data.attendances || []).map(mapRecord);
    } catch { return []; }
  }

  static async getDepartments(): Promise<string[]> {
    try {
      const data = await apiFetch<{ departments: string[] }>('/departments');
      if (Array.isArray(data?.departments) && data.departments.length > 0) {
        return data.departments;
      }
      return ['Sales', 'IT', 'Drafter', 'Human Capital', 'Marketing'];
    } catch {
      return ['Sales', 'IT', 'Drafter', 'Human Capital', 'Marketing'];
    }
  }

  static async addDepartment(name: string): Promise<{ success: boolean; message: string; departments: string[] }> {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'Nama departemen tidak boleh kosong.', departments: [] };
    }
    try {
      const data = await apiFetch<{ departments: string[]; added: string }>('/departments', {
        method: 'POST',
        body: { name: trimmed },
      });
      return {
        success: true,
        message: `Departemen ${trimmed} berhasil ditambahkan.`,
        departments: data.departments || [],
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menambahkan departemen.', departments: [] };
    }
  }

  static async reviewApproval(
    id: string,
    decision: 'approved' | 'rejected',
    _reviewerId: string,
    note?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await apiFetch(`/attendances/${id}/review`, {
        method: 'PATCH',
        body: { decision, note: note?.trim() || null },
      });
      return {
        success: true,
        message: decision === 'approved' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.',
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memproses persetujuan.' };
    }
  }

  /** Mengambil riwayat Audit Trail keaktifan admin cabang (khusus Superadmin & Admin). */
  static async getAuditLogs(companyId?: string): Promise<import('../types/attendance').AuditLog[]> {
    try {
      const q = companyId ? `?company_id=${companyId}` : '';
      const data = await apiFetch<{ logs: any[] }>(`/audit-logs${q}`);
      return (data.logs || []).map((l: any) => ({
        id: String(l.id),
        userId: String(l.userId),
        userName: l.userName,
        userRole: l.userRole,
        companyId: l.companyId ? String(l.companyId) : null,
        companyName: l.companyName || null,
        action: l.action,
        description: l.description,
        createdAt: l.createdAt,
      }));
    } catch {
      return [];
    }
  }
}
