/**
 * Mobile App Configuration
 * Centralized environment variable management for the Expo app
 */

function normalizeBaseUrl(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function isDevRuntime(): boolean {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  return process.env.NODE_ENV !== 'production';
}

function shouldIgnoreForProduction(url: string): boolean {
  const host = getHostname(url);
  return !isDevRuntime() && isLocalhostHost(host);
}

function isValidBackendUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function getBackendURL(): string {
  // Try to get from environment variables first
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;

  if (envApiUrl) {
    const normalized = normalizeBaseUrl(envApiUrl);
    if (!isValidBackendUrl(normalized)) {
      if (getDebug()) {
        console.warn('[Config] Ignoring invalid EXPO_PUBLIC_API_URL:', envApiUrl);
      }
    } else if (shouldIgnoreForProduction(normalized)) {
      console.warn(
        '[Config] Ignoring localhost EXPO_PUBLIC_API_URL in production build:',
        normalized
      );
    } else {
      if (getDebug()) {
        console.log('[Config] Using EXPO_PUBLIC_API_URL:', normalized);
      }
      return normalized;
    }
  }

  if (envDomain) {
    const isLocalNetwork =
      envDomain.includes('192.168.') || envDomain.includes('10.') || envDomain.includes('172.');

    const protocol = isLocalNetwork ? 'http' : 'https';
    const url = normalizeBaseUrl(`${protocol}://${envDomain}`);

    if (!isValidBackendUrl(url)) {
      if (getDebug()) {
        console.warn('[Config] Ignoring invalid EXPO_PUBLIC_DOMAIN:', envDomain);
      }
    } else if (shouldIgnoreForProduction(url)) {
      console.warn('[Config] Ignoring localhost EXPO_PUBLIC_DOMAIN in production build:', url);
    } else {
      if (getDebug()) {
        console.log('[Config] Using EXPO_PUBLIC_DOMAIN:', url);
      }
      return url;
    }
  }

  // Final fallback points to the dedicated API host so production clients use the backend directly.
  const fallback = 'https://api.nearhub.in';
  if (getDebug()) {
    console.log('[Config] Using fallback URL:', fallback);
  }

  return fallback;
}

export function getAppDownloadUrl(): string {
  const envDownloadUrl = String(process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL || '').trim();

  if (envDownloadUrl) {
    if (isValidBackendUrl(envDownloadUrl)) {
      return envDownloadUrl;
    }
    if (getDebug()) {
      console.warn('[Config] Ignoring invalid EXPO_PUBLIC_APP_DOWNLOAD_URL:', envDownloadUrl);
    }
  }

  return 'https://play.google.com/store/apps/details?id=com.synvide.nearhub&pcampaignid=web_share';
}

export function getWebBaseUrl(): string {
  const envWebUrl = String(process.env.EXPO_PUBLIC_WEB_URL || '').trim();

  if (envWebUrl) {
    const normalized = normalizeBaseUrl(envWebUrl);
    if (isValidBackendUrl(normalized)) {
      if (!shouldIgnoreForProduction(normalized)) {
        return normalized;
      }
      console.warn(
        '[Config] Ignoring localhost EXPO_PUBLIC_WEB_URL in production build:',
        normalized
      );
    } else if (getDebug()) {
      console.warn('[Config] Ignoring invalid EXPO_PUBLIC_WEB_URL:', envWebUrl);
    }
  }

  return 'https://api.nearhub.in';
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

  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length === 0 && getDebug()) {
    logDebug('All required environment variables are configured');
  }
}
