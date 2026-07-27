import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/query-client';
import { getDebug } from '@/lib/config';
import { clearPersistentCache, getPersistentCache, setPersistentCache } from '@/lib/use-cache';

export type BannerScreen = 'home' | 'search' | 'profile' | 'listings';

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
const bannerCacheFetchedAt: Partial<Record<BannerScreen, number>> = {};
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const CACHE_TTL_MS = 2 * 60 * 1000;
const BANNER_CACHE_VERSION = '1';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildApiUrlCandidates(baseUrl: string): string[] {
  const normalized = baseUrl.replace(/\/+$/, '');
  const candidates = [normalized];

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.replace(/^www\./, '');
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    } else if (!parsed.hostname.startsWith('www.') && parsed.hostname.includes('.')) {
      parsed.hostname = `www.${parsed.hostname}`;
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    }
  } catch {
    // Ignore malformed URL and use the base candidate only.
  }

  return [...new Set(candidates)];
}

function isRenderableBannerUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Support legacy admin data URLs while backend migration to hosted URLs is in progress.
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeBanners(input: unknown): AppScreenBanner[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const valid = input.filter((item): item is AppScreenBanner => {
    if (!item || typeof item !== 'object') return false;
    const id = String((item as AppScreenBanner).id || '').trim();
    if (!id || seen.has(id)) return false;
    const imageUrl = (item as AppScreenBanner).imageUrl;
    if (!isRenderableBannerUrl(imageUrl)) return false;
    seen.add(id);
    return true;
  });

  return valid.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

export function useAppScreenBanners(screen: BannerScreen): {
  banners: AppScreenBanner[];
  isLoading: boolean;
  refreshBanners: () => Promise<void>;
} {
  const [banners, setBanners] = useState<AppScreenBanner[]>(bannerCache[screen] ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(bannerCache[screen] === undefined);

  const cacheKey = `banners:${screen}`;

  const fetchBanners = useCallback(
    async (retryCount = 0): Promise<AppScreenBanner[]> => {
      const apiUrl = getApiUrl();
      const apiUrlCandidates = buildApiUrlCandidates(apiUrl);
      const maxRetries = 3;

      try {
        for (const candidate of apiUrlCandidates) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const url = `${candidate}/api/banners?screen=${screen}`;
            const response = await fetch(url, {
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
            });

            if (!response.ok) {
              if (RETRYABLE_STATUS.has(response.status) && retryCount < maxRetries) {
                const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                await delay(backoffMs);
                return fetchBanners(retryCount + 1);
              }

              // For non-retryable responses, quietly keep UX stable using cached data.
              if (getDebug()) {
                const errorText = await response.text();
                console.log(
                  `[useAppScreenBanners] ${screen} banners request failed:`,
                  response.status,
                  errorText
                );
              }
              continue;
            }

            const data = (await response.json()) as BannersResponse;
            return sanitizeBanners(data.banners);
          } finally {
            clearTimeout(timeout);
          }
        }

        return bannerCache[screen] ?? [];
      } catch (error) {
        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 1000;
          await delay(backoffMs);
          return fetchBanners(retryCount + 1);
        }
        if (getDebug()) {
          console.log(
            '[useAppScreenBanners] Using cached banners due to network/parse error:',
            error instanceof Error ? error.message : String(error)
          );
        }
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
      bannerCacheFetchedAt[screen] = Date.now();
      setBanners(nextBanners);
      await setPersistentCache(cacheKey, nextBanners, {
        ttl: CACHE_TTL_MS,
        version: BANNER_CACHE_VERSION,
      });
    } catch {
      // Preserve existing UI state when request fails
      setBanners((prev) => (prev.length > 0 ? prev : (bannerCache[screen] ?? [])));
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetchBanners, screen]);

  useEffect(() => {
    const hydrateAndRefresh = async () => {
      const cached = bannerCache[screen];
      const fetchedAt = bannerCacheFetchedAt[screen] ?? 0;
      const isFresh = Date.now() - fetchedAt < CACHE_TTL_MS;
      if (cached !== undefined && isFresh && cached.length > 0) {
        setBanners(cached);
        setIsLoading(false);
        return;
      }

      const persisted = await getPersistentCache<AppScreenBanner[]>(cacheKey, {
        version: BANNER_CACHE_VERSION,
      });
      if (persisted && persisted.length > 0) {
        const validPersisted = sanitizeBanners(persisted);
        bannerCache[screen] = validPersisted;
        bannerCacheFetchedAt[screen] = Date.now();
        setBanners(validPersisted);
        setIsLoading(false);
      } else {
        await clearPersistentCache(cacheKey).catch(() => {});
      }

      // Refresh on stale/empty cache to avoid sticky "no banner" state.
      void refreshBanners();
    };
    void hydrateAndRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]); // Only re-fetch when screen changes

  return {
    banners,
    isLoading,
    refreshBanners,
  };
}
