import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import { useUserInterests } from '@/shared/contexts/user-interests-context';
import { calculateDistance } from '@/lib/location-data';
import { formatCondition } from '@/lib/utils';
import ListingCard from '@/shared/components/ListingCard';
import { createResponsiveStyles } from '@/lib/responsive';

type SectionType = 'nearby' | 'featured';

export default function HomeSectionListScreen() {
  const insets = useSafeAreaInsets();
  const { section = 'nearby', lat = '', lon = '', radius = '', city = '' } = useLocalSearchParams();
  const { listings, savedIds, toggleSaved } = useListings();
  const { user } = useAuth();
  const { trackSave } = useUserInterests();

  const sectionParam = (Array.isArray(section) ? section[0] : section) as SectionType;
  const cityParam = Array.isArray(city) ? city[0] : city;
  const latParam = Array.isArray(lat) ? lat[0] : lat;
  const lonParam = Array.isArray(lon) ? lon[0] : lon;
  const radiusParam = Array.isArray(radius) ? radius[0] : radius;

  const userLat = latParam ? Number(latParam) : (user?.location?.latitude ?? null);
  const userLon = lonParam ? Number(lonParam) : (user?.location?.longitude ?? null);
  const selectedRadiusKm = radiusParam
    ? Number(radiusParam)
    : (user?.preferences?.searchRadiusKm ?? 50);

  const headerTitle = sectionParam === 'featured' ? 'Featured Deals' : 'Near You';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const visibleListings = useMemo(
    () =>
      listings.filter((item) => {
        const status = (item.status || 'active').toLowerCase();
        if (status !== 'active') return false;
        if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) return false;
        return true;
      }),
    [listings]
  );

  const listingsByLocation = useMemo(() => {
    if (userLat === null || userLon === null) return visibleListings;

    return visibleListings.filter((item) => {
      const distance = calculateDistance(
        userLat,
        userLon,
        item.location.latitude,
        item.location.longitude
      );
      return distance <= selectedRadiusKm;
    });
  }, [visibleListings, userLat, userLon, selectedRadiusKm]);

  const nearYouListings = useMemo(() => {
    if (userLat === null || userLon === null) return [];

    return [...listingsByLocation].sort((a, b) => {
      const distA = calculateDistance(userLat, userLon, a.location.latitude, a.location.longitude);
      const distB = calculateDistance(userLat, userLon, b.location.latitude, b.location.longitude);
      return distA - distB;
    });
  }, [listingsByLocation, userLat, userLon]);

  const featuredListings = useMemo(
    () => listingsByLocation.filter((item) => Boolean(item.featured)),
    [listingsByLocation]
  );

  const data = sectionParam === 'featured' ? featuredListings : nearYouListings;

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
          sellerVerified={Boolean(item.sellerVerified)}
          isBoosted={Boolean(item.featured)}
          isSponsored={Boolean((item as any).sponsored)}
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
      <View style={[styles.header, { paddingTop: insets.top || webTopInset }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {data.length} {data.length === 1 ? 'listing' : 'listings'}
            {cityParam ? ` in ${cityParam}` : ''}
          </Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptySubtitle}>
              {sectionParam === 'featured'
                ? 'No featured deals available for this location yet.'
                : 'No nearby listings found for this location yet.'}
            </Text>
          </View>
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
  headerTextWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  headerPlaceholder: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  leftColumn: {
    flex: 1,
    marginRight: 6,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
