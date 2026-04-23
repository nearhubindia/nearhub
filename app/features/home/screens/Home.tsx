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
  KeyboardAvoidingView,
  BackHandler,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import { getTabOverlayContentPadding } from '@/constants/layout';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import { hasValidOfferPrice, isNewProductDeal, isRestaurantDeal } from '@/lib/deals';
import { calculateDistance } from '@/lib/location-data';
import { Category } from '@/lib/types';
import { formatCondition } from '@/lib/utils';
import ListingCard from '@/shared/components/ListingCard';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { Logo } from '@/shared/components/Logo';
import BrandWordmark from '@/shared/components/BrandWordmark';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { getApiUrl } from '@/lib/query-client';
import { useAdminSettings } from '@/lib/use-admin-settings';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { createResponsiveStyles } from '@/lib/responsive';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOME_HORIZONTAL_INSET = 10;
const HOME_RAIL_GAP = 3;

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
  const { user, setUserSearchRadius } = useAuth();
  const { interests, trackSave } = useUserInterests();
  const { geoRadiusKm } = useAdminSettings();
  const {
    banners: homeBanners,
    isLoading: isHomeBannersLoading,
    refreshBanners,
  } = useAppScreenBanners('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  // Location selection state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [citySearchInput, setCitySearchInput] = useState('');
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [selectedLocationCity, setSelectedLocationCity] = useState<string | null>(null);
  const [selectedLocationLat, setSelectedLocationLat] = useState<number | null>(null);
  const [selectedLocationLon, setSelectedLocationLon] = useState<number | null>(null);
  const [selectedSearchRadiusKm, setSelectedSearchRadiusKm] = useState<number>(geoRadiusKm);
  const [isAutoLocatingUser, setIsAutoLocatingUser] = useState(false);
  const [isAutoDetectingLocation, setIsAutoDetectingLocation] = useState(false);
  const cityInputRef = useRef<TextInput>(null);
  const locationUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const userCity = selectedLocationCity || user?.location?.city || 'Your City';
  const userLat = selectedLocationLat ?? user?.location?.latitude;
  const userLon = selectedLocationLon ?? user?.location?.longitude;
  const effectiveGeoRadiusKm = user?.preferences?.searchRadiusKm ?? geoRadiusKm;
  const visibleListings = useMemo(
    () =>
      listings.filter((listing) => {
        const status = listing.status || 'active';
        if (status !== 'active') return false;
        if (listing.expiresAt && new Date(listing.expiresAt).getTime() < Date.now()) return false;
        return true;
      }),
    [listings]
  );

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
    }, 100); // Small delay to batch rapid changes
  }, []);

  useEffect(() => {
    let active = true;
    let abortController: AbortController | undefined;
    const query = citySearchInput.trim();
    const isNumericQuery = /^\d+$/.test(query);

    if (!query) {
      setCitySuggestions([]);
      setIsSearchingCities(false);
      return;
    }

    if (!isNumericQuery && query.length < 2) {
      setCitySuggestions([]);
      setIsSearchingCities(false);
      return;
    }

    if (isNumericQuery && query.length < 6) {
      setCitySuggestions([]);
      setIsSearchingCities(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearchingCities(true);
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
          } else {
            setCitySuggestions([]);
          }
        }
      } catch (error) {
        if (active && error instanceof Error && error.name !== 'AbortError') {
          setCitySuggestions([]);
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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setLoadingState(false);
          return;
        }

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

            // Use helper to batch state updates
            updateLocation(lastPosition.coords.latitude, lastPosition.coords.longitude, cityName);

            setLoadingState(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (onSuccess) onSuccess();
            return;
          }
        } catch (e) {
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

        // Use helper to batch state updates
        updateLocation(location.coords.latitude, location.coords.longitude, cityName);

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

  // Auto-fetch user location on app launch
  useEffect(() => {
    // Only try if we don't already have a location set
    if (selectedLocationLat !== null && selectedLocationLon !== null) {
      return;
    }

    autoDetectLocation(setIsAutoLocatingUser);
  }, []); // Only run once on mount

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
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

      // Close modal immediately for better UX
      setShowLocationModal(false);
      setCitySearchInput('');
      setCitySuggestions([]);
    },
    [updateLocation]
  );

  const filteredListingsByLocation = useMemo(() => {
    if (!userLat || !userLon) return visibleListings;
    // Filter listings within geoRadiusKm of selected location
    return visibleListings.filter((l) => {
      const distance = calculateDistance(
        userLat,
        userLon,
        l.location.latitude,
        l.location.longitude
      );
      return distance <= selectedSearchRadiusKm;
    });
  }, [visibleListings, userLat, userLon, selectedSearchRadiusKm]);

  const allNearYouListings = useMemo(() => {
    if (!userLat || !userLon) return [];
    return visibleListings
      .filter((l) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          l.location.latitude,
          l.location.longitude
        );
        return distance <= selectedSearchRadiusKm;
      })
      .sort((a, b) => {
        const distA = calculateDistance(
          userLat,
          userLon,
          a.location.latitude,
          a.location.longitude
        );
        const distB = calculateDistance(
          userLat,
          userLon,
          b.location.latitude,
          b.location.longitude
        );
        return distA - distB;
      });
  }, [visibleListings, userLat, userLon, selectedSearchRadiusKm]);

  const nearYouListings = useMemo(() => allNearYouListings.slice(0, 4), [allNearYouListings]);

  const allBoostedListings = useMemo(
    () => filteredListingsByLocation.filter((listing) => Boolean(listing.featured)),
    [filteredListingsByLocation]
  );
  const boostedListings = useMemo(() => allBoostedListings.slice(0, 4), [allBoostedListings]);
  const restaurantDeals = useMemo(
    () => allNearYouListings.filter((listing) => isRestaurantDeal(listing)).slice(0, 4),
    [allNearYouListings]
  );
  const newProductDeals = useMemo(
    () => allNearYouListings.filter((listing) => isNewProductDeal(listing)).slice(0, 4),
    [allNearYouListings]
  );

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshListings(), refreshBanners()]);
  }, [refreshListings, refreshBanners]);

  const handleLoadMore = useCallback(async () => {
    if (
      !hasMore ||
      isLoading ||
      isFetchingMore ||
      isRefreshing ||
      filteredListingsByLocation.length === 0
    ) {
      return;
    }

    await loadMore();
  }, [
    hasMore,
    isLoading,
    isFetchingMore,
    isRefreshing,
    loadMore,
    filteredListingsByLocation.length,
  ]);

  const handleSave = useCallback(
    (id: string, category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);

      // Track save for personalization
      trackSave(id, category).catch(console.error);
    },
    [toggleSaved, trackSave]
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
      filteredListingsByLocation.length % 2 === 0
        ? filteredListingsByLocation
        : [
            ...filteredListingsByLocation,
            { id: '__spacer__', __placeholder: true } as unknown as (typeof listings)[0],
          ],
    [filteredListingsByLocation, listings]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listings)[0]; index: number }) => {
      const columnStyle = index % 2 === 0 ? styles.leftColumn : styles.rightColumn;
      if ((item as any).__placeholder) {
        return <View style={[columnStyle, styles.placeholderColumn]} pointerEvents="none" />;
      }

      return (
        <View style={columnStyle}>
          <ListingCard
            id={item.id}
            title={item.title}
            titleMaxChars={28}
            description={item.description}
            price={item.price}
            offerPrice={item.offerPrice}
            priceUnit={item.priceUnit}
            image={item.images[0]}
            imageHeight={100}
            location={item.location.city}
            condition={formatCondition(item.condition)}
            sellerVerified={Boolean(item.sellerVerified)}
            isBoosted={Boolean(item.featured)}
            isSponsored={Boolean((item as any).sponsored)}
            isSaved={savedIds.has(item.id)}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
            onSave={() => handleSave(item.id, item.category)}
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

      return (
        <Pressable
          key={item.id}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          style={[styles.featuredCard, { width: alignedResultCardWidth }]}
        >
          <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
          {options?.badgeLabel ? (
            <View style={styles.cardLabelBadge}>
              <Text style={styles.cardLabelBadgeText}>{options.badgeLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>₹{displayPrice.toLocaleString('en-IN')}</Text>
            {hasValidOfferPrice(item) ? (
              <Text style={styles.cardOriginalPrice}>₹{basePrice.toLocaleString('en-IN')}</Text>
            ) : null}
          </View>
          {options?.showDistance ? (
            <Text style={styles.cardDistance}>
              {userLat && userLon
                ? Math.round(
                    calculateDistance(
                      userLat,
                      userLon,
                      item.location.latitude,
                      item.location.longitude
                    )
                  )
                : '?'}{' '}
              km away
            </Text>
          ) : null}
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
    [alignedResultCardWidth, userLat, userLon]
  );

  const renderEmptyRailState = useCallback((message: string) => {
    return (
      <View style={styles.emptyRailCard}>
        <Feather name="tag" size={18} color={Colors.primary} />
        <Text style={styles.emptyRailTitle}>No deals yet</Text>
        <Text style={styles.emptyRailText}>{message}</Text>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.topEdgeCover} />
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />
      <FlatList
        data={listingGridData}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabAwareBottomPadding }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
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
              <View style={styles.homeHeaderTopRow}>
                <Pressable style={styles.logoWrap} onPress={() => router.replace('/(tabs)')}>
                  <Logo size="md" showText={true} />
                </Pressable>

                <Pressable style={styles.locationPill} onPress={() => setShowLocationModal(true)}>
                  <Feather name="map-pin" size={13} color={Colors.primary} />
                  {isAutoLocatingUser ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color={Colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.locationPillText}>Detecting...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.locationPillText} numberOfLines={1}>
                        {userCity}
                      </Text>
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
                      pathname: '/search' as any,
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
                    Search Listing
                  </Text>
                  <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
                </Pressable>
                <NotificationBell />
              </View>
            </View>

            {/* App Screen Banners (Admin-uploaded) */}
            <AppScreenBanners banners={homeBanners} isLoading={isHomeBannersLoading} />

            {/* Near You Section */}
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
                {nearYouListings.length > 0
                  ? nearYouListings.map((item) =>
                      renderCompactRailCard(item, { showDistance: true })
                    )
                  : renderEmptyRailState('No nearby listings yet for this location.')}
              </ScrollView>
            </View>

            <View style={styles.featuredSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Feather name="coffee" size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Restaurant Deals</Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/home-section-list',
                      params: {
                        section: 'restaurantDeals',
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
                style={styles.featuredScroll}
                contentContainerStyle={styles.horizontalResultsContent}
              >
                {restaurantDeals.length > 0
                  ? restaurantDeals.map((item) =>
                      renderCompactRailCard(item, { showDistance: true, badgeLabel: 'Dining' })
                    )
                  : renderEmptyRailState('Food offers will appear here when sellers add them.')}
              </ScrollView>
            </View>

            <View style={styles.featuredSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Feather name="package" size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>New Product Deals</Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/home-section-list',
                      params: {
                        section: 'newProductDeals',
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
                style={styles.featuredScroll}
                contentContainerStyle={styles.horizontalResultsContent}
              >
                {newProductDeals.length > 0
                  ? newProductDeals.map((item) =>
                      renderCompactRailCard(item, { showDistance: true, badgeLabel: 'Brand New' })
                    )
                  : renderEmptyRailState('Fresh product discounts will be listed here.')}
              </ScrollView>
            </View>

            {/* Featured Deals Section */}
            <View style={styles.featuredSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Feather name="star" size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Featured Deals</Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/home-section-list',
                      params: {
                        section: 'featured',
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
                style={styles.featuredScroll}
                contentContainerStyle={styles.horizontalResultsContent}
              >
                {boostedListings.length > 0
                  ? boostedListings.map((item) =>
                      renderCompactRailCard(item, { showFeaturedBadge: true })
                    )
                  : renderEmptyRailState('Boosted and promoted listings will appear here.')}
              </ScrollView>
            </View>

            <View style={styles.allListingsSectionHeader}>
              <View style={styles.sectionHeaderCompact}>
                <View style={styles.sectionHeaderLeft}>
                  <Feather name="grid" size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>All Listings</Text>
                </View>
              </View>
              <Text style={styles.allListingsSectionSubtitle}>
                Showing listings within {selectedSearchRadiusKm} km of {userCity}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          !isLoading && filteredListingsByLocation.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Feather name="inbox" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Results Found</Text>
              <Text style={styles.emptyStateText}>
                No listings found in your area. Try adjusting your location or search radius.
              </Text>
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          filteredListingsByLocation.length > 0 && hasMore && isFetchingMore ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading more listings...</Text>
            </View>
          ) : !hasMore && filteredListingsByLocation.length > 0 ? (
            <View style={styles.endOfListFooter}>
              <Feather name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.endOfListText}>You&apos;re all caught up</Text>
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
                      {/^\d+$/.test(citySearchInput.trim()) && citySearchInput.trim().length < 6
                        ? 'Enter full 6-digit pincode'
                        : !/^\d+$/.test(citySearchInput.trim()) && citySearchInput.trim().length < 2
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
    height: 3,
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 6,
    marginHorizontal: -12,
  },
  statusBarTopStrip: {
    backgroundColor: '#0F172A',
    marginTop: -1,
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
    maxWidth: '56%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  locationPillText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
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
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
  nearYouSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    marginBottom: 4,
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
    marginTop: 2,
  },
  cardImage: {
    width: '100%',
    height: 100,
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
  cardTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    lineHeight: 14,
  },
  cardPrice: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    paddingHorizontal: 0,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 6,
    gap: 3,
  },
  cardOriginalPrice: {
    fontSize: 8,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  cardDistance: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  featuredSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  featuredScroll: {
    marginTop: 2,
  },
  featuredCard: {
    backgroundColor: Colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyRailCard: {
    width: SCREEN_WIDTH - HOME_HORIZONTAL_INSET * 2,
    minHeight: 96,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
    justifyContent: 'center',
  },
  emptyRailTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  emptyRailText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
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
    paddingVertical: 4,
  },
  horizontalResultsContent: {
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    gap: HOME_RAIL_GAP,
  },
  row: {
    paddingHorizontal: HOME_HORIZONTAL_INSET,
    justifyContent: 'space-between',
  },
  leftColumn: {
    flexBasis: '49%',
    maxWidth: '49%',
  },
  rightColumn: {
    flexBasis: '49%',
    maxWidth: '49%',
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
