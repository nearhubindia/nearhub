import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  Platform,
  AppState,
  Alert,
  StatusBar,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getTabBarHeight } from '@/constants/layout';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import { getPersonalizedShortsFeed, hasEnoughDataForPersonalization } from '@/lib/personalization';
import { calculateDistance } from '@/lib/location-data';
import { formatCondition } from '@/lib/utils';
import { useAdminSettings } from '@/lib/use-admin-settings';
import { getShortsSwipeHapticsEnabled } from '@/lib/config';
import { getApiUrl } from '@/lib/query-client';
import {
  configureShortsAudioSession,
  getShortsPreloadAheadCount,
  getShortsPrefetchConcurrency,
} from '@/lib/shorts-performance';
import { ShortsPrefetchQueue } from '@/lib/shorts-prefetch-queue';
import { trackShortsTelemetry } from '@/lib/shorts-telemetry';
import ShortsCard from '@/shared/components/ShortsCard';

function getStreamingUrl(videoUrl: string, apiBaseUrl: string): string {
  if (videoUrl.startsWith('https://') || videoUrl.startsWith('http://')) {
    return videoUrl;
  }
  if (videoUrl.startsWith('/videos/')) {
    const filename = videoUrl.replace(/^\/videos\//, '');
    return `${apiBaseUrl}/api/videos/stream/${filename}`;
  }
  return `${apiBaseUrl}/api/videos/stream/${videoUrl}`;
}

export default function ShortsScreen() {
  const { listingId: listingIdParam } = useLocalSearchParams<{ listingId?: string | string[] }>();
  const targetListingId = Array.isArray(listingIdParam)
    ? String(listingIdParam[0] || '').trim()
    : String(listingIdParam || '').trim();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const { listings, savedIds, toggleSaved } = useListings();
  type ShortsItem = (typeof listings)[number];
  const { isAuthenticated, user } = useAuth();
  const { interests, trackView, trackSave, trackContact } = useUserInterests();
  const isTabFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const { geoRadiusKm } = useAdminSettings();
  const effectiveGeoRadiusKm = user?.preferences?.searchRadiusKm ?? geoRadiusKm;
  const feedListRef = useRef<FlatList<ShortsItem>>(null);
  const wasTabFocusedRef = useRef(isTabFocused);
  const [listHeight, setListHeight] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now());
  const [feedInterestsSnapshot, setFeedInterestsSnapshot] = useState(interests);
  const shortsSwipeHapticsEnabled = getShortsSwipeHapticsEnabled();

  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  // Use measured list viewport height to avoid page-size drift across items/devices.
  const cardHeight = Math.max(1, Math.round(listHeight || windowHeight));
  // Use a single, stable anchor for all cards: tab bar height + small fixed padding.
  const overlayBottomPadding = 4;
  const fallbackTabBarHeight = Math.max(0, Math.round(getTabBarHeight(bottomInset)));
  const measuredTabBarHeight = Math.max(0, Math.round(tabBarHeight || 0));
  const stableTabBarHeight = measuredTabBarHeight > 0 ? measuredTabBarHeight : fallbackTabBarHeight;
  const cardUiBottomInset = stableTabBarHeight + overlayBottomPadding;
  const listLayoutKey = `shorts-${cardHeight}-${cardUiBottomInset}`;
  const preloadAbortRef = useRef<AbortController | null>(null);
  const isAppActiveRef = useRef(AppState.currentState === 'active');
  const preloadAheadCount = getShortsPreloadAheadCount();
  const prefetchQueueRef = useRef(
    new ShortsPrefetchQueue({
      concurrency: getShortsPrefetchConcurrency(),
      rangeHeader: 'bytes=0-262143',
    })
  );

  // Keep feed ordering stable while actively browsing; refresh snapshot when tab regains focus.
  useEffect(() => {
    const becameFocused = isTabFocused && !wasTabFocusedRef.current;
    if (becameFocused) {
      setFeedInterestsSnapshot(interests);
    }
    wasTabFocusedRef.current = isTabFocused;
  }, [isTabFocused, interests]);

  useEffect(() => {
    if (!isTabFocused) {
      return;
    }

    const snapshotIsEmpty =
      Object.keys(feedInterestsSnapshot.categories).length === 0 &&
      feedInterestsSnapshot.interactions.length === 0;
    const liveHasData =
      Object.keys(interests.categories).length > 0 || interests.interactions.length > 0;

    if (snapshotIsEmpty && liveHasData) {
      setFeedInterestsSnapshot(interests);
    }
  }, [isTabFocused, interests, feedInterestsSnapshot]);

  useEffect(() => {
    // Ensure shorts audio playback is not suppressed by stale audio-session defaults.
    void configureShortsAudioSession().catch((error) => {
      console.warn('[Shorts] Failed to set audio mode:', error);
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      isAppActiveRef.current = nextState === 'active';
      if (nextState !== 'active') {
        preloadAbortRef.current?.abort();
        prefetchQueueRef.current.clear();
      }
    });
    return () => subscription.remove();
  }, []);

  // Get personalized shorts feed using AI
  const personalizedShorts = useMemo(() => {
    const hasEnoughData = hasEnoughDataForPersonalization(feedInterestsSnapshot);

    let filtered = listings;

    const userLat = Number(user?.location?.latitude);
    const userLon = Number(user?.location?.longitude);
    const hasUserCoordinates = Number.isFinite(userLat) && Number.isFinite(userLon);
    const userCity = String(user?.location?.city || '')
      .trim()
      .toLowerCase();
    const userState = String((user as any)?.location?.state || '')
      .trim()
      .toLowerCase();

    // Filter by location (within geo radius)
    if (hasUserCoordinates) {
      filtered = filtered.filter((l) => {
        const listingLat = Number(l.location.latitude);
        const listingLon = Number(l.location.longitude);
        if (!Number.isFinite(listingLat) || !Number.isFinite(listingLon)) {
          return false;
        }

        const distance = calculateDistance(userLat, userLon, listingLat, listingLon);
        return Number.isFinite(distance) && distance <= effectiveGeoRadiusKm;
      });
    } else if (userCity || userState) {
      // Fallback: when coordinates are missing, keep feed local to user's city/state.
      filtered = filtered.filter((l) => {
        const listingCity = String(l.location?.city || '')
          .trim()
          .toLowerCase();
        const listingState = String((l.location as any)?.state || '')
          .trim()
          .toLowerCase();
        if (userCity && listingCity) {
          return listingCity === userCity;
        }
        if (userState && listingState) {
          return listingState === userState;
        }
        return false;
      });
    }

    // Shorts feed is video-only
    filtered = filtered.filter((l) => l.videos && l.videos.length > 0);

    let feed: typeof filtered;

    if (hasEnoughData) {
      // Use AI-powered personalization
      const personalized = getPersonalizedShortsFeed(
        filtered,
        feedInterestsSnapshot,
        userLat,
        userLon
      );
      feed = personalized.map((item) => item.listing);
    } else {
      // New user - show filtered shorts
      feed = filtered;
    }

    if (targetListingId) {
      const targetFromFilteredFeed = feed.find((item) => item.id === targetListingId);
      if (targetFromFilteredFeed) {
        const withoutTarget = feed.filter((item) => item.id !== targetListingId);
        return [targetFromFilteredFeed, ...withoutTarget];
      }
    }

    return feed;
  }, [listings, feedInterestsSnapshot, user?.location, effectiveGeoRadiusKm, targetListingId]);

  useEffect(() => {
    if (personalizedShorts.length === 0) {
      return;
    }
    if (currentIndex >= personalizedShorts.length) {
      setCurrentIndex(personalizedShorts.length - 1);
    }
  }, [currentIndex, personalizedShorts.length]);

  useEffect(() => {
    if (!targetListingId || personalizedShorts.length === 0) return;
    const targetIndex = personalizedShorts.findIndex((item) => item.id === targetListingId);
    if (targetIndex < 0) return;
    setCurrentIndex(targetIndex);
    feedListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
  }, [personalizedShorts, targetListingId]);

  useEffect(() => {
    if (personalizedShorts.length === 0 || !isTabFocused || !isAppActiveRef.current) return;

    preloadAbortRef.current?.abort();
    prefetchQueueRef.current.clear();
    const controller = new AbortController();
    preloadAbortRef.current = controller;

    const warmup = async () => {
      try {
        const apiBaseUrl = getApiUrl();
        const targets = personalizedShorts
          .slice(currentIndex + 1, currentIndex + 1 + preloadAheadCount)
          .map((item) => item.videos?.[0])
          .filter((url): url is string => typeof url === 'string' && url.length > 0)
          .map((url) => getStreamingUrl(url, apiBaseUrl));
        if (controller.signal.aborted) return;
        prefetchQueueRef.current.enqueue(targets);
      } catch {
        // Best effort preloading only.
      }
    };

    void warmup();

    return () => {
      controller.abort();
      prefetchQueueRef.current.clear();
    };
  }, [currentIndex, personalizedShorts, isTabFocused, preloadAheadCount]);

  const handlePlaybackMetric = useCallback(
    (
      listingId: string,
      event: 'first_frame' | 'source_fallback' | 'playback_error',
      details?: {
        sourceMode?: 'direct' | 'hls';
        error?: string;
      }
    ) => {
      if (event === 'first_frame') {
        trackShortsTelemetry('shorts_first_frame', { listingId, ...details });
        return;
      }
      if (event === 'source_fallback') {
        trackShortsTelemetry('shorts_source_fallback', { listingId, ...details });
        return;
      }
      trackShortsTelemetry('shorts_playback_error', { listingId, ...details });
    },
    []
  );

  const handleSave = useCallback(
    (id: string, category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);
      trackSave(id, category).catch(console.error);
    },
    [toggleSaved, trackSave]
  );

  const handleContact = useCallback(
    (item: (typeof personalizedShorts)[0]) => {
      if (!isAuthenticated) {
        Alert.alert('Sign in Required', 'You need to register to contact sellers.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Register', onPress: () => router.push('/auth/register') },
        ]);
        return;
      }

      const normalizedUserId = String(user?.id || '')
        .replace(/[\s+-]/g, '')
        .toLowerCase();
      const normalizedListingUserId = String((item as any)?.userId || '')
        .replace(/[\s+-]/g, '')
        .toLowerCase();
      const isOwner = !!normalizedUserId && normalizedUserId === normalizedListingUserId;

      if (isOwner) {
        Alert.alert('Not Allowed', 'You cannot message your own listing.');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      trackContact(item.id, item.category).catch(console.error);
      router.push({
        pathname: '/chat/[listingId]',
        params: {
          listingId: item.id,
          otherUserId: item.userId || '',
          sellerName: item.sellerName,
          listingTitle: item.title,
          listingImage: item.images[0],
        },
      });
    },
    [isAuthenticated, trackContact, user?.id]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (personalizedShorts.length === 0) {
        return;
      }

      const rawOffsetY = event.nativeEvent.contentOffset.y;
      const clampedIndex = Math.min(
        personalizedShorts.length - 1,
        Math.max(0, Math.round(rawOffsetY / cardHeight))
      );
      const delta = clampedIndex - currentIndex;

      if (delta === 0) {
        return;
      }

      const nextIndex = clampedIndex;

      const previousShort = personalizedShorts[currentIndex];
      const viewDuration = Math.round((Date.now() - viewStartTime) / 1000); // seconds
      if (previousShort && viewDuration > 1) {
        trackView(previousShort.id, previousShort.category, viewDuration).catch(console.error);
      }

      setCurrentIndex(nextIndex);
      setViewStartTime(Date.now());
      if (shortsSwipeHapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [
      cardHeight,
      currentIndex,
      personalizedShorts,
      shortsSwipeHapticsEnabled,
      trackView,
      viewStartTime,
    ]
  );

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.max(1, Math.round(event.nativeEvent.layout.height));
    setListHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
  }, []);

  if (personalizedShorts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Feather name="film" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No shorts yet</Text>
        <Text style={styles.emptySubtitle}>
          {listings.filter((l) => l.videos && l.videos.length > 0).length === 0
            ? 'Video listings will appear here as shorts'
            : 'Building your personalized feed...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <View pointerEvents="none" style={[styles.topEdgeCover, { height: topInset + 2 }]} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />
      <FlatList<ShortsItem>
        ref={feedListRef}
        key={listLayoutKey}
        data={personalizedShorts}
        extraData={cardUiBottomInset}
        renderItem={({ item, index }) => (
          <ShortsCard
            title={item.title?.trim() || 'Untitled listing'}
            price={Number(item.price) || 0}
            offerPrice={Number(item.offerPrice) || undefined}
            image={item.images?.[0] || ''}
            images={item.images}
            videos={item.videos}
            sellerName={item.sellerName?.trim() || 'NearHub Seller'}
            sellerAvatar={item.sellerAvatar}
            sellerVerified={Boolean(item.sellerVerified)}
            location={item.location?.city || 'Unknown location'}
            category={item.category}
            condition={formatCondition(item.condition)}
            isSaved={savedIds.has(item.id)}
            isActive={index === currentIndex && isTabFocused}
            // Keep adjacent videos mounted for smoother handoff while scrolling.
            shouldRenderVideo={Math.abs(index - currentIndex) <= 1 && isTabFocused}
            onPlaybackMetric={(event, details) => handlePlaybackMetric(item.id, event, details)}
            onSave={() => handleSave(item.id, item.category)}
            onContact={() => handleContact(item)}
            onDetails={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
            cardHeight={cardHeight}
            cardWidth={width}
            uiBottomInset={cardUiBottomInset}
            uiTopInset={topInset}
          />
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={16}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          length: cardHeight,
          offset: cardHeight * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topEdgeCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    zIndex: 100,
    elevation: 100,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
