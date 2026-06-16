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
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { useListings } from '@/shared/contexts/listings-context';
import { useAuth } from '@/shared/contexts/auth-context';
import {
  countdownPartsFromMs,
  formatCountdown,
  formatDealStatus,
  getEffectiveDealWindow,
  isDealActiveNow,
  isDealExpired,
  isDealUpcoming,
} from '@/lib/deal-timer';
import { getDiscountPercent } from '@/lib/deals';
import { calculateDistance } from '@/lib/location-data';
import { bookDeal } from '@/lib/deal-bookings';
import { createResponsiveStyles } from '@/lib/responsive';
import AppTopHeader from '@/shared/components/AppTopHeader';

type DealSectionItem = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  location: string;
  distance: string;
  sortDistanceKm?: number;
  dealEndsAt?: number;
  dealStatus: string;
  comboItems?: string[];
  badge?: string;
  voucherEnabled?: boolean;
  dealType?: string;
};

function formatPriceInr(value?: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatDistanceLabel(distanceKm?: number): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Distance unavailable';
  if (distanceKm < 1) return '<1 km away';
  return `${Math.round(distanceKm)} km away`;
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
  const comboTitle =
    item.comboItems && item.comboItems.length >= 2
      ? `${item.comboItems[0]} + ${item.comboItems[1]}`
      : item.title;

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
          {comboTitle}
        </Text>
        {item.comboItems && item.comboItems.length >= 2 ? (
          <Text style={styles.comboSubTitle} numberOfLines={1}>
            {item.title}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={[styles.cardPrice, compact && styles.compactCardPrice]}>
            {formatPriceInr(item.price)}
          </Text>
          {item.originalPrice ? (
            <Text style={styles.cardOriginalPrice}>{formatPriceInr(item.originalPrice)}</Text>
          ) : null}
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
            {item.distance}
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

function ComboDealCard({
  item,
  nowMs,
  bookingId,
  onBook,
}: {
  item: DealSectionItem;
  nowMs: number;
  bookingId: string | null;
  onBook: (id: string) => void;
}) {
  const comboImages = [
    item.images[0] || item.image,
    item.images[1] || item.images[0] || item.image,
  ];
  const comboTitle =
    item.comboItems && item.comboItems.length >= 2
      ? `${item.comboItems[0]} + ${item.comboItems[1]}`
      : item.title;

  return (
    <View style={styles.comboCard}>
      <Pressable
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
      >
        <View style={styles.comboMedia}>
          <View style={styles.comboSectionGrid}>
            {comboImages.map((image, index) => (
              <View key={`${item.id}-${index}`} style={styles.comboGridCell}>
                <Image source={{ uri: image }} style={styles.comboImage} contentFit="cover" />
              </View>
            ))}
          </View>
          <View style={styles.comboPlusBubble}>
            <Text style={styles.comboPlusText}>+</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.comboBody}>
        <Text style={styles.comboTitle} numberOfLines={2}>
          {comboTitle}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.comboPrice}>{formatPriceInr(item.price)}</Text>
          {item.originalPrice ? (
            <Text style={styles.cardOriginalPrice}>{formatPriceInr(item.originalPrice)}</Text>
          ) : null}
        </View>
        <View style={styles.statusPanel}>
          <Text style={styles.statusKicker}>Deal status</Text>
          {item.dealStatus.startsWith('Ends in') ? (
            <CountdownBlocks endAt={item.dealEndsAt} nowMs={nowMs} />
          ) : (
            <Text style={styles.statusValue}>{item.dealStatus}</Text>
          )}
        </View>
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
  const { listings, savedIds, toggleSaved, refreshListings, isRefreshing } = useListings();
  const { user, cachedLocation, isAuthenticated } = useAuth();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const currentLocation = user?.location || cachedLocation;

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBookDeal = useCallback(
    async (listingId: string) => {
      if (!isAuthenticated || !user?.id) {
        Alert.alert('Sign in required', 'Please sign in to book a deal.');
        router.push('/auth/register');
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
        Alert.alert('Booking failed', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setBookingId(null);
      }
    },
    [isAuthenticated, user?.id, user?.phone]
  );

  const mappedDeals = useMemo(() => {
    return listings
      .filter((item) => Boolean(item.isDeal))
      .map((item) => {
        const window = getEffectiveDealWindow(item, nowMs);
        const distanceKm =
          typeof currentLocation?.latitude === 'number' &&
          typeof currentLocation?.longitude === 'number'
            ? calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                item.location.latitude,
                item.location.longitude
              )
            : undefined;
        const displayPrice =
          typeof item.offerPrice === 'number' && item.offerPrice > 0 && item.offerPrice < item.price
            ? item.offerPrice
            : item.price;
        const originalPrice = displayPrice !== item.price ? item.price : undefined;

        return {
          id: item.id,
          title: item.title,
          price: displayPrice,
          originalPrice,
          image: item.images[0] || '',
          images: item.images || [],
          location: item.location.city,
          distance: formatDistanceLabel(distanceKm),
          sortDistanceKm: distanceKm,
          dealEndsAt: window?.endMs,
          dealStatus: formatDealStatus(item, nowMs),
          comboItems: item.comboItems,
          badge: isDealActiveNow(item, nowMs) ? 'Deal' : undefined,
          voucherEnabled: item.voucherEnabled,
          dealType: item.dealType,
        } satisfies DealSectionItem;
      })
      .sort((a, b) => {
        const distanceA =
          typeof a.sortDistanceKm === 'number' && Number.isFinite(a.sortDistanceKm)
            ? a.sortDistanceKm
            : Number.POSITIVE_INFINITY;
        const distanceB =
          typeof b.sortDistanceKm === 'number' && Number.isFinite(b.sortDistanceKm)
            ? b.sortDistanceKm
            : Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      });
  }, [listings, nowMs, currentLocation?.latitude, currentLocation?.longitude]);

  const todaysDeals = useMemo(
    () =>
      mappedDeals
        .filter((item) => item.dealType !== 'combo')
        .filter((item) => {
          const source = listings.find((listing) => listing.id === item.id);
          return source ? isDealActiveNow(source, nowMs) : false;
        })
        .sort((a, b) => Number(a.dealEndsAt || 0) - Number(b.dealEndsAt || 0))
        .slice(0, 6),
    [listings, mappedDeals, nowMs]
  );

  const upcomingDeals = useMemo(
    () =>
      mappedDeals.filter((item) => {
        const source = listings.find((listing) => listing.id === item.id);
        return source ? isDealUpcoming(source, nowMs) : false;
      }),
    [listings, mappedDeals, nowMs]
  );

  const comboDeals = useMemo(
    () =>
      mappedDeals.filter((item) => {
        const source = listings.find((listing) => listing.id === item.id);
        return item.dealType === 'combo' && source ? isDealActiveNow(source, nowMs) : false;
      }),
    [listings, mappedDeals, nowMs]
  );

  const expiredDeals = useMemo(
    () =>
      mappedDeals
        .filter((item) => {
          const source = listings.find((listing) => listing.id === item.id);
          return source ? isDealExpired(source, nowMs) : false;
        })
        .sort((a, b) => Number(b.dealEndsAt || 0) - Number(a.dealEndsAt || 0))
        .slice(0, 6),
    [listings, mappedDeals, nowMs]
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshListings} />}
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
    >
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <AppTopHeader
          eyebrow="NearHub Deals"
          title="Discover Deals"
          subtitle="Browse live offers, upcoming promotions, and combo bundles in the same native app layout as the rest of NearHub."
          rightAction={
            <Pressable style={styles.bookingsButton} onPress={() => router.push('/bookings')}>
              <Feather name="clipboard" size={16} color={Colors.text} />
            </Pressable>
          }
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          icon={<Feather name="tag" size={18} color={Colors.primary} />}
          title="Today's Deals"
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

      <View style={styles.section}>
        <SectionHeader
          icon={<Feather name="gift" size={18} color="#F97316" />}
          title="Combo Deals You'll Love"
          subtitle="Save more with handpicked product bundles by distance"
        />
        {comboDeals.length > 0 ? (
          <View style={styles.comboGrid}>
            {comboDeals.map((item) => (
              <ComboDealCard
                key={item.id}
                item={item}
                nowMs={nowMs}
                bookingId={bookingId}
                onBook={handleBookDeal}
              />
            ))}
          </View>
        ) : (
          <EmptyState message="No combo deals are available right now." />
        )}
      </View>

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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
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
  comboSubTitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
  comboCard: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  comboMedia: {
    position: 'relative',
    height: 176,
    backgroundColor: '#FFFFFF',
  },
  comboGrid: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    gap: StyleSheet.hairlineWidth,
  },
  comboGridCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  comboImage: {
    width: '100%',
    height: '100%',
  },
  comboPlusBubble: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboPlusText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    lineHeight: 24,
  },
  comboBody: {
    padding: 12,
  },
  comboTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: '#0F172A',
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
