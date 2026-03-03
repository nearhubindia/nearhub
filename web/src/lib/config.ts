/**
 * Web Portal Configuration
 * Centralized environment variable management for the admin panel
 */

export const getApiUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:5000`;
  }

  return 'http://localhost:5000';
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
