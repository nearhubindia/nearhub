import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ScrollView,
  Dimensions,
  Platform,
  RefreshControl,
  Pressable,
  TextInput,
  BackHandler,
  ActivityIndicator,
  Alert,
  StatusBar,
  InteractionManager,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import { getTabOverlayContentPadding } from '@/constants/layout';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import { getDiscountPercent, hasValidOfferPrice } from '@/lib/deals';
import {
  formatDealStatus,
  getEffectiveDealWindow,
  isDealActiveNow,
  isDealExpired,
  isDealUpcoming,
} from '@/lib/deal-timer';
import { bookDeal, DealBookingError } from '@/lib/deal-bookings';
import { calculateDistance } from '@/lib/location-data';
import { Category, type Listing } from '@/lib/types';
import { formatCondition } from '@/lib/utils';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { Logo } from '@/shared/components/Logo';
import ListingCard from '@/shared/components/ListingCard';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { shareListingLink } from '@/lib/share-app-link';
import { getApiUrl } from '@/lib/query-client';
import { useAdminSettings } from '@/lib/use-admin-settings';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { useListingTaxonomy } from '@/lib/use-listing-taxonomy';
import { createResponsiveStyles } from '@/lib/responsive';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOME_HORIZONTAL_INSET = 10;
const HOME_RAIL_GAP = 3;
const LISTING_IMAGE_ASPECT_RATIO = 3 / 4;
const HOME_LIST_INITIAL_RENDER = 8;
const HOME_LIST_MAX_BATCH = 8;
const HOME_LIST_WINDOW_SIZE = 7;
const LOCATION_BOOTSTRAP_TIMEOUT_MS = 2800;

interface CitySuggestion {
  pincode: string;
  locationName: string;
  city: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  region: string;
}

type HomeDealItem = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  location: string;
  distance: string;
  sortDistanceKm?: number;
  dealEndsAt?: number;
  dealStatus: string;
  comboItems?: string[];
  badge?: string;
  voucherEnabled?: boolean;
  dealType?: string;
};

function formatDistanceLabel(distanceKm?: number): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Distance unavailable';
  if (distanceKm < 1) return '<1 km away';
  return `${Math.round(distanceKm)} km away`;
}

function normalizeDealItems(items: unknown[]): Listing[] {
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const location = item.location;
      const normalizedLocation =
        location && typeof location === 'object'
          ? {
              latitude: Number((location as Record<string, unknown>).latitude) || 0,
              longitude: Number((location as Record<string, unknown>).longitude) || 0,
              city: String((location as Record<string, unknown>).city || 'Unknown'),
            }
          : { latitude: 0, longitude: 0, city: 'Unknown' };

      return {
        ...(item as object),
        isDeal: Boolean(
          (item as Record<string, unknown>).isDeal ?? (item as Record<string, unknown>).is_deal
        ),
        dealType: String(
          (item as Record<string, unknown>).dealType ??
            (item as Record<string, unknown>).deal_type ??
            ''
        ).toLowerCase() as 'normal' | 'combo',
        dealStartAt:
          String(
            (item as Record<string, unknown>).dealStartAt ??
              (item as Record<string, unknown>).deal_start_at ??
              ''
          ).trim() || undefined,
        dealEndAt:
          String(
            (item as Record<string, unknown>).dealEndAt ??
              (item as Record<string, unknown>).deal_end_at ??
              ''
          ).trim() || undefined,
        dealRecurrence: String(
          (item as Record<string, unknown>).dealRecurrence ??
            (item as Record<string, unknown>).deal_recurrence ??
            'none'
        ).toLowerCase() as 'none' | 'daily' | 'weekly' | 'monthly',
        dealRecurrenceUntil:
          String(
            (item as Record<string, unknown>).dealRecurrenceUntil ??
              (item as Record<string, unknown>).deal_recurrence_until ??
              ''
          ).trim() || undefined,
        comboItems: Array.isArray((item as Record<string, unknown>).comboItems)
          ? ((item as Record<string, unknown>).comboItems as string[])
          : Array.isArray((item as Record<string, unknown>).combo_items)
            ? ((item as Record<string, unknown>).combo_items as string[])
            : undefined,
        voucherEnabled: Boolean(
          (item as Record<string, unknown>).voucherEnabled ??
          (item as Record<string, unknown>).voucher_enabled
        ),
        status: String((item as Record<string, unknown>).status || 'active').toLowerCase() as
          | 'active'
          | 'sold'
          | 'pending'
          | 'rejected'
          | 'inactive'
          | 'expired',
        location: normalizedLocation,
        images: Array.isArray((item as Record<string, unknown>).images)
          ? ((item as Record<string, unknown>).images as string[])
          : [],
      } as Listing;
    });
}

export default function HomeScreen() {
  const MIN_RADIUS_KM = 1;
  const MAX_RADIUS_KM = 500;
  const insets = useSafeAreaInsets();
  const {
    listings,
    savedIds,
    toggleSaved,
    isLoading,
    isRefreshing,
    isFetchingMore,
    refreshListings,
    loadMore,
    hasMore,
  } = useListings();
  const { user, cachedLocation, setUserSearchRadius, setUserLocation, isAuthenticated } = useAuth();
  const { trackSave } = useUserInterests();
  const { geoRadiusKm } = useAdminSettings();
  const { groups: categoryGroups } = useListingTaxonomy();
  const [broadDealListings, setBroadDealListings] = useState<Listing[]>([]);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const {
    banners: homeBanners,
    isLoading: isHomeBannersLoading,
    refreshBanners,
  } = useAppScreenBanners('home');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const orderedCategories = useMemo(
    () => Array.from(new Set(categoryGroups.flatMap((group) => group.subcategories))),
    [categoryGroups]
  );

  // Location selection state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [citySearchInput, setCitySearchInput] = useState('');
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [citySearchError, setCitySearchError] = useState<string | null>(null);
  const [selectedLocationCity, setSelectedLocationCity] = useState<string | null>(null);
  const [selectedLocationLat, setSelectedLocationLat] = useState<number | null>(null);
  const [selectedLocationLon, setSelectedLocationLon] = useState<number | null>(null);
  const [selectedSearchRadiusKm, setSelectedSearchRadiusKm] = useState<number>(geoRadiusKm);
  const [isAutoLocatingUser, setIsAutoLocatingUser] = useState(false);
  const [isAutoDetectingLocation, setIsAutoDetectingLocation] = useState(false);
  const [isBootstrappingLocation, setIsBootstrappingLocation] = useState(false);
  const [isLocationBootstrapActive, setIsLocationBootstrapActive] = useState(false);
  const [locationPermissionRequired, setLocationPermissionRequired] = useState(false);
  const [canAskLocationPermissionAgain, setCanAskLocationPermissionAgain] = useState(true);
  const cityInputRef = useRef<TextInput>(null);
  const locationUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startupAutoLocationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userCity =
    selectedLocationCity || user?.location?.city || cachedLocation?.city || 'Your City';
  const userLat = selectedLocationLat ?? user?.location?.latitude ?? cachedLocation?.latitude;
  const userLon = selectedLocationLon ?? user?.location?.longitude ?? cachedLocation?.longitude;
  const effectiveGeoRadiusKm = user?.preferences?.searchRadiusKm ?? geoRadiusKm;
  const visibleListings = useMemo(
    () =>
      listings.filter((listing) => {
        const status = String(listing.status || 'active').toLowerCase();
        if (status !== 'active') return false;
        if (listing.expiresAt && new Date(listing.expiresAt).getTime() < Date.now()) return false;
        return true;
      }),
    [listings]
  );
  const distanceByListingId = useMemo(() => {
    if (!userLat || !userLon) return new Map<string, number>();

    const distanceMap = new Map<string, number>();
    for (const listing of visibleListings) {
      const distance = calculateDistance(
        userLat,
        userLon,
        listing.location.latitude,
        listing.location.longitude
      );
      distanceMap.set(listing.id, distance);
    }

    return distanceMap;
  }, [visibleListings, userLat, userLon]);

  // Helper function to batch location state updates
  const updateLocation = useCallback((lat: number, lon: number, city: string) => {
    // Clear any pending update
    if (locationUpdateTimeoutRef.current) {
      clearTimeout(locationUpdateTimeoutRef.current);
    }

    // Use startTransition to batch updates and mark as low priority
    locationUpdateTimeoutRef.current = setTimeout(() => {
      setSelectedLocationCity(city);
      setSelectedLocationLat(lat);
      setSelectedLocationLon(lon);
      // Always reset to default category when location changes.
      setSelectedCategory('All');
    }, 100); // Small delay to batch rapid changes
  }, []);

  useEffect(() => {
    let active = true;
    let abortController: AbortController | undefined;
    const query = citySearchInput.trim();
    const isNumericQuery = /^\d+$/.test(query);

    if (!query) {
      setCitySuggestions([]);
      setCitySearchError(null);
      setIsSearchingCities(false);
      return;
    }

    if (!isNumericQuery && query.length < 2) {
      setCitySuggestions([]);
      setCitySearchError(null);
      setIsSearchingCities(false);
      return;
    }

    if (isNumericQuery && query.length < 6) {
      setCitySuggestions([]);
      setCitySearchError(null);
      setIsSearchingCities(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearchingCities(true);
      setCitySearchError(null);
      abortController = new AbortController();

      try {
        const apiUrl = await getApiUrl();

        if (/^\d{6}$/.test(query)) {
          const response = await fetch(`${apiUrl}/api/location/pincode/${query}`, {
            signal: abortController.signal,
          });

          if (!response.ok) {
            if (active) {
              setCitySuggestions([]);
              setCitySearchError('Could not fetch pincode details. Please try again.');
            }
            return;
          }

          const responseData = await response.json();
          const location = responseData?.data;

          const suggestion: CitySuggestion | null =
            location && location.latitude !== undefined && location.longitude !== undefined
              ? {
                  pincode: query,
                  locationName:
                    location.locationName || location.city || location.state || 'Unknown',
                  city: location.city || location.state || 'Unknown',
                  state: location.state || '',
                  district: location.district || '',
                  latitude: location.latitude,
                  longitude: location.longitude,
                  region: '',
                }
              : null;

          if (active) {
            setCitySuggestions(suggestion ? [suggestion] : []);
            setCitySearchError(suggestion ? null : 'No matching locations found');
          }
          return;
        }

        const response = await fetch(
          `${apiUrl}/api/location/cities/search?q=${encodeURIComponent(query)}&limit=10`,
          {
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error('City search request failed');
        }

        const payload = (await response.json()) as {
          success?: boolean;
          data?: CitySuggestion[];
        };

        if (active) {
          if (payload.success && Array.isArray(payload.data)) {
            setCitySuggestions(payload.data);
            setCitySearchError(null);
          } else {
            setCitySuggestions([]);
            setCitySearchError('No matching locations found');
          }
        }
      } catch (error) {
        if (active && error instanceof Error && error.name !== 'AbortError') {
          setCitySuggestions([]);
          setCitySearchError('Location search is unavailable right now. Please try again.');
        }
      } finally {
        if (active) {
          setIsSearchingCities(false);
        }
      }
    }, 400); // Increased debounce from 250ms to 400ms

    return () => {
      active = false;
      clearTimeout(timeout);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [citySearchInput]);

  useEffect(() => {
    setSelectedSearchRadiusKm(effectiveGeoRadiusKm);
  }, [effectiveGeoRadiusKm]);

  const applySearchRadius = useCallback(
    (nextRadiusKm: number) => {
      const clamped = Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, Math.round(nextRadiusKm)));
      setSelectedSearchRadiusKm(clamped);

      if (user) {
        setUserSearchRadius(clamped).catch((error) => {
          console.error('Failed to persist search radius preference:', error);
        });
      }
    },
    [setUserSearchRadius, user]
  );

  // Reusable function to auto-detect current location
  const autoDetectLocation = useCallback(
    async (setLoadingState: (state: boolean) => void, onSuccess?: () => void) => {
      setLoadingState(true);
      try {
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionRequired(true);
          setCanAskLocationPermissionAgain(Boolean(canAskAgain));
          console.log('Location permission denied');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setLoadingState(false);
          return;
        }
        setLocationPermissionRequired(false);
        setCanAskLocationPermissionAgain(true);

        // Try to get last known position first (faster)
        try {
          const lastPosition = await Location.getLastKnownPositionAsync({});
          if (lastPosition) {
            const reverseGeocode = await Location.reverseGeocodeAsync({
              latitude: lastPosition.coords.latitude,
              longitude: lastPosition.coords.longitude,
            });
            const cityName =
              reverseGeocode[0]?.city || reverseGeocode[0]?.region || 'Current Location';
            const stateName = reverseGeocode[0]?.region || reverseGeocode[0]?.country || 'Unknown';

            // Use helper to batch state updates
            updateLocation(lastPosition.coords.latitude, lastPosition.coords.longitude, cityName);
            setUserLocation(
              lastPosition.coords.latitude,
              lastPosition.coords.longitude,
              cityName,
              stateName
            ).catch((error) => {
              console.warn('[Home] Failed to persist auto-detected location:', error);
            });

            setLoadingState(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (onSuccess) onSuccess();
            return;
          }
        } catch {
          console.log('Error getting last known position, fetching current...');
        }

        // If no last known position, get current accurate position
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          mayShowUserSettingsDialog: true,
        });
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        const cityName = reverseGeocode[0]?.city || reverseGeocode[0]?.region || 'Current Location';
        const stateName = reverseGeocode[0]?.region || reverseGeocode[0]?.country || 'Unknown';

        // Use helper to batch state updates
        updateLocation(location.coords.latitude, location.coords.longitude, cityName);
        setUserLocation(
          location.coords.latitude,
          location.coords.longitude,
          cityName,
          stateName
        ).catch((error) => {
          console.warn('[Home] Failed to persist auto-detected location:', error);
        });

        setLoadingState(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error('Error auto-detecting location:', error);
        Alert.alert(
          'Location Error',
          'Could not get your location. Please check if location services are enabled.'
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setLoadingState(false);
      }
    },
    [updateLocation]
  );

  const checkLocationPermissionState = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      const granted = permission.status === 'granted';
      setLocationPermissionRequired(!granted);
      setCanAskLocationPermissionAgain(Boolean(permission.canAskAgain));
    } catch (error) {
      console.error('Failed to check location permission state:', error);
      setLocationPermissionRequired(true);
      setCanAskLocationPermissionAgain(false);
    }
  }, []);

  // Try to resolve location in the background, but do not block the feed behind a splash screen.
  useEffect(() => {
    const hasResolvedLocation =
      (selectedLocationLat !== null && selectedLocationLon !== null) ||
      (typeof user?.location?.latitude === 'number' &&
        typeof user?.location?.longitude === 'number') ||
      (typeof cachedLocation?.latitude === 'number' &&
        typeof cachedLocation?.longitude === 'number');

    if (hasResolvedLocation) {
      setIsBootstrappingLocation(false);
      setIsLocationBootstrapActive(false);
      return;
    }

    let cancelled = false;
    setIsBootstrappingLocation(true);

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      startupAutoLocationTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        void autoDetectLocation(setIsAutoLocatingUser).finally(() => {
          if (!cancelled) {
            setIsBootstrappingLocation(false);
          }
        });
      }, 120);
    });

    const fallbackTimer = setTimeout(() => {
      if (!cancelled) {
        setIsBootstrappingLocation(false);
        setIsLocationBootstrapActive(false);
      }
    }, LOCATION_BOOTSTRAP_TIMEOUT_MS);

    return () => {
      cancelled = true;
      interactionTask.cancel();
      clearTimeout(fallbackTimer);
      if (startupAutoLocationTimeoutRef.current) {
        clearTimeout(startupAutoLocationTimeoutRef.current);
        startupAutoLocationTimeoutRef.current = null;
      }
    };
  }, [
    autoDetectLocation,
    cachedLocation?.latitude,
    cachedLocation?.longitude,
    selectedLocationLat,
    selectedLocationLon,
    user?.location?.latitude,
    user?.location?.longitude,
  ]);

  useEffect(() => {
    if (!(userLat && userLon)) {
      void checkLocationPermissionState();
    }
  }, [checkLocationPermissionState, userLat, userLon]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
      }
      if (startupAutoLocationTimeoutRef.current) {
        clearTimeout(startupAutoLocationTimeoutRef.current);
      }
    };
  }, []);

  // Focus city input and handle back button
  useEffect(() => {
    if (showLocationModal) {
      const timer = setTimeout(() => {
        cityInputRef.current?.focus();
      }, 400);
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        setShowLocationModal(false);
        setCitySearchInput('');
        setCitySuggestions([]);
        setCitySearchError(null);
        return true;
      });
      return () => {
        clearTimeout(timer);
        backHandler.remove();
      };
    }
  }, [showLocationModal]);

  const selectCityAndSetLocation = useCallback(
    (location: CitySuggestion) => {
      // Use helper to batch state updates
      updateLocation(location.latitude, location.longitude, location.locationName || location.city);
      setUserLocation(
        location.latitude,
        location.longitude,
        location.locationName || location.city,
        location.state || 'Unknown'
      ).catch((error) => {
        console.warn('[Home] Failed to persist selected location:', error);
      });

      // Close modal immediately for better UX
      setShowLocationModal(false);
      setCitySearchInput('');
      setCitySuggestions([]);
      setCitySearchError(null);
    },
    [setUserLocation, updateLocation]
  );

  const { filteredListingsByLocation, allNearYouListings } = useMemo(() => {
    if (!userLat || !userLon) {
      return {
        filteredListingsByLocation: isLocationBootstrapActive ? [] : visibleListings,
        allNearYouListings: [] as (typeof listings)[0][],
      };
    }

    const withinRadius: { listing: (typeof listings)[0]; distance: number }[] = [];
    for (const listing of visibleListings) {
      const distance = distanceByListingId.get(listing.id);
      if (distance === undefined) continue;
      if (distance <= selectedSearchRadiusKm) {
        withinRadius.push({ listing, distance });
      }
    }

    return {
      filteredListingsByLocation: withinRadius.map((entry) => entry.listing),
      allNearYouListings: [...withinRadius]
        .sort((a, b) => a.distance - b.distance)
        .map((entry) => entry.listing),
    };
  }, [
    distanceByListingId,
    isLocationBootstrapActive,
    visibleListings,
    userLat,
    userLon,
    selectedSearchRadiusKm,
  ]);

  const nearYouListings = useMemo(() => allNearYouListings, [allNearYouListings]);
  const showNearYouSection = nearYouListings.length > 0;

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadBroadDealListings = async () => {
      try {
        const response = await fetch(
          `${getApiUrl()}/api/listings?limit=100&dealsOnly=1&includeExpiredDeals=1`,
          { signal: controller.signal }
        );
        if (!response.ok) return;

        const payload = (await response.json()) as {
          data?: unknown[];
          results?: unknown[];
        };
        const normalized = normalizeDealItems(payload.data || payload.results || []);

        if (active) {
          setBroadDealListings(normalized);
        }
      } catch (error) {
        if (active && !(error instanceof Error && error.name === 'AbortError')) {
          setBroadDealListings([]);
        }
      }
    };

    void loadBroadDealListings();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const homeCategories = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const listing of filteredListingsByLocation) {
      const category = listing.category;
      counts.set(category, (counts.get(category) || 0) + 1);
    }

    const backendOrdered = orderedCategories
      .map((category) => ({ category, count: counts.get(category) || 0 }))
      .filter((entry) => entry.count > 0);
    const uncatalogued = Array.from(counts.entries())
      .filter(([category]) => !orderedCategories.includes(category))
      .map(([category, count]) => ({ category, count }));

    return [...backendOrdered, ...uncatalogued].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredListingsByLocation, orderedCategories]);

  const homeListingsForGrid = useMemo(() => {
    if (selectedCategory === 'All') return filteredListingsByLocation;
    return filteredListingsByLocation.filter((listing) => listing.category === selectedCategory);
  }, [filteredListingsByLocation, selectedCategory]);

  const activeListingsForGrid = homeListingsForGrid;
  const hasLocation = Boolean(userLat && userLon);
  const onRefresh = useCallback(async () => {
    await Promise.all([refreshListings(), refreshBanners()]);
  }, [refreshListings, refreshBanners]);

  const handleLoadMore = useCallback(async () => {
    if (
      !hasMore ||
      isLoading ||
      isFetchingMore ||
      isRefreshing ||
      activeListingsForGrid.length === 0
    ) {
      return;
    }

    await loadMore();
  }, [hasMore, isLoading, isFetchingMore, isRefreshing, loadMore, activeListingsForGrid.length]);

  const handleSave = useCallback(
    (id: string, category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);

      // Track save for personalization
      trackSave(id, category).catch(console.error);
    },
    [toggleSaved, trackSave]
  );

  const handleBookDeal = useCallback(
    async (listingId: string) => {
      if (!isAuthenticated || !user?.id) {
        Alert.alert('Sign in required', 'Please sign in to book a deal.');
        router.push('/auth/register');
        return;
      }

      setBookingId(listingId);
      try {
        await bookDeal(listingId, user.id, user.phone || undefined);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Deal booked', 'Your deal booking has been created successfully.', [
          { text: 'OK' },
        ]);
      } catch (error) {
        if (error instanceof DealBookingError && error.code === 'ALREADY_BOOKED') {
          Alert.alert('Already booked', 'You already booked this deal.', [
            { text: 'OK' },
            { text: 'View bookings', onPress: () => router.push('/bookings') },
          ]);
          return;
        }
        Alert.alert('Booking failed', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setBookingId(null);
      }
    },
    [isAuthenticated, user?.id, user?.phone]
  );

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const statusStripHeight = Platform.OS === 'web' ? webTopInset : Math.max(insets.top, 12);
  const tabAwareBottomPadding = getTabOverlayContentPadding(insets.bottom, 20);
  const alignedResultCardWidth = useMemo(
    () => (SCREEN_WIDTH - HOME_HORIZONTAL_INSET * 2 - HOME_RAIL_GAP * 3) / 4,
    []
  );
  const listingGridData = useMemo(
    () =>
      activeListingsForGrid.length % 2 === 0
        ? activeListingsForGrid
        : [
            ...activeListingsForGrid,
            { id: '__spacer__', __placeholder: true } as unknown as (typeof listings)[0],
          ],
    [activeListingsForGrid]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listings)[0]; index: number }) => {
      const typedItem = item as (typeof listings)[0] & { __placeholder?: boolean };
      const columnStyle = index % 2 === 0 ? styles.leftColumn : styles.rightColumn;
      if (typedItem.__placeholder) {
        return <View style={[columnStyle, styles.placeholderColumn]} pointerEvents="none" />;
      }

      return (
        <View style={columnStyle}>
          <ListingCard
            id={item.id}
            title={item.title}
            titleMaxChars={28}
            description={item.description}
            price={Number(item.price) || 0}
            offerPrice={hasValidOfferPrice(item) ? Number(item.offerPrice) : undefined}
            priceUnit={item.priceUnit}
            image={item.images[0]}
            imageAspectRatio={1}
            location={item.location.city}
            condition={formatCondition(item.condition)}
            sellerVerified={Boolean(item.sellerVerified)}
            isBoosted={Boolean(item.featured)}
            isSponsored={Boolean((item as any).sponsored)}
            isSaved={savedIds.has(item.id)}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
            onSave={() => handleSave(item.id, item.category)}
            onShare={() => shareListingLink({ listingId: item.id, listingTitle: item.title })}
          />
        </View>
      );
    },
    [savedIds, handleSave]
  );

  const renderCompactRailCard = useCallback(
    (
      item: (typeof listings)[0],
      options?: {
        showDistance?: boolean;
        showFeaturedBadge?: boolean;
        badgeLabel?: string;
      }
    ) => {
      const basePrice = Number(item.price) || 0;
      const displayPrice = hasValidOfferPrice(item) ? Number(item.offerPrice) : basePrice;
      const discountPercent = getDiscountPercent(item);
      const itemDistanceKm = distanceByListingId.get(item.id);

      return (
        <Pressable
          key={item.id}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          style={[styles.featuredCard, { width: alignedResultCardWidth }]}
        >
          <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(10, 18, 36, 0)', 'rgba(10, 18, 36, 0.32)', 'rgba(10, 18, 36, 0.85)']}
            style={styles.cardMediaOverlay}
          />
          {options?.badgeLabel ? (
            <View style={styles.cardLabelBadge}>
              <Text style={styles.cardLabelBadgeText}>{options.badgeLabel}</Text>
            </View>
          ) : null}
          {discountPercent ? (
            <View style={styles.cardDiscountBadge}>
              <Text style={styles.cardDiscountBadgeText}>{discountPercent}% OFF</Text>
            </View>
          ) : null}
          <View style={styles.cardInfoOverlay}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.cardPriceRow}>
              <Text style={styles.cardPrice} numberOfLines={1}>
                ₹{displayPrice.toLocaleString('en-IN')}
              </Text>
              {hasValidOfferPrice(item) ? (
                <Text style={styles.cardOriginalPrice} numberOfLines={1}>
                  ₹{basePrice.toLocaleString('en-IN')}
                </Text>
              ) : null}
            </View>
            {options?.showDistance ? (
              <Text style={styles.cardDistance}>
                {userLat && userLon && typeof itemDistanceKm === 'number'
                  ? Math.round(itemDistanceKm)
                  : '?'}{' '}
                km away
              </Text>
            ) : null}
          </View>
          {options?.showFeaturedBadge ? (
            <View style={styles.cardBadgeStack}>
              {Boolean(item.sellerVerified) ? (
                <View style={[styles.cardBadge, styles.verifiedBadge]}>
                  <Feather name="check-circle" size={10} color="#FFFFFF" />
                </View>
              ) : null}
              <View style={styles.cardBadge}>
                <Ionicons name="rocket" size={10} color="#FFFFFF" />
              </View>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [alignedResultCardWidth, distanceByListingId, userLat, userLon]
  );

  const dealListings = useMemo(() => listings.filter((item) => Boolean(item.isDeal)), [listings]);

  const mappedDeals = useMemo(() => {
    return dealListings
      .filter((item) => Boolean(item.isDeal))
      .map((item) => {
        const window = getEffectiveDealWindow(item, nowMs);
        const distanceKm =
          typeof userLat === 'number' && typeof userLon === 'number'
            ? calculateDistance(userLat, userLon, item.location.latitude, item.location.longitude)
            : undefined;
        const displayPrice =
          typeof item.offerPrice === 'number' && item.offerPrice > 0 && item.offerPrice < item.price
            ? item.offerPrice
            : item.price;
        const originalPrice = displayPrice !== item.price ? item.price : undefined;

        return {
          id: item.id,
          title: item.title,
          price: displayPrice,
          originalPrice,
          image: item.images[0] || '',
          images: item.images || [],
          location: item.location.city,
          distance: formatDistanceLabel(distanceKm),
          sortDistanceKm: distanceKm,
          dealEndsAt: window?.endMs,
          dealStatus: formatDealStatus(item, nowMs),
          comboItems: item.comboItems,
          badge: isDealActiveNow(item, nowMs) ? 'Deal' : undefined,
          voucherEnabled: item.voucherEnabled,
          dealType: item.dealType,
        } satisfies HomeDealItem;
      })
      .sort((a, b) => {
        const distanceA =
          typeof a.sortDistanceKm === 'number' && Number.isFinite(a.sortDistanceKm)
            ? a.sortDistanceKm
            : Number.POSITIVE_INFINITY;
        const distanceB =
          typeof b.sortDistanceKm === 'number' && Number.isFinite(b.sortDistanceKm)
            ? b.sortDistanceKm
            : Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      });
  }, [dealListings, nowMs, userLat, userLon]);

  const todaysDeals = useMemo(
    () =>
      mappedDeals
        .filter((item) => item.dealType !== 'combo')
        .filter((item) => {
          const source = listings.find((listing) => listing.id === item.id);
          return source ? isDealActiveNow(source, nowMs) : false;
        })
        .sort((a, b) => Number(a.dealEndsAt || 0) - Number(b.dealEndsAt || 0))
        .slice(0, 6),
    [listings, mappedDeals, nowMs]
  );

  const upcomingDeals = useMemo(
    () =>
      mappedDeals.filter((item) => {
        const source = listings.find((listing) => listing.id === item.id);
        return source ? isDealUpcoming(source, nowMs) : false;
      }),
    [listings, mappedDeals, nowMs]
  );

  const broadUpcomingDeals = useMemo(
    () =>
      normalizeDealItems(broadDealListings)
        .filter((item) => isDealUpcoming(item, nowMs))
        .map((item) => {
          const window = getEffectiveDealWindow(item, nowMs);
          const distanceKm =
            typeof userLat === 'number' && typeof userLon === 'number'
              ? calculateDistance(userLat, userLon, item.location.latitude, item.location.longitude)
              : undefined;
          const displayPrice =
            typeof item.offerPrice === 'number' &&
            item.offerPrice > 0 &&
            item.offerPrice < item.price
              ? item.offerPrice
              : item.price;
          const originalPrice = displayPrice !== item.price ? item.price : undefined;

          return {
            id: item.id,
            title: item.title,
            price: displayPrice,
            originalPrice,
            image: item.images[0] || '',
            images: item.images || [],
            location: item.location.city,
            distance: formatDistanceLabel(distanceKm),
            sortDistanceKm: distanceKm,
            dealEndsAt: window?.endMs,
            dealStatus: formatDealStatus(item, nowMs),
            comboItems: item.comboItems,
            badge: isDealActiveNow(item, nowMs) ? 'Deal' : undefined,
            voucherEnabled: item.voucherEnabled,
            dealType: item.dealType,
          } satisfies HomeDealItem;
        })
        .sort((a, b) => {
          const distanceA =
            typeof a.sortDistanceKm === 'number' && Number.isFinite(a.sortDistanceKm)
              ? a.sortDistanceKm
              : Number.POSITIVE_INFINITY;
          const distanceB =
            typeof b.sortDistanceKm === 'number' && Number.isFinite(b.sortDistanceKm)
              ? b.sortDistanceKm
              : Number.POSITIVE_INFINITY;
          return distanceA - distanceB;
        }),
    [broadDealListings, nowMs, userLat, userLon]
  );

  const displayUpcomingDeals = upcomingDeals.length > 0 ? upcomingDeals : broadUpcomingDeals;

  const comboDeals = useMemo(
    () =>
      mappedDeals.filter((item) => {
        const source = listings.find((listing) => listing.id === item.id);
        return item.dealType === 'combo' && source ? isDealActiveNow(source, nowMs) : false;
      }),
    [listings, mappedDeals, nowMs]
  );

  const expiredDeals = useMemo(
    () =>
      mappedDeals
        .filter((item) => {
          const source = listings.find((listing) => listing.id === item.id);
          return source ? isDealExpired(source, nowMs) : false;
        })
        .sort((a, b) => Number(b.dealEndsAt || 0) - Number(a.dealEndsAt || 0))
        .slice(0, 6),
    [listings, mappedDeals, nowMs]
  );

  const renderDealRailCard = useCallback(
    (
      item: HomeDealItem,
      options?: {
        showBadge?: boolean;
        combo?: boolean;
      }
    ) => {
      const basePrice = Number(item.originalPrice || item.price);
      const displayPrice = Number(item.price) || 0;
      const discountPercent = getDiscountPercent({ price: basePrice, offerPrice: displayPrice });

      return (
        <Pressable
          key={item.id}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          style={[styles.dealCard, options?.combo && styles.comboDealCard]}
        >
          <View style={styles.dealCardMedia}>
            <Image source={{ uri: item.image }} style={styles.dealCardImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(10, 18, 36, 0)', 'rgba(10, 18, 36, 0.22)', 'rgba(10, 18, 36, 0.88)']}
              style={styles.dealCardOverlay}
            />
            {options?.showBadge && item.badge ? (
              <View style={styles.dealBadgePill}>
                <Text style={styles.dealBadgeText}>{item.badge}</Text>
              </View>
            ) : null}
            {discountPercent ? (
              <View style={styles.dealDiscountPill}>
                <Text style={styles.dealDiscountText}>{discountPercent}% OFF</Text>
              </View>
            ) : null}
            {options?.combo ? (
              <View style={styles.comboDealPill}>
                <Ionicons name="layers" size={11} color="#FFFFFF" />
                <Text style={styles.comboDealPillText}>Combo</Text>
              </View>
            ) : null}
            <View style={styles.dealCardTopRight}>
              {Boolean(item.voucherEnabled) ? (
                <View style={styles.dealMicroBadge}>
                  <Feather name="tag" size={9} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.dealCardBody}>
            <Text style={styles.dealCardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {options?.combo && item.comboItems?.length ? (
              <Text style={styles.dealCardSubtitle} numberOfLines={1}>
                {item.comboItems.slice(0, 2).join(' + ')}
              </Text>
            ) : null}
            <View style={styles.dealPriceRow}>
              <View style={styles.dealPriceStack}>
                <Text
                  style={styles.dealPrice}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  ₹{displayPrice.toLocaleString('en-IN')}
                </Text>
                {item.originalPrice ? (
                  <Text
                    style={styles.dealOriginalPrice}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    ₹{basePrice.toLocaleString('en-IN')}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.dealMetaRow}>
              <Feather name="map-pin" size={11} color={Colors.textTertiary} />
              <Text style={styles.dealDistanceText} numberOfLines={1}>
                {item.distance}
              </Text>
            </View>
            <View style={styles.dealStatusPanel}>
              <Text style={styles.dealStatusLabel}>Deal status</Text>
              <Text style={styles.dealStatusValue} numberOfLines={1}>
                {item.dealStatus || 'Active deal'}
              </Text>
            </View>
            {item.dealStatus.startsWith('Ends in') ? (
              <Pressable
                style={[
                  styles.dealBookButton,
                  bookingId === item.id && styles.dealBookButtonDisabled,
                ]}
                onPress={() => handleBookDeal(item.id)}
                disabled={bookingId === item.id}
              >
                {bookingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dealBookButtonText}>Book Deal</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [bookingId, handleBookDeal, nowMs]
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={[styles.topEdgeCover, { height: statusStripHeight + 2 }]} />
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />
      <FlatList
        data={listingGridData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabAwareBottomPadding }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        initialNumToRender={HOME_LIST_INITIAL_RENDER}
        maxToRenderPerBatch={HOME_LIST_MAX_BATCH}
        windowSize={HOME_LIST_WINDOW_SIZE}
        updateCellsBatchingPeriod={48}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.homeHeader}>
              <View style={[styles.statusBarTopStrip, { height: statusStripHeight }]} />
              <LinearGradient
                colors={['#E9F4FF', '#F7FBFF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.homeHeaderGradient}
              >
                <View style={styles.homeHeaderTopRow}>
                  <Pressable style={styles.logoWrap} onPress={() => router.replace('/(tabs)')}>
                    <Logo size="md" showText={true} />
                  </Pressable>

                  <Pressable style={styles.locationPill} onPress={() => setShowLocationModal(true)}>
                    <View style={styles.locationPinBadge}>
                      <Feather name="map-pin" size={11} color="#FFFFFF" />
                    </View>
                    {isAutoLocatingUser ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color={Colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <View style={styles.locationTextWrap}>
                          <Text style={styles.locationPillText}>Detecting location...</Text>
                          <Text style={styles.locationPillSubtext}>Please wait</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.locationTextWrap}>
                          <Text style={styles.locationPillText} numberOfLines={1}>
                            {userCity}
                          </Text>
                          <Text style={styles.locationPillSubtext} numberOfLines={1}>
                            Within {Math.round(selectedSearchRadiusKm)} km
                          </Text>
                        </View>
                        <Feather name="chevron-down" size={13} color={Colors.textSecondary} />
                      </>
                    )}
                  </Pressable>
                </View>

                <View style={styles.searchBarContainer}>
                  <Pressable
                    style={styles.searchBar}
                    onPress={() =>
                      router.push({
                        pathname: '/search',
                        params: {
                          lat: userLat?.toString() || '',
                          lon: userLon?.toString() || '',
                          pincode: '',
                          category: selectedCategory,
                          radius: selectedSearchRadiusKm.toString(),
                        },
                      })
                    }
                  >
                    <Feather name="search" size={16} color={Colors.textTertiary} />
                    <Text style={styles.searchPlaceholder} numberOfLines={1}>
                      Search listings near you
                    </Text>
                    <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
                  </Pressable>
                  <NotificationBell />
                </View>
              </LinearGradient>
            </View>

            {/* App Screen Banners (Admin-uploaded) */}
            <AppScreenBanners banners={homeBanners} isLoading={isHomeBannersLoading} />

            {showNearYouSection ? (
              <View style={styles.nearYouSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Feather name="map-pin" size={16} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Near You</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/home-section-list',
                        params: {
                          section: 'nearby',
                          lat: userLat?.toString() || '',
                          lon: userLon?.toString() || '',
                          radius: selectedSearchRadiusKm.toString(),
                          city: userCity,
                        },
                      })
                    }
                    style={styles.viewAllButton}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.nearYouScroll}
                  contentContainerStyle={styles.horizontalResultsContent}
                >
                  {nearYouListings.map((item) =>
                    renderCompactRailCard(item, { showDistance: true })
                  )}
                </ScrollView>
              </View>
            ) : null}

            {todaysDeals.length > 0 ? (
              <View style={styles.dealsSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Feather name="tag" size={16} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Deals</Text>
                  </View>
                  <Pressable onPress={() => router.push('/deals')} style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </Pressable>
                </View>
                <Text style={styles.sectionSubtext}>Live offers ending soon near you</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dealRailContent}
                >
                  {todaysDeals.map((item) => renderDealRailCard(item, { showBadge: true }))}
                </ScrollView>
              </View>
            ) : null}

            {comboDeals.length > 0 ? (
              <View style={styles.dealsSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="layers" size={16} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Combo Deals</Text>
                  </View>
                  <Pressable onPress={() => router.push('/deals')} style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </Pressable>
                </View>
                <Text style={styles.sectionSubtext}>Bundle offers with extra savings</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dealRailContent}
                >
                  {comboDeals.map((item) =>
                    renderDealRailCard(item, { showBadge: true, combo: true })
                  )}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.dealsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Feather name="clock" size={16} color="#F97316" />
                  <Text style={styles.sectionTitle}>Up Coming Deals</Text>
                </View>
                <Pressable onPress={() => router.push('/deals')} style={styles.viewAllButton}>
                  <Text style={styles.viewAllText}>View All</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionSubtext}>Deals starting soon, sorted by proximity</Text>
              {displayUpcomingDeals.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dealRailContent}
                >
                  {displayUpcomingDeals.map((item) => renderDealRailCard(item))}
                </ScrollView>
              ) : (
                <View style={styles.dealEmptyState}>
                  <Text style={styles.dealEmptyStateText}>
                    No upcoming deals are available right now.
                  </Text>
                </View>
              )}
            </View>

            {expiredDeals.length > 0 ? (
              <View style={styles.dealsSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Feather name="clock" size={16} color={Colors.textSecondary} />
                    <Text style={styles.sectionTitle}>Expired Deals</Text>
                  </View>
                  <Pressable onPress={() => router.push('/deals')} style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </Pressable>
                </View>
                <Text style={styles.sectionSubtext}>
                  Closed offers are still visible for reference
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dealRailContent}
                >
                  {expiredDeals.map((item) => renderDealRailCard(item))}
                </ScrollView>
              </View>
            ) : null}

            {homeCategories.length > 0 ? (
              <View style={styles.categorySection}>
                <View style={styles.sectionHeaderCompact}>
                  <View style={styles.sectionHeaderLeft}>
                    <Feather name="grid" size={16} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Categories</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  <Pressable
                    style={[
                      styles.categoryChip,
                      selectedCategory === 'All' && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory('All')}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === 'All' && styles.categoryChipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </Pressable>
                  {homeCategories.map(({ category, count }) => (
                    <Pressable
                      key={category}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory === category && styles.categoryChipTextActive,
                        ]}
                      >
                        {category} ({count})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !isLoading && activeListingsForGrid.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Feather
                name={hasLocation ? 'inbox' : 'map-pin'}
                size={48}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptyStateTitle}>
                {hasLocation ? 'No Listings Found' : 'Set Your Location'}
              </Text>
              <Text style={styles.emptyStateText}>
                {hasLocation
                  ? 'No listings found in your area. Try adjusting your location, radius, or category.'
                  : 'Use the location selector to detect or choose your city and see nearby listings.'}
              </Text>
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          activeListingsForGrid.length > 0 && hasMore && isFetchingMore ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading more listings...</Text>
            </View>
          ) : !hasMore && activeListingsForGrid.length > 0 ? (
            <View style={styles.endOfListFooter}>
              <Feather name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.endOfListText}>You're all caught up on listings</Text>
            </View>
          ) : null
        }
      />

      {/* Location Selection Overlay */}
      {showLocationModal && (
        <View style={styles.locationOverlay}>
          <View style={styles.locationFullPage}>
            {/* Header bar */}
            <View style={styles.locationHeader}>
              <Pressable
                style={styles.locationBackButton}
                onPress={() => {
                  setShowLocationModal(false);
                  setCitySearchInput('');
                  setCitySuggestions([]);
                  setCitySearchError(null);
                }}
              >
                <Feather name="arrow-left" size={24} color={Colors.text} />
              </Pressable>
              <Text style={styles.locationHeaderTitle}>Select Location</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <ScrollView
              style={styles.locationPageContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <Text style={styles.locationDescription}>
                Change your location to find listings within {selectedSearchRadiusKm} km
              </Text>

              {/* City Search Input */}
              <View style={styles.pincodeSearchContainer}>
                <Feather
                  name="map-pin"
                  size={18}
                  color={Colors.primary}
                  style={styles.pincodeSearchIcon}
                />
                <TextInput
                  ref={cityInputRef}
                  style={styles.pincodeSearchInput}
                  placeholder="Enter City or Pincode"
                  placeholderTextColor={Colors.textTertiary}
                  value={citySearchInput}
                  onChangeText={setCitySearchInput}
                  autoFocus={true}
                />
                {citySearchInput.trim().length > 0 && (
                  <Pressable
                    onPress={() => {
                      setCitySearchInput('');
                      setCitySuggestions([]);
                      setCitySearchError(null);
                    }}
                    style={styles.pincodeSearchClear}
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.citySuggestionsContainer}>
                {isSearchingCities ? (
                  <View style={styles.citySearchLoading}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.citySearchLoadingText}>Searching locations...</Text>
                  </View>
                ) : null}
                {citySuggestions.length > 0 ? (
                  citySuggestions.map((city) => (
                    <Pressable
                      key={`${city.pincode}-${city.locationName}`}
                      style={styles.citySuggestionItem}
                      onPress={() => selectCityAndSetLocation(city)}
                    >
                      <View style={styles.citySuggestionTextWrap}>
                        <Text style={styles.citySuggestionName}>{city.locationName}</Text>
                        <Text style={styles.citySuggestionMeta}>
                          {city.district ? `${city.district}, ${city.state}` : city.state}
                          {city.pincode ? ` • ${city.pincode}` : ''}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
                    </Pressable>
                  ))
                ) : citySearchInput.trim().length === 0 ? null : (
                  <View style={styles.noCityResults}>
                    <Text style={styles.noCityResultsText}>
                      {citySearchError
                        ? citySearchError
                        : /^\d+$/.test(citySearchInput.trim()) && citySearchInput.trim().length < 6
                          ? 'Enter full 6-digit pincode'
                          : !/^\d+$/.test(citySearchInput.trim()) &&
                              citySearchInput.trim().length < 2
                            ? 'Type at least 2 letters to search city'
                            : 'No matching locations found'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Auto-detect Current Location Button */}
              <Pressable
                style={[
                  styles.autoDetectButton,
                  isAutoDetectingLocation && styles.autoDetectButtonDisabled,
                ]}
                onPress={() =>
                  autoDetectLocation(setIsAutoDetectingLocation, () => {
                    setShowLocationModal(false);
                    setCitySearchInput('');
                  })
                }
                disabled={isAutoDetectingLocation}
              >
                {isAutoDetectingLocation ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.autoDetectButtonText}>Detecting...</Text>
                  </>
                ) : (
                  <>
                    <Feather name="navigation" size={16} color="#FFFFFF" />
                    <Text
                      style={[styles.autoDetectButtonText, styles.autoDetectButtonTextWithIcon]}
                    >
                      Use Current Location
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.radiusControlsSection}>
                <Text style={styles.radiusSectionTitle}>Search Coverage Radius</Text>
                <Text style={styles.radiusSectionSubtitle}>Admin default: {geoRadiusKm} km</Text>

                <View style={styles.radiusActionsRow}>
                  <Pressable
                    style={styles.radiusStepButton}
                    onPress={() => applySearchRadius(selectedSearchRadiusKm - 5)}
                    disabled={selectedSearchRadiusKm <= MIN_RADIUS_KM}
                  >
                    <Feather name="minus" size={18} color={Colors.primary} />
                  </Pressable>

                  <View style={styles.radiusValuePill}>
                    <Text style={styles.radiusValueText}>{selectedSearchRadiusKm} km</Text>
                  </View>

                  <Pressable
                    style={styles.radiusStepButton}
                    onPress={() => applySearchRadius(selectedSearchRadiusKm + 5)}
                    disabled={selectedSearchRadiusKm >= MAX_RADIUS_KM}
                  >
                    <Feather name="plus" size={18} color={Colors.primary} />
                  </Pressable>
                </View>

                <View style={styles.radiusPresetRow}>
                  {[25, 100, 200, 500].map((radiusKm) => (
                    <Pressable
                      key={radiusKm}
                      style={[
                        styles.radiusPresetChip,
                        selectedSearchRadiusKm === radiusKm && styles.radiusPresetChipActive,
                      ]}
                      onPress={() => applySearchRadius(radiusKm)}
                    >
                      <Text
                        style={[
                          styles.radiusPresetChipText,
                          selectedSearchRadiusKm === radiusKm && styles.radiusPresetChipTextActive,
                        ]}
                      >
                        {radiusKm} km
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Coverage Info */}
              <View style={styles.coverageInfoBox}>
                <View style={styles.coverageIconContainer}>
                  <Feather name="map-pin" size={16} color={Colors.success} />
                </View>
                <View style={styles.coverageTextContainer}>
                  <Text style={styles.coverageTitle}>Search Coverage</Text>
                  <Text style={styles.coverageText}>
                    Find listings within {selectedSearchRadiusKm} km from your selected city.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topEdgeCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    zIndex: 200,
    elevation: 200,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTop: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  aiBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  homeHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    marginBottom: 8,
    marginHorizontal: -12,
  },
  homeHeaderGradient: {
    paddingBottom: 8,
  },
  statusBarTopStrip: {
    backgroundColor: '#0F172A',
  },
  homeHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  locationPill: {
    maxWidth: '52%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(10,102,194,0.22)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#0A66C2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  locationPinBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  locationTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  locationPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#0B1D30',
  },
  locationPillSubtext: {
    marginTop: 0,
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#5C6F82',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    marginTop: 2,
  },
  nearhubPromoSection: {
    marginBottom: 6,
  },
  nearhubPromoTrack: {
    paddingHorizontal: 0,
    gap: 0,
  },
  nearhubPromoBanner: {
    borderRadius: 0,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
    gap: 8,
  },
  nearhubPromoAccent: {
    position: 'absolute',
    right: -40,
    top: -46,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.28,
  },
  nearhubPromoAccentSecondary: {
    position: 'absolute',
    left: -34,
    bottom: -48,
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.2,
  },
  nearhubPromoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.surface,
    alignSelf: 'flex-start',
  },
  nearhubPromoEyebrow: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.surface,
    letterSpacing: 0.8,
  },
  nearhubPromoTitle: {
    fontSize: 21,
    fontFamily: 'Inter_700Bold',
    color: Colors.surface,
    lineHeight: 28,
  },
  nearhubPromoBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    maxWidth: '88%',
  },
  nearhubPromoSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.surface,
    lineHeight: 20,
    opacity: 0.92,
  },
  nearhubFeaturePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  nearhubFeatureText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primaryDark,
  },
  promoPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  promoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  promoDotActive: {
    width: 18,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(10,102,194,0.2)',
    justifyContent: 'space-between',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categorySection: {
    marginTop: 4,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  nearYouSection: {
    marginTop: 6,
    marginBottom: 6,
  },
  dealsSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    marginBottom: 6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  sectionSubtext: {
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    marginTop: -2,
    marginBottom: 8,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  viewAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  nearYouScroll: {
    marginTop: 0,
  },
  dealRailContent: {
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    gap: 6,
  },
  dealEmptyState: {
    marginHorizontal: HOME_HORIZONTAL_INSET,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  dealEmptyStateText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  dealCard: {
    width: 176,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(10,102,194,0.16)',
    marginRight: 6,
  },
  comboDealCard: {
    width: 188,
  },
  dealCardMedia: {
    position: 'relative',
    aspectRatio: 0.84,
    backgroundColor: '#E9F4FF',
  },
  dealCardImage: {
    width: '100%',
    height: '100%',
  },
  dealCardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dealBadgePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
  },
  dealDiscountPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    shadowColor: '#7F1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  dealDiscountText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
  },
  comboDealPill: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 18, 36, 0.75)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  comboDealPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
  },
  dealCardTopRight: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dealMicroBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  dealCardBody: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  dealCardTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  dealCardSubtitle: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  dealPriceRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    marginTop: 4,
    minWidth: 0,
  },
  dealPriceStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  dealPrice: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  dealOriginalPrice: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  dealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dealDistanceText: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  dealStatusPanel: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: 'rgba(10,102,194,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  dealStatusLabel: {
    fontSize: 8,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  dealStatusValue: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#F59E0B',
  },
  dealBookButton: {
    marginTop: 6,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#0759e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealBookButtonDisabled: {
    opacity: 0.7,
  },
  dealBookButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  cardImage: {
    width: '100%',
    aspectRatio: LISTING_IMAGE_ASPECT_RATIO,
  },
  cardMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardInfoOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  cardLabelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cardLabelBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  cardDiscountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#7F1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDiscountBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  cardPrice: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#CFE5FF',
    flexShrink: 0,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 3,
    marginTop: 3,
    minWidth: 0,
  },
  cardOriginalPrice: {
    fontSize: 8,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  cardDistance: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  featuredCard: {
    backgroundColor: '#0B1D30',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardBadgeStack: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'flex-end',
    gap: 4,
  },
  cardBadge: {
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    backgroundColor: '#0F766E',
  },
  allListingsSectionHeader: {
    marginTop: 2,
    marginBottom: 6,
  },
  sectionHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    marginBottom: 2,
  },
  allListingsSectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    marginTop: -2,
  },
  listContent: {
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    paddingVertical: 6,
  },
  horizontalResultsContent: {
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    gap: HOME_RAIL_GAP,
  },
  row: {
    gap: 6,
    justifyContent: 'flex-start',
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  placeholderColumn: {
    opacity: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  endOfListFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 18,
  },
  endOfListText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  emptyStateContainer: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Location overlay styles
  locationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  locationFullPage: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 48,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  locationBackButton: {
    padding: 8,
  },
  locationHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  locationPageContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  locationDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  radiusControlsSection: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  radiusSectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  radiusSectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  radiusActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  radiusStepButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  radiusValuePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 102, 194, 0.08)',
  },
  radiusValueText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  radiusPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  radiusPresetChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(10, 102, 194, 0.12)',
  },
  radiusPresetChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  radiusPresetChipTextActive: {
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  pincodeSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  pincodeSearchIcon: {
    marginRight: 10,
  },
  pincodeSearchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
    minHeight: 44,
    paddingVertical: 0,
  },
  pincodeSearchClear: {
    padding: 4,
  },
  citySuggestionsContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  citySearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  citySearchLoadingText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  citySuggestionItem: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  citySuggestionTextWrap: {
    flex: 1,
  },
  citySuggestionName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  citySuggestionMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  noCityResults: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noCityResultsText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  searchPincodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 20,
    gap: 8,
  },
  searchPincodeButtonPressed: {
    opacity: 0.8,
  },
  searchPincodeButtonDisabled: {
    opacity: 0.5,
  },
  searchPincodeButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  autoDetectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 9,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  autoDetectButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  autoDetectButtonDisabled: {
    opacity: 0.7,
  },
  autoDetectButtonText: {
    fontSize: 14.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  autoDetectButtonTextWithIcon: {
    marginLeft: 8,
  },
  autoDetectTextWrap: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
  },
  autoDetectCoverageText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.86)',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
  coverageInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1.5,
    borderColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 12,
    gap: 12,
  },
  coverageIconContainer: {
    paddingTop: 2,
  },
  coverageTextContainer: {
    flex: 1,
  },
  coverageTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
    marginBottom: 2,
  },
  coverageText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
