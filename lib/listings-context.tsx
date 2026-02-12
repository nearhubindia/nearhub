import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Listing, Category } from './types';
import { SAMPLE_LISTINGS } from './sample-data';

const LISTINGS_KEY = '@marketlocal_listings';
const SAVED_KEY = '@marketlocal_saved';
const INITIALIZED_KEY = '@marketlocal_initialized';

interface ListingsContextValue {
  listings: Listing[];
  savedIds: Set<string>;
  isLoading: boolean;
  addListing: (listing: Omit<Listing, 'id' | 'createdAt'>) => Promise<void>;
  toggleSaved: (id: string) => Promise<void>;
  getListingById: (id: string) => Listing | undefined;
  getListingsByCategory: (category: Category) => Listing[];
  getSavedListings: () => Listing[];
  refreshListings: () => Promise<void>;
}

const ListingsContext = createContext<ListingsContextValue | null>(null);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
      if (!initialized) {
        await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(SAMPLE_LISTINGS));
        await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
        setListings(SAMPLE_LISTINGS);
      } else {
        const stored = await AsyncStorage.getItem(LISTINGS_KEY);
        if (stored) {
          setListings(JSON.parse(stored));
        }
      }

      const savedStr = await AsyncStorage.getItem(SAVED_KEY);
      if (savedStr) {
        setSavedIds(new Set(JSON.parse(savedStr)));
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      setListings(SAMPLE_LISTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  const addListing = async (listing: Omit<Listing, 'id' | 'createdAt'>) => {
    const newListing: Listing = {
      ...listing,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updated = [newListing, ...listings];
    setListings(updated);
    await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(updated));
  };

  const toggleSaved = async (id: string) => {
    const next = new Set(savedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSavedIds(next);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
  };

  const getListingById = (id: string) => listings.find((l) => l.id === id);

  const getListingsByCategory = (category: Category) =>
    listings.filter((l) => l.category === category);

  const getSavedListings = () => listings.filter((l) => savedIds.has(l.id));

  const refreshListings = async () => {
    setIsLoading(true);
    await loadData();
  };

  const value = useMemo(
    () => ({
      listings,
      savedIds,
      isLoading,
      addListing,
      toggleSaved,
      getListingById,
      getListingsByCategory,
      getSavedListings,
      refreshListings,
    }),
    [listings, savedIds, isLoading],
  );

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>;
}

export function useListings() {
  const context = useContext(ListingsContext);
  if (!context) {
    throw new Error('useListings must be used within a ListingsProvider');
  }
  return context;
}
