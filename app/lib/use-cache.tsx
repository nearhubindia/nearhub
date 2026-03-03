import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Local AsyncStorage Cache Hook
 * Persists data to device storage for offline support
 */
export function useLocalCache<T>(
  key: string,
  ttl: number = 3600000 // 1 hour default
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from storage on mount
  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const cached = await AsyncStorage.getItem(`cache:${key}`);

        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached);
          const isExpired = Date.now() - entry.timestamp > entry.ttl;

          if (!isExpired) {
            setData(entry.data);
          } else {
            // Clear expired cache
            await AsyncStorage.removeItem(`cache:${key}`);
          }
        }
      } catch (err) {
        console.error(`[LocalCache] Load error for ${key}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadFromStorage();
  }, [key]);

  // Save to storage
  const setCache = useCallback(
    async (value: T) => {
      try {
        const entry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          ttl,
        };

        await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(entry));
        setData(value);
        setError(null);
      } catch (err) {
        console.error(`[LocalCache] Save error for ${key}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [key, ttl]
  );

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(`cache:${key}`);
      setData(null);
      setError(null);
    } catch (err) {
      console.error(`[LocalCache] Clear error for ${key}:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [key]);

  return { data, loading, error, setCache, clearCache };
}

/**
 * Fetch with local cache fallback
 * Falls back to cached data if network request fails
 */
export function useCachedFetch<T>(
  url: string,
  options?: {
    ttl?: number;
    enabled?: boolean;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<T | null>(null);

  const { data: cachedData, setCache: setCachedData } = useLocalCache<T>(
    `fetch:${url}`,
    options?.ttl
  );

  useEffect(() => {
    if (cachedData) {
      cacheRef.current = cachedData;
      setData(cachedData);
    }
  }, [cachedData]);

  useEffect(() => {
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = (await response.json()) as T;

        // Update cache
        await setCachedData(result);
        setData(result);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';

        // Use cached data if available
        if (cacheRef.current) {
          console.warn(`[CachedFetch] Using cached data for ${url}`);
          setData(cacheRef.current);
        } else {
          setError(errorMsg);
          setData(null);
        }

        options?.onError?.(err instanceof Error ? err : new Error(errorMsg));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, options?.enabled, options?.ttl]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = (await response.json()) as T;
      await setCachedData(result);
      setData(result);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      options?.onError?.(err instanceof Error ? err : new Error(errorMsg));
    } finally {
      setLoading(false);
    }
  }, [url, options?.onError]);

  return { data, loading, error, refetch };
}

/**
 * Memoized query hook for expensive computations
 * Caches results based on dependencies
 */
export function useMemoQuery<T, D extends any[]>(
  queryFn: () => Promise<T>,
  deps: D,
  options?: {
    ttl?: number;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<T | null>(null);
  const depsRef = useRef<D>(deps);

  useEffect(() => {
    const areDepsDifferent =
      depsRef.current.length !== deps.length || depsRef.current.some((dep, i) => dep !== deps[i]);

    if (!areDepsDifferent && cacheRef.current) {
      // Deps haven't changed, use cached result
      setData(cacheRef.current);
      setLoading(false);
      return;
    }

    depsRef.current = deps;

    const execute = async () => {
      try {
        setLoading(true);
        const result = await queryFn();
        cacheRef.current = result;
        setData(result);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        options?.onError?.(err instanceof Error ? err : new Error(errorMsg));
      } finally {
        setLoading(false);
      }
    };

    execute();
  }, [deps, queryFn, options?.onError]);

  return { data, loading, error };
}

/**
 * Query result cache with automatic refresh
 * Similar to TanStack Query but lighter weight
 */
export function useCachedQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number; // Time before data is considered stale
    cacheTime?: number; // Time to keep data after unmount
    enabled?: boolean;
    retry?: number;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const cacheKey = `query:${queryKey.join(':')}`;
  const staleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // Load cached data
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);

        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached);
          const age = Date.now() - entry.timestamp;

          setData(entry.data);

          // Check if stale
          if (age > (options?.staleTime || 300000)) {
            setIsStale(true);
          } else {
            setIsStale(false);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(`[CachedQuery] Load error:`, err);
      }
    };

    if (options?.enabled !== false) {
      loadCache();
    }
  }, [cacheKey, options?.enabled, options?.staleTime]);

  // Fetch data
  useEffect(() => {
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await queryFn();

        // Update cache
        const entry: CacheEntry<T> = {
          data: result,
          timestamp: Date.now(),
          ttl: options?.cacheTime || 600000,
        };

        await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
        setData(result);
        setError(null);
        setIsStale(false);
        retryCountRef.current = 0;

        // Mark as stale after staleTime
        if (options?.staleTime) {
          staleTimeoutRef.current = setTimeout(() => setIsStale(true), options.staleTime);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);

        // Retry logic
        const maxRetries = options?.retry ?? 3;
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(fetchData, 1000 * 2 ** (retryCountRef.current - 1)); // Exponential backoff
        } else {
          options?.onError?.(err instanceof Error ? err : new Error(errorMsg));
        }
      } finally {
        setLoading(false);
      }
    };

    if (isStale || !data) {
      fetchData();
    }

    return () => {
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
      }
    };
  }, [queryKey, queryFn, isStale, data, options?.enabled]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await queryFn();

      const entry: CacheEntry<T> = {
        data: result,
        timestamp: Date.now(),
        ttl: options?.cacheTime || 600000,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      setData(result);
      setError(null);
      setIsStale(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      options?.onError?.(err instanceof Error ? err : new Error(errorMsg));
    } finally {
      setLoading(false);
    }
  }, [queryFn, cacheKey, options?.cacheTime, options?.onError]);

  const invalidate = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(cacheKey);
      setData(null);
      setIsStale(true);
      retryCountRef.current = 0;
    } catch (err) {
      console.error(`[CachedQuery] Invalidate error:`, err);
    }
  }, [cacheKey]);

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
    invalidate,
  };
}

/**
 * Batch cache invalidation utility
 */
export async function invalidateQueries(patterns: string[]): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const keysToDelete = keys.filter((key) =>
      patterns.some(
        (pattern) =>
          key.startsWith(pattern) ||
          (pattern.includes('*') && key.startsWith(pattern.replace('*', '')))
      )
    );

    if (keysToDelete.length > 0) {
      await AsyncStorage.multiRemove(keysToDelete);
      console.log(`[Cache] Invalidated ${keysToDelete.length} entries`);
    }
  } catch (err) {
    console.error('[Cache] Invalidation error:', err);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith('cache:'));

    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[Cache] Cleared ${cacheKeys.length} cache entries`);
    }
  } catch (err) {
    console.error('[Cache] Clear error:', err);
  }
}
