import { uploadFile } from '../lib/api';

// Upload file ke backend Express (POST /upload/:kind), kembalikan URL publik.
// Wajib dipanggil SEBELUM simpan presensi supaya kolom
// photoUrl / documentUrl berisi URL publik, bukan path lokal HP.
export const StorageService = {
  uploadAvatar(_userId: string, uri: string): Promise<string> {
    return uploadFile('avatar', uri, 'avatar.jpg');
  },
  uploadAttendancePhoto(_userId: string, uri: string): Promise<string> {
    return uploadFile('photo', uri, `${Date.now()}.jpg`);
  },
  uploadDocument(_userId: string, name: string, uri: string): Promise<string> {
    const safe = (name || 'dokumen').replace(/[^a-zA-Z0-9._-]/g, '_');
    return uploadFile('document', uri, `${Date.now()}-${safe}`);
  },
};
