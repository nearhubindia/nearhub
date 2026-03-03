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
        console.log('[useAppScreenBanners] Fetching from:', url);
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Handle rate limiting with exponential backoff
          if (response.status === 429 && retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`[useAppScreenBanners] Rate limited, retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return fetchBanners(retryCount + 1);
          }

          // Graceful fallback after retries: keep cache/empty banners without throwing hard error
          if (response.status === 429) {
            console.warn(
              `[useAppScreenBanners] Rate limited for ${screen}. Using cached banners until retry window resets.`
            );
            return bannerCache[screen] ?? [];
          }

          const errorMsg = `Failed to fetch ${screen} banners: ${response.status} ${errorText}`;
          console.error('[useAppScreenBanners]', errorMsg);
          throw new Error(errorMsg);
        }

        const data = (await response.json()) as BannersResponse;
        console.log(
          '[useAppScreenBanners] Success, got',
          Array.isArray(data.banners) ? data.banners.length : 0,
          'banners'
        );
        return Array.isArray(data.banners) ? data.banners : [];
      } catch (error) {
        console.error(
          '[useAppScreenBanners] Network/parse error:',
          error instanceof Error ? error.message : String(error)
        );
        throw error;
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
      console.error('[useAppScreenBanners] Failed to fetch banners', error);
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
