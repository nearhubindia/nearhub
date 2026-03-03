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
      try {
        const apiUrl = await getApiUrl();
        const response = await fetch(`${apiUrl}/api/admin/settings`);

        if (!response.ok) {
          throw new Error('Failed to fetch admin settings');
        }

        const data = await response.json();
        cachedSettings = data.settings;

        setGeoRadiusKm(data.settings.geoRadiusKm || DEFAULT_GEO_RADIUS);
        setError(null);
      } catch (err) {
        console.error('[useAdminSettings] Error fetching settings:', err);
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
