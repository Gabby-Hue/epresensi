import { supabase } from '../lib/supabase';

// Ubah data: URL (hasil snapshot kamera web) jadi Blob.
// fetch(dataUrl) tidak bisa diandalkan di React Native, jadi decode manual.
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith('data:')) return dataUrlToBlob(uri);
  const res = await fetch(uri);
  return await res.blob();
}

// Upload file ke Supabase Storage, kembalikan public URL.
// Wajib dipanggil SEBELUM insert ke tabel attendances supaya kolom
// photo_url / document_url berisi URL publik, bukan path lokal HP.
async function uploadUri(bucket: string, path: string, uri: string): Promise<string> {
  const blob = await uriToBlob(uri);
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(`Upload ke ${bucket} gagal: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export const StorageService = {
  uploadAvatar(userId: string, uri: string): Promise<string> {
    return uploadUri('avatars', `${userId}/avatar.jpg`, uri);
  },
  uploadAttendancePhoto(userId: string, uri: string): Promise<string> {
    return uploadUri('attendance-photos', `${userId}/${Date.now()}.jpg`, uri);
  },
  uploadDocument(userId: string, name: string, uri: string): Promise<string> {
    const safe = (name || 'dokumen').replace(/[^a-zA-Z0-9._-]/g, '_');
    return uploadUri('attendance-docs', `${userId}/${Date.now()}-${safe}`, uri);
  },
};
