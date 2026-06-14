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
import { getBackendURL, getDebug } from '@/lib/config';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

type DealListingInput = {
  isDeal?: boolean;
  dealType?: 'normal' | 'combo';
  dealStartAt?: string;
  dealEndAt?: string;
  dealRecurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dealRecurrenceUntil?: string;
  dealCycleQuantity?: number;
  maxDealBookings?: number;
  postDealPriceMode?: 'original' | 'discount';
  postDealDiscountPrice?: number;
  comboItems?: string[];
  dealTerms?: string;
  voucherEnabled?: boolean;
};

const LISTINGS_KEY = '@marketlocal_listings';
const SAVED_KEY = '@marketlocal_saved';
const INITIALIZED_KEY = '@marketlocal_initialized';
const DATA_VERSION_KEY = '@marketlocal_data_version';
const CURRENT_DATA_VERSION = '11'; // Refresh cache to clear stale listings and enforce latest geo-filtering
const NETWORK_TIMEOUT_MS = 12000;
const isDebugLoggingEnabled = getDebug();

function debugLog(...args: unknown[]): void {
  if (isDebugLoggingEnabled) {
    console.log(...args);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseOptionalCount(...candidates: unknown[]): number | undefined {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const numericValue = Number(candidate);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      return numericValue;
    }
  }
  return undefined;
}

type StoredAuthUser = {
  id?: string;
  phone?: string;
  token?: string;
};

async function getStoredAuthUser(): Promise<StoredAuthUser | null> {
  const raw = await AsyncStorage.getItem('@nearhub_auth_user');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuthUser;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function mergeListings(existing: Listing | undefined, incoming: Listing): Listing {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    sellerName: isNonEmptyString(incoming.sellerName) ? incoming.sellerName : existing.sellerName,
    sellerAvatar: isNonEmptyString(incoming.sellerAvatar)
      ? incoming.sellerAvatar
      : existing.sellerAvatar,
    sellerPhone: isNonEmptyString(incoming.sellerPhone)
      ? incoming.sellerPhone
      : existing.sellerPhone,
    contactPhone: isNonEmptyString(incoming.contactPhone)
      ? incoming.contactPhone
      : existing.contactPhone,
    images: incoming.images?.length ? incoming.images : existing.images,
    videos: incoming.videos?.length ? incoming.videos : existing.videos,
  };
}

function resolveSellerName(listing: any): string {
  const isPlaceholderName = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    const digitsOnly = value.replace(/\D/g, '');
    return (
      normalized === 'seller' ||
      normalized === 'unknown' ||
      normalized === 'anonymous' ||
      digitsOnly.length >= 10
    );
  };

  const candidates = [
    listing?.sellerName,
    listing?.seller_name,
    listing?.seller?.name,
    listing?.seller?.username,
    listing?.ownerName,
    listing?.owner_name,
    listing?.userName,
    listing?.user_name,
    listing?.username,
    listing?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const normalized = candidate.trim();
      if (!isPlaceholderName(normalized)) {
        return normalized;
      }
    }
  }

  return 'Seller';
}

function normalizeAppListingType(listing: any): Listing['listingType'] {
  const rawType =
    typeof listing?.listingType === 'string' ? listing.listingType.trim().toLowerCase() : '';
  if (rawType === 'sell' || rawType === 'buy' || rawType === 'service' || rawType === 'job') {
    return rawType;
  }

  const normalizedSubCategory = String(
    listing?.subCategory || listing?.subcategory || listing?.category || ''
  )
    .trim()
    .toLowerCase();
  if (normalizedSubCategory === 'jobs') return 'job';
  if (
    normalizedSubCategory === 'services' ||
    normalizedSubCategory === 'freelance' ||
    normalizedSubCategory === 'business' ||
    normalizedSubCategory === 'education' ||
    normalizedSubCategory === 'health'
  ) {
    return 'service';
  }

  const normalizedMainCategory = String(listing?.mainCategory || '')
    .trim()
    .toLowerCase();
  if (normalizedMainCategory === 'jobs & services') return 'service';

  return 'sell';
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
    listing: Omit<Listing, 'id' | 'createdAt'> & Partial<DealListingInput>,
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
      let hydratedFromCache = false;

      try {
        debugLog('[Listings] loadData: Fetching listings from backend...');
        if (!options?.asRefresh) {
          setIsLoading(true);
        }

        const backendURL = getBackendURL();
        const [dataVersion, cachedListingsStr, savedStr, userDataStr] = await Promise.all([
          AsyncStorage.getItem(DATA_VERSION_KEY),
          AsyncStorage.getItem(LISTINGS_KEY),
          AsyncStorage.getItem(SAVED_KEY),
          AsyncStorage.getItem('@nearhub_auth_user'),
        ]);

        if (savedStr) {
          try {
            const parsed = JSON.parse(savedStr);
            if (Array.isArray(parsed)) {
              setSavedIds(
                new Set(parsed.filter((value): value is string => typeof value === 'string'))
              );
            }
          } catch (savedError) {
            console.warn('[Listings] Failed to parse saved ids cache:', savedError);
          }
        }

        const needsCacheReset = dataVersion !== CURRENT_DATA_VERSION;
        if (needsCacheReset) {
          void AsyncStorage.removeItem(LISTINGS_KEY);
        } else if (cachedListingsStr) {
          try {
            const cachedListings = JSON.parse(cachedListingsStr);
            if (Array.isArray(cachedListings) && cachedListings.length > 0) {
              hydratedFromCache = true;
              setListings(cachedListings as Listing[]);
              if (!options?.asRefresh) {
                setIsLoading(false);
              }
            }
          } catch (cacheError) {
            console.warn('[Listings] Failed to parse listings cache:', cacheError);
          }
        }

        let currentUserId = '';
        let currentUserPhone = '';
        let userLatitude: number | undefined;
        let userLongitude: number | undefined;
        let userRadiusKm = 50;

        if (userDataStr) {
          try {
            const userData = JSON.parse(userDataStr);
            currentUserId = String(userData?.id || '');
            currentUserPhone = String(userData?.phone || '');
            userLatitude = userData?.location?.latitude;
            userLongitude = userData?.location?.longitude;
            userRadiusKm = Number(userData?.preferences?.searchRadiusKm || 50) || 50;
          } catch (userError) {
            console.warn('[Listings] Could not parse user data for geo-filtering:', userError);
          }
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

        const mapApiListing = (listing: any): Listing => {
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
            price: typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price,
            offerPrice:
              listing.offerPrice !== undefined && listing.offerPrice !== null
                ? typeof listing.offerPrice === 'string'
                  ? parseFloat(listing.offerPrice)
                  : listing.offerPrice
                : undefined,
            mainCategory:
              typeof listing.mainCategory === 'string' && listing.mainCategory.trim()
                ? listing.mainCategory.trim()
                : undefined,
            subCategory: (listing.subCategory || listing.subcategory || listing.category) as
              | Category
              | undefined,
            subcategory: (listing.subCategory || listing.subcategory || listing.category) as
              | Category
              | undefined,
            category: (listing.subCategory || listing.subcategory || listing.category) as Category,
            condition: listing.condition || 'good',
            images: (images || []).map(normalizeMediaUrl).filter(Boolean),
            videos: (videos || []).map(normalizeMediaUrl).filter(Boolean),
            location: {
              city: listing.location || 'Unknown',
              latitude: listing.latitude ? parseFloat(listing.latitude) : 0,
              longitude: listing.longitude ? parseFloat(listing.longitude) : 0,
            },
            visibilityMode:
              listing.visibilityMode === 'online' || listing.visibilityMode === 'local'
                ? listing.visibilityMode
                : undefined,
            visibilityRadiusKm:
              listing.visibilityRadiusKm !== undefined && listing.visibilityRadiusKm !== null
                ? Number(listing.visibilityRadiusKm)
                : undefined,
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
            viewCount: parseOptionalCount(
              listing.viewCount,
              listing.views,
              listing.totalViews,
              listing['view_count']
            ),
            chatCount:
              listing.chatCount !== undefined && listing.chatCount !== null
                ? Number(listing.chatCount)
                : undefined,
            likeCount:
              listing.likeCount !== undefined && listing.likeCount !== null
                ? Number(listing.likeCount)
                : undefined,
            saveCount:
              listing.saveCount !== undefined && listing.saveCount !== null
                ? Number(listing.saveCount)
                : undefined,
            duration: Number(listing.durationDays || listing.duration || 0) || undefined,
            durationDays: Number(listing.durationDays || listing.duration || 0) || undefined,
            isDeal: Boolean(listing.isDeal),
            dealType: (listing.dealType || undefined) as Listing['dealType'],
            dealStartAt: listing.dealStartAt || undefined,
            dealEndAt: listing.dealEndAt || undefined,
            dealRecurrence: (listing.dealRecurrence || undefined) as Listing['dealRecurrence'],
            dealRecurrenceUntil: listing.dealRecurrenceUntil || undefined,
            dealCycleQuantity:
              listing.dealCycleQuantity !== undefined && listing.dealCycleQuantity !== null
                ? Number(listing.dealCycleQuantity)
                : undefined,
            maxDealBookings:
              listing.maxDealBookings !== undefined && listing.maxDealBookings !== null
                ? Number(listing.maxDealBookings)
                : undefined,
            postDealPriceMode: (listing.postDealPriceMode ||
              undefined) as Listing['postDealPriceMode'],
            postDealDiscountPrice:
              listing.postDealDiscountPrice !== undefined && listing.postDealDiscountPrice !== null
                ? Number(listing.postDealDiscountPrice)
                : undefined,
            comboItems: Array.isArray(listing.comboItems) ? listing.comboItems : undefined,
            dealTerms:
              typeof listing.dealTerms === 'string' && listing.dealTerms.trim()
                ? listing.dealTerms.trim()
                : undefined,
            voucherEnabled:
              listing.voucherEnabled !== undefined && listing.voucherEnabled !== null
                ? Boolean(listing.voucherEnabled)
                : undefined,
            status: listing.status || 'active',
            rejectionReason:
              typeof listing.rejectionReason === 'string' && listing.rejectionReason.trim()
                ? listing.rejectionReason.trim()
                : undefined,
            listingType: normalizeAppListingType(listing),
          };
        };

        let url = `${backendURL}/api/listings?limit=${LIMIT}&offset=0`;
        if (userLatitude !== undefined && userLongitude !== undefined) {
          url += `&latitude=${userLatitude}&longitude=${userLongitude}&radius=${userRadiusKm}`;
          debugLog(
            `[Listings] Geo-filtering: lat=${userLatitude}, lon=${userLongitude}, radius=${userRadiusKm}km`
          );
        }

        try {
          const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: buildUserAuthHeaders({ id: currentUserId, phone: currentUserPhone }),
          });

          if (response.ok) {
            const data = await response.json();
            debugLog('[Listings] API response received, listings count:', data.data?.length || 0);

            if (data.success && data.data) {
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
                mergedServerListingsMap.set(
                  listing.id,
                  mergeListings(mergedServerListingsMap.get(listing.id), listing)
                );
              });
              const mergedServerListings = [...mergedServerListingsMap.values()];

              debugLog(
                '[Listings] Merged listings: API=',
                apiListings.length,
                'user=',
                userListings.length,
                'total=',
                mergedServerListings.length
              );

              setListings(mergedServerListings);
              const baseCount = Array.isArray(data.data) ? data.data.length : 0;
              setHasMore(baseCount >= LIMIT);
              setOffset(baseCount);

              void Promise.all([
                AsyncStorage.setItem(LISTINGS_KEY, JSON.stringify(mergedServerListings)),
                AsyncStorage.setItem(INITIALIZED_KEY, 'true'),
                AsyncStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION),
              ]).catch((storageError) => {
                console.warn('[Listings] Failed to persist listings cache:', storageError);
              });
              return;
            }
          }
        } catch (apiError) {
          console.warn('[Listings] API fetch failed, keeping cache if available:', apiError);
        }

        if (!hydratedFromCache) {
          setListings([]);
          setHasMore(false);
          setOffset(0);
          void AsyncStorage.removeItem(LISTINGS_KEY);
        }

        void Promise.all([
          AsyncStorage.setItem(INITIALIZED_KEY, 'true'),
          AsyncStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION),
        ]).catch((storageError) => {
          console.warn('[Listings] Failed to persist listings metadata:', storageError);
        });
      } catch (e) {
        console.error('[Listings] Failed to load data:', e);
        if (!hydratedFromCache) {
          setListings([]);
          setHasMore(false);
          setOffset(0);
        }
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
    debugLog(
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
      debugLog(
        '[Listings] Creating listing via API:',
        `${backendURL}/api/subscriptions/create-listing`
      );

      // DEBUG: Log what we're sending
      const ownerId = String(listing.userId || '').trim();
      if (!ownerId) {
        throw new Error('Missing listing owner id');
      }
      const storedAuthUser = await getStoredAuthUser();
      const authToken = String(storedAuthUser?.token || '').trim();
      const ownerPhone = String(storedAuthUser?.phone || listing.sellerPhone || '').trim();
      const requestBody = {
        userId: ownerId,
        sellerName: listing.sellerName,
        contactPhone: listing.contactPhone || listing.sellerPhone || '',
        title: listing.title,
        description: listing.description,
        mainCategory: listing.mainCategory || undefined,
        subCategory: listing.subCategory || listing.subcategory || listing.category,
        category: listing.category,
        price: listing.price,
        offerPrice: listing.offerPrice,
        priceUnit: listing.priceUnit,
        condition: listing.condition,
        location: listing.location?.city || 'Unknown',
        visibilityMode: listing.visibilityMode || 'local',
        visibilityRadiusKm:
          listing.visibilityMode === 'online' ? Number(listing.visibilityRadiusKm || 0) : undefined,
        images: listing.images || [],
        videos: listing.videos || [], // Include videos array (from video uploads)
        listingType: listing.videos && listing.videos.length > 0 ? 'video' : 'image',
        isDeal: listing.isDeal || false,
        dealType: listing.isDeal ? listing.dealType || 'normal' : undefined,
        dealStartAt: listing.isDeal ? listing.dealStartAt : undefined,
        dealEndAt: listing.isDeal ? listing.dealEndAt : undefined,
        dealRecurrence: listing.isDeal ? listing.dealRecurrence || 'none' : undefined,
        dealRecurrenceUntil: listing.isDeal ? listing.dealRecurrenceUntil : undefined,
        dealCycleQuantity: listing.isDeal ? listing.dealCycleQuantity : undefined,
        maxDealBookings: listing.isDeal ? listing.maxDealBookings : undefined,
        postDealPriceMode: listing.isDeal ? listing.postDealPriceMode : undefined,
        postDealDiscountPrice: listing.isDeal ? listing.postDealDiscountPrice : undefined,
        comboItems: listing.isDeal ? listing.comboItems : undefined,
        dealTerms: listing.isDeal ? listing.dealTerms : undefined,
        voucherEnabled: listing.isDeal ? listing.voucherEnabled : undefined,
        ...(duration && { duration }), // Include duration for paid listings
        ...(couponCode && { couponCode }), // Include coupon code if provided
        ...(subscriptionTierId && { subscriptionTierId }), // Include subscription tier ID if provided
        ...(userSubscriptionId && { userSubscriptionId }), // Include user subscription ID for quota tracking
      };

      debugLog('[Listings] REQUEST BODY DEBUG:', {
        hasVideos: !!listing.videos,
        videosLength: listing.videos?.length || 0,
        videosValue: listing.videos,
        requestBodyVideos: requestBody.videos,
        latitude: listing.location?.latitude,
        longitude: listing.location?.longitude,
      });

      const response = await fetch(`${backendURL}/api/subscriptions/create-listing`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: ownerId, phone: ownerPhone, token: authToken }),
        body: JSON.stringify({
          ...requestBody,
          // Explicitly include latitude and longitude for geolocation
          latitude: listing.location?.latitude,
          longitude: listing.location?.longitude,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        debugLog('[Listings] API creation response:', data);

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
      debugLog('[Listings] Updating listing:', id, updates);
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
          listingType: updates.listingType,
          title: updates.title,
          description: updates.description,
          price: updates.price,
          offerPrice: updates.offerPrice,
          priceUnit: updates.priceUnit,
          mainCategory: updates.mainCategory,
          subCategory: updates.subCategory || updates.subcategory || updates.category,
          category: updates.category,
          condition: updates.condition,
          location: updates.location?.city || updates.location,
          pincode: updates.pincode,
          latitude: updates.location?.latitude,
          longitude: updates.location?.longitude,
          images: updates.images,
          videos: updates.videos,
          visibilityMode: updates.visibilityMode,
          visibilityRadiusKm:
            updates.visibilityMode === 'online' ? updates.visibilityRadiusKm : undefined,
          isDeal: updates.isDeal,
          dealType: updates.isDeal ? updates.dealType : undefined,
          dealStartAt: updates.isDeal ? updates.dealStartAt : undefined,
          dealEndAt: updates.isDeal ? updates.dealEndAt : undefined,
          dealRecurrence: updates.isDeal ? updates.dealRecurrence : undefined,
          dealRecurrenceUntil: updates.isDeal ? updates.dealRecurrenceUntil : undefined,
          dealCycleQuantity: updates.isDeal ? updates.dealCycleQuantity : undefined,
          maxDealBookings: updates.isDeal ? updates.maxDealBookings : undefined,
          postDealPriceMode: updates.isDeal ? updates.postDealPriceMode : undefined,
          postDealDiscountPrice: updates.isDeal ? updates.postDealDiscountPrice : undefined,
          comboItems: updates.isDeal ? updates.comboItems : undefined,
          dealTerms: updates.isDeal ? updates.dealTerms : undefined,
          voucherEnabled: updates.isDeal ? updates.voucherEnabled : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        debugLog('[Listings] API update response:', data);

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
      debugLog('[Listings] Deleting listing:', id);
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
        debugLog('[Listings] API delete response:', data);

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
    const wasSaved = savedIds.has(id);
    const next = new Set(savedIds);
    if (wasSaved) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setSavedIds(next);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...next]));

    const delta = wasSaved ? -1 : 1;
    setListings((prev) =>
      prev.map((listing) => {
        if (listing.id !== id) return listing;
        const currentCount = Number(listing.likeCount ?? listing.saveCount ?? 0) || 0;
        const nextCount = Math.max(0, currentCount + delta);
        return {
          ...listing,
          likeCount: nextCount,
          saveCount: nextCount,
        };
      })
    );

    try {
      const userDataStr = await AsyncStorage.getItem('@nearhub_auth_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const authUserId = String(userData?.id || '').trim();
      const authUserPhone = String(userData?.phone || '').trim();
      if (!authUserId) return;

      const backendURL = getBackendURL();
      const method = wasSaved ? 'DELETE' : 'POST';
      const response = await fetch(`${backendURL}/api/listings/${encodeURIComponent(id)}/like`, {
        method,
        headers: buildUserAuthHeaders({ id: authUserId, phone: authUserPhone }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn('[Listings] Failed to sync listing like:', response.status, errorText);
        return;
      }

      const data = await response.json().catch(() => null);
      const serverLikeCount = Number(data?.likeCount);
      if (Number.isFinite(serverLikeCount)) {
        setListings((prev) =>
          prev.map((listing) =>
            listing.id === id
              ? {
                  ...listing,
                  likeCount: serverLikeCount,
                  saveCount: serverLikeCount,
                }
              : listing
          )
        );
      }
    } catch (error) {
      console.warn('[Listings] Failed to sync listing like:', error);
    }
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
      let authUserId = '';
      let authUserPhone = '';
      let userLatitude: number | undefined;
      let userLongitude: number | undefined;
      let userRadiusKm = 50;
      try {
        const userDataStr = await AsyncStorage.getItem('@nearhub_auth_user');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          authUserId = String(userData?.id || '');
          authUserPhone = String(userData?.phone || '');
          userLatitude = Number(userData?.location?.latitude);
          userLongitude = Number(userData?.location?.longitude);
          userRadiusKm = Number(userData?.preferences?.searchRadiusKm || 50) || 50;
        }
      } catch {
        // Best-effort auth header attachment; continue without auth headers.
      }

      let url = `${backendURL}/api/listings?limit=${LIMIT}&offset=${offset}`;
      if (Number.isFinite(userLatitude) && Number.isFinite(userLongitude)) {
        url += `&latitude=${userLatitude}&longitude=${userLongitude}&radius=${userRadiusKm}`;
      }

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: buildUserAuthHeaders({ id: authUserId, phone: authUserPhone }),
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
            mainCategory:
              typeof listing.mainCategory === 'string' && listing.mainCategory.trim()
                ? listing.mainCategory.trim()
                : undefined,
            subCategory: (listing.subCategory || listing.subcategory || listing.category) as
              | Category
              | undefined,
            subcategory: (listing.subCategory || listing.subcategory || listing.category) as
              | Category
              | undefined,
            category: (listing.subCategory || listing.subcategory || listing.category) as Category,
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
            viewCount: parseOptionalCount(
              listing.viewCount,
              listing.views,
              listing.totalViews,
              listing['view_count']
            ),
            chatCount:
              listing.chatCount !== undefined && listing.chatCount !== null
                ? Number(listing.chatCount)
                : undefined,
            likeCount:
              listing.likeCount !== undefined && listing.likeCount !== null
                ? Number(listing.likeCount)
                : undefined,
            saveCount:
              listing.saveCount !== undefined && listing.saveCount !== null
                ? Number(listing.saveCount)
                : undefined,
            duration: Number(listing.durationDays || listing.duration || 0) || undefined,
            durationDays: Number(listing.durationDays || listing.duration || 0) || undefined,
            status: listing.status || 'active',
            rejectionReason:
              typeof listing.rejectionReason === 'string' && listing.rejectionReason.trim()
                ? listing.rejectionReason.trim()
                : undefined,
            listingType: normalizeAppListingType(listing),
          }));

          setListings((prev) => {
            const listingMap = new Map<string, Listing>();
            [...prev, ...newListings].forEach((listing) => {
              listingMap.set(listing.id, mergeListings(listingMap.get(listing.id), listing));
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
