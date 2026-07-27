import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

interface MediaCarouselProps {
  images?: string[];
  /** Kept for API compatibility with legacy listings; videos are intentionally ignored. */
  videos?: string[];
  height: number;
  isFocused?: boolean;
  onCurrentMediaTypeChange?: (type: 'image') => void;
}

/** Image-only listing carousel. Video playback is no longer supported. */
export default function MediaCarousel({
  images = [],
  height,
  onCurrentMediaTypeChange,
}: MediaCarouselProps) {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = images.filter(Boolean);

  React.useEffect(() => {
    if (items.length) onCurrentMediaTypeChange?.('image');
  }, [items.length, onCurrentMediaTypeChange]);

  if (!items.length) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.placeholder}>
          <Feather name="image" size={40} color="#999" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, index) => `${uri}-${index}`}
        onMomentumScrollEnd={(event) =>
          setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={[styles.mediaContainer, { width, height }]}>
            <Image source={{ uri: item }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        )}
      />
      {items.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {items.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', position: 'relative' },
  mediaContainer: { backgroundColor: '#000' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  counterText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
