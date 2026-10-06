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
  const form = new FormData();
  if (uri.startsWith('data:')) {
    form.append('file', dataUrlToBlob(uri), filename);
  } else {
    const res = await fetch(uri);
    const blob = await res.blob();
    (form as any).append('file', blob, filename);
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
