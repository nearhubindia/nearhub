import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import type { AppScreenBanner } from '@/shared/hooks/use-app-screen-banners';

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PADDING = 5;
const BANNER_WIDTH = SCREEN_WIDTH - H_PADDING * 2; // Equal padding both sides
const BANNER_HEIGHT = (BANNER_WIDTH / 16) * 9; // 16:9 aspect ratio
const GAP = 12;

interface AppScreenBannersProps {
  banners: AppScreenBanner[];
  isLoading: boolean;
}

export default function AppScreenBanners({ banners, isLoading }: AppScreenBannersProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle manual scrolling to update current index
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollX / (BANNER_WIDTH + GAP));
    const clampedIndex = Math.min(Math.max(0, index), banners.length - 1);
    setCurrentIndex(clampedIndex);
  };

  // Auto-scroll banners
  useEffect(() => {
    if (banners.length < 2) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % banners.length;
        const scrollPosition = nextIndex * (BANNER_WIDTH + GAP);
        scrollRef.current?.scrollTo({
          x: scrollPosition,
          animated: true,
        });
        return nextIndex;
      });
    }, 3000); // Auto-scroll every 3 seconds

    return () => clearInterval(interval);
  }, [banners.length]);

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        decelerationRate="fast"
        snapToInterval={BANNER_WIDTH + GAP}
        snapToAlignment="start"
        scrollEnabled={banners.length > 1}
      >
        {banners.map((banner) => (
          <Pressable key={banner.id} style={styles.bannerCard}>
            <Image source={{ uri: banner.imageUrl }} style={styles.bannerImage} contentFit="fill" />
          </Pressable>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {banners.length > 1 && (
        <View style={styles.dotsContainer}>
          {banners.map((_, index) => (
            <View key={index} style={[styles.dot, index === currentIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 0,
    marginBottom: 4,
    marginHorizontal: -12, // Counteract parent padding
  },
  loadingWrap: {
    marginVertical: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    paddingHorizontal: H_PADDING,
    gap: GAP,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
});
