/**
 * Mobile App Configuration
 * Centralized environment variable management for the Expo app
 */

export function getBackendURL(): string {
  // Try to get from environment variables first
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;

  if (envApiUrl) {
    if (getDebug()) {
      console.log('[Config] Using EXPO_PUBLIC_API_URL:', envApiUrl);
    }
    return envApiUrl;
  }

  if (envDomain) {
    const isLocalNetwork =
      envDomain.includes('192.168.') || envDomain.includes('10.') || envDomain.includes('172.');

    const protocol = isLocalNetwork ? 'http' : 'https';
    const url = `${protocol}://${envDomain}`;

    if (getDebug()) {
      console.log('[Config] Using EXPO_PUBLIC_DOMAIN:', url);
    }

    return url;
  }

  // Fallback to development default
  const fallback = 'http://localhost:5000';
  if (getDebug()) {
    console.log('[Config] Using fallback URL:', fallback);
  }

  return fallback;
}

export function getDebug(): boolean {
  return process.env.EXPO_PUBLIC_DEBUG === 'true';
}

export function getOfflineMode(): boolean {
  return process.env.EXPO_PUBLIC_OFFLINE_MODE === 'true';
}

export function getCacheStaleTime(): number {
  return parseInt(process.env.EXPO_PUBLIC_CACHE_STALE_TIME || '300000', 10);
}

export function getDefaultGeoRadius(): number {
  return parseInt(process.env.EXPO_PUBLIC_DEFAULT_GEO_RADIUS_KM || '10', 10);
}

export function getMaxImageSize(): number {
  return parseInt(process.env.EXPO_PUBLIC_MAX_IMAGE_SIZE_MB || '10', 10);
}

export function getMaxVideoSize(): number {
  return parseInt(process.env.EXPO_PUBLIC_MAX_VIDEO_SIZE_MB || '500', 10);
}

export function getImageCompressionQuality(): number {
  return parseFloat(process.env.EXPO_PUBLIC_IMAGE_COMPRESSION_QUALITY || '0.8');
}

export function getVideoCompressionTargetSize(): number {
  return parseInt(process.env.EXPO_PUBLIC_VIDEO_COMPRESSION_TARGET_MB || '100', 10);
}

export function getListingsPageSize(): number {
  return parseInt(process.env.EXPO_PUBLIC_LISTINGS_PAGE_SIZE || '20', 10);
}

export function getSearchPageSize(): number {
  return parseInt(process.env.EXPO_PUBLIC_SEARCH_PAGE_SIZE || '20', 10);
}

export function getInfiniteScrollThreshold(): number {
  return parseInt(process.env.EXPO_PUBLIC_INFINITE_SCROLL_THRESHOLD || '500', 10);
}

export function logDebug(message: string, data?: any): void {
  if (getDebug()) {
    console.log(`[NearHub] ${message}`, data || '');
  }
}

export function logError(message: string, error?: any): void {
  console.error(`[NearHub] ERROR: ${message}`, error || '');
}

// Validate required environment variables
export function validateEnvironment(): void {
  const requiredEnv: (keyof typeof process.env)[] = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_DOMAIN'];

  const missing = requiredEnv.filter(
    (key) => !process.env[key]
  );

  if (missing.length === 0 && getDebug()) {
    logDebug('All required environment variables are configured');
  }
}
