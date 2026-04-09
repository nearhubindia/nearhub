import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@nearhub_search_history';
const MAX_HISTORY_ITEMS = 20;

export interface SearchHistoryItem {
  query: string;
  category?: string;
  city?: string;
  timestamp: number;
  searchCount: number; // How many times this exact search was performed
}

interface SearchHistoryContextValue {
  isLoaded: boolean;
  searchHistory: SearchHistoryItem[];
  trendingSearches: SearchHistoryItem[];
  recentSearches: SearchHistoryItem[];
  addSearch: (query: string, category?: string, city?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  removeSearch: (query: string) => Promise<void>;
  getTrendingSearches: (limit?: number) => SearchHistoryItem[];
}

const SearchHistoryContext = createContext<SearchHistoryContextValue | null>(null);

export function SearchHistoryProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setSearchHistory(parsed.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    } finally {
      setIsLoaded(true);
    }
  };

  const addSearch = async (query: string, category?: string, city?: string) => {
    if (!query.trim()) return;

    const normalizedQuery = query.toLowerCase().trim();
    const now = Date.now();

    setSearchHistory((prev) => {
      // Check if this search already exists
      const existing = prev.find(
        (item) => item.query === normalizedQuery && item.category === category && item.city === city
      );

      let updated: SearchHistoryItem[];

      if (existing) {
        // Update existing search
        updated = prev.map((item) =>
          item.query === normalizedQuery && item.category === category && item.city === city
            ? { ...item, timestamp: now, searchCount: item.searchCount + 1 }
            : item
        );
      } else {
        // Add new search
        updated = [
          { query: normalizedQuery, category, city, timestamp: now, searchCount: 1 },
          ...prev,
        ].slice(0, MAX_HISTORY_ITEMS); // Keep only latest 20
      }

      // Save to storage
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)).catch((e) =>
        console.error('Failed to save search history:', e)
      );

      return updated;
    });
  };

  const clearHistory = async () => {
    setSearchHistory([]);
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const removeSearch = async (query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    const updated = searchHistory.filter((item) => item.query !== normalizedQuery);
    setSearchHistory(updated);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  };

  const getTrendingSearches = (limit: number = 5): SearchHistoryItem[] => {
    return searchHistory.sort((a, b) => b.searchCount - a.searchCount).slice(0, limit);
  };

  const recentSearches = searchHistory.slice(0, 5); // Last 5 searches
  const trendingSearches = getTrendingSearches(5);

  const value = {
    isLoaded,
    searchHistory,
    trendingSearches,
    recentSearches,
    addSearch,
    clearHistory,
    removeSearch,
    getTrendingSearches,
  };

  return <SearchHistoryContext.Provider value={value}>{children}</SearchHistoryContext.Provider>;
}

export function useSearchHistory() {
  const context = useContext(SearchHistoryContext);
  if (!context) {
    throw new Error('useSearchHistory must be used within a SearchHistoryProvider');
  }
  return context;
}
