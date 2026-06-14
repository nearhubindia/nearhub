import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { Listing } from '@/lib/types';
import { getTimeAgo, formatCondition } from '@/lib/utils';
import { getBackendURL } from '@/lib/config';
import { calculateDistance } from '@/lib/location-data';
import { useAdminSettings } from '@/lib/use-admin-settings';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { shareListingLink } from '@/lib/share-app-link';
import MediaCarousel from '@/shared/components/MediaCarousel';
import RichTextPreview from '@/shared/components/RichTextPreview';
import { createResponsiveStyles } from '@/lib/responsive';
import { bookDeal } from '@/lib/deal-bookings';
import { countdownPartsFromMs, formatDealStatus, getEffectiveDealWindow } from '@/lib/deal-timer';
import { trackGenerateLead, trackPurchaseEvent, trackViewItem } from '@/lib/firebase-analytics';

const { width } = Dimensions.get('window');

function parseMediaArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [trimmed];
    return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  } catch {
    return [trimmed];
  }
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function mapApiListing(listing: any): Listing {
  const categoryValue = String(
    listing?.subCategory || listing?.subcategory || listing?.category || ''
  ).trim();
  const normalizedCategory = (categoryValue || 'Other') as Listing['category'];
  const latitude = toNumber(listing?.latitude, 0);
  const longitude = toNumber(listing?.longitude, 0);

  return {
    id: String(listing?.id || ''),
    userId: String(listing?.userId || listing?.sellerId || ''),
    title: String(listing?.title || ''),
    description: String(listing?.description || ''),
    price: toNumber(listing?.price, 0),
    offerPrice:
      listing?.offerPrice !== undefined && listing?.offerPrice !== null
        ? toNumber(listing.offerPrice, 0)
        : undefined,
    priceUnit:
      typeof listing?.priceUnit === 'string' && listing.priceUnit.trim()
        ? listing.priceUnit.trim()
        : undefined,
    mainCategory:
      typeof listing?.mainCategory === 'string' && listing.mainCategory.trim()
        ? listing.mainCategory.trim()
        : undefined,
    subCategory: normalizedCategory,
    subcategory: normalizedCategory,
    category: normalizedCategory,
    images: parseMediaArray(listing?.images),
    videos: parseMediaArray(listing?.videos),
    sellerName: String(listing?.sellerName || listing?.seller?.name || 'Seller').trim() || 'Seller',
    sellerVerified: Boolean(listing?.sellerVerified),
    sellerPhone: String(listing?.contactPhone || listing?.sellerPhone || '').trim(),
    contactPhone: String(listing?.contactPhone || listing?.sellerPhone || '').trim(),
    location: {
      latitude,
      longitude,
      city: String(listing?.location || listing?.city || 'Unknown').trim() || 'Unknown',
    },
    condition: (String(listing?.condition || 'good').trim() || 'good') as Listing['condition'],
    listingType: normalizeAppListingType(listing),
    status:
      typeof listing?.status === 'string' && listing.status.trim()
        ? (listing.status.trim() as Listing['status'])
        : undefined,
    rejectionReason:
      typeof listing?.rejectionReason === 'string' && listing.rejectionReason.trim()
        ? listing.rejectionReason.trim()
        : undefined,
    expiresAt:
      typeof listing?.expiresAt === 'string' && listing.expiresAt.trim()
        ? listing.expiresAt.trim()
        : undefined,
    createdAt: String(listing?.createdAt || new Date().toISOString()),
    aiValidated: Boolean(listing?.aiValidated),
    isPaid: Boolean(listing?.isPaid),
    featured: Boolean(listing?.featured),
    sponsored: Boolean(listing?.sponsored),
    boostedUntil:
      typeof listing?.boostedUntil === 'string' && listing.boostedUntil.trim()
        ? listing.boostedUntil.trim()
        : undefined,
    boostCount:
      listing?.boostCount !== undefined && listing?.boostCount !== null
        ? toNumber(listing.boostCount, 0)
        : undefined,
    pincode: typeof listing?.pincode === 'string' ? listing.pincode.trim() : undefined,
    duration:
      listing?.duration !== undefined && listing?.duration !== null
        ? toNumber(listing.duration, 0)
        : undefined,
    durationDays:
      listing?.durationDays !== undefined && listing?.durationDays !== null
        ? toNumber(listing.durationDays, 0)
        : undefined,
    isDeal: Boolean(listing?.isDeal),
    dealType:
      typeof listing?.dealType === 'string' && listing.dealType.trim()
        ? (listing.dealType.trim() as Listing['dealType'])
        : undefined,
    dealStartAt:
      typeof listing?.dealStartAt === 'string' && listing.dealStartAt.trim()
        ? listing.dealStartAt.trim()
        : undefined,
    dealEndAt:
      typeof listing?.dealEndAt === 'string' && listing.dealEndAt.trim()
        ? listing.dealEndAt.trim()
        : undefined,
    dealRecurrence:
      typeof listing?.dealRecurrence === 'string' && listing.dealRecurrence.trim()
        ? (listing.dealRecurrence.trim() as Listing['dealRecurrence'])
        : undefined,
    dealRecurrenceUntil:
      typeof listing?.dealRecurrenceUntil === 'string' && listing.dealRecurrenceUntil.trim()
        ? listing.dealRecurrenceUntil.trim()
        : undefined,
    dealCycleQuantity:
      listing?.dealCycleQuantity !== undefined && listing.dealCycleQuantity !== null
        ? toNumber(listing.dealCycleQuantity, 0)
        : undefined,
    maxDealBookings:
      listing?.maxDealBookings !== undefined && listing.maxDealBookings !== null
        ? toNumber(listing.maxDealBookings, 0)
        : undefined,
    postDealPriceMode:
      typeof listing?.postDealPriceMode === 'string' && listing.postDealPriceMode.trim()
        ? (listing.postDealPriceMode.trim() as Listing['postDealPriceMode'])
        : undefined,
    postDealDiscountPrice:
      listing?.postDealDiscountPrice !== undefined && listing.postDealDiscountPrice !== null
        ? toNumber(listing.postDealDiscountPrice, 0)
        : undefined,
    comboItems: parseMediaArray(listing?.comboItems),
    dealTerms:
      typeof listing?.dealTerms === 'string' && listing.dealTerms.trim()
        ? listing.dealTerms.trim()
        : undefined,
    voucherEnabled:
      listing?.voucherEnabled !== undefined && listing.voucherEnabled !== null
        ? Boolean(listing.voucherEnabled)
        : undefined,
    sellerAvatar:
      typeof listing?.sellerAvatar === 'string' && listing.sellerAvatar.trim()
        ? listing.sellerAvatar.trim()
        : '',
    viewCount:
      listing?.viewCount !== undefined && listing?.viewCount !== null
        ? toNumber(listing.viewCount, 0)
        : undefined,
    chatCount:
      listing?.chatCount !== undefined && listing?.chatCount !== null
        ? toNumber(listing.chatCount, 0)
        : undefined,
    likeCount:
      listing?.likeCount !== undefined && listing?.likeCount !== null
        ? toNumber(listing.likeCount, 0)
        : undefined,
    saveCount:
      listing?.saveCount !== undefined && listing?.saveCount !== null
        ? toNumber(listing.saveCount, 0)
        : undefined,
  };
}

export default function ListingDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(idParam)
    ? String(idParam[0] || '').trim()
    : String(idParam || '').trim();
  const insets = useSafeAreaInsets();
  const { listings, getListingById, savedIds, toggleSaved } = useListings();
  const { isAuthenticated, user } = useAuth();
  const { geoRadiusKm } = useAdminSettings();
  const [isFocused, setIsFocused] = useState(true);
  const [resolvedContactPhone, setResolvedContactPhone] = useState('');
  const [deepLinkedListing, setDeepLinkedListing] = useState<Listing | null>(null);
  const [isFetchingListing, setIsFetchingListing] = useState(false);
  const [hasAttemptedListingFetch, setHasAttemptedListingFetch] = useState(false);
  const [isBookingDeal, setIsBookingDeal] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Pause videos when screen loses focus
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  const listingFromContext = getListingById(listingId);
  const listing = listingFromContext || deepLinkedListing;
  const isSaved = savedIds.has(listingId);
  const normalizedUserId = (user?.id || '').replace(/[\s+-]/g, '');
  const listingPhoneRaw = (
    resolvedContactPhone ||
    listing?.contactPhone ||
    listing?.sellerPhone ||
    ''
  ).trim();
  const normalizedSellerPhone = listingPhoneRaw.replace(/\D/g, '').slice(-10);
  const normalizedListingUserId = (listing?.userId || '').replace(/[\s+-]/g, '');
  const listingUserIdLower = String(listing?.userId || '')
    .trim()
    .toLowerCase();
  const isAdminListing =
    listingUserIdLower === 'admin' ||
    listingUserIdLower.startsWith('admin-') ||
    listingUserIdLower.startsWith('admin_') ||
    normalizedListingUserId.toLowerCase().startsWith('admin');
  const isOwner = !!normalizedUserId && normalizedUserId === normalizedListingUserId;
  const canShowCall =
    (!isAdminListing || (isAdminListing && normalizedSellerPhone.length > 0)) && !isOwner;
  const canShowMessage = !isAdminListing && !isOwner;
  const listingStatus = String((listing as any)?.status || '').toLowerCase();
  const isExpired =
    listingStatus === 'expired' ||
    (!!listing?.expiresAt && new Date(listing.expiresAt).getTime() < Date.now());
  const listingLatitude = listing?.location?.latitude;
  const listingLongitude = listing?.location?.longitude;
  const canShowDirections =
    Number.isFinite(listingLatitude) &&
    Number.isFinite(listingLongitude) &&
    (listingLatitude !== 0 || listingLongitude !== 0);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const effectiveRadiusKm = user?.preferences?.searchRadiusKm ?? geoRadiusKm;

  // Debug: Log listing data
  useEffect(() => {
    if (__DEV__ && listing) {
      console.log('[ListingDetail] Listing loaded:', {
        id: listing.id,
        title: listing.title,
        hasImages: listing.images?.length || 0,
        hasVideos: listing.videos?.length || 0,
        videos: listing.videos,
      });
    }
  }, [listing?.id]);

  useEffect(() => {
    if (!listing?.id) return;
    void trackViewItem({
      id: listing.id,
      title: listing.title,
      category: listing.category,
      price: Number(listing.offerPrice || listing.price || 0),
      listingType: listing.isDeal ? 'deal' : 'listing',
      location: listing.location?.city || '',
    });
  }, [listing]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setResolvedContactPhone('');
    setDeepLinkedListing(null);
    setHasAttemptedListingFetch(false);
    setIsBookingDeal(false);
  }, [listingId]);

  useEffect(() => {
    if (!listingId || listingFromContext || hasAttemptedListingFetch) return;

    let cancelled = false;
    setIsFetchingListing(true);

    const fetchListingById = async () => {
      try {
        const apiUrl = getBackendURL();
        const response = await fetch(`${apiUrl}/api/listings/${encodeURIComponent(listingId)}`, {
          method: 'GET',
          headers: buildUserAuthHeaders({
            id: user?.id || '',
            phone: user?.phone || '',
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) return;

        const rawListing = data.listing || data.data;
        if (!rawListing || cancelled) return;
        setDeepLinkedListing(mapApiListing(rawListing));
      } catch (error) {
        console.warn('[ListingDetail] Failed to fetch deep-linked listing:', error);
      } finally {
        if (!cancelled) {
          setIsFetchingListing(false);
          setHasAttemptedListingFetch(true);
        }
      }
    };

    void fetchListingById();

    return () => {
      cancelled = true;
    };
  }, [hasAttemptedListingFetch, listingFromContext, listingId, user?.id, user?.phone]);

  // Track view when screen loads
  useEffect(() => {
    if (!listingId) return;

    const trackView = async () => {
      try {
        const apiUrl = getBackendURL();
        await fetch(`${apiUrl}/api/listings/${encodeURIComponent(listingId)}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        // Silently track - don't show errors to user
      } catch (error) {
        console.error('[ListingDetail] Failed to track view:', error);
      }
    };

    trackView();
  }, [listingId]);

  const recommendationDistanceByListingId = useMemo(() => {
    if (!listing) return new Map<string, number>();

    const sourceLat = Number(listing.location?.latitude);
    const sourceLon = Number(listing.location?.longitude);
    const hasSourceCoords =
      Number.isFinite(sourceLat) &&
      Number.isFinite(sourceLon) &&
      (sourceLat !== 0 || sourceLon !== 0);
    if (!hasSourceCoords) return new Map<string, number>();

    const distanceMap = new Map<string, number>();
    for (const item of listings) {
      const itemLat = Number(item.location?.latitude);
      const itemLon = Number(item.location?.longitude);
      if (!Number.isFinite(itemLat) || !Number.isFinite(itemLon)) continue;
      distanceMap.set(item.id, calculateDistance(sourceLat, sourceLon, itemLat, itemLon));
    }
    return distanceMap;
  }, [listing, listings]);

  const recommendedProducts = useMemo(() => {
    if (!listing) return [];

    const selectedCity = String(listing.location.city || '')
      .trim()
      .toLowerCase();
    const selectedCategory = String(listing.category || '')
      .trim()
      .toLowerCase();
    const hasSourceCoords = recommendationDistanceByListingId.size > 0;
    const currentTime = Date.now();

    const candidates = listings.filter((item) => {
      if (item.id === listing.id) return false;
      if (item.listingType !== 'sell') return false;
      if (
        String(item.category || '')
          .trim()
          .toLowerCase() !== selectedCategory
      ) {
        return false;
      }
      if (
        String(item.condition || '')
          .trim()
          .toLowerCase() !== 'new'
      ) {
        return false;
      }
      if (hasSourceCoords) {
        const distanceKm = recommendationDistanceByListingId.get(item.id);
        if (distanceKm === undefined) return false;
        if (distanceKm > effectiveRadiusKm) return false;
      }

      const status = String(item.status || 'active').toLowerCase();
      if (status !== 'active') return false;
      if (item.expiresAt && new Date(item.expiresAt).getTime() < currentTime) return false;
      return true;
    });

    return candidates
      .map((item) => {
        let score = 0;

        const itemCity = String(item.location.city || '')
          .trim()
          .toLowerCase();
        if (selectedCity && itemCity && selectedCity === itemCity) score += 3;
        if (item.featured) score += 2;

        const hasOffer =
          typeof item.offerPrice === 'number' &&
          item.offerPrice > 0 &&
          item.offerPrice < item.price;
        if (hasOffer) score += 1;

        const createdAt = new Date(item.createdAt).getTime();
        const distanceKm = recommendationDistanceByListingId.get(item.id);
        return {
          item,
          score,
          createdAt: Number.isFinite(createdAt) ? createdAt : 0,
          distanceKm: typeof distanceKm === 'number' ? distanceKm : Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((entry) => entry.item);
  }, [effectiveRadiusKm, listing, listings, recommendationDistanceByListingId]);

  if (!listing) {
    if (isFetchingListing || !hasAttemptedListingFetch) {
      return (
        <View style={[styles.notFound, { paddingTop: insets.top || webTopInset }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.notFoundText, { marginTop: 14 }]}>Loading listing...</Text>
        </View>
      );
    }

    return (
      <View style={[styles.notFound, { paddingTop: insets.top || webTopInset }]}>
        <Feather name="alert-circle" size={48} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Listing not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in Required', 'You need to register to contact sellers.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Register', onPress: () => router.push('/auth/register') },
      ]);
      return;
    }
    action();
  };

  const handleMessage = () => {
    requireAuth(() => {
      if (isOwner) {
        Alert.alert('Not Allowed', 'You cannot message your own listing.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void trackGenerateLead({
        listingId: listing.id,
        listingTitle: listing.title,
        method: 'chat',
        category: listing.category,
      });
      router.push({
        pathname: '/chat/[listingId]',
        params: {
          listingId: listing.id,
          otherUserId: listing.userId || '',
          otherUserAvatar: listing.sellerAvatar || '',
          sellerName: listing.sellerName,
          listingTitle: listing.title,
          listingImage: listing.images[0],
        },
      });
    });
  };

  const handleCall = () => {
    requireAuth(() => {
      if (isOwner) {
        Alert.alert('Not Allowed', 'You cannot call your own listing.');
        return;
      }
      void (async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        let phone = '';

        try {
          const apiUrl = getBackendURL();
          const response = await fetch(`${apiUrl}/api/listings/${listing.id}/contact`, {
            method: 'GET',
            headers: buildUserAuthHeaders({
              id: user?.id || '',
              phone: user?.phone || '',
            }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || 'Seller phone number is not available.');
          }
          const fetchedPhone = String(data.contactPhone || data.sellerPhone || '')
            .replace(/\D/g, '')
            .slice(-10);
          if (!fetchedPhone) {
            throw new Error('Seller phone number is not available.');
          }
          setResolvedContactPhone(fetchedPhone);
          void trackGenerateLead({
            listingId: listing.id,
            listingTitle: listing.title,
            method: 'call',
            category: listing.category,
          });
          phone = fetchedPhone;
        } catch (error: any) {
          Alert.alert('Contact Seller', error?.message || 'Seller phone number is not available.');
          return;
        }

        if (Platform.OS === 'web') {
          Alert.alert('Contact Seller', `Call ${listing.sellerName} at ${phone}`);
        } else {
          Alert.alert('Contact Seller', `Would you like to call ${listing.sellerName}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => Linking.openURL(`tel:${phone}`) },
          ]);
        }
      })();
    });
  };

  const handleDirections = async () => {
    if (!canShowDirections || listingLatitude === undefined || listingLongitude === undefined) {
      Alert.alert('Directions unavailable', 'This listing does not have map coordinates yet.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const destination = encodeURIComponent(`${listingLatitude},${listingLongitude}`);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    try {
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert('Directions unavailable', 'Unable to open Google Maps on this device.');
    }
  };

  const handleBookDeal = useCallback(() => {
    if (!listing?.isDeal) return;

    requireAuth(() => {
      if (isOwner) {
        Alert.alert('Not Allowed', 'You cannot book your own deal.');
        return;
      }

      void (async () => {
        setIsBookingDeal(true);
        try {
          await bookDeal(listing.id, user?.id || '', user?.phone || undefined);
          void trackGenerateLead({
            listingId: listing.id,
            listingTitle: listing.title,
            method: 'deal_booking',
            category: listing.category,
          });
          void trackPurchaseEvent({
            purchaseType: 'deal',
            itemId: listing.id,
            itemName: listing.title,
            category: listing.category,
            value: Number(listing.offerPrice || listing.price || 0),
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Deal booked', 'Your booking is confirmed.', [
            { text: 'Close', style: 'cancel' },
            { text: 'View bookings', onPress: () => router.push('/bookings') },
          ]);
        } catch (error) {
          Alert.alert('Booking failed', error instanceof Error ? error.message : 'Try again.');
        } finally {
          setIsBookingDeal(false);
        }
      })();
    });
  }, [isOwner, listing, requireAuth, user?.id, user?.phone]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSaved(listingId);
  };

  const handleShareListing = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareListingLink({ listingId: listing.id, listingTitle: listing.title });
  };

  const hasValidOfferPrice =
    typeof listing.offerPrice === 'number' &&
    listing.offerPrice > 0 &&
    listing.offerPrice < listing.price;
  const displayPrice = hasValidOfferPrice ? (listing.offerPrice as number) : listing.price;
  const dealWindow = listing.isDeal ? getEffectiveDealWindow(listing, nowMs) : null;
  const dealStatus = listing.isDeal ? formatDealStatus(listing, nowMs) : '';
  const isBookableDeal = Boolean(
    listing.isDeal && dealWindow && nowMs >= dealWindow.startMs && nowMs <= dealWindow.endMs
  );
  const comboTitle =
    listing.isDeal &&
    listing.dealType === 'combo' &&
    listing.comboItems &&
    listing.comboItems.length >= 2
      ? `${listing.comboItems[0]} + ${listing.comboItems[1]}`
      : listing.title;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100,
        }}
      >
        <View style={styles.imageContainer}>
          <MediaCarousel
            images={listing.images}
            videos={listing.videos}
            height={width * 1.3}
            isFocused={isFocused}
            onVideoEnlargePress={() =>
              router.replace({
                pathname: '/(tabs)/shorts',
                params: { listingId: listing.id },
              })
            }
          />

          <Pressable
            style={[styles.headerButton, styles.backIcon, { top: (insets.top || webTopInset) + 8 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.headerButton, styles.saveIcon, { top: (insets.top || webTopInset) + 8 }]}
            onPress={handleSave}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? Colors.accent : '#fff'}
            />
          </Pressable>

          <Pressable
            style={[
              styles.headerButton,
              styles.shareIcon,
              { top: (insets.top || webTopInset) + 8 },
            ]}
            onPress={handleShareListing}
          >
            <Feather name="share-2" size={20} color="#fff" />
          </Pressable>

          {listing.aiValidated && (
            <View style={styles.aiBadge}>
              <Feather name="shield" size={14} color="#fff" />
              <Text style={styles.aiBadgeText}>AI Verified</Text>
            </View>
          )}
        </View>

        <View style={styles.details}>
          <View style={styles.summaryCard}>
            <View style={styles.priceRow}>
              <View style={styles.priceWrap}>
                <Text style={styles.price}>₹{displayPrice.toLocaleString('en-IN')}</Text>
                {listing.priceUnit && <Text style={styles.priceUnit}> / {listing.priceUnit}</Text>}
                {hasValidOfferPrice && (
                  <Text style={styles.originalPrice}>₹{listing.price.toLocaleString('en-IN')}</Text>
                )}
              </View>
              <View style={styles.rightBadges}>
                {isExpired && (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>Expired</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.typeBadge,
                    listing.listingType === 'buy' ? styles.buyBadge : styles.sellBadge,
                  ]}
                >
                  <Text style={styles.typeText}>
                    {listing.listingType === 'buy' ? 'Wanted' : 'For Sale'}
                  </Text>
                </View>
              </View>
            </View>

            {listing.isDeal && (
              <View style={styles.dealPanel}>
                <View style={styles.dealPillRow}>
                  <View style={styles.dealPill}>
                    <Feather name="tag" size={12} color="#FFFFFF" />
                    <Text style={styles.dealPillText}>Deal</Text>
                  </View>
                  {listing.voucherEnabled !== false ? (
                    <View style={styles.voucherPill}>
                      <Ionicons name="ticket-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.voucherPillText}>Voucher enabled</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.dealTitle}>{comboTitle}</Text>
                {listing.dealType === 'combo' &&
                listing.comboItems &&
                listing.comboItems.length > 0 ? (
                  <Text style={styles.dealComboSubtitle} numberOfLines={2}>
                    {listing.comboItems.join(' + ')}
                  </Text>
                ) : null}

                <View style={styles.dealStatusShell}>
                  <Text style={styles.dealStatusKicker}>
                    {dealStatus.startsWith('Ends in') ? 'DEAL ENDS IN' : 'Deal status'}
                  </Text>
                  {dealStatus.startsWith('Ends in') ? (
                    <View style={styles.dealCountdownRow}>
                      {countdownPartsFromMs(dealWindow?.endMs, nowMs).map((part) => (
                        <View key={part.label} style={styles.dealCountdownBlock}>
                          <Text style={styles.dealCountdownValue}>{part.value}</Text>
                          <Text style={styles.dealCountdownLabel}>{part.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.dealStatusValue}>{dealStatus || 'Deal listing'}</Text>
                  )}
                </View>

                <Text style={styles.dealBannerSubtitle}>
                  {listing.voucherEnabled === false
                    ? 'Booking is available without a voucher.'
                    : 'Booking will generate a voucher for redemption.'}
                </Text>

                {isBookableDeal ? (
                  <Pressable
                    style={[styles.dealBookButton, isBookingDeal && styles.dealBookButtonDisabled]}
                    onPress={handleBookDeal}
                    disabled={isBookingDeal}
                  >
                    {isBookingDeal ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.dealBookButtonText}>Book Deal</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            )}

            <Text style={styles.title}>{comboTitle}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="clock" size={14} color={Colors.textTertiary} />
                <Text style={styles.metaText}>{getTimeAgo(listing.createdAt)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color={Colors.textTertiary} />
                <Text style={styles.metaText}>{listing.location.city}</Text>
              </View>
              <View style={styles.condBadge}>
                <Text style={styles.condText}>{formatCondition(listing.condition)}</Text>
              </View>
            </View>

            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{listing.category}</Text>
            </View>

            {isExpired && isOwner && (
              <View style={styles.expiredCtaCard}>
                <Text style={styles.expiredCtaTitle}>This listing has expired</Text>
                <Text style={styles.expiredCtaSubtitle}>
                  Renew it to make it visible to buyers again.
                </Text>
                <Pressable
                  style={styles.renewNowButton}
                  onPress={() =>
                    router.push({
                      pathname: '/my-listings',
                      params: { tab: 'expired', renewId: listing.id },
                    })
                  }
                >
                  <Feather name="refresh-cw" size={16} color="#fff" />
                  <Text style={styles.renewNowButtonText}>Renew now</Text>
                </Pressable>
              </View>
            )}

            {canShowDirections && (
              <Pressable style={styles.inlineDirectionsButton} onPress={handleDirections}>
                <Feather name="navigation" size={15} color={Colors.primary} />
                <Text style={styles.inlineDirectionsText}>Get Directions</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Description</Text>
            <RichTextPreview text={listing.description || ''} textStyle={styles.description} />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <View style={styles.sellerCard}>
              <View style={styles.sellerAvatar}>
                {listing.sellerAvatar ? (
                  <Image source={{ uri: listing.sellerAvatar }} style={styles.sellerAvatarImage} />
                ) : (
                  <Text style={styles.sellerAvatarText}>{listing.sellerName.charAt(0)}</Text>
                )}
              </View>
              <View style={styles.sellerInfo}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{listing.sellerName}</Text>
                  {listing.sellerVerified && (
                    <View style={styles.sellerVerifiedBadge}>
                      <Feather name="check-circle" size={12} color="#fff" />
                      <Text style={styles.sellerVerifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sellerLocation}>{listing.location.city}</Text>
              </View>
            </View>
          </View>

          {recommendedProducts.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Recommended Products</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendedScrollContent}
              >
                {recommendedProducts.map((item) => {
                  const itemHasOffer =
                    typeof item.offerPrice === 'number' &&
                    item.offerPrice > 0 &&
                    item.offerPrice < item.price;
                  const itemDisplayPrice = itemHasOffer ? (item.offerPrice as number) : item.price;

                  return (
                    <Pressable
                      key={item.id}
                      style={styles.recommendedCard}
                      onPress={() =>
                        router.push({ pathname: '/listing/[id]', params: { id: item.id } })
                      }
                    >
                      {item.images?.[0] ? (
                        <Image
                          source={{ uri: item.images[0] }}
                          style={styles.recommendedImage}
                          contentFit="cover"
                          transition={120}
                        />
                      ) : (
                        <View style={[styles.recommendedImage, styles.recommendedImageFallback]}>
                          <Feather name="image" size={18} color={Colors.textTertiary} />
                        </View>
                      )}

                      <View style={styles.recommendedContent}>
                        <Text style={styles.recommendedTitle} numberOfLines={2}>
                          {item.title?.trim() || 'Untitled listing'}
                        </Text>
                        <View style={styles.recommendedPriceRow}>
                          <Text style={styles.recommendedPrice}>
                            ₹{(Number(itemDisplayPrice) || 0).toLocaleString('en-IN')}
                          </Text>
                          {itemHasOffer && (
                            <Text style={styles.recommendedOriginalPrice}>
                              ₹{(Number(item.price) || 0).toLocaleString('en-IN')}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.recommendedMeta} numberOfLines={1}>
                          {item.location.city}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {(canShowCall || canShowMessage) && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: (insets.bottom || (Platform.OS === 'web' ? 34 : 0)) + 8 },
          ]}
        >
          {canShowMessage && (
            <Pressable style={styles.messageButton} onPress={handleMessage}>
              <Feather name="message-circle" size={20} color={Colors.primary} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          )}
          {canShowCall && (
            <Pressable
              style={[styles.callButton, !canShowMessage && { flex: 1 }]}
              onPress={handleCall}
            >
              <Feather name="phone" size={20} color="#fff" />
              <Text style={styles.callText}>Call Seller</Text>
            </Pressable>
          )}
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
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  mainImage: {
    width,
    height: width * 0.6,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  headerButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    left: 16,
  },
  saveIcon: {
    right: 16,
  },
  shareIcon: {
    right: 64,
  },
  aiBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  details: {
    marginTop: -24,
    paddingHorizontal: 16,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dealPanel: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
    marginBottom: 14,
  },
  dealPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  dealPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  voucherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  voucherPillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  dealTitle: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 22,
    color: '#0F172A',
    fontFamily: 'Inter_700Bold',
  },
  dealComboSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  dealStatusShell: {
    marginTop: 14,
    alignItems: 'center',
  },
  dealStatusKicker: {
    fontSize: 11,
    letterSpacing: 2.2,
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  dealCountdownRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dealCountdownBlock: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F8D9DD',
  },
  dealCountdownValue: {
    color: '#DC1633',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  dealCountdownLabel: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 7,
    fontFamily: 'Inter_500Medium',
  },
  dealStatusValue: {
    marginTop: 6,
    color: '#DC1633',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  dealBannerSubtitle: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  dealBookButton: {
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealBookButtonDisabled: {
    opacity: 0.75,
  },
  dealBookButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },
  priceUnit: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  originalPrice: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  expiredBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  expiredBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  sellBadge: {
    backgroundColor: '#ECFDF5',
  },
  buyBadge: {
    backgroundColor: '#EFF6FF',
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  condBadge: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  condText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  expiredCtaCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  expiredCtaTitle: {
    fontSize: 14,
    color: '#991b1b',
    fontFamily: 'Inter_700Bold',
  },
  expiredCtaSubtitle: {
    fontSize: 13,
    color: '#7f1d1d',
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  renewNowButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  renewNowButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 18,
  },
  inlineDirectionsButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  inlineDirectionsText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sellerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  sellerAvatarText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  sellerLocation: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sellerVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F766E',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sellerVerifiedText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  categoryText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  recommendedScrollContent: {
    paddingTop: 10,
    gap: 10,
    paddingRight: 12,
  },
  recommendedCard: {
    width: 168,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  recommendedImage: {
    width: '100%',
    height: 104,
  },
  recommendedImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  recommendedContent: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  recommendedTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    lineHeight: 17,
    minHeight: 34,
  },
  recommendedPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendedPrice: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  recommendedOriginalPrice: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  recommendedMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: 6,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    gap: 6,
  },
  callText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  notFound: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
