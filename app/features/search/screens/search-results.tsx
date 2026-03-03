import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Platform,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import {
  rankListingsByPersonalization,
  hasEnoughDataForPersonalization,
} from '@/lib/personalization';
import { calculateDistance } from '@/lib/location-data';
import { Category, CATEGORIES } from '@/lib/types';
import { formatCondition } from '@/lib/utils';
import ListingCard from '@/shared/components/ListingCard';
import CategoryPill from '@/shared/components/CategoryPill';
import { useAdminSettings } from '@/lib/use-admin-settings';
import { createResponsiveStyles } from '@/lib/responsive';

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const {
    query = '',
    pincode = '',
    lat = '',
    lon = '',
    category = 'All',
    radius = '',
  } = useLocalSearchParams();
  const { listings, savedIds, toggleSaved, isLoading, refreshListings, loadMore, hasMore } =
    useListings();
  const { user } = useAuth();
  const { interests, trackSave } = useUserInterests();
  const { geoRadiusKm } = useAdminSettings();

  const initialCategoryParam = Array.isArray(category) ? category[0] : category;
  const initialCategory: Category | 'All' =
    initialCategoryParam === 'All' || CATEGORIES.includes(initialCategoryParam as Category)
      ? (initialCategoryParam as Category | 'All')
      : 'All';

  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(initialCategory);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(Array.isArray(query) ? query[0] : query || '');

  const userLat = lat ? parseFloat(Array.isArray(lat) ? lat[0] : lat) : null;
  const userLon = lon ? parseFloat(Array.isArray(lon) ? lon[0] : lon) : null;
  const radiusParam = radius ? parseFloat(Array.isArray(radius) ? radius[0] : radius) : NaN;
  const effectiveRadiusKm = Number.isFinite(radiusParam)
    ? radiusParam
    : (user?.preferences?.searchRadiusKm ?? geoRadiusKm);
  const hasEnoughData = hasEnoughDataForPersonalization(interests);
  const headerTitle = selectedCategory === 'All' ? 'Search Results' : `${selectedCategory} Results`;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const filteredListings = useMemo(() => {
    let results = listings;

    // Filter by category
    if (selectedCategory !== 'All') {
      results = results.filter((item) => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      results = results.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.description.toLowerCase().includes(lowerQuery) ||
          item.category.toLowerCase().includes(lowerQuery) ||
          item.location.city.toLowerCase().includes(lowerQuery)
      );
    }

    if (userLat !== null && userLon !== null) {
      results = results.filter((item) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          item.location.latitude,
          item.location.longitude
        );
        return distance <= effectiveRadiusKm;
      });
    }

    // Rank by personalization if we have enough data
    if (hasEnoughData) {
      const ranked = rankListingsByPersonalization(results, interests);
      results = ranked.map((item) => item.listing);
    }

    // Sort by distance if location is available
    if (userLat !== null && userLon !== null) {
      results = results.sort((a, b) => {
        const distA = calculateDistance(
          userLat,
          userLon,
          a.location.latitude,
          a.location.longitude
        );
        const distB = calculateDistance(
          userLat,
          userLon,
          b.location.latitude,
          b.location.longitude
        );
        return distA - distB;
      });
    }

    return results;
  }, [
    listings,
    selectedCategory,
    searchQuery,
    interests,
    hasEnoughData,
    userLat,
    userLon,
    effectiveRadiusKm,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshListings();
    setRefreshing(false);
  }, [refreshListings]);

  const handleSave = useCallback(
    (id: string, category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSaved(id);
      trackSave(id, category).catch(console.error);
    },
    [toggleSaved, trackSave]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listings)[0]; index: number }) => (
      <View style={index % 2 === 0 ? styles.leftColumn : styles.rightColumn}>
        <ListingCard
          id={item.id}
          title={item.title}
          description={item.description}
          price={item.price}
          offerPrice={item.offerPrice}
          priceUnit={item.priceUnit}
          image={item.images[0]}
          location={item.location.city}
          condition={formatCondition(item.condition)}
          isSaved={savedIds.has(item.id)}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          onSave={() => handleSave(item.id, item.category)}
        />
      </View>
    ),
    [savedIds, handleSave]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top || webTopInset }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerPlaceholder} />
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Search Bar */}
            <View style={styles.searchBarContainer}>
              <Pressable
                style={styles.searchBar}
                onPress={() =>
                  router.push({
                    pathname: '/search',
                    params: {
                      query: searchQuery,
                      lat: userLat?.toString() || '',
                      lon: userLon?.toString() || '',
                      pincode: Array.isArray(pincode) ? pincode[0] : pincode,
                      category: selectedCategory,
                      radius: effectiveRadiusKm.toString(),
                    },
                  })
                }
              >
                <Feather name="search" size={18} color={Colors.textTertiary} />
                <Text style={styles.searchPlaceholder} numberOfLines={1}>
                  {searchQuery.trim() ? searchQuery : 'Search Listing'}
                </Text>
                <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
              </Pressable>
              <Text style={styles.resultCount}>
                {filteredListings.length} {filteredListings.length === 1 ? 'result' : 'results'}{' '}
                found
              </Text>
            </View>

            {/* Categories */}
            <FlatList
              data={['All', ...CATEGORIES]}
              renderItem={({ item: cat }) => (
                <CategoryPill
                  category={cat === 'All' ? 'All' : (cat as any)}
                  isSelected={selectedCategory === cat}
                  onPress={() => setSelectedCategory(cat as any)}
                />
              )}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
              scrollEnabled
            />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              No listings match your search. Try different keywords or browse categories.
            </Text>
          </View>
        }
        onEndReached={() => {
          if (hasMore && !isLoading) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadingFooter}>
              <Text style={styles.loadingText}>Loading more...</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  headerPlaceholder: {
    width: 40,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  row: {
    paddingHorizontal: 8,
    gap: 2,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
