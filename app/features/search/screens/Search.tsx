import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { useSearchHistory } from '@/shared/contexts/search-history-context';
import { useListings } from '@/shared/contexts/listings-context';
import { Category } from '@/lib/types';
import { useListingTaxonomy } from '@/lib/use-listing-taxonomy';
import { getCategoryDisplayMeta } from '@/lib/category-display';
import { trackSearchEvent } from '@/lib/firebase-analytics';

const TOP_CATEGORIES_DAILY_CACHE_KEY = '@nearhub_top_categories_daily_cache_v1';
const TOP_CATEGORY_LIMIT = 16;
const TOP_CATEGORIES_TIMEZONE = 'Asia/Kolkata';

interface TopCategoriesDailyCache {
  dateKey: string;
  categories: Category[];
}

function getLocalDateKey(date: Date = new Date()): string {
  try {
    // Use a fixed market timezone so daily ordering is consistent across devices.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TOP_CATEGORIES_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function sanitizeCachedCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Category => typeof item === 'string' && item.trim().length > 0
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const {
    lat = '',
    lon = '',
    pincode = '',
    category = 'All',
    query = '',
    radius = '',
  } = useLocalSearchParams();
  const {
    isLoaded: isSearchHistoryLoaded,
    searchHistory,
    recentSearches,
    trendingSearches,
    addSearch,
  } = useSearchHistory();
  const { listings } = useListings();
  const { groups: categoryGroups } = useListingTaxonomy();
  const { banners: searchBanners, isLoading: isSearchBannersLoading } =
    useAppScreenBanners('search');
  const queryValue = Array.isArray(query) ? query[0] : query;
  const [searchQuery, setSearchQuery] = useState(queryValue || '');

  const latValue = Array.isArray(lat) ? lat[0] : lat;
  const lonValue = Array.isArray(lon) ? lon[0] : lon;
  const pincodeValue = Array.isArray(pincode) ? pincode[0] : pincode;
  const categoryValue = Array.isArray(category) ? category[0] : category;
  const radiusValue = Array.isArray(radius) ? radius[0] : radius;
  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          categoryGroups.flatMap((group) => group.subcategories).filter((item) => Boolean(item))
        )
      ),
    [categoryGroups]
  );
  const categoryIconByName = useMemo(() => {
    const iconMap = new Map<string, string>();
    categoryGroups.forEach((group) => {
      group.subcategories.forEach((subcategory) => {
        const iconUrl = group.subcategoryIcons?.[subcategory];
        if (iconUrl) iconMap.set(subcategory, iconUrl);
      });
    });
    return iconMap;
  }, [categoryGroups]);
  const initialCategory =
    categoryValue === 'All' ? 'All' : ((categoryValue || 'All') as Category | 'All');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(initialCategory);
  const [topCategoryTiles, setTopCategoryTiles] = useState<Category[]>(
    availableCategories.slice(0, TOP_CATEGORY_LIMIT)
  );
  const topCategoriesDailyCacheRef = useRef<TopCategoriesDailyCache | null>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const searchableListings = useMemo(
    () =>
      listings.filter((listing) => {
        const status = (listing.status || 'active').toLowerCase();
        if (status !== 'active') return false;
        if (listing.expiresAt && new Date(listing.expiresAt).getTime() < Date.now()) return false;
        return true;
      }),
    [listings]
  );

  useEffect(() => {
    setTopCategoryTiles((current) =>
      current.length > 0 ? current : availableCategories.slice(0, TOP_CATEGORY_LIMIT)
    );
  }, [availableCategories]);

  const navigateToResults = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return;
      }

      addSearch(
        normalizedQuery,
        categoryValue === 'All' ? undefined : categoryValue,
        undefined
      ).catch(console.error);
      void trackSearchEvent({
        searchTerm: normalizedQuery,
        category: categoryValue === 'All' ? undefined : String(categoryValue),
        location: pincodeValue || undefined,
      });

      router.push({
        pathname: '/search-results',
        params: {
          query: normalizedQuery,
          lat: latValue,
          lon: lonValue,
          pincode: pincodeValue,
          category: categoryValue,
          radius: radiusValue,
        },
      });
    },
    [addSearch, latValue, lonValue, pincodeValue, categoryValue]
  );

  const handleBack = useCallback((): void => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)');
  }, []);

  const navigateToCategoryResults = useCallback(
    (nextCategory: Category | 'All') => {
      setSelectedCategory(nextCategory);

      const queryForHistory = searchQuery.trim() || nextCategory;
      addSearch(
        queryForHistory,
        nextCategory === 'All' ? undefined : nextCategory,
        undefined
      ).catch(console.error);
      void trackSearchEvent({
        searchTerm: searchQuery.trim() || String(nextCategory),
        category: nextCategory === 'All' ? undefined : String(nextCategory),
        location: pincodeValue || undefined,
      });

      router.push({
        pathname: '/search-results',
        params: {
          query: searchQuery.trim(),
          lat: latValue,
          lon: lonValue,
          pincode: pincodeValue,
          category: nextCategory,
          radius: radiusValue,
        },
      });
    },
    [searchQuery, addSearch, latValue, lonValue, pincodeValue]
  );

  const rankedTopCategoryTiles = useMemo((): Category[] => {
    if (availableCategories.length === 0) {
      return [];
    }
    if (searchHistory.length === 0) {
      return availableCategories.slice(0, TOP_CATEGORY_LIMIT);
    }

    const categoryScores: Record<string, number> = Object.fromEntries(
      availableCategories.map((cat) => [cat, 0])
    );

    searchHistory.forEach((item) => {
      const weight = Math.max(1, item.searchCount);
      const normalizedQuery = item.query.toLowerCase().trim();

      if (item.category && categoryScores[item.category] !== undefined) {
        categoryScores[item.category] += weight * 2;
      }

      if (!normalizedQuery) {
        return;
      }

      availableCategories.forEach((categoryName) => {
        if (normalizedQuery.includes(categoryName.toLowerCase())) {
          categoryScores[categoryName] += weight * 2;
        }
      });

      searchableListings.forEach((listing) => {
        const matches =
          listing.title.toLowerCase().includes(normalizedQuery) ||
          listing.description.toLowerCase().includes(normalizedQuery) ||
          listing.category.toLowerCase().includes(normalizedQuery) ||
          listing.location.city.toLowerCase().includes(normalizedQuery);

        if (matches) {
          categoryScores[listing.category] += weight;
        }
      });
    });

    const ranked = [...availableCategories].sort((a, b) => {
      const diff = categoryScores[b] - categoryScores[a];
      if (diff !== 0) {
        return diff;
      }
      return availableCategories.indexOf(a) - availableCategories.indexOf(b);
    });

    return ranked.slice(0, TOP_CATEGORY_LIMIT);
  }, [searchHistory, searchableListings, availableCategories]);

  useEffect(() => {
    if (!isSearchHistoryLoaded) return;

    const todayKey = getLocalDateKey();
    if (topCategoriesDailyCacheRef.current?.dateKey === todayKey) {
      return;
    }

    let cancelled = false;

    const loadOrComputeTopCategories = async () => {
      try {
        const stored = await AsyncStorage.getItem(TOP_CATEGORIES_DAILY_CACHE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { dateKey?: unknown; categories?: unknown };
          const cachedDateKey = typeof parsed.dateKey === 'string' ? parsed.dateKey : '';
          const cachedCategories = sanitizeCachedCategories(parsed.categories).slice(
            0,
            TOP_CATEGORY_LIMIT
          );

          if (cachedDateKey === todayKey && cachedCategories.length > 0) {
            topCategoriesDailyCacheRef.current = {
              dateKey: todayKey,
              categories: cachedCategories,
            };
            if (!cancelled) {
              setTopCategoryTiles(cachedCategories);
            }
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load daily top categories cache:', error);
      }

      const todaysCategories = rankedTopCategoryTiles.slice(0, TOP_CATEGORY_LIMIT);
      topCategoriesDailyCacheRef.current = {
        dateKey: todayKey,
        categories: todaysCategories,
      };

      if (!cancelled) {
        setTopCategoryTiles(todaysCategories);
      }

      AsyncStorage.setItem(
        TOP_CATEGORIES_DAILY_CACHE_KEY,
        JSON.stringify({
          dateKey: todayKey,
          categories: todaysCategories,
        })
      ).catch((error) => {
        console.error('Failed to save daily top categories cache:', error);
      });
    };

    loadOrComputeTopCategories();

    return () => {
      cancelled = true;
    };
  }, [isSearchHistoryLoaded, rankedTopCategoryTiles]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || webTopInset }]}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Listing"
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => navigateToResults(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Feather name="x-circle" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
          onPress={() => navigateToResults(searchQuery)}
          disabled={!searchQuery.trim()}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>

        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <Text style={styles.categoriesTitle}>Top Categories</Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/categories',
                  params: {
                    query: searchQuery,
                    lat: latValue,
                    lon: lonValue,
                    pincode: pincodeValue,
                    radius: radiusValue,
                  },
                })
              }
              hitSlop={8}
            >
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.categoriesGrid}>
            {topCategoryTiles.map((item) => {
              const meta = getCategoryDisplayMeta(item);
              const iconUrl = categoryIconByName.get(item);
              const isSelected = selectedCategory === item;

              return (
                <Pressable
                  key={item}
                  style={styles.categoryTile}
                  onPress={() => navigateToCategoryResults(item)}
                >
                  <View style={[styles.iconTile, isSelected && styles.iconTileSelected]}>
                    {iconUrl ? (
                      <Image
                        source={{ uri: iconUrl }}
                        style={styles.pictureImage}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                      />
                    ) : meta.pictureImage ? (
                      <Image
                        source={{ uri: meta.pictureImage }}
                        style={styles.pictureImage}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Text style={styles.pictureIconFallback}>{meta.picture}</Text>
                    )}
                  </View>
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <AppScreenBanners banners={searchBanners} isLoading={isSearchBannersLoading} />

        {recentSearches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            {recentSearches.map((item, index) => (
              <Pressable
                key={`recent-${index}-${item.query}`}
                style={styles.rowItem}
                onPress={() => navigateToResults(item.query)}
              >
                <Feather name="clock" size={14} color={Colors.textSecondary} />
                <Text style={styles.rowText}>{item.query}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {trendingSearches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending</Text>
            {trendingSearches.map((item, index) => (
              <Pressable
                key={`trending-${index}-${item.query}`}
                style={styles.rowItem}
                onPress={() => navigateToResults(item.query)}
              >
                <Feather name="trending-up" size={14} color={Colors.primary} />
                <Text style={styles.rowText}>{item.query}</Text>
                <Text style={styles.countBadge}>{item.searchCount}x</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  searchButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.surface,
  },
  section: {
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  categoriesSection: {
    marginTop: 10,
  },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoriesTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    paddingTop: 4,
    paddingBottom: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
    textTransform: 'uppercase',
    paddingRight: 2,
  },
  categoriesGrid: {
    paddingTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4,
  },
  categoryTile: {
    width: '23%',
    alignItems: 'center',
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  pictureImage: {
    width: 20,
    height: 20,
    position: 'absolute',
  },
  pictureIconFallback: {
    fontSize: 16,
    lineHeight: 18,
    opacity: 1,
  },
  iconTileSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryLabel: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  categoryLabelSelected: {
    color: Colors.primary,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  countBadge: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
});
