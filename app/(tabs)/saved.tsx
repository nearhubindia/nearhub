import React, { useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/lib/listings-context';
import { getTimeAgo, formatCondition } from '@/lib/utils';
import ListingCard from '@/components/ListingCard';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedIds, toggleSaved, getSavedListings } = useListings();
  const savedListings = getSavedListings();

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleSave = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);
    },
    [toggleSaved],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 8 }]}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.count}>{savedListings.length} items</Text>
      </View>

      <FlatList
        data={savedListings}
        renderItem={({ item, index }) => (
          <View style={index % 2 === 0 ? styles.leftCol : styles.rightCol}>
            <ListingCard
              id={item.id}
              title={item.title}
              price={item.price}
              image={item.images[0]}
              location={item.location.city}
              condition={formatCondition(item.condition)}
              timeAgo={getTimeAgo(item.createdAt)}
              isSaved={savedIds.has(item.id)}
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
              onSave={() => handleSave(item.id)}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="heart" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No saved listings</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart icon on listings you like to save them here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  count: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftCol: {
    marginRight: 6,
  },
  rightCol: {
    marginLeft: 6,
  },
  listContent: {
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
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
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
