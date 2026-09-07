import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export interface DeviceDetails {
  modelName: string;
  deviceId: string;
  brand: string;
  osName: string;
}

/**
 * Deteksi informasi spesifikasi perangkat secara otomatis
 */
export async function getDeviceInfo(): Promise<DeviceDetails> {
  const brand = Device.brand || (Platform.OS === 'web' ? 'Web Browser' : 'Unknown Brand');
  const model = Device.modelName || (Platform.OS === 'web' ? 'Browser Client' : 'Mobile Device');
  const osName = Device.osName || Platform.OS;

  let deviceId = '';

  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      deviceId = androidId ? androidId.toUpperCase() : '';
    } else if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      deviceId = iosId ? iosId.replace(/-/g, '').slice(0, 16).toUpperCase() : '';
    }
  } catch {
    // Fallback jika permission atau platform tidak support
  }

  // Fallback ID unik perangkat jika kosong
  if (!deviceId) {
    if (typeof window !== 'undefined' && window.localStorage) {
      let storedId = window.localStorage.getItem('epresensi_device_fingerprint');
      if (!storedId) {
        storedId = Array.from({ length: 16 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        )
          .join('')
          .toUpperCase();
        window.localStorage.setItem('epresensi_device_fingerprint', storedId);
      }
      deviceId = storedId;
    } else {
      deviceId = '9CF6612056B2DBAD';
    }
  }

  const modelFormatted =
    brand.toLowerCase() === 'apple'
      ? `${model}`
      : `${brand.toLowerCase()} ${model.toLowerCase()}`;

  return {
    modelName: modelFormatted,
    deviceId,
    brand,
    osName,
  };
}
