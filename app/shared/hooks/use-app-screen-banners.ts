import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/query-client';

export type BannerScreen = 'home' | 'search' | 'profile' | 'shorts' | 'listings';

export interface AppScreenBanner {
  id: string;
  title: string;
  screen: BannerScreen;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BannersResponse {
  success: boolean;
  banners: AppScreenBanner[];
}

const bannerCache: Partial<Record<BannerScreen, AppScreenBanner[]>> = {};
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAppScreenBanners(screen: BannerScreen): {
  banners: AppScreenBanner[];
  isLoading: boolean;
  refreshBanners: () => Promise<void>;
} {
  const [banners, setBanners] = useState<AppScreenBanner[]>(bannerCache[screen] ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(bannerCache[screen] === undefined);

  const fetchBanners = useCallback(
    async (retryCount = 0): Promise<AppScreenBanner[]> => {
      const apiUrl = getApiUrl();
      const url = `${apiUrl}/api/banners?screen=${screen}`;
      const maxRetries = 3;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();

          if (RETRYABLE_STATUS.has(response.status) && retryCount < maxRetries) {
            const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            await delay(backoffMs);
            return fetchBanners(retryCount + 1);
          }

          if (RETRYABLE_STATUS.has(response.status)) {
            return bannerCache[screen] ?? [];
          }

          const errorMsg = `Failed to fetch ${screen} banners: ${response.status} ${errorText}`;
          console.error('[useAppScreenBanners]', errorMsg);
          throw new Error(errorMsg);
        }

        const data = (await response.json()) as BannersResponse;
        return Array.isArray(data.banners) ? data.banners : [];
      } catch (error) {
        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 1000;
          await delay(backoffMs);
          return fetchBanners(retryCount + 1);
        }
        console.warn(
          '[useAppScreenBanners] Using cached banners due to network/parse error:',
          error instanceof Error ? error.message : String(error)
        );
        return bannerCache[screen] ?? [];
      }
    },
    [screen]
  );

  const refreshBanners = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const nextBanners = await fetchBanners();
      bannerCache[screen] = nextBanners;
      setBanners(nextBanners);
    } catch (error: unknown) {
      console.warn('[useAppScreenBanners] Failed to fetch banners, keeping previous state', error);
      // Preserve existing UI state when request fails
      setBanners((prev) => (prev.length > 0 ? prev : (bannerCache[screen] ?? [])));
    } finally {
      setIsLoading(false);
    }
  }, [fetchBanners, screen]);

  useEffect(() => {
    // Check cache first
    if (bannerCache[screen] !== undefined) {
      setBanners(bannerCache[screen] ?? []);
      setIsLoading(false);
      return;
    }

    // Only fetch if not cached
    void refreshBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]); // Only re-fetch when screen changes

  return {
    banners,
    isLoading,
    refreshBanners,
  };
}
