import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

type SoundName = 'tap' | 'select' | 'success' | 'error';

const sounds: Partial<Record<SoundName, Audio.Sound>> = {};
let ready = false;

/** Panggil sekali saat aplikasi mulai. Gagal diam-diam = aplikasi tetap jalan tanpa bunyi. */
export async function initFeedback(): Promise<void> {
  if (ready) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const files: Record<SoundName, number> = {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      tap: require('../../assets/sounds/tap.wav'),
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      select: require('../../assets/sounds/select.wav'),
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      success: require('../../assets/sounds/success.wav'),
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      error: require('../../assets/sounds/error.wav'),
    };
    const entries = Object.entries(files) as Array<[SoundName, number]>;
    for (const [name, asset] of entries) {
      try {
        const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.5 });
        sounds[name] = sound;
      } catch {}
    }
    ready = true;
  } catch {}
}

function replay(name: SoundName): void {
  try {
    void sounds[name]?.replayAsync();
  } catch {}
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

/** Sentuhan tombol biasa: klik + getar ringan. */
export function tap(): void {
  replay('tap');
  buzz('light');
}

/** Pilihan/pindah tab/tanggal: blip lembut + getar ringan. */
export function select(): void {
  replay('select');
  buzz('light');
}

/** Aksi berhasil disimpan/disimpan: nada naik + getar sukses. */
export function succeed(): void {
  replay('success');
  buzz('success');
}

/** Aksi gagal/ditolak: nada rendah + getar error. */
export function fail(): void {
  replay('error');
  buzz('error');
}
