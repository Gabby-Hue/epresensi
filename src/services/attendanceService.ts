import { supabase, signUpClient } from '../lib/supabase';
import {
  AttendanceRecord,
  AttendanceType,
  OfficeSettings,
  SessionType,
  UserProfile,
} from '../types/attendance';
import { getDeviceInfo } from './deviceService';

let currentOfficeSettings: OfficeSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  officeName: 'Kantor Utama',
  latitude: -6.2088,
  longitude: 106.8456,
  radiusMeters: 150,
  updatedAt: new Date().toISOString(),
};

let cachedOffices: OfficeSettings[] = [currentOfficeSettings];

const FIXED_OFFICE_ID = '00000000-0000-0000-0000-000000000001';

function mapOfficeRow(row: any): OfficeSettings {
  return {
    id: row.id,
    officeName: row.office_name || 'Kantor',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    updatedAt: row.updated_at,
  };
}

// Supabase Auth menolak email tanpa @/. — normalisasi input asal admin tetap terdaftar
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

function translateAuthError(msgRaw: string): string {
  const m = (msgRaw || '').toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'Email atau kata sandi salah.';
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed'))
    return 'Email belum diverifikasi. Matikan Confirm email di Supabase atau cek inbox.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Email ini sudah terdaftar. Langsung masuk, atau hapus dulu akun auth lama di dashboard Supabase bila ingin buat ulang.';
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit') || m.includes('429'))
    return 'Batas kirim email tercapai. Tunggu sebentar atau matikan Confirm email di Supabase.';
  if (m.includes('password should be at least 6'))
    return 'Kata sandi minimal 6 karakter.';
  if (m.includes('invalid email') || m.includes('email_address_invalid'))
    return 'Format email tidak valid. Gunakan email dengan @ dan domain (contoh: budi@kantor.com).';
  if (m.includes('device') && m.includes('terkunci')) return msgRaw;
  return msgRaw || 'Login gagal. Coba lagi.';
}

export class AttendanceService {
  /**
   * Login ketat via Supabase Auth + device lock
   */
  static async signInWithEmail(email: string, pass: string): Promise<{ user: UserProfile | null; error: string | null }> {
    const raw = email.trim();
    const { authEmail } = toAuthEmail(raw);
    const cleanEmail = authEmail;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });
      if (error) return { user: null, error: translateAuthError(error.message) };
      if (!data?.user) return { user: null, error: 'Login gagal. Coba lagi.' };

      const profile = await this.getCurrentProfile(data.user.id);
      if (!profile) return { user: null, error: 'Akun belum terdaftar di data karyawan. Hubungi admin.' };

      // Device lock: admin bebas, employee dikunci ke device pertama
      if (profile.role !== 'admin') {
        const dev = await getDeviceInfo();
        const storedModel = (profile as any).deviceModel ?? null;
        const storedId = (profile as any).deviceId ?? null;
        if (storedId && storedId !== dev.deviceId) {
          await supabase.auth.signOut();
          return {
            user: null,
            error: `Akun terkunci di perangkat ${storedModel || storedId}. Hubungi admin untuk atur ulang.`,
          };
        }
        if (!storedId) {
          // kunci otomatis ke device ini
          await supabase
            .from('profiles')
            .update({ device_model: dev.modelName, device_id: dev.deviceId } as any)
            .eq('id', profile.id);
          (profile as any).deviceModel = dev.modelName;
          (profile as any).deviceId = dev.deviceId;
        }
      }

      return { user: profile, error: null };
    } catch (e: any) {
      return { user: null, error: translateAuthError(e?.message || '') };
    }
  }

  static async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {}
  }

  static async getCurrentProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: data.role as any,
        department: data.department,
        avatarUrl: data.avatar_url,
        createdBy: (data as any).created_by ?? null,
        phoneNumber: (data as any).phone_number ?? undefined,
        deviceModel: (data as any).device_model ?? undefined,
        deviceId: (data as any).device_id ?? undefined,
      };
    } catch {
      return null;
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
  }): Promise<{ success: boolean; message: string }> {
    const cleanName = params.fullName.trim();
    const typedRaw = params.email.trim();
    if (!cleanName || !typedRaw || !params.password) {
      return { success: false, message: 'Lengkapi nama, departemen, email, dan kata sandi dulu.' };
    }
    if (params.password.length < 6) return { success: false, message: 'Kata sandi minimal 6 karakter.' };

    const { authEmail, mapped } = toAuthEmail(typedRaw);
    const cleanEmail = authEmail;

    try {
      const { data, error: signUpError } = await signUpClient.auth.signUp({
        email: cleanEmail,
        password: params.password,
        options: { data: { full_name: cleanName, role: 'employee' } },
      });
      if (signUpError) throw new Error(translateAuthError(signUpError.message));

      let newUserId = data?.user?.id || null;
      // Jika email sudah ada, Supabase kadang kembalikan user null tanpa error — cek via signIn dummy? fallback pesan
      if (!newUserId) {
        // coba ambil id existing lewat login gagal? tidak bisa tanpa admin key — beri pesan jelas
        throw new Error('Pendaftaran auth tidak mengembalikan ID. Mungkin email sudah terdaftar.');
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: newUserId,
          email: typedRaw.toLowerCase(), // simpan email asli yang diketik admin
          full_name: cleanName,
          role: 'employee',
          department: params.department?.trim() || 'General',
          created_by: params.createdBy ?? null,
        } as any,
        { onConflict: 'id' }
      );
      if (profileError) throw new Error(profileError.message);

      return {
        success: true,
        message: mapped
          ? `Akun ${cleanName} (${typedRaw}) berhasil dibuat. Untuk masuk, ketik persis "${typedRaw}" + kata sandi yang didaftarkan.`
          : `Akun ${cleanName} (${typedRaw}) berhasil dibuat.`,
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
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: cleanName, department: params.department?.trim() || 'General' } as any)
        .eq('id', params.id);
      if (error) throw new Error(error.message);
      return { success: true, message: `Data ${cleanName} berhasil diperbarui.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memperbarui data.' };
    }
  }

  static async deleteEmployeeAccount(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Akun karyawan berhasil dihapus.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus akun.' };
    }
  }

  // Reset kunci perangkat — hanya admin bisa panggil ini
  static async resetEmployeeDevice(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ device_model: null, device_id: null } as any)
        .eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Kunci perangkat direset. Karyawan bisa login dari HP baru.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal reset perangkat.' };
    }
  }

  static async bootstrapInitialAdmin(): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const adminEmail = 'admin@admin.com';
    const adminPass = '123456';
    try {
      const { data } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPass,
        options: { data: { full_name: 'Admin HR Presensi', role: 'admin' } },
      });
      if (data?.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: adminEmail,
          full_name: 'Admin HR Presensi',
          role: 'admin',
          department: 'Human Capital',
        } as any);
        const p = await this.getCurrentProfile(data.user.id);
        if (p) return { success: true, message: `Akun Admin (${adminEmail} / ${adminPass}) siap!`, user: p };
      }
    } catch {}
    const existing = await this.getCurrentProfile('c1a14fe4-7ff3-47c5-aa82-9a5714901e56');
    if (existing) return { success: true, message: `Akun Admin (${adminEmail} / ${adminPass}) siap!`, user: existing };
    return { success: false, message: 'Gagal bootstrap admin.' };
  }

  static async getOfficeSettings(): Promise<OfficeSettings> {
    const offices = await this.getOfficeList();
    if (offices.length > 0) currentOfficeSettings = offices[0];
    return currentOfficeSettings;
  }

  /** Semua titik kantor, urut dari yang paling baru. */
  static async getOfficeList(): Promise<OfficeSettings[]> {
    try {
      const { data, error } = await supabase.from('office_settings').select('*').order('updated_at', { ascending: false });
      if (!error && data && data.length > 0) {
        cachedOffices = data.map(mapOfficeRow);
        currentOfficeSettings = cachedOffices[0];
      }
    } catch {}
    return cachedOffices;
  }

  /** Tambah titik kantor baru (nama + koordinat + radius custom). */
  static async addOffice(params: {
    officeName: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<{ success: boolean; message: string; office?: OfficeSettings }> {
    const name = params.officeName.trim();
    if (!name) return { success: false, message: 'Nama kantor tidak boleh kosong.' };
    if (!isFinite(params.latitude) || !isFinite(params.longitude)) {
      return { success: false, message: 'Koordinat tidak valid.' };
    }
    if (!Number.isInteger(params.radiusMeters) || params.radiusMeters <= 0) {
      return { success: false, message: 'Radius harus bilangan bulat positif (meter).' };
    }
    try {
      const { data, error } = await supabase
        .from('office_settings')
        .insert({
          office_name: name,
          latitude: params.latitude,
          longitude: params.longitude,
          radius_meters: params.radiusMeters,
        } as any)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const office = mapOfficeRow(data);
      await this.getOfficeList();
      return { success: true, message: `Titik ${name} berhasil ditambahkan.`, office };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menambah titik kantor.' };
    }
  }

  /** Ubah nama / titik / radius kantor tertentu. */
  static async updateOffice(
    id: string,
    params: { officeName: string; latitude: number; longitude: number; radiusMeters: number }
  ): Promise<{ success: boolean; message: string }> {
    const name = params.officeName.trim();
    if (!name) return { success: false, message: 'Nama kantor tidak boleh kosong.' };
    if (!isFinite(params.latitude) || !isFinite(params.longitude)) {
      return { success: false, message: 'Koordinat tidak valid.' };
    }
    if (!Number.isInteger(params.radiusMeters) || params.radiusMeters <= 0) {
      return { success: false, message: 'Radius harus bilangan bulat positif (meter).' };
    }
    try {
      const { error } = await supabase
        .from('office_settings')
        .update({
          office_name: name,
          latitude: params.latitude,
          longitude: params.longitude,
          radius_meters: params.radiusMeters,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw new Error(error.message);
      await this.getOfficeList();
      return { success: true, message: `Titik ${name} berhasil diperbarui.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memperbarui titik kantor.' };
    }
  }

  /** Hapus titik kantor. Minimal 1 titik harus tersisa. */
  static async deleteOffice(id: string): Promise<{ success: boolean; message: string }> {
    if (cachedOffices.length <= 1) {
      return { success: false, message: 'Minimal harus ada 1 titik kantor. Tambah dulu titik baru sebelum menghapus.' };
    }
    try {
      const { error } = await supabase.from('office_settings').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await this.getOfficeList();
      return { success: true, message: 'Titik kantor dihapus.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus titik kantor.' };
    }
  }

  static async updateOfficeSettings(newSettings: Partial<OfficeSettings>): Promise<OfficeSettings> {
    currentOfficeSettings = { ...currentOfficeSettings, ...newSettings, updatedAt: new Date().toISOString() };
    try {
      const { data } = await supabase.from('office_settings').select('id').order('updated_at', { ascending: false }).limit(1);
      const targetId = data && data.length > 0 && data[0].id ? data[0].id : FIXED_OFFICE_ID;
      await supabase.from('office_settings').upsert({
        id: targetId,
        office_name: currentOfficeSettings.officeName,
        latitude: currentOfficeSettings.latitude,
        longitude: currentOfficeSettings.longitude,
        radius_meters: currentOfficeSettings.radiusMeters,
        updated_at: currentOfficeSettings.updatedAt,
      } as any);
      currentOfficeSettings.id = targetId;
      await this.getOfficeList();
    } catch {}
    return currentOfficeSettings;
  }

  static async getAllUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (!data) return [];
      return data.map((d: any) => ({
        id: d.id,
        email: d.email,
        fullName: d.full_name,
        role: d.role as any,
        department: d.department,
        avatarUrl: d.avatar_url,
        createdBy: d.created_by ?? null,
        phoneNumber: d.phone_number ?? undefined,
        deviceModel: d.device_model ?? undefined,
        deviceId: d.device_id ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  static async getTodayAttendances(): Promise<AttendanceRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase.from('attendances').select('*').eq('date', today).order('clock_in_time', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];
      return data.map(mapAttendanceRow);
    } catch {
      return [];
    }
  }

  // Penting: fallback via email supaya baris lama yang user_id NULL tetap tampil di mingguan
  static async getUserAttendances(userId: string): Promise<AttendanceRecord[]> {
    try {
      // ambil email profil untuk fallback
      let userEmail: string | null = null;
      try {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
        if (prof?.email) userEmail = prof.email;
      } catch {}

      // query 1: by user_id
      let rows: any[] = [];
      const { data: byId } = await supabase.from('attendances').select('*').eq('user_id', userId).order('clock_in_time', { ascending: false });
      if (byId) rows = byId;

      // query 2: by email kalau ada email (untuk baris yatim user_id null)
      if (userEmail) {
        const { data: byEmail } = await supabase.from('attendances').select('*').eq('user_email', userEmail.toLowerCase()).order('clock_in_time', { ascending: false });
        if (byEmail && byEmail.length > 0) {
          const seen = new Set(rows.map((r) => r.id));
          for (const r of byEmail) if (!seen.has(r.id)) rows.push(r);
          rows.sort((a, b) => new Date(b.clock_in_time).getTime() - new Date(a.clock_in_time).getTime());
        }
      }

      if (rows.length === 0) return [];
      return rows.map(mapAttendanceRow);
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
    reason?: string;
    startDate?: string;
    endDate?: string;
    photoUrl?: string;
    documentUrl?: string;
  }): Promise<AttendanceRecord> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const status = params.type === 'izin_sakit' ? 'izin' : 'hadir';
    const sType = params.sessionType || (params.type === 'izin_sakit' ? 'izin_sakit' : 'masuk');

    // Resolve UUID asli — kalau gagal, lempar error jelas (jangan simpan null diam-diam)
    let profileId: string | null = null;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    try {
      if (uuidRe.test(params.user.id)) {
        const { data } = await supabase.from('profiles').select('id').eq('id', params.user.id).maybeSingle();
        if (data?.id) profileId = data.id;
      }
      if (!profileId && params.user.email) {
        const { data } = await supabase.from('profiles').select('id').eq('email', params.user.email.trim().toLowerCase()).maybeSingle();
        if (data?.id) profileId = data.id;
      }
    } catch {}
    if (!profileId) throw new Error('Profil tidak ditemukan di database. Minta admin daftarkan ulang akun Anda.');

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      userId: profileId,
      userName: params.user.fullName,
      userEmail: params.user.email,
      type: params.type,
      sessionType: sType,
      status: status as any,
      date: today,
      clockInTime: now.toISOString(),
      latitude: params.latitude,
      longitude: params.longitude,
      distanceMeters: params.distanceMeters,
      officeName: params.officeName,
      reason: params.reason,
      startDate: params.startDate || today,
      endDate: params.endDate || today,
      photoUrl: params.photoUrl,
      documentUrl: params.documentUrl,
      createdAt: now.toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: profileId,
          user_name: newRecord.userName,
          user_email: newRecord.userEmail,
          type: newRecord.type,
          session_type: newRecord.sessionType,
          status: newRecord.status,
          date: newRecord.date,
          clock_in_time: newRecord.clockInTime,
          latitude: newRecord.latitude ?? null,
          longitude: newRecord.longitude ?? null,
          distance_meters: newRecord.distanceMeters ?? null,
          office_name: newRecord.officeName ?? null,
          reason: newRecord.reason ?? null,
          start_date: newRecord.startDate,
          end_date: newRecord.endDate,
          photo_url: newRecord.photoUrl ?? null,
          document_url: newRecord.documentUrl ?? null,
        } as any)
        .select()
        .single();
      if (error) throw new Error(error.message || 'Insert attendances ditolak database.');
      if (data?.id) newRecord.id = data.id;
    } catch (err: any) {
      const msg = err?.message || 'Gagal menyimpan presensi ke Supabase.';
      console.error('[Supabase] submitAttendance gagal:', msg);
      throw new Error(msg);
    }
    return newRecord;
  }

  static async getUserTodayStatus(userId: string): Promise<AttendanceRecord | null> {
    const today = new Date().toISOString().split('T')[0];
    const recs = await this.getUserAttendances(userId);
    return recs.find((r) => r.date === today) || null;
  }
}

function mapAttendanceRow(item: any): AttendanceRecord {
  return {
    id: item.id,
    userId: item.user_id ?? item.user_email,
    userName: item.user_name,
    userEmail: item.user_email,
    type: item.type,
    sessionType: item.session_type || 'masuk',
    status: item.status,
    date: item.date,
    clockInTime: item.clock_in_time,
    latitude: item.latitude,
    longitude: item.longitude,
    distanceMeters: item.distance_meters,
    officeName: item.office_name ?? undefined,
    reason: item.reason,
    startDate: item.start_date,
    endDate: item.end_date,
    photoUrl: item.photo_url,
    documentUrl: item.document_url,
    createdAt: item.created_at,
  };
}
