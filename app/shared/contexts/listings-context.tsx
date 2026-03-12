import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Listing, Category } from '@/lib/types';
import { getBackendURL } from '@/lib/config';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

const LISTINGS_KEY = '@marketlocal_listings';
const SAVED_KEY = '@marketlocal_saved';
const INITIALIZED_KEY = '@marketlocal_initialized';
const DATA_VERSION_KEY = '@marketlocal_data_version';
const CURRENT_DATA_VERSION = '8'; // Remove sample fallback and reset stale sample cache
const NETWORK_TIMEOUT_MS = 12000;

function resolveSellerName(listing: any): string {
  const candidates = [
    listing?.sellerName,
    listing?.seller_name,
    listing?.ownerName,
    listing?.owner_name,
    listing?.userName,
    listing?.user_name,
    listing?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'Seller';
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface ListingsContextValue {
  listings: Listing[];
  savedIds: Set<string>;
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingMore: boolean;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50; // Items per page
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadAtRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const MIN_LOAD_INTERVAL_MS = 1500;

  const loadData = useCallback(async (options?: { force?: boolean; asRefresh?: boolean }) => {
    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const now = Date.now();
    const shouldThrottle =
      !options?.force &&
      hasLoadedOnceRef.current &&
      now - lastLoadAtRef.current < MIN_LOAD_INTERVAL_MS;
    if (shouldThrottle) {
      return;
    }

    const run = (async () => {
      try {
        console.log('[Listings] loadData: Fetching listings from backend...');
        if (!options?.asRefresh) {
          setIsLoading(true);
        }

        const backendURL = getBackendURL();
        const dataVersion = await AsyncStorage.getItem(DATA_VERSION_KEY);
        const needsCacheReset = dataVersion !== CURRENT_DATA_VERSION;
        let currentUserId = '';

        if (needsCacheReset) {
          await AsyncStorage.removeItem(LISTINGS_KEY);
        }

        const normalizeMediaUrl = (url: unknown): string => {
          if (typeof url !== 'string') return '';
          const value = url.trim();
          if (!value) return value;

          if (value.startsWith('/')) {
            return `${backendURL}${value}`;
          }

          if (value.startsWith('http://') || value.startsWith('https://')) {
            try {
              const parsed = new URL(value);
              if (
                parsed.hostname === 'localhost' ||
                parsed.hostname === '127.0.0.1' ||
                parsed.hostname === '0.0.0.0'
              ) {
                const apiBase = new URL(backendURL);
                parsed.protocol = apiBase.protocol;
                parsed.host = apiBase.host;
                return parsed.toString();
              }
            } catch {
              return value;
            }
          }

          return value;
        };

        // Get user location and radius from AsyncStorage (set by auth context)
        let url = `${backendURL}/api/listings?limit=${LIMIT}&offset=0`;
        try {
          const userDataStr = await AsyncStorage.getItem('@nearhub_auth_user');
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            currentUserId = String(userData?.id || '');
            const latitude = userData?.location?.latitude;
            const longitude = userData?.location?.longitude;
            const radiusKm = userData?.preferences?.searchRadiusKm || 50; // Default 50km

            if (latitude !== undefined && longitude !== undefined) {
              url += `&latitude=${latitude}&longitude=${longitude}&radius=${radiusKm}`;
              console.log(
                `[Listings] Geo-filtering: lat=${latitude}, lon=${longitude}, radius=${radiusKm}km`
              );
            }
          }
        } catch (userError) {
          console.warn('[Listings] Could not load user location for geo-filtering:', userError);
        }

        try {
          // Try to fetch from backend API first
          const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(
              '[Listings] API response received, listings count:',
              data.data?.length || 0
            );

            if (data.success && data.data) {
              const mapApiListing = (listing: any): Listing => {
                // Parse JSON fields if they're strings
                const images =
                  typeof listing.images === 'string'
                    ? JSON.parse(listing.images || '[]')
                    : listing.images || [];
                const videos =
                  typeof listing.videos === 'string'
                    ? JSON.parse(listing.videos || '[]')
                    : listing.videos || [];

                return {
                  id: listing.id,
                  userId: listing.userId || '',
                  title: listing.title,
                  description: listing.description || '',
                  price:
                    typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price,
                  offerPrice:
                    listing.offerPrice !== undefined && listing.offerPrice !== null
                      ? typeof listing.offerPrice === 'string'
                        ? parseFloat(listing.offerPrice)
                        : listing.offerPrice
                      : undefined,
                  category: listing.category as Category,
                  condition: listing.condition || 'good',
                  images: (images || []).map(normalizeMediaUrl).filter(Boolean),
                  videos: (videos || []).map(normalizeMediaUrl).filter(Boolean),
                  location: {
                    city: listing.location || 'Unknown',
                    latitude: listing.latitude ? parseFloat(listing.latitude) : 0,
                    longitude: listing.longitude ? parseFloat(listing.longitude) : 0,
                  },
                  sellerName: resolveSellerName(listing),
                  sellerVerified: Boolean((listing as any).sellerVerified),
                  sellerPhone: listing.contactPhone || listing.sellerPhone || '',
                  contactPhone: listing.contactPhone || listing.sellerPhone || '',
                  sellerAvatar:
                    typeof (listing as any).sellerAvatar === 'string'
                      ? normalizeMediaUrl((listing as any).sellerAvatar)
                      : '',
                  createdAt: listing.createdAt || new Date().toISOString(),
                  expiresAt: listing.expiresAt || undefined,
                  isPaid: listing.isPaid || false,
                  featured: Boolean(listing.featured),
                  sponsored: Boolean((listing as any).sponsored),
                  boostedUntil: listing.boostedUntil || undefined,
                  boostCount:
                    listing.boostCount !== undefined && listing.boostCount !== null
                      ? Number(listing.boostCount)
                      : undefined,
                  duration: Number(listing.durationDays || listing.duration || 0) || undefined,
                  durationDays: Number(listing.durationDays || listing.duration || 0) || undefined,
                  status: listing.status || 'active',
                  rejectionReason:
                    typeof listing.rejectionReason === 'string' && listing.rejectionReason.trim()
                      ? listing.rejectionReason.trim()
                      : undefined,
                  listingType: (listing.listingType as Listing['listingType']) || 'sell',
                };
              };

              const apiListings: Listing[] = (data.data || []).map((listing: any) =>
                mapApiListing(listing)
              );

              let userListings: Listing[] = [];
              const userLookupId = currentUserId;
              if (userLookupId) {
                try {
                  const userRes = await fetchWithTimeout(
                    `${backendURL}/api/subscriptions/user/${encodeURIComponent(userLookupId)}/listings`,
                    {
                      method: 'GET',
                      headers: buildUserAuthHeaders({ id: currentUserId }),
                    }
                  );

                  if (userRes.ok) {
                    const userData = await userRes.json();
                    const rawUserListings = Array.isArray(userData?.listings)
                      ? userData.listings
                      : Array.isArray(userData?.activeListings)
                        ? userData.activeListings
                        : [];
                    userListings = rawUserListings.map((listing: any) => mapApiListing(listing));
                  }
                } catch (userErr) {
                  console.warn('[Listings] Failed to fetch user listings:', userErr);
                }
              }

              const mergedServerListingsMap = new Map<string, Listing>();
              [...apiListings, ...userListings].forEach((listing) => {
                mergedServerListingsMap.set(listing.id, listing);
              });
              const mergedServerListings = [...mergedServerListingsMap.values()];

              console.log(
                '[Listings] Merged listings: API=',
                apiListings.length,
                'user=',
                userListings.length,
                'total=',
                mergedServerListings.length
              );

              setListings(mergedServerListings);
              await AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(mergedServerListings));
              await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
              await AsyncStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
              const baseCount = Array.isArray(data.data) ? data.data.length : 0;
              setHasMore(baseCount >= LIMIT);
              setOffset(baseCount);
              return;
            }
          }
        } catch (apiError) {
          console.warn('[Listings] API fetch failed, falling back to local storage:', apiError);
        }

        // No local listings fallback: enforce DB/API as the single source of truth
        setListings([]);
        await AsyncStorage.removeItem(LISTINGS_KEY);
        await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
        await AsyncStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);

        const savedStr = await AsyncStorage.getItem(SAVED_KEY);
        if (savedStr) {
          setSavedIds(new Set(JSON.parse(savedStr)));
        }
      } catch (e) {
        console.error('[Listings] Failed to load data:', e);
        setListings([]);
      } finally {
        if (!options?.asRefresh) {
          setIsLoading(false);
        }
      }
      hasLoadedOnceRef.current = true;
      lastLoadAtRef.current = Date.now();
    })();

    loadInFlightRef.current = run.finally(() => {
      loadInFlightRef.current = null;
    });

    return loadInFlightRef.current;
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    // Try to POST to backend API first
    try {
      const backendURL = getBackendURL();
      console.log(
        '[Listings] Creating listing via API:',
        `${backendURL}/api/subscriptions/create-listing`
      );

      // DEBUG: Log what we're sending
      const ownerId = String(listing.userId || '').trim();
      if (!ownerId) {
        throw new Error('Missing listing owner id');
      }
      const requestBody = {
        userId: ownerId,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        price: listing.price,
        offerPrice: listing.offerPrice,
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
        headers: buildUserAuthHeaders({ id: ownerId }),
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

        // Refresh listings from API to get the latest data
        await loadData({ force: true });
        return;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(
          '[Listings] API creation failed with status:',
          response.status,
          'data:',
          errorData
        );

        // Surface limiter/subscription quota errors to UI (do not silently fallback)
        if (
          response.status === 429 ||
          errorData.code === 'DAILY_LISTING_LIMIT_REACHED' ||
          errorData.code === 'LISTING_LIMIT_REACHED' ||
          errorData.code === 'SUBSCRIPTION_LIMIT_REACHED'
        ) {
          const error = new Error(errorData.error || errorData.message || 'Listing limit reached');
          (error as any).code =
            errorData.code ||
            (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'LISTING_LIMIT_REACHED');
          (error as any).retryAfter = errorData.retryAfter;
          (error as any).limit = errorData.limit;
          (error as any).details = errorData;
          throw error;
        }

        throw new Error(errorData.error || errorData.message || 'Failed to create listing');
      }
    } catch (apiError: any) {
      if (
        apiError.code === 'DAILY_LISTING_LIMIT_REACHED' ||
        apiError.code === 'RATE_LIMIT_EXCEEDED' ||
        apiError.code === 'LISTING_LIMIT_REACHED' ||
        apiError.code === 'SUBSCRIPTION_LIMIT_REACHED'
      ) {
        throw apiError;
      }

      console.error('[Listings] API creation error:', apiError);
      throw apiError;
    }
  };

  const updateListing = async (id: string, updates: Partial<Listing>) => {
    try {
      console.log('[Listings] Updating listing:', id, updates);
      const existingListing = listings.find((listing) => listing.id === id);
      const ownerUserId = existingListing?.userId?.trim() || '';
      if (!ownerUserId) {
        throw new Error('Missing listing owner id');
      }

      // Try API update first
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/listings/${id}`, {
        method: 'PATCH',
        headers: buildUserAuthHeaders({ id: ownerUserId }),
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
        await loadData({ force: true });
        return;
      } else {
        const errorText = await response.text();
        console.error('[Listings] API update failed:', response.status, errorText);
        throw new Error(`Update failed: ${errorText}`);
      }
    } catch (apiError) {
      console.error('[Listings] API update error:', apiError);
      throw apiError;
    }
  };

  const deleteListing = async (id: string) => {
    try {
      console.log('[Listings] Deleting listing:', id);
      const existingListing = listings.find((listing) => listing.id === id);
      const ownerUserId = existingListing?.userId?.trim() || '';
      if (!ownerUserId) {
        throw new Error('Missing listing owner id');
      }

      // Try API delete first
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/listings/${id}`, {
        method: 'DELETE',
        headers: buildUserAuthHeaders({ id: ownerUserId }),
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

  const refreshListings = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData({ force: true, asRefresh: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  const loadMore = async () => {
    if (!hasMore || isLoading || isFetchingMore) return;

    setIsFetchingMore(true);
    try {
      const backendURL = getBackendURL();
      const url = `${backendURL}/api/listings?limit=${LIMIT}&offset=${offset}`;

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const responseListings = Array.isArray(data?.data) ? data.data : [];

        if (data.success) {
          const parseMedia = (value: unknown): string[] => {
            if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
            if (typeof value !== 'string' || !value.trim()) return [];
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
            } catch {
              return [value];
            }
          };

          const newListings: Listing[] = responseListings.map((listing: any) => ({
            id: listing.id,
            userId: listing.userId || '',
            title: listing.title,
            description: listing.description || '',
            price: typeof listing.price === 'string' ? Number(listing.price) : listing.price,
            offerPrice:
              listing.offerPrice !== undefined && listing.offerPrice !== null
                ? typeof listing.offerPrice === 'string'
                  ? Number(listing.offerPrice)
                  : listing.offerPrice
                : undefined,
            category: listing.category as Category,
            condition: listing.condition,
            images: parseMedia(listing.images),
            videos: parseMedia(listing.videos),
            location: {
              city: listing.location || 'Unknown',
              latitude: listing.latitude ? Number(listing.latitude) : 0,
              longitude: listing.longitude ? Number(listing.longitude) : 0,
            },
            sellerName: resolveSellerName(listing),
            sellerVerified: Boolean((listing as any).sellerVerified),
            sellerPhone: listing.contactPhone || listing.sellerPhone || '',
            contactPhone: listing.contactPhone || listing.sellerPhone || '',
            sellerAvatar:
              typeof (listing as any).sellerAvatar === 'string'
                ? (listing as any).sellerAvatar.trim()
                : '',
            createdAt: listing.createdAt || new Date().toISOString(),
            expiresAt: listing.expiresAt || undefined,
            isPaid: listing.isPaid || false,
            featured: Boolean(listing.featured),
            sponsored: Boolean((listing as any).sponsored),
            boostedUntil: listing.boostedUntil || undefined,
            boostCount:
              listing.boostCount !== undefined && listing.boostCount !== null
                ? Number(listing.boostCount)
                : undefined,
            duration: Number(listing.durationDays || listing.duration || 0) || undefined,
            durationDays: Number(listing.durationDays || listing.duration || 0) || undefined,
            status: listing.status || 'active',
            rejectionReason:
              typeof listing.rejectionReason === 'string' && listing.rejectionReason.trim()
                ? listing.rejectionReason.trim()
                : undefined,
            listingType: (listing.listingType as Listing['listingType']) || 'sell',
          }));

          setListings((prev) => {
            const listingMap = new Map<string, Listing>();
            [...prev, ...newListings].forEach((listing) => {
              listingMap.set(listing.id, listing);
            });
            return [...listingMap.values()];
          });
          setOffset((prevOffset) => prevOffset + responseListings.length);
          setHasMore(newListings.length >= LIMIT);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('[Listings] Error loading more listings:', error);
    } finally {
      setIsFetchingMore(false);
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
      isRefreshing,
      isFetchingMore,
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
    [listings, savedIds, isLoading, isRefreshing, isFetchingMore, hasMore, offset]
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
