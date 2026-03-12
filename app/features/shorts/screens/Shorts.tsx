import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  Pressable,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import { getPersonalizedShortsFeed, hasEnoughDataForPersonalization } from '@/lib/personalization';
import { calculateDistance } from '@/lib/location-data';
import { formatCondition } from '@/lib/utils';
import { useAdminSettings } from '@/lib/use-admin-settings';
import ShortsCard from '@/shared/components/ShortsCard';
const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 84 : 50;

export default function ShortsScreen() {
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const { listings, savedIds, toggleSaved } = useListings();
  const { isAuthenticated, user } = useAuth();
  const { interests, trackView, trackSave, trackContact } = useUserInterests();
  const { geoRadiusKm } = useAdminSettings();
  const effectiveGeoRadiusKm = user?.preferences?.searchRadiusKm ?? geoRadiusKm;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now());
  const [showOnlyVideos, setShowOnlyVideos] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  // Pause videos when tab loses focus
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  // Full screen height minus tab bar only
  const cardHeight = windowHeight - TAB_BAR_HEIGHT;

  // Get personalized shorts feed using AI
  const personalizedShorts = useMemo(() => {
    const hasEnoughData = hasEnoughDataForPersonalization(interests);

    let filtered = listings;

    // Filter by location (within geoRadiusKm)
    const userLat = user?.location?.latitude;
    const userLon = user?.location?.longitude;
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

    // Filter based on content type
    if (showOnlyVideos) {
      // Show only items with videos
      filtered = filtered.filter((l) => l.videos && l.videos.length > 0);
    } else {
      // Show videos and image slideshows (default)
      filtered = filtered.filter(
        (l) => (l.videos && l.videos.length > 0) || (l.images && l.images.length > 0)
      );
    }

    if (hasEnoughData) {
      // Use AI-powered personalization
      const personalized = getPersonalizedShortsFeed(filtered, interests, userLat, userLon);
      return personalized.map((item) => item.listing);
    } else {
      // New user - show filtered shorts
      return filtered;
    }
  }, [listings, interests, user?.location, showOnlyVideos, effectiveGeoRadiusKm]);

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
          sellerName: item.sellerName,
          listingTitle: item.title,
          listingImage: item.images[0],
        },
      });
    },
    [isAuthenticated, trackContact, user?.id]
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        // Find the item with the most coverage (not just the first viewable item)
        let maxCoverageIndex = 0;
        let maxCoverage = 0;

        for (const item of viewableItems) {
          const coverage = item.viewablePercentage || 0;
          if (coverage > maxCoverage) {
            maxCoverage = coverage;
            maxCoverageIndex = item.index;
          }
        }

        // Only update if we found a clearly visible item (> 50% visible)
        if (maxCoverage > 50 && maxCoverageIndex !== currentIndex) {
          setCurrentIndex(maxCoverageIndex);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [currentIndex]
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60, // Increased from 50 to 60 for better accuracy
    minimumViewTime: 200, // Minimum time (ms) item must be visible
  }).current;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const hasEnoughData = hasEnoughDataForPersonalization(interests);

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
    <View style={styles.container}>
      <FlatList
        data={personalizedShorts}
        renderItem={({ item, index }) => (
          <ShortsCard
            title={item.title}
            price={item.price}
            image={item.images[0]}
            images={item.images}
            videos={item.videos}
            sellerName={item.sellerName}
            sellerAvatar={item.sellerAvatar}
            sellerVerified={Boolean(item.sellerVerified)}
            location={item.location.city}
            category={item.category}
            condition={formatCondition(item.condition)}
            isSaved={savedIds.has(item.id)}
            isActive={index === currentIndex && isFocused}
            onSave={() => handleSave(item.id, item.category)}
            onContact={() => handleContact(item)}
            onDetails={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
            cardHeight={cardHeight}
            cardWidth={width}
          />
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={cardHeight}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Simple toggle button for images/videos - top right corner */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowOnlyVideos(!showOnlyVideos);
        }}
        style={[styles.floatingToggle, { top: insets.top + 12 }]}
      >
        <Feather name={showOnlyVideos ? 'play-circle' : 'image'} size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  floatingToggle: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 10,
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
