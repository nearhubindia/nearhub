import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Listing, Category } from '@/lib/types';
import { SAMPLE_LISTINGS } from '@/lib/sample-data';
import * as ImageStorage from '@/lib/image-storage';
import { getBackendURL } from '@/lib/config';

const LISTINGS_KEY = '@marketlocal_listings';
const SAVED_KEY = '@marketlocal_saved';
const INITIALIZED_KEY = '@marketlocal_initialized';
const DATA_VERSION_KEY = '@marketlocal_data_version';
const CURRENT_DATA_VERSION = '4'; // Updated to use sample data with proper coordinates

interface ListingsContextValue {
  listings: Listing[];
  savedIds: Set<string>;
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  limit: number;
  addListing: (
    listing: Omit<Listing, 'id' | 'createdAt'>,
    duration?: number,
    couponCode?: string,
    subscriptionTierId?: string,
    userSubscriptionId?: string
  ) => Promise<void>;
  toggleSaved: (id: string) => Promise<void>;
  getListingById: (id: string) => Listing | undefined;
  getListingsByCategory: (category: Category) => Listing[];
  getSavedListings: () => Listing[];
  refreshListings: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const ListingsContext = createContext<ListingsContextValue | null>(null);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50; // Items per page

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Use sample data with proper coordinates for location-based features
      // (Backend API data lacks proper lat/lon, causing listings to be filtered out)
      console.log('[Listings] Loading sample data with location coordinates');

      // Fallback: Load from cache or sample data
      const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
      const dataVersion = await AsyncStorage.getItem(DATA_VERSION_KEY);
      if (!initialized || dataVersion !== CURRENT_DATA_VERSION) {
        const stored = await AsyncStorage.getItem(LISTINGS_KEY);
        const existingListings: Listing[] = stored ? JSON.parse(stored) : [];
        const sampleIds = new Set(SAMPLE_LISTINGS.map((l) => l.id));
        const userListings = existingListings.filter((l) => !sampleIds.has(l.id));
        const merged = [...SAMPLE_LISTINGS, ...userListings];
        await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(merged));
        await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
        await AsyncStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
        setListings(merged);
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

  const addListing = async (
    listing: Omit<Listing, 'id' | 'createdAt'>,
    duration?: number,
    couponCode?: string,
    subscriptionTierId?: string,
    userSubscriptionId?: string
  ) => {
    console.log(
      '[Listings] addListing called with duration:',
      duration,
      'couponCode:',
      couponCode,
      'subscriptionTierId:',
      subscriptionTierId
    );
    const listingId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    // Hash and store images (deduplication)
    const imageHashes: string[] = [];
    for (const imageUri of listing.images) {
      try {
        // This will return existing hash if duplicate, create new if unique
        const hash = await ImageStorage.saveImageByHash(
          imageUri,
          0, // width unknown from URI
          0, // height unknown from URI
          0.4, // ultraLight quality
          0 // size unknown from URI
        );
        imageHashes.push(hash);
      } catch (error) {
        console.error(`Failed to hash image: ${error}`);
        // Fallback: use original URI if hashing fails
      }
    }

    const newListing: Listing = {
      ...listing,
      id: listingId,
      createdAt,
      imageHashes: imageHashes.length > 0 ? imageHashes : undefined,
    };

    // Try to POST to backend API first
    try {
      const backendURL = getBackendURL();
      console.log(
        '[Listings] Creating listing via API:',
        `${backendURL}/api/subscriptions/create-listing`
      );

      const response = await fetch(`${backendURL}/api/subscriptions/create-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId: listing.sellerPhone || 'user-' + Date.now(),
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: listing.price,
          priceUnit: listing.priceUnit,
          condition: listing.condition,
          location: listing.location?.city || 'Unknown',
          images: listing.images || [],
          listingType: listing.videos && listing.videos.length > 0 ? 'video' : 'image',
          ...(duration && { duration }), // Include duration for paid listings
          ...(couponCode && { couponCode }), // Include coupon code if provided
          ...(subscriptionTierId && { subscriptionTierId }), // Include subscription tier ID if provided
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Listings] API creation response:', data);

        // Update the listing with the server-generated ID if provided
        if (data.listing?.id) {
          newListing.id = data.listing.id;
        }

        // Refresh listings from API to get the latest data
        await loadData();
        return;
      } else {
        const errorText = await response.text();
        console.error(
          '[Listings] API creation failed with status:',
          response.status,
          'body:',
          errorText
        );
        console.warn('[Listings] API creation failed, falling back to local storage');
      }
    } catch (apiError) {
      console.error('[Listings] API creation error:', apiError);
      console.warn('[Listings] API creation error, falling back to local storage:', apiError);
    }

    // Fallback: Save locally if API fails
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

  const loadMore = async () => {
    if (!hasMore || isLoading) return;

    try {
      const backendURL = getBackendURL();
      const newOffset = offset + LIMIT;
      const url = `${backendURL}/api/listings?limit=${LIMIT}&offset=${newOffset}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.listings) {
          const newListings: Listing[] = [];

          // Handle both grouped and flat responses
          if (Array.isArray(data.listings)) {
            data.listings.forEach((listing: any) => {
              newListings.push({
                id: listing.id,
                title: listing.title,
                description: listing.description || '',
                price: listing.price,
                category: listing.category as Category,
                condition: listing.condition,
                images: listing.images || [],
                location: {
                  city: listing.location || 'Unknown',
                  latitude: 0,
                  longitude: 0,
                },
                sellerName: 'Seller',
                sellerPhone: '+91 98765 43210',
                sellerAvatar: 'https://i.pravatar.cc/150?img=1',
                createdAt: listing.createdAt || new Date().toISOString(),
                isPaid: listing.isPaid || false,
                status: listing.status || 'active',
                listingType: (listing.listingType as Listing['listingType']) || 'sell',
              });
            });
          } else {
            Object.entries(data.listings).forEach(([category, categoryListings]: [string, any]) => {
              if (Array.isArray(categoryListings)) {
                categoryListings.forEach((listing: any) => {
                  newListings.push({
                    id: listing.id,
                    title: listing.title,
                    description: listing.description || '',
                    price: listing.price,
                    category: listing.category as Category,
                    condition: listing.condition,
                    images: listing.images || [],
                    location: {
                      city: listing.location || 'Unknown',
                      latitude: 0,
                      longitude: 0,
                    },
                    sellerName: 'Seller',
                    sellerPhone: '+91 98765 43210',
                    sellerAvatar: 'https://i.pravatar.cc/150?img=1',
                    createdAt: listing.createdAt || new Date().toISOString(),
                    isPaid: listing.isPaid || false,
                    status: listing.status || 'active',
                    listingType: (listing.listingType as Listing['listingType']) || 'sell',
                  });
                });
              }
            });
          }

          // Append new listings
          setListings([...listings, ...newListings]);
          setOffset(newOffset);

          // Update hasMore
          if (data.pagination) {
            setHasMore(data.pagination.hasMore || false);
          }
        }
      }
    } catch (error) {
      console.error('[Listings] Error loading more listings:', error);
    }
  };

  const value = useMemo(
    () => ({
      listings,
      hasMore,
      offset,
      limit: LIMIT,
      savedIds,
      isLoading,
      addListing,
      toggleSaved,
      getListingById,
      getListingsByCategory,
      getSavedListings,
      refreshListings,
      loadMore,
    }),
    [listings, savedIds, isLoading, hasMore, offset]
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
