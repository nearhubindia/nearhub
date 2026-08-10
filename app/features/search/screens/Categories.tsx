import React, { useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { Category } from '@/lib/types';
import { useListingTaxonomy } from '@/lib/use-listing-taxonomy';
import { getCategoryDisplayMeta } from '@/lib/category-display';

interface CategoryItem {
  key: string;
  label: Category;
  iconUrl?: string;
}

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { query = '', pincode = '', lat = '', lon = '' } = useLocalSearchParams();
  const { groups: categoryGroups } = useListingTaxonomy();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const categoryItems = React.useMemo(
    () =>
      Array.from(new Set(categoryGroups.flatMap((group) => group.subcategories))).map(
        (category) => {
          const group = categoryGroups.find((item) => item.subcategories.includes(category));
          return {
            key: category,
            label: category,
            iconUrl: group?.subcategoryIcons?.[category],
          };
        }
      ),
    [categoryGroups]
  );

  const queryValue = Array.isArray(query) ? query[0] : query;
  const pincodeValue = Array.isArray(pincode) ? pincode[0] : pincode;
  const latValue = Array.isArray(lat) ? lat[0] : lat;
  const lonValue = Array.isArray(lon) ? lon[0] : lon;

  const handleCategoryPress = useCallback(
    (category: Category) => {
      router.push({
        pathname: '/search-results',
        params: {
          query: queryValue,
          pincode: pincodeValue,
          lat: latValue,
          lon: lonValue,
          category,
        },
      });
    },
    [queryValue, pincodeValue, latValue, lonValue]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || webTopInset }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>All Categories</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={categoryItems}
        keyExtractor={(item) => item.key}
        numColumns={4}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 36 }]}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => {
          const meta = getCategoryDisplayMeta(item.label);

          return (
            <Pressable style={styles.categoryCard} onPress={() => handleCategoryPress(item.label)}>
              <View style={styles.iconTile}>
                {item.iconUrl ? (
                  <Image
                    source={{ uri: item.iconUrl }}
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
              <Text style={styles.categoryText} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
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
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryCard: {
    width: '23%',
    alignItems: 'center',
  },
  iconTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pictureImage: {
    width: 32,
    height: 32,
    position: 'absolute',
  },
  pictureIconFallback: {
    fontSize: 24,
    lineHeight: 26,
    opacity: 1,
  },
  categoryText: {
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    color: Colors.text,
    fontFamily: 'Inter_500Medium',
  },
});
