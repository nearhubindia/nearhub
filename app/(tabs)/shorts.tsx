import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/lib/listings-context';
import { formatCondition } from '@/lib/utils';
import ShortsCard from '@/components/ShortsCard';

const { height, width } = Dimensions.get('window');

export default function ShortsScreen() {
  const insets = useSafeAreaInsets();
  const { listings, savedIds, toggleSaved } = useListings();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSave = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);
    },
    [toggleSaved],
  );

  const handleContact = useCallback((item: (typeof listings)[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/chat/[listingId]',
      params: {
        listingId: item.id,
        sellerName: item.sellerName,
        listingTitle: item.title,
        listingImage: item.images[0],
      },
    });
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  if (listings.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top || webTopInset }]}>
        <Feather name="film" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No shorts yet</Text>
        <Text style={styles.emptySubtitle}>Listings will appear here as shorts</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        renderItem={({ item }) => (
          <ShortsCard
            title={item.title}
            price={item.price}
            image={item.images[0]}
            sellerName={item.sellerName}
            location={item.location.city}
            category={item.category}
            condition={formatCondition(item.condition)}
            isSaved={savedIds.has(item.id)}
            onSave={() => handleSave(item.id)}
            onContact={() => handleContact(item)}
            onDetails={() =>
              router.push({ pathname: '/listing/[id]', params: { id: item.id } })
            }
          />
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />

      <View style={[styles.topOverlay, { top: (insets.top || webTopInset) + 8 }]}>
        <Text style={styles.shortsTitle}>Shorts</Text>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIndex + 1}/{listings.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  shortsTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  counter: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
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
