import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { getBackendURL } from '@/lib/config';

const { width } = Dimensions.get('window');

interface SellerAnalytics {
  sellerId: string;
  totalListings: number;
  activeListings: number;
  totalViews: number;
  averageViewsPerListing: number;
  topListings: Array<{
    id: string;
    title: string;
    viewCount: number;
    status: string;
  }>;
  allListings: Array<{
    id: string;
    title: string;
    viewCount: number;
    status: string;
  }>;
  last30DaysViews: Array<{
    date: string;
    count: number;
  }>;
}

export default function SellerAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    if (!user?.id) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = getBackendURL();
        const response = await fetch(`${apiUrl}/api/sellers/${user.id}/analytics`);

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        if (data.success) {
          setAnalytics(data.data);
        } else {
          setError(data.error || 'Failed to load analytics');
        }
      } catch (err) {
        console.error('[Analytics] Error fetching data:', err);
        setError('Unable to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user?.id]);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top || webTopInset }]}>
        <Text style={styles.errorText}>Please sign in to view analytics</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
              // Re-trigger useEffect
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : analytics ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        >
          {/* Overview Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
                  <Feather name="package" size={24} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>{analytics.totalListings}</Text>
                <Text style={styles.statLabel}>Total Listings</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#10b981' + '20' }]}>
                  <Feather name="check-circle" size={24} color="#10b981" />
                </View>
                <Text style={styles.statValue}>{analytics.activeListings}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#f59e0b' + '20' }]}>
                  <Feather name="eye" size={24} color="#f59e0b" />
                </View>
                <Text style={styles.statValue}>{analytics.totalViews.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Views</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
                  <Feather name="trending-up" size={24} color="#8b5cf6" />
                </View>
                <Text style={styles.statValue}>{analytics.averageViewsPerListing}</Text>
                <Text style={styles.statLabel}>Avg. Views</Text>
              </View>
            </View>
          </View>

          {/* Top Listings */}
          {analytics.topListings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Performing Listings</Text>
              {analytics.topListings.map((listing, index) => (
                <Pressable
                  key={listing.id}
                  style={styles.listingRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/listing/[id]', params: { id: listing.id } });
                  }}
                >
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingTitle} numberOfLines={1}>
                      {listing.title}
                    </Text>
                    <View style={styles.listingMeta}>
                      <Feather name="eye" size={12} color={Colors.textSecondary} />
                      <Text style={styles.listingViews}>
                        {listing.viewCount?.toLocaleString() || 0} views
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Recent Activity */}
          {analytics.last30DaysViews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Last 30 Days Activity</Text>
              <View style={styles.activityContainer}>
                {analytics.last30DaysViews.slice(0, 10).map((day) => (
                  <View key={day.date} style={styles.activityRow}>
                    <Text style={styles.activityDate}>
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <View style={styles.activityBar}>
                      <View
                        style={[
                          styles.activityBarFill,
                          {
                            width: `${Math.min((day.count / Math.max(...analytics.last30DaysViews.map((d) => d.count))) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.activityCount}>{day.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* All Listings Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Listings</Text>
            <View style={styles.allListingsContainer}>
              {analytics.allListings.map((listing) => (
                <Pressable
                  key={listing.id}
                  style={styles.miniListingCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/listing/[id]', params: { id: listing.id } });
                  }}
                >
                  <Text style={styles.miniListingTitle} numberOfLines={2}>
                    {listing.title}
                  </Text>
                  <View style={styles.miniListingStats}>
                    <View
                      style={[
                        styles.miniStatusBadge,
                        {
                          backgroundColor:
                            listing.status === 'active'
                              ? '#10b981' + '20'
                              : listing.status === 'sold'
                                ? '#3b82f6' + '20'
                                : '#6b7280' + '20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.miniStatusText,
                          {
                            color:
                              listing.status === 'active'
                                ? '#10b981'
                                : listing.status === 'sold'
                                  ? '#3b82f6'
                                  : '#6b7280',
                          },
                        ]}
                      >
                        {listing.status}
                      </Text>
                    </View>
                    <View style={styles.miniViewCount}>
                      <Feather name="eye" size={12} color={Colors.textSecondary} />
                      <Text style={styles.miniViewText}>
                        {listing.viewCount?.toLocaleString() || 0}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : null}
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 48) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingViews: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  activityContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityDate: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    width: 60,
  },
  activityBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  activityBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  activityCount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    width: 40,
    textAlign: 'right',
  },
  allListingsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  miniListingCard: {
    width: (width - 48) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniListingTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
    height: 36,
  },
  miniListingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniStatusText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },
  miniViewCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniViewText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
