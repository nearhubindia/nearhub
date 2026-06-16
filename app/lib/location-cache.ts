import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedLocation = {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  updatedAt: string;
};

const LOCATION_CACHE_KEY = '@nearhub_cached_location';

export async function loadCachedLocation(): Promise<CachedLocation | null> {
  const raw = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedLocation;
    if (
      typeof parsed?.latitude === 'number' &&
      typeof parsed?.longitude === 'number' &&
      typeof parsed?.city === 'string' &&
      typeof parsed?.state === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed cache entries.
  }

  return null;
}

export async function saveCachedLocation(location: Omit<CachedLocation, 'updatedAt'>): Promise<void> {
  await AsyncStorage.setItem(
    LOCATION_CACHE_KEY,
    JSON.stringify({
      ...location,
      updatedAt: new Date().toISOString(),
    })
  );
}

export async function clearCachedLocation(): Promise<void> {
  await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
}
