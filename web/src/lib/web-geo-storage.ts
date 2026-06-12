import { readStoredWebUser } from './web-auth-storage';

type GeoCoords = { latitude: number; longitude: number };

function toGeoCoords(latitude?: unknown, longitude?: unknown): GeoCoords | null {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

export function readStoredHeaderGeoCoords(): GeoCoords | null {
  try {
    const raw = localStorage.getItem('nearhub:header:inputs:v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      geo?: { latitude?: number; longitude?: number } | null;
    };
    return toGeoCoords(parsed.geo?.latitude, parsed.geo?.longitude);
  } catch {
    return null;
  }
}

export function readStoredWebGeoCoords(): GeoCoords | null {
  const headerCoords = readStoredHeaderGeoCoords();
  if (headerCoords) return headerCoords;

  const user = readStoredWebUser();
  return toGeoCoords(user?.latitude, user?.longitude);
}
