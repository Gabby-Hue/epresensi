import * as Location from 'expo-location';
import { LocationCoords } from '../types/attendance';

/**
 * Calculates distance in meters between two lat/lng coordinates using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Requests location permissions and fetches current GPS position.
 * Returns default fallback coordinates if permission is denied or running in limited environment.
 */
export async function getCurrentLocation(): Promise<{
  coords: LocationCoords;
  errorMsg: string | null;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        coords: { latitude: -6.2088, longitude: 106.8456 }, // Default Jakarta
        errorMsg: 'Izin akses lokasi ditolak. Menggunakan lokasi default.',
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
      },
      errorMsg: null,
    };
  } catch (err: any) {
    return {
      coords: { latitude: -6.2088, longitude: 106.8456 },
      errorMsg: err.message || 'Gagal mengambil lokasi perangkat.',
    };
  }
}

/**
 * Formats distance display string (e.g., "45 m" or "1.2 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
