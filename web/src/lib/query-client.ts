import { QueryClient, hydrate, dehydrate } from '@tanstack/react-query';

/**
 * Centralized ReactQuery configuration for the web application
 * Manages caching, refetch timing, and error handling globally
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data becomes stale after 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cached data remains in memory for 10 minutes after last use
      gcTime: 10 * 60 * 1000,
      // Don't retry failed requests automatically
      retry: false,
      // Don't refetch when window regains focus
      refetchOnWindowFocus: false,
      // Don't refetch when mounting if data is still fresh
      refetchOnMount: false,
    },
    mutations: {
      // Don't retry failed mutations
      retry: false,
    },
  },
});

// Persist react-query cache using official persister with versioning and selective persistence.
const PERSIST_KEY_BASE = 'nearhub:react-query-state';
const CACHE_VERSION = 'v1';
const PERSIST_KEY = `${PERSIST_KEY_BASE}:${CACHE_VERSION}`;

export function enableQueryPersistence(): void {
  // cleanup older versions
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(PERSIST_KEY_BASE) && !k.includes(CACHE_VERSION)) {
        localStorage.removeItem(k);
      }
    });
  } catch {
    // ignore
  }

  const shouldDehydrateQuery = (query: any) => {
    try {
      if (query.options?.meta?.persist) return true;
      const k = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
      const whitelist = ['header-push-notifications', 'header-user-profile', 'nearhub-home-feed'];
      return whitelist.includes(String(k));
    } catch {
      return false;
    }
  };

  // Size limits to avoid persisting very large query results
  const MAX_QUERY_BYTES = 50_000; // ~50 KB per query
  const MAX_TOTAL_BYTES = 300_000; // ~300 KB total persisted payload

  function estimateQuerySize(query: any): number {
    try {
      // Only serialize the most relevant parts to estimate size
      const candidate = {
        queryKey: query.queryKey,
        state: {
          data: query.state?.data,
          dataUpdatedAt: query.state?.dataUpdatedAt,
        },
      };
      return JSON.stringify(candidate).length;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  function pruneDehydratedState(state: any): any {
    try {
      if (!state || !Array.isArray(state.queries)) return state;

      // Keep mandatory queries first (whitelist or meta.persist)
      const mandatoryKeys = new Set(['header-push-notifications', 'header-user-profile', 'nearhub-home-feed']);

      const candidates = state.queries.map((q: any) => ({ q, key: Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey, size: estimateQuerySize({ queryKey: q.queryKey, state: q.state }) }));

      // Sort so mandatory and smaller entries preferred
      candidates.sort((a: any, b: any) => {
        const aMandatory = mandatoryKeys.has(String(a.key)) || a.q?.state?.meta?.persist;
        const bMandatory = mandatoryKeys.has(String(b.key)) || b.q?.state?.meta?.persist;
        if (aMandatory !== bMandatory) return aMandatory ? -1 : 1;
        return a.size - b.size;
      });

      const newQueries: any[] = [];
      let total = 0;
      for (const c of candidates) {
        if (c.size > MAX_QUERY_BYTES) continue; // skip too-large queries
        if (total + c.size > MAX_TOTAL_BYTES) continue;
        newQueries.push(c.q);
        total += c.size;
      }

      return { ...state, queries: newQueries };
    } catch {
      return state;
    }
  }

  // Try to use the official persister if available, otherwise fall back to simple localStorage persistence
  (async () => {
    try {
      // Dynamically import the official persister packages separately so bundlers
      // won't statically fail if the packages are not installed.
      // @ts-ignore
      const dynamicImport: (s: string) => Promise<any> = new Function('s', 'return import(s)') as any;
      let persistMod: any = null;
      let syncPersisterMod: any = null;
      try {
        persistMod = await dynamicImport('@tanstack/react-query-persist-client');
      } catch {
        persistMod = null;
      }
      try {
        syncPersisterMod = await dynamicImport('@tanstack/query-sync-storage-persister');
      } catch {
        syncPersisterMod = null;
      }

      if (persistMod && persistMod.persistQueryClient && syncPersisterMod && syncPersisterMod.createSyncStoragePersister) {
        const { persistQueryClient } = persistMod;
        const { createSyncStoragePersister } = syncPersisterMod;
        const persister = createSyncStoragePersister({ storage: window.localStorage, key: PERSIST_KEY });
        persistQueryClient({
          queryClient,
          persister,
          maxAge: 1000 * 60 * 60 * 24,
          dehydrateOptions: { shouldDehydrateQuery },
        });
        return;
      }
    } catch {
      // continue to manual fallback
    }

    // Manual fallback: hydrate then save on visibilitychange/pagehide/beforeunload
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed) {
            // lazy import dehydrate/hydrate from react-query to avoid circular imports
            hydrate(queryClient, parsed);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    let saveTimer: number | null = null;
    const save = async () => {
      try {
        let state = dehydrate(queryClient, { shouldDehydrateQuery });
        try {
          const serialized = JSON.stringify(state);
          if (serialized.length > MAX_TOTAL_BYTES) {
            state = pruneDehydratedState(state);
          }
        } catch {
          // ignore
        }
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    };

    const scheduleSave = () => {
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        void save();
        saveTimer = null;
      }, 250);
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') scheduleSave();
    });
    window.addEventListener('pagehide', () => scheduleSave());
    window.addEventListener('beforeunload', () => scheduleSave());
  })();
}
