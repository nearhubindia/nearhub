import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

interface PhotoSlideshowProps {
  images: string[];
  isActive: boolean;
  interval?: number; // milliseconds between slides
  cardHeight: number;
  cardWidth: number;
}

/**
 * PhotoSlideshow Component
 * Automatically cycles through multiple photos with fade transitions
 * Creates a swipeable experience for photo listings
 */
export default function PhotoSlideshow({
  images,
  isActive,
  interval = 3000, // 3 seconds per image
  cardHeight,
  cardWidth,
}: PhotoSlideshowProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Auto-cycle through images when active
  useEffect(() => {
    if (!isActive || images.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
        setFadingOut(false);
      }, 300); // Fade duration
    }, interval);

    return () => clearInterval(timer);
  }, [isActive, images.length, interval]);

  const currentImage = images[currentImageIndex];
  const hasUnreachablePlaceholder =
    typeof currentImage === 'string' && currentImage.includes('via.placeholder.com');
  const imageSource = hasUnreachablePlaceholder
    ? require('../../assets/images/icon.png')
    : { uri: currentImage };

  if (!currentImage) {
    return (
      <View style={[styles.container, { width: cardWidth, height: cardHeight }]}>
        <View style={styles.placeholder}>
          <Feather name="image" size={40} color="#999" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]}>
      <Image
        source={imageSource}
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: fadingOut ? 0.7 : 1,
          },
        ]}
        contentFit="cover"
        transition={300}
      />

      {/* Photo count indicator */}
      {images.length > 1 && (
        <View style={styles.photoCountBadge}>
          <Feather name="image" size={12} color="#fff" />
          <Text style={styles.photoCountText}>
            {currentImageIndex + 1}/{images.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
