import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ScrollView,
  Platform,
  RefreshControl,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/lib/listings-context';
import { Category, CATEGORIES } from '@/lib/types';
import { getTimeAgo, formatCondition } from '@/lib/utils';
import ListingCard from '@/components/ListingCard';
import CategoryPill from '@/components/CategoryPill';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { listings, savedIds, toggleSaved, isLoading, refreshListings } = useListings();
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredListings = useMemo(() => {
    let result = listings;

    if (selectedCategory !== 'All') {
      result = result.filter((l) => l.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          l.sellerName.toLowerCase().includes(q) ||
          l.location.city.toLowerCase().includes(q),
      );
    }

    return result;
  }, [listings, selectedCategory, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshListings();
    setRefreshing(false);
  }, []);

  const handleSave = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);
    },
    [toggleSaved],
  );

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listings)[0]; index: number }) => (
      <View style={index % 2 === 0 ? styles.leftColumn : styles.rightColumn}>
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
    ),
    [savedIds, handleSave],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.greeting}>adlix</Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={Colors.primary} />
            <Text style={styles.locationText}>San Francisco, CA</Text>
          </View>
        </View>

        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search listings, categories, sellers..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x-circle" size={18} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {searchQuery.trim().length > 0 && (
            <Text style={styles.resultCount}>
              {filteredListings.length} {filteredListings.length === 1 ? 'result' : 'results'} found
            </Text>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <CategoryPill
            category="All"
            isSelected={selectedCategory === 'All'}
            onPress={() => setSelectedCategory('All')}
          />
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat}
              category={cat}
              isSelected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredListings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name={searchQuery.trim() ? 'search' : 'inbox'} size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No results found' : 'No listings found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? `No listings match "${searchQuery.trim()}". Try different keywords.`
                : selectedCategory !== 'All'
                ? `No items in ${selectedCategory}. Try a different category.`
                : 'Pull to refresh or create a new listing.'}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTop: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    paddingVertical: 0,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
    marginTop: 6,
    marginLeft: 4,
  },
  categoryScroll: {
    paddingHorizontal: 16,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftColumn: {
    marginRight: 6,
  },
  rightColumn: {
    marginLeft: 6,
  },
  listContent: {
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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
