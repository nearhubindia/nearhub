import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { createResponsiveStyles } from '@/lib/responsive';
import { fetchMyDealBookings, type DealBooking } from '@/lib/deal-bookings';

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

export default function DealBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<DealBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingVoucherId, setOpeningVoucherId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      setLoading(false);
      return;
    }

    try {
      const rows = await fetchMyDealBookings(user.id, user.phone || undefined);
      setBookings(rows);
    } catch (error) {
      Alert.alert('Could not load bookings', error instanceof Error ? error.message : 'Try again.');
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

  const showVoucherCode = useCallback((booking: DealBooking) => {
    setOpeningVoucherId(booking.id);
    Alert.alert(
      'Voucher details',
      booking.voucherCode
        ? `Voucher Code: ${booking.voucherCode}\nStatus: ${booking.status}`
        : `Status: ${booking.status}`,
      [{ text: 'Close', style: 'cancel' }]
    );
    setOpeningVoucherId(null);
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Bookings</Text>
          <Text style={styles.title}>Your booked deals</Text>
        </View>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>Loading your bookings...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="clipboard" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySubtitle}>
                Book a deal from the deals page and it will show up here.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const status = String(item.status || 'booked').toLowerCase();
          return (
            <View style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingIcon}>
                  <Feather name="tag" size={16} color={Colors.primary} />
                </View>
                <View style={styles.bookingTitleWrap}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>
                    {item.listingTitle || 'Deal booking'}
                  </Text>
                  <Text style={styles.bookingSubtitle}>Booking ID: {item.id}</Text>
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
                    {status}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingMeta}>
                <Text style={styles.metaText}>Booked: {formatDate(item.bookedAt)}</Text>
                <Text style={styles.metaText}>Redeemed: {formatDate(item.redeemedAt)}</Text>
                {item.voucherCode ? (
                  <Text style={styles.metaText}>Voucher: {item.voucherCode}</Text>
                ) : null}
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
                  style={[styles.primaryButton, openingVoucherId === item.id && styles.disabledButton]}
                  onPress={() => showVoucherCode(item)}
                >
                  <Feather name="file-text" size={14} color="#fff" />
                  <Text style={styles.primaryButtonText}>View code</Text>
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
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderLight,
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 22,
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
  },
  listContent: {
    padding: 16,
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
  },
  secondaryButton: {
    flex: 1,
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
    flex: 1,
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
