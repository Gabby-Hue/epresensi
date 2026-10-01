import * as Haptics from 'expo-haptics';

type SoundName = 'tap' | 'select' | 'success' | 'error';

/** Inisialisasi feedback (suara dinonaktifkan, menyisakan haptic jika didukung). */
export async function initFeedback(): Promise<void> {
  // Suara audio dinonaktifkan sesuai preferensi terbaru
}

function buzz(kind: 'light' | 'success' | 'error'): void {
  try {
    if (kind === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (kind === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {}
}

/** Sentuhan tombol biasa: getar ringan tanpa suara. */
export function tap(): void {
  buzz('light');
}

/** Pilihan/pindah tab/tanggal: getar ringan tanpa suara. */
export function select(): void {
  buzz('light');
}

/** Aksi berhasil disimpan/disetujui: getar sukses tanpa suara. */
export function succeed(): void {
  buzz('success');
}

/** Aksi gagal/ditolak: getar error tanpa suara. */
export function fail(): void {
  buzz('error');
}
