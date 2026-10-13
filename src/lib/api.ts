// Pengganti src/lib/supabase.ts — client HTTP ke backend Express.
// Alur baru: Expo App -> apiFetch (file ini) -> Express :3001 -> MySQL Laragon.
// Token JWT disimpan di memory + localStorage (web). Di HP native, token
// hidup selama aplikasi jalan; untuk persist antar-restart pasang
// @react-native-async-storage/async-storage lalu ganti webStore di bawah.

export const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
).replace(/\/+$/, '');
// CATATAN URL per device (atur di .env EXPO_PUBLIC_API_URL):
// - Web / iOS simulator : http://localhost:3001 (default)
// - Android emulator    : http://10.0.2.2:3001
// - HP fisik            : http://IP-LAPTOP-KAMU:3001 (satu WiFi)

const TOKEN_KEY = 'epresensi_token';
let memToken: string | null = null;

function webStore(): {
  get: (k: string) => string | null;
  set: (k: string, v: string) => void;
  del: (k: string) => void;
} | null {
  try {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    if (w && w.localStorage) {
      const ls = w.localStorage;
      return {
        get: (k: string) => ls.getItem(k),
        set: (k: string, v: string) => ls.setItem(k, v),
        del: (k: string) => ls.removeItem(k),
      };
    }
  } catch {
    // abaikan — jatuh ke memory only
  }
  return null;
}

export async function getToken(): Promise<string | null> {
  if (memToken) return memToken;
  const ws = webStore();
  if (ws) {
    try {
      memToken = ws.get(TOKEN_KEY);
    } catch {
      memToken = null;
    }
  }
  return memToken;
}

export async function setToken(t: string | null): Promise<void> {
  memToken = t;
  const ws = webStore();
  if (!ws) return;
  try {
    if (t) ws.set(TOKEN_KEY, t);
    else ws.del(TOKEN_KEY);
  } catch {
    // abaikan
  }
}

export async function clearToken(): Promise<void> {
  return setToken(null);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface FetchOpts {
  method?: string;
  body?: unknown;
  auth?: boolean; // default true — kirim Authorization bila ada token
}

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const token = opts.auth === false ? null : await getToken();
  let res: Response;
  try {
    res = await fetch(apiBaseUrl + path, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      cache: 'no-store',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Tidak bisa menghubungi server. Pastikan backend jalan di ' + apiBaseUrl);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, `Server error (${res.status}).`);
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || `Gagal (${res.status}).`);
  }
  return data as T;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Upload file ke POST /upload/:kind (pengganti Supabase Storage).
// Mengembalikan URL publik. JANGAN set Content-Type manual —
// fetch mengisi boundary multipart sendiri.
export async function uploadFile(
  kind: 'avatar' | 'photo' | 'document',
  uri: string,
  filename: string
): Promise<string> {
  // Deteksi tipe MIME dari nama file agar PDF tidak dikirim sebagai octet-stream.
  const lower = (filename || '').toLowerCase();
  const mime = lower.endsWith('.pdf')
    ? 'application/pdf'
    : lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
  const form = new FormData();
  if (uri.startsWith('data:')) {
    form.append('file', dataUrlToBlob(uri), filename);
  } else if (uri.startsWith('file:') || uri.startsWith('content:')) {
    // Native Android/iOS: uri bisa file:// atau content:// (DocumentPicker).
    // fetch(content://) GAGAL di Android, jadi kirim objek file RN langsung.
    (form as any).append('file', { uri, name: filename, type: mime } as any);
  } else {
    // Web: blob/http/blob URL — baca dulu jadi Blob baru bisa di-append.
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      (form as any).append('file', blob, filename);
    } catch {
      throw new Error('Upload gagal: tidak bisa membaca file.');
    }
  }
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}/upload/${kind}`, {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: form as any,
    });
  } catch {
    throw new Error('Upload gagal: tidak bisa menghubungi server.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Upload gagal (${res.status}).`);
  }
  if (!res.ok || !data?.url) throw new Error(data?.error || `Upload gagal (${res.status}).`);
  return data.url as string;
}

/**
 * Normalisasi URL media (foto presensi, avatar, dokumen lampiran)
 * agar selalu valid diakses dari Android / iOS / Web:
 * - Mengubah URL relatif (/uploads/...) jadi URL absolut dengan apiBaseUrl
 * - Mengubah localhost/127.0.0.1 jadi apiBaseUrl aktif
 * - Mengubah http:// jadi https:// bila backend menggunakan HTTPS (mencegah Android cleartext block)
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  let clean = String(url).trim();
  if (!clean) return null;

  if (clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('file:') || clean.startsWith('content:')) {
    return clean;
  }

  if (clean.startsWith('/')) {
    return `${apiBaseUrl}${clean}`;
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(clean)) {
    clean = clean.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, apiBaseUrl);
  }

  if (apiBaseUrl.startsWith('https://') && clean.startsWith('http://')) {
    clean = clean.replace(/^http:\/\//i, 'https://');
  }

  return clean;
}
