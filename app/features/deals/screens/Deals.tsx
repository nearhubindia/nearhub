import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import {
  countdownPartsFromMs,
  formatCountdown,
  isDealActiveNow,
  isDealCompleted,
  isDealUpcomingWithinWindow,
} from '@/lib/deal-timer';
import { getDiscountPercent } from '@/lib/deals';
import { hasMeaningfulCoordinates } from '@/lib/location-data';
import { bookDeal, DealBookingError } from '@/lib/deal-bookings';
import {
  createDealCardItem,
  sortDealItemsByDistance,
  type DealCardItem,
} from '@/lib/deal-card-items';
import {
  isPublishedDealListing,
  normalizeDealListingLocation,
  normalizeDealListingRecord,
} from '@/lib/deal-normalizers';
import { createResponsiveStyles } from '@/lib/responsive';
import AppTopHeader from '@/shared/components/AppTopHeader';
import { getApiUrl } from '@/lib/query-client';
import { Listing } from '@/lib/types';

type DealSectionItem = DealCardItem;

type DealSectionFilter = 'today' | 'upcoming' | 'expired';

function normalizeSectionFilter(value: string | string[] | undefined): DealSectionFilter | null {
  const normalized = String(Array.isArray(value) ? value[0] : value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'today' || normalized === 'upcoming' || normalized === 'expired') {
    return normalized;
  }

  return null;
}

function formatPriceInr(value?: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function normalizeDealItems(items: unknown[]): Listing[] {
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      return {
        ...(item as object),
        ...normalizeDealListingRecord(item),
        location: normalizeDealListingLocation(item),
      } as Listing;
    });
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <View style={styles.sectionTitleRow}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function CountdownStrip({ endAt, nowMs }: { endAt?: number; nowMs: number }) {
  return (
    <View style={styles.countdownStrip}>
      <Feather name="clock" size={14} color="#DC1633" />
      <Text style={styles.countdownStripText}>{formatCountdown(endAt, nowMs)}</Text>
    </View>
  );
}

function CountdownBlocks({ endAt, nowMs }: { endAt?: number; nowMs: number }) {
  const parts = countdownPartsFromMs(endAt, nowMs);

  return (
    <View style={styles.countdownBlocksRow}>
      {parts.map((part) => (
        <View key={part.label} style={styles.countdownBlock}>
          <Text style={styles.countdownBlockValue}>{part.value}</Text>
          <Text style={styles.countdownBlockLabel}>{part.label}</Text>
        </View>
      ))}
    </View>
  );
}

function DealCard({
  item,
  nowMs,
  compact = false,
  bookingId,
  onToggleSaved,
  saved,
  onBook,
}: {
  item: DealSectionItem;
  nowMs: number;
  compact?: boolean;
  bookingId: string | null;
  onToggleSaved: (id: string) => void;
  saved: boolean;
  onBook: (id: string) => void;
}) {
  const sale = getDiscountPercent({
    price: item.originalPrice || item.price,
    offerPrice: item.price,
  });

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <Pressable
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
      >
        <View style={[styles.cardMedia, compact && styles.compactCardMedia]}>
          <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" />
          {sale ? (
            <View style={styles.saleBadge}>
              <Text style={styles.saleBadgeText}>{sale}% OFF</Text>
            </View>
          ) : null}
          {item.badge ? (
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>{item.badge}</Text>
            </View>
          ) : null}
          <Pressable style={styles.saveButton} onPress={() => onToggleSaved(item.id)}>
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={16}
              color={saved ? '#EF4444' : '#FFFFFF'}
            />
          </Pressable>
        </View>
      </Pressable>

      <View style={[styles.cardBody, compact && styles.compactCardBody]}>
        <Text style={[styles.cardTitle, compact && styles.compactCardTitle]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.priceRow}>
          <View style={styles.priceStack}>
            <Text
              style={[styles.cardPrice, compact && styles.compactCardPrice]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {formatPriceInr(item.price)}
            </Text>
            {item.originalPrice ? (
              <Text
                style={styles.cardOriginalPrice}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {formatPriceInr(item.originalPrice)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.distanceRow}>
          <Feather
            name="map-pin"
            size={12}
            color={compact ? Colors.textSecondary : Colors.textTertiary}
          />
          <Text
            style={[styles.distanceText, compact && styles.compactDistanceText]}
            numberOfLines={1}
          >
            {item.location}
          </Text>
        </View>

        {item.dealStatus.startsWith('Ends in') ? (
          compact ? (
            <CountdownStrip endAt={item.dealEndsAt} nowMs={nowMs} />
          ) : (
            <View style={styles.countdownPanel}>
              <Text style={styles.countdownKicker}>DEAL ENDS IN</Text>
              <CountdownBlocks endAt={item.dealEndsAt} nowMs={nowMs} />
            </View>
          )
        ) : (
          <View style={styles.statusPanel}>
            <Text style={styles.statusKicker}>Deal status</Text>
            <Text style={styles.statusValue}>{item.dealStatus}</Text>
          </View>
        )}

        {item.dealStatus.startsWith('Ends in') ? (
          <Pressable
            style={[styles.bookButton, bookingId === item.id && styles.bookButtonDisabled]}
            onPress={() => onBook(item.id)}
            disabled={bookingId === item.id}
          >
            {bookingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.bookButtonText}>Book Deal</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function DealsScreen() {
  const insets = useSafeAreaInsets();
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const pathname = usePathname();
  const selectedSection = normalizeSectionFilter(section);
  const authRedirect = pathname && pathname !== '/auth/register' ? pathname : '';
  const { listings, savedIds, toggleSaved, refreshListings, isRefreshing } = useListings();
  const { user, cachedLocation, isAuthenticated } = useAuth();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [broadDealListings, setBroadDealListings] = useState<Listing[]>([]);
  const [isBroadRefreshing, setIsBroadRefreshing] = useState(false);
  const currentLocation = user?.location || cachedLocation;
  const hasCurrentLocationCoordinates = hasMeaningfulCoordinates(
    Number(currentLocation?.latitude),
    Number(currentLocation?.longitude)
  );
  const distanceCoords =
    hasCurrentLocationCoordinates && currentLocation
      ? {
          latitude: Number(currentLocation.latitude),
          longitude: Number(currentLocation.longitude),
        }
      : null;

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadBroadDealListings = useCallback(async () => {
    try {
      const response = await fetch(
        `${getApiUrl()}/api/listings?limit=500&dealsOnly=1&includeExpiredDeals=1`
      );
      if (!response.ok) return;

      const payload = (await response.json()) as {
        data?: unknown[];
        results?: unknown[];
      };
      setBroadDealListings(normalizeDealItems(payload.data || payload.results || []));
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setBroadDealListings([]);
      }
    }
  }, []);

  useEffect(() => {
    void loadBroadDealListings();
  }, [loadBroadDealListings]);

  const refreshDeals = useCallback(async () => {
    setIsBroadRefreshing(true);
    try {
      await Promise.all([refreshListings(), loadBroadDealListings()]);
    } finally {
      setIsBroadRefreshing(false);
    }
  }, [loadBroadDealListings, refreshListings]);

  const handleBookDeal = useCallback(
    async (listingId: string) => {
      if (!isAuthenticated || !user?.id) {
        Alert.alert('Sign in required', 'Please sign in to book a deal.');
        router.push({
          pathname: '/auth/register',
          params: authRedirect ? { redirect: authRedirect } : undefined,
        });
        return;
      }

      setBookingId(listingId);
      try {
        await bookDeal(listingId, user.id, user.phone || undefined);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Deal booked', 'Your deal booking has been created successfully.', [
          { text: 'Later', style: 'cancel' },
          { text: 'View bookings', onPress: () => router.push('/bookings') },
        ]);
      } catch (error) {
        if (error instanceof DealBookingError && error.code === 'ALREADY_BOOKED') {
          Alert.alert('Already booked', 'You already booked this deal.', [
            { text: 'OK' },
            { text: 'View bookings', onPress: () => router.push('/bookings') },
          ]);
          return;
        }
        Alert.alert('Booking failed', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setBookingId(null);
      }
    },
    [isAuthenticated, user?.id, user?.phone]
  );

  const allDealListings = useMemo(() => {
    const merged = new Map<string, Listing>();
    [...listings, ...broadDealListings]
      .filter((item) => isPublishedDealListing(item))
      .forEach((listing) => {
        merged.set(listing.id, listing);
      });
    return [...merged.values()];
  }, [broadDealListings, listings]);

  const mappedDeals = useMemo(
    () => allDealListings.map((item) => createDealCardItem(item, nowMs, distanceCoords)),
    [allDealListings, nowMs, distanceCoords]
  );
  const sortedMappedDeals = useMemo(() => sortDealItemsByDistance(mappedDeals), [mappedDeals]);

  const todaysDeals = useMemo(
    () =>
      sortedMappedDeals
        .filter((item) => {
          const source = allDealListings.find((listing) => listing.id === item.id);
          return source ? isDealActiveNow(source, nowMs) : false;
        })
        .sort((a, b) => Number(a.dealEndsAt || 0) - Number(b.dealEndsAt || 0)),
    [allDealListings, sortedMappedDeals, nowMs]
  );

  const upcomingDeals = useMemo(
    () =>
      sortedMappedDeals.filter((item) => {
        const source = allDealListings.find((listing) => listing.id === item.id);
        return source ? isDealUpcomingWithinWindow(source, nowMs) : false;
      }),
    [allDealListings, sortedMappedDeals, nowMs]
  );

  const expiredDeals = useMemo(
    () =>
      sortedMappedDeals
        .filter((item) => {
          const source = allDealListings.find((listing) => listing.id === item.id);
          return source ? isDealCompleted(source, nowMs) : false;
        })
        .sort((a, b) => Number(b.dealEndsAt || 0) - Number(a.dealEndsAt || 0)),
    [allDealListings, sortedMappedDeals, nowMs]
  );

  const showTodaySection = !selectedSection || selectedSection === 'today';
  const showUpcomingSection = !selectedSection || selectedSection === 'upcoming';
  const showExpiredSection = !selectedSection || selectedSection === 'expired';

  const heroTitle =
    selectedSection === 'today'
      ? 'Active Deals'
      : selectedSection === 'upcoming'
        ? 'Upcoming Deals'
        : selectedSection === 'expired'
          ? 'Expired Deals'
          : 'Discover Deals';
  const heroSubtitle =
    selectedSection === 'today'
      ? 'Browse every live deal currently active across NearHub.'
      : selectedSection === 'upcoming'
        ? 'Browse every scheduled deal that is starting soon.'
        : selectedSection === 'expired'
          ? 'Browse all expired deals kept for reference.'
          : 'Browse live offers and upcoming promotions in the same native app layout as the rest of NearHub.';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing || isBroadRefreshing} onRefresh={refreshDeals} />
      }
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
    >
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <AppTopHeader
          eyebrow="NearHub Deals"
          title={heroTitle}
          subtitle={heroSubtitle}
          rightAction={
            <Pressable style={styles.bookingsButton} onPress={() => router.push('/bookings')}>
              <Feather name="clipboard" size={16} color={Colors.text} />
            </Pressable>
          }
        />
      </View>

      {showTodaySection ? (
        <View style={styles.section}>
          <SectionHeader
            icon={<Feather name="tag" size={18} color={Colors.primary} />}
            title="Active Deals"
          />
          {todaysDeals.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRail}
            >
              {todaysDeals.map((item) => (
                <View key={item.id} style={styles.railCardWrap}>
                  <DealCard
                    item={item}
                    nowMs={nowMs}
                    compact
                    bookingId={bookingId}
                    onToggleSaved={toggleSaved}
                    saved={savedIds.has(item.id)}
                    onBook={handleBookDeal}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <EmptyState message="No active deals are available right now." />
          )}
        </View>
      ) : null}

      {showUpcomingSection ? (
        <View style={styles.section}>
          <SectionHeader
            icon={<Feather name="zap" size={18} color="#F97316" />}
            title="Upcoming Deals"
            subtitle="Deals starting soon, sorted by distance"
          />
          {upcomingDeals.length > 0 ? (
            <View style={styles.grid}>
              {upcomingDeals.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <DealCard
                    item={item}
                    nowMs={nowMs}
                    bookingId={bookingId}
                    onToggleSaved={toggleSaved}
                    saved={savedIds.has(item.id)}
                    onBook={handleBookDeal}
                  />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState message="No upcoming deals are available right now." />
          )}
        </View>
      ) : null}

      {showExpiredSection ? (
        <View style={styles.section}>
          <SectionHeader
            icon={<Feather name="clock" size={18} color={Colors.textSecondary} />}
            title="Expired Deals"
            subtitle="Closed offers are still visible for price reference"
          />
          {expiredDeals.length > 0 ? (
            <View style={styles.grid}>
              {expiredDeals.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <DealCard
                    item={item}
                    nowMs={nowMs}
                    bookingId={bookingId}
                    onToggleSaved={toggleSaved}
                    saved={savedIds.has(item.id)}
                    onBook={handleBookDeal}
                  />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState message="No expired deals yet." />
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bookingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 21,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  horizontalRail: {
    paddingRight: 8,
    gap: 10,
  },
  railCardWrap: {
    width: 180,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48.5%',
  },
  comboSectionGrid: {
    gap: 14,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compactCard: {
    borderRadius: 16,
  },
  cardMedia: {
    position: 'relative',
    aspectRatio: 0.92,
    backgroundColor: '#F8FAFC',
  },
  compactCardMedia: {
    aspectRatio: 1.05,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  saleBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  dealBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.85)',
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  saveButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 10,
  },
  compactCardBody: {
    padding: 8,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  compactCardTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  priceStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  cardPrice: {
    fontSize: 18,
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  compactCardPrice: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter_700Bold',
  },
  comboPrice: {
    fontSize: 22,
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  cardOriginalPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontFamily: 'Inter_400Regular',
  },
  distanceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  compactDistanceText: {
    color: '#475569',
  },
  countdownStrip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  countdownStripText: {
    color: '#DC1633',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  countdownPanel: {
    marginTop: 12,
    alignItems: 'center',
  },
  countdownKicker: {
    fontSize: 10,
    letterSpacing: 2.4,
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  countdownBlocksRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  countdownBlock: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F8D9DD',
  },
  countdownBlockValue: {
    color: '#DC1633',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  countdownBlockLabel: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 7,
    fontFamily: 'Inter_500Medium',
  },
  statusPanel: {
    marginTop: 12,
    alignItems: 'center',
  },
  statusKicker: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: 'Inter_400Regular',
  },
  statusValue: {
    marginTop: 4,
    color: '#DC1633',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  bookButton: {
    marginTop: 12,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonDisabled: {
    opacity: 0.7,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
});
