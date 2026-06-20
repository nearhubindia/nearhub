/**
 * Web Portal Configuration
 * Centralized environment variable management for the admin panel
 */

const PRODUCTION_API_URL = 'https://api.nearhub.in';

function normalizeUrl(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function isLocalhostHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized.endsWith('.local')
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalApiUrl(value: string): boolean {
  try {
    return isLocalhostHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

export const getApiUrl = (): string => {
  const configuredUrl = normalizeUrl(import.meta.env.VITE_API_URL || '');

  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname.toLowerCase();
    const isCurrentLocal = isLocalhostHost(currentHost);

    if (configuredUrl) {
      if (isValidHttpUrl(configuredUrl)) {
        if (!isCurrentLocal && isLocalApiUrl(configuredUrl)) {
          return PRODUCTION_API_URL;
        }
        return configuredUrl;
      }
    }

    if (!isCurrentLocal) {
      return PRODUCTION_API_URL;
    }

    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:5000`;
  }

  if (configuredUrl && isValidHttpUrl(configuredUrl)) {
    return configuredUrl;
  }

  return PRODUCTION_API_URL;
};

export const getApiTimeout = (): number => {
  return parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10);
};

export const getDebug = (): boolean => {
  return import.meta.env.VITE_DEBUG === 'true';
};

export const getAdminPageSize = (entity: 'listings' | 'users' | 'coupons' | 'reports'): number => {
  const sizeMap: Record<string, string> = {
    listings: import.meta.env.VITE_ADMIN_LISTINGS_PAGE_SIZE || '20',
    users: import.meta.env.VITE_ADMIN_USERS_PAGE_SIZE || '20',
    coupons: import.meta.env.VITE_ADMIN_COUPONS_PAGE_SIZE || '20',
    reports: import.meta.env.VITE_ADMIN_SPAM_REPORTS_PAGE_SIZE || '20',
  };
  return parseInt(sizeMap[entity], 10);
};

export const getCurrencySymbol = (): string => {
  return import.meta.env.VITE_CURRENCY_SYMBOL || '₹';
};

export const getCurrencyCode = (): string => {
  return import.meta.env.VITE_CURRENCY_CODE || 'INR';
};

export const getMinPriceForPaidListing = (): number => {
  return parseInt(import.meta.env.VITE_MIN_PRICE_FOR_PAID_LISTING || '3000', 10);
};

export const getAppName = (): string => {
  return import.meta.env.VITE_APP_NAME || 'NearHub Admin';
};

export const getAppTitle = (): string => {
  return import.meta.env.VITE_APP_TITLE || 'NearHub Platform Administration';
};

export const getSupportEmail = (): string => {
  return import.meta.env.VITE_SUPPORT_EMAIL || 'support@nearhub.com';
};

export const logDebug = (message: string, data?: unknown): void => {
  if (getDebug()) {
    console.log(`[NearHub Admin] ${message}`, data || '');
  }
};

export const logError = (message: string, error?: unknown): void => {
  console.error(`[NearHub Admin] ERROR: ${message}`, error || '');
};
