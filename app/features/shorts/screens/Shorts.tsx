import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  Platform,
  Alert,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
import ShortsCard from '@/shared/components/ShortsCard';

export default function ShortsScreen() {
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const { listings, savedIds, toggleSaved } = useListings();
  const { isAuthenticated, user } = useAuth();
  const { interests, trackView, trackSave, trackContact } = useUserInterests();
  const isTabFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const { geoRadiusKm } = useAdminSettings();
  const effectiveGeoRadiusKm = user?.preferences?.searchRadiusKm ?? geoRadiusKm;
  const [listHeight, setListHeight] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now());
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

  // Get personalized shorts feed using AI
  const personalizedShorts = useMemo(() => {
    const hasEnoughData = hasEnoughDataForPersonalization(interests);

    let filtered = listings;

    const userLat = user?.location?.latitude;
    const userLon = user?.location?.longitude;

    // Filter by location (within geo radius)
    if (userLat && userLon) {
      filtered = filtered.filter((l) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          l.location.latitude,
          l.location.longitude
        );
        return distance <= effectiveGeoRadiusKm;
      });
    }

    // Shorts feed is video-only
    filtered = filtered.filter((l) => l.videos && l.videos.length > 0);

    if (hasEnoughData) {
      // Use AI-powered personalization
      const personalized = getPersonalizedShortsFeed(filtered, interests, userLat, userLon);
      return personalized.map((item) => item.listing);
    } else {
      // New user - show filtered shorts
      return filtered;
    }
  }, [listings, interests, user?.location, effectiveGeoRadiusKm]);

  // Track view time when user changes shorts
  useEffect(() => {
    if (
      personalizedShorts.length > 0 &&
      currentIndex >= 0 &&
      currentIndex < personalizedShorts.length
    ) {
      const currentShort = personalizedShorts[currentIndex];
      const viewDuration = Math.round((Date.now() - viewStartTime) / 1000); // seconds

      if (viewDuration > 1) {
        // Only track if viewed for more than 1 second
        trackView(currentShort.id, currentShort.category, viewDuration).catch(console.error);
      }

      // Reset timer for new video
      setViewStartTime(Date.now());
    }
  }, [currentIndex]);

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
      const rawOffsetY = event.nativeEvent.contentOffset.y;
      const clampedIndex = Math.min(
        personalizedShorts.length - 1,
        Math.max(0, Math.round(rawOffsetY / cardHeight))
      );

      if (clampedIndex !== currentIndex) {
        setCurrentIndex(clampedIndex);
        if (shortsSwipeHapticsEnabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [cardHeight, currentIndex, personalizedShorts.length, shortsSwipeHapticsEnabled]
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
      <FlatList
        key={listLayoutKey}
        data={personalizedShorts}
        extraData={cardUiBottomInset}
        renderItem={({ item, index }) => (
          <ShortsCard
            title={item.title?.trim() || 'Untitled listing'}
            price={Number(item.price) || 0}
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
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={16}
        windowSize={3}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
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
