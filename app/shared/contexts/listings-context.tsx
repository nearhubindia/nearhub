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
  updateListing: (id: string, updates: Partial<Listing>) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
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
      console.log('[Listings] loadData: Fetching listings from backend...');
      setIsLoading(true);

      const backendURL = getBackendURL();
      
      // Get user location and radius from AsyncStorage (set by auth context)
      let url = `${backendURL}/api/listings?limit=100&offset=0`;
      try {
        const userDataStr = await AsyncStorage.getItem('@nearhub_auth_user');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const latitude = userData?.location?.latitude;
          const longitude = userData?.location?.longitude;
          const radiusKm = userData?.preferences?.searchRadiusKm || 50; // Default 50km
          
          if (latitude !== undefined && longitude !== undefined) {
            url += `&latitude=${latitude}&longitude=${longitude}&radius=${radiusKm}`;
            console.log(`[Listings] Geo-filtering: lat=${latitude}, lon=${longitude}, radius=${radiusKm}km`);
          }
        }
      } catch (userError) {
        console.warn('[Listings] Could not load user location for geo-filtering:', userError);
      }

      try {
        // Try to fetch from backend API first
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[Listings] API response received, listings count:', data.data?.length || 0);

          if (data.success && data.data) {
            const apiListings: Listing[] = (data.data || []).map((listing: any) => {
              // Parse JSON fields if they're strings
              const images = typeof listing.images === 'string' 
                ? JSON.parse(listing.images || '[]') 
                : (listing.images || []);
              const videos = typeof listing.videos === 'string' 
                ? JSON.parse(listing.videos || '[]') 
                : (listing.videos || []);

              return {
                id: listing.id,
                title: listing.title,
                description: listing.description || '',
                price: typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price,
                category: listing.category as Category,
                condition: listing.condition || 'good',
                images: images || [],
                videos: videos || [],
                location: {
                  city: listing.location || 'Unknown',
                  latitude: listing.latitude ? parseFloat(listing.latitude) : 0,
                  longitude: listing.longitude ? parseFloat(listing.longitude) : 0,
                },
                sellerName: 'Seller',
                sellerPhone: listing.sellerId || '',
                sellerAvatar: 'https://i.pravatar.cc/150?img=1',
                createdAt: listing.createdAt || new Date().toISOString(),
                isPaid: listing.isPaid || false,
                status: listing.status || 'active',
                listingType: (listing.listingType as Listing['listingType']) || 'sell',
              };
            });

            // Merge with existing local listings to preserve unsync'd ones
            const stored = await AsyncStorage.getItem(LISTINGS_KEY);
            const existingListings: Listing[] = stored ? JSON.parse(stored) : [];
            
            // Get IDs from API for deduplication
            const apiIds = new Set(apiListings.map(l => l.id));
            
            // Keep local listings that aren't on the server yet
            const localOnlyListings = existingListings.filter(l => !apiIds.has(l.id));
            
            // Merge: API listings first (latest), then local-only listings
            const merged = [...apiListings, ...localOnlyListings];
            
            console.log(
              '[Listings] Merged listings: API=',
              apiListings.length,
              'localOnly=',
              localOnlyListings.length,
              'total=',
              merged.length
            );
            
            setListings(merged);
            await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(merged));
            await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
            await AsyncStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
            setHasMore(true);
            setOffset(0);
            return;
          }
        }
      } catch (apiError) {
        console.warn('[Listings] API fetch failed, falling back to local storage:', apiError);
      }

      // Fallback: Load from cache if API fails
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
      console.error('[Listings] Failed to load data:', e);
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
      subscriptionTierId,
      'userSubscriptionId:',
      userSubscriptionId
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

      // DEBUG: Log what we're sending
      const requestBody = {
        sellerId: listing.sellerPhone || 'user-' + Date.now(),
        title: listing.title,
        description: listing.description,
        category: listing.category,
        price: listing.price,
        priceUnit: listing.priceUnit,
        condition: listing.condition,
        location: listing.location?.city || 'Unknown',
        images: listing.images || [],
        videos: listing.videos || [], // Include videos array (from video uploads)
        listingType: listing.videos && listing.videos.length > 0 ? 'video' : 'image',
        ...(duration && { duration }), // Include duration for paid listings
        ...(couponCode && { couponCode }), // Include coupon code if provided
        ...(subscriptionTierId && { subscriptionTierId }), // Include subscription tier ID if provided
        ...(userSubscriptionId && { userSubscriptionId }), // Include user subscription ID for quota tracking
      };
      
      console.log('[Listings] REQUEST BODY DEBUG:', {
        hasVideos: !!listing.videos,
        videosLength: listing.videos?.length || 0,
        videosValue: listing.videos,
        requestBodyVideos: requestBody.videos,
        latitude: listing.location?.latitude,
        longitude: listing.location?.longitude,
      });

      const response = await fetch(`${backendURL}/api/subscriptions/create-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...requestBody,
          // Explicitly include latitude and longitude for geolocation
          latitude: listing.location?.latitude,
          longitude: listing.location?.longitude,
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(
          '[Listings] API creation failed with status:',
          response.status,
          'data:',
          errorData
        );

        // Check if it's an AI validation error
        if (errorData.code === 'INAPPROPRIATE_CONTENT' || errorData.code === 'PRODUCT_IMAGE_MISMATCH') {
          // Throw a detailed error for AI validation failures
          const error = new Error(errorData.message || 'Content validation failed');
          (error as any).code = errorData.code;
          (error as any).details = errorData.details;
          throw error;
        }

        // Surface limiter/subscription quota errors to UI (do not silently fallback)
        if (
          response.status === 429 ||
          errorData.code === 'DAILY_LISTING_LIMIT_REACHED' ||
          errorData.code === 'LISTING_LIMIT_REACHED' ||
          errorData.code === 'SUBSCRIPTION_LIMIT_REACHED'
        ) {
          const error = new Error(errorData.error || errorData.message || 'Listing limit reached');
          (error as any).code = errorData.code || (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'LISTING_LIMIT_REACHED');
          (error as any).retryAfter = errorData.retryAfter;
          (error as any).limit = errorData.limit;
          (error as any).details = errorData;
          throw error;
        }

        // For other errors, fall back to local storage
        console.warn('[Listings] API creation failed, falling back to local storage');
      }
    } catch (apiError: any) {
      // Re-throw AI validation errors so UI can display them
      if (apiError.code === 'INAPPROPRIATE_CONTENT' || apiError.code === 'PRODUCT_IMAGE_MISMATCH') {
        throw apiError;
      }

      if (
        apiError.code === 'DAILY_LISTING_LIMIT_REACHED' ||
        apiError.code === 'RATE_LIMIT_EXCEEDED' ||
        apiError.code === 'LISTING_LIMIT_REACHED' ||
        apiError.code === 'SUBSCRIPTION_LIMIT_REACHED'
      ) {
        throw apiError;
      }

      console.error('[Listings] API creation error:', apiError);
      console.warn('[Listings] API creation error, falling back to local storage:', apiError);
    }

    // Fallback: Save locally if API fails
    const updated = [newListing, ...listings];
    setListings(updated);
    await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(updated));
  };

  const updateListing = async (id: string, updates: Partial<Listing>) => {
    try {
      console.log('[Listings] Updating listing:', id, updates);
      const existingListing = listings.find((listing) => listing.id === id);
      const ownerId = existingListing?.sellerPhone?.trim();

      // Try API update first
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/listings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(ownerId ? { 'x-user-id': ownerId } : {}),
        },
        body: JSON.stringify({
          status: updates.status,
          title: updates.title,
          description: updates.description,
          price: updates.price,
          offerPrice: updates.offerPrice,
          priceUnit: updates.priceUnit,
          condition: updates.condition,
          location: updates.location?.city || updates.location,
          pincode: updates.pincode,
          latitude: updates.location?.latitude,
          longitude: updates.location?.longitude,
          images: updates.images,
          videos: updates.videos,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Listings] API update response:', data);

        // Update local state
        const updatedListings = listings.map((listing) =>
          listing.id === id ? { ...listing, ...updates } : listing
        );
        setListings(updatedListings);
        await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(updatedListings));

        // Refresh to sync with server
        await loadData();
        return;
      } else {
        const errorText = await response.text();
        console.error('[Listings] API update failed:', response.status, errorText);
        throw new Error(`Update failed: ${errorText}`);
      }
    } catch (apiError) {
      console.error('[Listings] API update error:', apiError);
      
      // Fallback: Update locally if API fails
      const updatedListings = listings.map((listing) =>
        listing.id === id ? { ...listing, ...updates } : listing
      );
      setListings(updatedListings);
      await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(updatedListings));
      
      throw apiError; // Re-throw to let UI handle error
    }
  };

  const deleteListing = async (id: string) => {
    try {
      console.log('[Listings] Deleting listing:', id);
      const existingListing = listings.find((listing) => listing.id === id);
      const ownerId = existingListing?.sellerPhone?.trim();

      // Try API delete first
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/listings/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(ownerId ? { 'x-user-id': ownerId } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Listings] API delete response:', data);

        // Update local state
        const updatedListings = listings.filter((listing) => listing.id !== id);
        setListings(updatedListings);
        await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(updatedListings));

        // Also remove from saved if it was saved
        if (savedIds.has(id)) {
          const newSavedIds = new Set(savedIds);
          newSavedIds.delete(id);
          setSavedIds(newSavedIds);
          await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...newSavedIds]));
        }

        return;
      } else {
        const errorText = await response.text();
        console.error('[Listings] API delete failed:', response.status, errorText);
        throw new Error(`Delete failed: ${errorText}`);
      }
    } catch (apiError) {
      console.error('[Listings] API delete error:', apiError);
      throw apiError; // Re-throw to let UI handle error
    }
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
      updateListing,
      deleteListing,
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
