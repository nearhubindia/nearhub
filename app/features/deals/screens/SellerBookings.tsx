import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import AuthRequiredState from '@/shared/components/AuthRequiredState';
import { useAuth } from '@/shared/contexts/auth-context';
import { createResponsiveStyles } from '@/lib/responsive';
import {
  downloadDealVoucherPdf,
  fetchSellerDealBookings,
  openDealVoucherPdf,
  parseVoucherPayload,
  statusLabel,
  updateDealBookingStatus,
  type DealBooking,
} from '@/lib/deal-bookings';

function formatDate(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function SellerDealBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<DealBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingVoucherId, setOpeningVoucherId] = useState<string | null>(null);
  const [downloadingVoucherId, setDownloadingVoucherId] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      setLoading(false);
      return;
    }

    try {
      const rows = await fetchSellerDealBookings(user.id, user.phone || undefined);
      setBookings(rows);
    } catch (error) {
      Alert.alert(
        'Could not load deal bookings',
        error instanceof Error ? error.message : 'Try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.phone]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
  }, [loadBookings]);

  const openVoucher = useCallback(
    async (booking: DealBooking) => {
      if (!user?.id) {
        Alert.alert('Sign in required', 'Please sign in to open the voucher.');
        return;
      }

      setOpeningVoucherId(booking.id);
      try {
        await openDealVoucherPdf(booking.id, {
          id: user.id,
          phone: user.phone || undefined,
          token: user.token || undefined,
        });
      } catch (error) {
        Alert.alert(
          'Could not open voucher',
          error instanceof Error ? error.message : 'Try again.'
        );
      } finally {
        setOpeningVoucherId(null);
      }
    },
    [user?.id, user?.phone, user?.token]
  );

  const downloadVoucher = useCallback(
    async (booking: DealBooking) => {
      if (!user?.id) {
        Alert.alert('Sign in required', 'Please sign in to download the voucher.');
        return;
      }

      setDownloadingVoucherId(booking.id);
      try {
        const result = await downloadDealVoucherPdf(booking.id, {
          id: user.id,
          phone: user.phone || undefined,
          token: user.token || undefined,
        });
        if (Platform.OS !== 'web') {
          Alert.alert('Voucher ready', `Saved PDF voucher to:\n${result.uri}`);
        }
      } catch (error) {
        Alert.alert(
          'Could not download voucher',
          error instanceof Error ? error.message : 'Try again.'
        );
      } finally {
        setDownloadingVoucherId(null);
      }
    },
    [user?.id, user?.phone, user?.token]
  );

  const markEncashed = useCallback(
    async (booking: DealBooking) => {
      if (!user?.id) {
        Alert.alert('Sign in required', 'Please sign in to update the booking.');
        return;
      }

      setUpdatingBookingId(booking.id);
      try {
        const updated = await updateDealBookingStatus({
          bookingId: booking.id,
          status: 'encashed',
          userId: user.id,
          userPhone: user.phone || undefined,
        });
        setBookings((current) =>
          current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
        );
        Alert.alert('Updated', 'Deal marked as encashed.');
      } catch (error) {
        Alert.alert(
          'Could not update booking',
          error instanceof Error ? error.message : 'Try again.'
        );
      } finally {
        setUpdatingBookingId(null);
      }
    },
    [user?.id, user?.phone]
  );

  if (!isAuthenticated) {
    return <AuthRequiredState message="Please sign in to view your deal bookings" />;
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
                <Feather name="arrow-left" size={24} color={Colors.text} />
              </Pressable>
              <Text style={styles.screenTitle}>Deal Bookings</Text>
              <View style={styles.headerSpacer} />
            </View>
            <Text style={styles.subtitle}>
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No deal bookings yet</Text>
            <Text style={styles.emptySubtitle}>
              Buyer purchases for your deals will appear here for voucher tracking.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = String(item.status || 'booked').toLowerCase();
          const voucher = parseVoucherPayload(item.voucherPayload);
          const isOpening = openingVoucherId === item.id;
          const isDownloading = downloadingVoucherId === item.id;
          const isUpdating = updatingBookingId === item.id;
          const canMarkEncashed =
            status !== 'redeemed' && status !== 'cancelled' && status !== 'expired';

          return (
            <View style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingIcon}>
                  <Feather name="shopping-bag" size={16} color={Colors.primary} />
                </View>
                <View style={styles.bookingTitleWrap}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>
                    {voucher.listingTitle || item.listingTitle || 'Deal booking'}
                  </Text>
                  <Text style={styles.bookingSubtitle}>
                    {item.voucherCode ? `Voucher ${item.voucherCode}` : `Booking ID: ${item.id}`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    status === 'redeemed' && styles.statusPillSuccess,
                    status === 'cancelled' && styles.statusPillDanger,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      status === 'redeemed' && styles.statusPillTextSuccess,
                      status === 'cancelled' && styles.statusPillTextDanger,
                    ]}
                  >
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingMeta}>
                <Text style={styles.metaText}>
                  Purchased: {formatDate(item.bookedAt || item.createdAt)}
                </Text>
                <Text style={styles.metaText}>Encashed: {formatDate(item.redeemedAt)}</Text>
                <Text style={styles.metaText}>Buyer ID: {item.buyerId}</Text>
                <Text style={styles.metaText}>Starts: {formatDate(voucher.dealStartAt)}</Text>
                <Text style={styles.metaText}>Ends: {formatDate(voucher.dealEndAt)}</Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    router.push({ pathname: '/listing/[id]', params: { id: item.listingId } })
                  }
                >
                  <Feather name="external-link" size={14} color={Colors.text} />
                  <Text style={styles.secondaryButtonText}>Open listing</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, isOpening && styles.disabledButton]}
                  disabled={isOpening}
                  onPress={() => void openVoucher(item)}
                >
                  <Feather name="file-text" size={14} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {isOpening ? 'Opening...' : 'View PDF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.secondaryButton, isDownloading && styles.disabledButton]}
                  disabled={isDownloading}
                  onPress={() => void downloadVoucher(item)}
                >
                  <Feather name="download" size={14} color={Colors.text} />
                  <Text style={styles.secondaryButtonText}>
                    {isDownloading ? 'Downloading...' : 'Download PDF'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    (!canMarkEncashed || isUpdating) && styles.disabledButton,
                  ]}
                  disabled={!canMarkEncashed || isUpdating}
                  onPress={() => void markEncashed(item)}
                >
                  <Feather name="check-circle" size={14} color={Colors.text} />
                  <Text style={styles.secondaryButtonText}>
                    {isUpdating ? 'Updating...' : 'Mark encashed'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  screenTitle: {
    fontSize: 24,
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  emptyState: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    marginBottom: 14,
    marginHorizontal: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 102, 194, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingTitleWrap: {
    flex: 1,
    gap: 2,
  },
  bookingTitle: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  bookingSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.borderLight,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  statusPillDanger: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  statusPillTextSuccess: {
    color: '#15803d',
  },
  statusPillTextDanger: {
    color: '#b91c1c',
  },
  bookingMeta: {
    marginTop: 12,
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    flexGrow: 1,
    minWidth: 130,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  primaryButton: {
    flexGrow: 1,
    minWidth: 130,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
