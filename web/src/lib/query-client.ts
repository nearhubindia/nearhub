import { QueryClient } from '@tanstack/react-query';

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
