import { useState, useEffect } from 'react';
import { getApiUrl } from './query-client';

interface AdminSettings {
  geoRadiusKm: number;
  freeListingDays: number;
  autoDeleteExpiredMedia: boolean;
  mediaDeleteAfterDays: number;
  reactivationAllowed: boolean;
  discountEnabled: boolean;
  discountPercentage: number;
  [key: string]: any;
}

const DEFAULT_GEO_RADIUS = 100; // Default fallback
let cachedSettings: AdminSettings | null = null;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 520, 521, 522, 523, 524]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook to fetch and cache admin settings
 * Includes geo radius, pricing, and other configuration
 */
export function useAdminSettings() {
  const [geoRadiusKm, setGeoRadiusKm] = useState<number>(DEFAULT_GEO_RADIUS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Return cached settings if available
    if (cachedSettings) {
      setGeoRadiusKm(cachedSettings.geoRadiusKm || DEFAULT_GEO_RADIUS);
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      const maxRetries = 2;

      try {
        const apiUrl = getApiUrl();
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${apiUrl}/api/admin/settings`, {
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
              if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
                await delay(500 * Math.pow(2, attempt));
                continue;
              }
              throw new Error(`Failed to fetch admin settings (${response.status})`);
            }

            const data = await response.json();
            cachedSettings = data.settings;
            setGeoRadiusKm(data.settings.geoRadiusKm || DEFAULT_GEO_RADIUS);
            setError(null);
            return;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries) {
              await delay(500 * Math.pow(2, attempt));
              continue;
            }
          }
        }

        throw lastError || new Error('Failed to fetch admin settings');
      } catch (err) {
        console.warn('[useAdminSettings] Using fallback settings:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setGeoRadiusKm(DEFAULT_GEO_RADIUS); // Use default on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { geoRadiusKm, isLoading, error };
}

/**
 * Get cached geo radius or default
 * Useful for synchronous access after initial load
 */
export function getCachedGeoRadius(): number {
  return cachedSettings?.geoRadiusKm || DEFAULT_GEO_RADIUS;
}

/**
 * Clear settings cache (useful for testing or force refresh)
 */
export function clearAdminSettingsCache(): void {
  cachedSettings = null;
}
