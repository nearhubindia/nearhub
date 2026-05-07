import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { useAuth } from '@/shared/contexts/auth-context';
import { useListings } from '@/shared/contexts/listings-context';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { getTimeAgo, formatCondition } from '@/lib/utils';
import { getApiUrl } from '@/lib/query-client';
import { createResponsiveStyles } from '@/lib/responsive';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

interface UpgradePlan {
  duration: number;
  price: number;
  label: string;
  subtitle: string;
}

const DEFAULT_UPGRADE_PLANS: UpgradePlan[] = [
  { duration: 45, price: 49, label: '45 Days', subtitle: 'Short boost for quick visibility' },
  { duration: 90, price: 99, label: '90 Days', subtitle: 'Balanced reach and value' },
  { duration: 180, price: 149, label: '180 Days', subtitle: 'Best value for long visibility' },
];

const PLAN_AMOUNT_BY_DURATION: Record<number, number> = {
  45: 49,
  90: 99,
  180: 149,
};

export default function MyListingsScreen() {
  const params = useLocalSearchParams<{
    tab?: string;
    renewId?: string;
    posted?: string;
    edited?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { listings, deleteListing, updateListing, refreshListings } = useListings();
  const {
    banners: listingsBanners,
    isLoading: isListingsBannersLoading,
    refreshBanners,
  } = useAppScreenBanners('listings');
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [markingActiveId, setMarkingActiveId] = useState<string | null>(null);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedUpgradeItem, setSelectedUpgradeItem] = useState<any | null>(null);
  const [upgradingDuration, setUpgradingDuration] = useState<number | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackModalTitle, setFeedbackModalTitle] = useState('Success');
  const [feedbackModalMessage, setFeedbackModalMessage] = useState('');
  const [feedbackModalType, setFeedbackModalType] = useState<'success' | 'error'>('success');
  const [hasHandledPostedSuccess, setHasHandledPostedSuccess] = useState(false);
  const [hasHandledEditedSuccess, setHasHandledEditedSuccess] = useState(false);
  const [autoRenewOpenedForId, setAutoRenewOpenedForId] = useState<string | null>(null);
  const [upgradePlans, setUpgradePlans] = useState<UpgradePlan[]>(DEFAULT_UPGRADE_PLANS);
  const [nowTick, setNowTick] = useState(Date.now());

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleBackPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/home');
  }, []);

  // Filter user's listings using canonical user id.
  const normalizeId = (value: string | undefined | null) => String(value || '').trim();
  const userIdNormalized = normalizeId(user?.id);
  const myListings = listings.filter((listing) => {
    const listingUserId = normalizeId(listing.userId);
    return Boolean(userIdNormalized && listingUserId && listingUserId === userIdNormalized);
  });

  const activeListings = myListings.filter((l) => {
    if (l.status !== 'active') return false;
    if (!l.expiresAt) return true;
    return new Date(l.expiresAt) >= new Date();
  });
  const pendingListings = myListings.filter((l) => l.status === 'pending');
  const rejectedListings = myListings.filter((l) => l.status === 'rejected');
  const soldListings = myListings.filter((l) => l.status === 'sold');
  const expiredListings = myListings.filter((l) => {
    // Check if listing has expired based on duration
    if (!l.expiresAt) return false;
    return new Date(l.expiresAt) < new Date();
  });

  const isListingExpired = (item: any) =>
    !!item?.expiresAt && new Date(item.expiresAt).getTime() < Date.now();

  const getListingPriority = (item: any): number => {
    if (item.status === 'pending') return 0;
    if (item.status === 'rejected') return 1;
    if (isListingExpired(item)) return 2;
    if (item.status === 'active') return 3;
    if (item.status === 'sold') return 4;
    return 5;
  };

  const currentListings = [...myListings].sort((a, b) => {
    const priorityDelta = getListingPriority(a) - getListingPriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const fetchUpgradePlans = useCallback(async () => {
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/subscription-tiers`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!data?.success || !Array.isArray(data.tiers)) {
        return;
      }

      const bestPlanByDuration = new Map<number, UpgradePlan>();

      data.tiers.forEach((tier: any) => {
        if (String(tier?.type || 'bundle') === 'boost') return;

        const duration = Number(tier?.durationDays || tier?.duration || 0);
        if (!Number.isFinite(duration) || duration <= 0) return;

        const regularPrice = Number(tier?.price || 0);
        const offerPrice = Number(tier?.offerPrice);
        const effectivePrice =
          Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice
            ? offerPrice
            : regularPrice;

        // Renewal/upgrade is payment-only; skip free tiers.
        if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return;

        const nextPlan: UpgradePlan = {
          duration,
          price: effectivePrice,
          label: `${duration} Days`,
          subtitle: (
            String(tier?.description || '').trim() || `${tier?.name || 'Premium'} plan`
          ).slice(0, 80),
        };

        const currentPlan = bestPlanByDuration.get(duration);
        if (!currentPlan || nextPlan.price < currentPlan.price) {
          bestPlanByDuration.set(duration, nextPlan);
        }
      });

      const normalizedPlans = [...bestPlanByDuration.values()].sort(
        (a, b) => a.duration - b.duration
      );
      if (normalizedPlans.length > 0) {
        setUpgradePlans(normalizedPlans);
      }
    } catch (error) {
      console.warn('[MyListings] Failed to fetch live upgrade plans, using defaults.');
    }
  }, []);

  useEffect(() => {
    fetchUpgradePlans();
  }, [fetchUpgradePlans]);

  useEffect(() => {
    const renewId = typeof params.renewId === 'string' ? params.renewId : '';
    if (!renewId || autoRenewOpenedForId === renewId) return;

    const expiredListing = expiredListings.find((l) => l.id === renewId);
    if (!expiredListing) return;

    setSelectedUpgradeItem(expiredListing);
    setUpgradeModalVisible(true);
    setAutoRenewOpenedForId(renewId);
  }, [params.renewId, expiredListings, autoRenewOpenedForId]);

  useEffect(() => {
    const posted = typeof params.posted === 'string' ? params.posted : '';
    if (posted !== '1' || hasHandledPostedSuccess) return;

    setHasHandledPostedSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal(
      'Listing posted successfully. It is now visible in your listings.',
      'Listing Posted Successfully'
    );
  }, [hasHandledPostedSuccess, params.posted]);

  useEffect(() => {
    const edited = typeof params.edited === 'string' ? params.edited : '';
    if (edited !== '1' || hasHandledEditedSuccess) return;

    setHasHandledEditedSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal('Listing updated successfully.', 'Listing Updated Successfully');
  }, [hasHandledEditedSuccess, params.edited]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshListings(), refreshBanners(), fetchUpgradePlans()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUpgradePlans, refreshBanners, refreshListings]);

  useFocusEffect(
    useCallback(() => {
      refreshListings().catch((error) => {
        console.warn('[MyListings] Failed to refresh listings on focus:', error);
      });
    }, [refreshListings])
  );

  const showSuccessModal = (message: string, title = 'Success') => {
    setFeedbackModalTitle(title);
    setFeedbackModalType('success');
    setFeedbackModalMessage(message);
    setFeedbackModalVisible(true);
  };

  const showErrorModal = (message: string) => {
    setFeedbackModalTitle('Error');
    setFeedbackModalType('error');
    setFeedbackModalMessage(message);
    setFeedbackModalVisible(true);
  };

  const handleDelete = async (listingId: string, listingTitle: string) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${listingTitle}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(listingId);
            try {
              await deleteListing(listingId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccessModal('Listing deleted successfully');
            } catch (error) {
              console.error('Error deleting listing:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showErrorModal('Failed to delete listing. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsSold = async (listingId: string, listingTitle: string) => {
    Alert.alert('Mark as Sold', `Mark "${listingTitle}" as sold?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Mark as Sold',
        onPress: async () => {
          setMarkingSoldId(listingId);
          try {
            await updateListing(listingId, { status: 'sold' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccessModal('Listing marked as sold');
          } catch (error) {
            console.error('Error marking as sold:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showErrorModal('Failed to mark listing as sold. Please try again.');
          } finally {
            setMarkingSoldId(null);
          }
        },
      },
    ]);
  };

  const handleMarkAsActive = async (listingId: string, listingTitle: string) => {
    Alert.alert('Mark as Active', `Move "${listingTitle}" back to active listings?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Mark as Active',
        onPress: async () => {
          setMarkingActiveId(listingId);
          try {
            await updateListing(listingId, { status: 'active' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccessModal('Listing moved back to Active');
          } catch (error) {
            console.error('Error marking as active:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showErrorModal('Failed to move listing to active. Please try again.');
          } finally {
            setMarkingActiveId(null);
          }
        },
      },
    ]);
  };

  const handleResubmit = async (listingId: string, listingTitle: string) => {
    Alert.alert('Resubmit Listing', `Resubmit "${listingTitle}" for admin approval?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resubmit',
        onPress: async () => {
          setResubmittingId(listingId);
          try {
            await updateListing(listingId, { status: 'pending' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccessModal('Listing resubmitted for approval');
          } catch (error) {
            console.error('Error resubmitting listing:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showErrorModal('Failed to resubmit listing. Please try again.');
          } finally {
            setResubmittingId(null);
          }
        },
      },
    ]);
  };

  const handleViewSubscription = (item: any) => {
    const planInfo = getListingPlanInfo(item);
    const message =
      `Plan: ${planInfo.planName}\n` +
      `Amount: ${planInfo.amountLabel}\n` +
      `Expiry: ${planInfo.expiryLabel}`;

    Alert.alert('Listing Details', message, [
      {
        text: 'View Plans',
        onPress: () => handleUpgrade(item),
      },
      {
        text: 'Close',
        style: 'cancel',
      },
    ]);
  };

  const handleUpgrade = (item: any) => {
    setSelectedUpgradeItem(item);
    setUpgradeModalVisible(true);
  };

  const handleUpgradeButton = (item: any, e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedUpgradeItem(item);
    setUpgradeModalVisible(true);
  };

  const closeUpgradeModal = () => {
    setUpgradeModalVisible(false);
    setSelectedUpgradeItem(null);
    setUpgradingDuration(null);
  };

  const getCurrentPlanDuration = (item: any): number => {
    if (!item) return 30;

    const durationCandidates = [
      item.durationDays,
      item.duration,
      item.subscriptionDuration,
      item.userSubscription?.tier?.durationDays,
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (durationCandidates.length > 0) {
      return Math.max(...durationCandidates);
    }

    return 30;
  };

  const getListingPlanInfo = (
    item: any
  ): { planName: string; amountLabel: string; expiryLabel: string } => {
    const duration = getCurrentPlanDuration(item);
    const amount = PLAN_AMOUNT_BY_DURATION[duration];
    const planName =
      duration === 30
        ? 'Basic 30 Days'
        : duration === 15
          ? 'Free 15 Days'
          : `Premium ${duration} Days`;
    const amountLabel =
      typeof amount === 'number'
        ? `₹${amount.toLocaleString('en-IN')}`
        : item?.isPaid
          ? 'Included in subscription'
          : 'Free';
    const expiryLabel = item?.expiresAt
      ? new Date(item.expiresAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';

    return { planName, amountLabel, expiryLabel };
  };

  const getAvailableUpgradePlans = (item: any): UpgradePlan[] => {
    if (isListingExpired(item)) {
      return upgradePlans;
    }

    const currentDuration = getCurrentPlanDuration(item);
    return upgradePlans.filter((plan) => plan.duration > currentDuration);
  };

  const getBoostRemainingMs = (boostedUntil?: string | null): number => {
    if (!boostedUntil) return 0;
    const end = new Date(boostedUntil).getTime();
    if (!Number.isFinite(end)) return 0;
    return Math.max(0, end - nowTick);
  };

  const formatBoostRemaining = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const getMetricValue = (item: any, candidates: string[]): number => {
    for (const key of candidates) {
      const value = Number(item?.[key]);
      if (Number.isFinite(value) && value >= 0) {
        return value;
      }
    }
    return 0;
  };

  const processUpgrade = async (listingId: string, duration: number, price: number) => {
    try {
      setUpgradingDuration(duration);
      const apiUrl = await getApiUrl();
      const checkoutResponse = await fetch(`${apiUrl}/api/subscriptions/upgrade-listing/checkout`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: user?.id || '', phone: user?.phone || '' }),
        body: JSON.stringify({
          listingId,
          duration,
          price,
        }),
      });

      const checkoutData = await checkoutResponse.json();
      if (!checkoutResponse.ok || !checkoutData.success || !checkoutData.payment) {
        if (String(checkoutData?.error || '').toLowerCase() === 'listing not found') {
          throw new Error(
            'This listing is not available on server yet. Payment renewal works only for server-created listings.'
          );
        }
        throw new Error(checkoutData.error || 'Failed to initiate upgrade payment');
      }

      const { razorpayOrderId, amount, key } = checkoutData.payment;

      // @ts-ignore - dynamic import to avoid New Architecture crash
      const RazorpayCheckout = require('react-native-razorpay').default;

      const sanitizedContact = String(user?.phone || '')
        .replace(/\D/g, '')
        .slice(-10);
      const sanitizedName = String(user?.name || '').trim();
      const sanitizedEmail = String(user?.email || '').trim();

      const paymentResult = await RazorpayCheckout.open({
        description: `Listing upgrade - ${duration} days`,
        image: 'https://nearhub.app/nearhub-logo.png',
        currency: 'INR',
        key,
        amount: String(amount),
        order_id: razorpayOrderId,
        name: 'NearHub',
        prefill: {
          email: sanitizedEmail,
          contact: sanitizedContact,
          name: sanitizedName,
        },
        theme: { color: '#0A66C2' },
      });

      const verifyResponse = await fetch(
        `${apiUrl}/api/subscriptions/upgrade-listing/verify-payment`,
        {
          method: 'POST',
          headers: buildUserAuthHeaders({ id: user?.id || '', phone: user?.phone || '' }),
          body: JSON.stringify({
            listingId,
            duration,
            price,
            razorpay_order_id: paymentResult.razorpay_order_id,
            razorpay_payment_id: paymentResult.razorpay_payment_id,
            razorpay_signature: paymentResult.razorpay_signature,
          }),
        }
      );

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      await updateListing(listingId, {
        isPaid: true,
        featured: true,
        duration,
        durationDays: duration,
        expiresAt: verifyData?.data?.expiresAt,
        status: 'active',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeUpgradeModal();
      showSuccessModal(`Listing upgraded to ${duration} days plan!`);
      onRefresh();
    } catch (error) {
      const gatewayError = (typeof error === 'object' && error !== null ? error : {}) as any;
      const gatewayStep = String(gatewayError?.error?.step || '');
      const gatewayReason = String(gatewayError?.error?.reason || '');
      const gatewayDescription = String(gatewayError?.description || '');

      let errMsg = error instanceof Error ? error.message : 'Upgrade failed';

      const isPaymentAuthFailure =
        gatewayStep.toLowerCase() === 'payment_authentication' ||
        gatewayReason.toLowerCase() === 'payment_error' ||
        gatewayDescription.toLowerCase().includes('payment_authentication');

      if (isPaymentAuthFailure) {
        errMsg = 'Payment authentication failed. Please retry with a valid payment method.';
      }

      const wasCancelled =
        typeof errMsg === 'string' &&
        (errMsg.toLowerCase().includes('cancelled') || errMsg.toLowerCase().includes('dismissed'));
      const isKnownListingMissing =
        typeof errMsg === 'string' && errMsg.toLowerCase().includes('not available on server yet');

      if (!wasCancelled && !isKnownListingMissing && !isPaymentAuthFailure) {
        console.error('Error upgrading listing:', error);
      } else if (isPaymentAuthFailure) {
        console.warn('[Renew] Payment authentication failed during Razorpay checkout.');
      } else if (isKnownListingMissing) {
        console.warn('[Renew] Listing not synced to backend, payment renewal blocked.');
      }
      if (!wasCancelled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showErrorModal(errMsg || 'Failed to upgrade listing. Please try again.');
      }
    } finally {
      setUpgradingDuration(null);
    }
  };

  const handleBoostNow = async (item: any, e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isAlreadyBoosted = !!item?.boostedUntil && new Date(item.boostedUntil) > new Date();
    if (isAlreadyBoosted) {
      showErrorModal('This listing is already boosted. Try again after current boost expires.');
      return;
    }
    setBoostingId(item.id);

    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/subscriptions/listings/${item.id}/boost`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: user?.id || '', phone: user?.phone || '' }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        if (response.status === 409 || data?.code === 'LISTING_ALREADY_BOOSTED') {
          const untilLabel = data?.boostedUntil
            ? new Date(data.boostedUntil).toLocaleString('en-IN')
            : null;
          showErrorModal(
            untilLabel
              ? `This listing is already boosted until ${untilLabel}.`
              : 'This listing is already boosted.'
          );
          return;
        }
        if (response.status === 402 || data?.code === 'BOOST_CREDITS_EXHAUSTED') {
          Alert.alert(
            'Boost Credits Exhausted',
            'You have no boost credits left. Purchase a boost pack to continue.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Buy Boost Pack',
                onPress: () => router.push('/subscriptions'),
              },
            ]
          );
          return;
        }

        throw new Error(data?.error || 'Failed to boost listing');
      }

      await updateListing(item.id, {
        featured: true,
        boostedUntil: data?.boostedUntil || undefined,
        boostCount:
          item?.boostCount !== undefined && item?.boostCount !== null
            ? Number(item.boostCount) + 1
            : 1,
        status: 'active',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal(
        'Listing boosted successfully for more views.',
        'Listing Boosted Successfully'
      );
      onRefresh();
    } catch (error) {
      console.error('[Boost] Error boosting listing:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showErrorModal(error instanceof Error ? error.message : 'Failed to boost listing');
    } finally {
      setBoostingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <Pressable onPress={handleBackPress} style={styles.backButton} hitSlop={8}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Listings</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/listings/analytics');
            }}
            style={styles.analyticsButton}
            hitSlop={8}
          >
            <Feather name="bar-chart-2" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/create');
            }}
            style={styles.addButton}
            hitSlop={8}
          >
            <Feather name="plus" size={24} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Listings */}
      <FlatList
        key="single-column"
        data={currentListings}
        renderItem={({ item }) => {
          const listingPlanInfo = getListingPlanInfo(item);
          const boostRemainingMs = getBoostRemainingMs(item?.boostedUntil);
          const isCurrentlyBoosted = boostRemainingMs > 0;
          const isExpiredItem = isListingExpired(item);

          return (
            <View style={styles.listingItem}>
              <View style={styles.cardContainer}>
                <Pressable
                  style={styles.cardTapArea}
                  onPress={() =>
                    router.push({ pathname: '/listing/[id]', params: { id: item.id } })
                  }
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={item.images?.[0] ? { uri: item.images[0] } : undefined}
                      style={styles.listingImage}
                      contentFit="cover"
                      transition={200}
                    />

                    <View
                      style={[
                        styles.statusBadge,
                        item.status === 'pending'
                          ? styles.pendingStatusBadge
                          : item.status === 'rejected'
                            ? styles.rejectedStatusBadge
                            : item.isPaid
                              ? styles.premiumStatusBadge
                              : styles.activeStatusBadge,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {item.status === 'pending'
                          ? 'APPROVAL PENDING'
                          : item.status === 'rejected'
                            ? 'REJECTED'
                            : item.isPaid
                              ? 'PREMIUM'
                              : 'ACTIVE'}
                      </Text>
                    </View>

                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionBadgeText}>
                        {formatCondition(item.condition)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsSection}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceText}>
                        ₹
                        {Number(
                          item.offerPrice && item.offerPrice > 0 && item.offerPrice < item.price
                            ? item.offerPrice
                            : item.price || 0
                        ).toLocaleString('en-IN')}
                      </Text>
                      {item.priceUnit ? (
                        <Text style={styles.priceUnitText}> / {item.priceUnit}</Text>
                      ) : null}
                      {item.offerPrice && item.offerPrice > 0 && item.offerPrice < item.price ? (
                        <Text style={styles.originalPriceText}>
                          ₹{Number(item.price || 0).toLocaleString('en-IN')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.titleText} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <View style={styles.metaRow}>
                      <Feather name="map-pin" size={13} color={Colors.textTertiary} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.location?.city || 'Location unavailable'}
                      </Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{getTimeAgo(item.createdAt)}</Text>
                    </View>

                    {isCurrentlyBoosted && (
                      <View style={styles.boostedTimerBanner}>
                        <Feather name="zap" size={13} color="#166534" />
                        <Text style={styles.boostedTimerText}>
                          Boost active • ends in {formatBoostRemaining(boostRemainingMs)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.planInfoContainer}>
                      <View style={styles.planInfoRow}>
                        <Text style={styles.planInfoLabel}>Plan</Text>
                        <Text style={styles.planInfoValue}>{listingPlanInfo.planName}</Text>
                      </View>
                      <View style={styles.planInfoRow}>
                        <Text style={styles.planInfoLabel}>Amount</Text>
                        <Text style={styles.planInfoValue}>{listingPlanInfo.amountLabel}</Text>
                      </View>
                      <View style={styles.planInfoRow}>
                        <Text style={styles.planInfoLabel}>Expiry</Text>
                        <Text style={styles.planInfoValue}>{listingPlanInfo.expiryLabel}</Text>
                      </View>
                    </View>

                    {item.status === 'rejected' ? (
                      <View style={styles.rejectionReasonContainer}>
                        <Text style={styles.rejectionReasonLabel}>Admin Message</Text>
                        <Text style={styles.rejectionReasonText}>
                          {item.rejectionReason ||
                            'Your listing was rejected by admin. Edit and resubmit to continue.'}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Analytics Stats Row */}
                  <View style={styles.analyticsRow}>
                    <View style={styles.analyticsItem}>
                      <Feather name="eye" size={18} color="#6b7280" />
                      <Text style={styles.analyticsValue}>
                        {getMetricValue(item, ['viewCount', 'views', 'totalViews'])}
                      </Text>
                      <Text style={styles.analyticsLabel}>Views</Text>
                    </View>
                    <View style={styles.analyticsDivider} />
                    <View style={styles.analyticsItem}>
                      <Feather name="heart" size={18} color="#6b7280" />
                      <Text style={styles.analyticsValue}>
                        {getMetricValue(item, ['likeCount', 'likes', 'saveCount', 'savedCount'])}
                      </Text>
                      <Text style={styles.analyticsLabel}>Likes</Text>
                    </View>
                    <View style={styles.analyticsDivider} />
                    <Pressable
                      style={styles.analyticsItem}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/chat/');
                      }}
                    >
                      <Feather name="message-circle" size={18} color="#6b7280" />
                      <Text style={styles.analyticsValue}>
                        {getMetricValue(item, [
                          'chatCount',
                          'chats',
                          'messageCount',
                          'inquiryCount',
                        ])}
                      </Text>
                      <Text style={styles.analyticsLabel}>Chats</Text>
                    </Pressable>
                  </View>
                </Pressable>

                {/* Action Buttons Grid */}
                {item.status === 'active' && !isExpiredItem && (
                  <View style={styles.actionButtonsGrid}>
                    <Pressable
                      style={[styles.actionButton, styles.editButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({ pathname: '/listings/edit', params: { id: item.id } });
                      }}
                    >
                      <Feather name="edit-2" size={18} color="#374151" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.boostButton,
                        isCurrentlyBoosted && styles.actionButtonDisabled,
                      ]}
                      onPress={(e) => handleBoostNow(item, e)}
                      disabled={boostingId === item.id || isCurrentlyBoosted}
                    >
                      {boostingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="trending-up" size={18} color="#fff" />
                          <Text style={styles.boostButtonText}>
                            {isCurrentlyBoosted ? 'Boosted' : 'Boost'}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={[styles.actionButton, styles.soldButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleMarkAsSold(item.id, item.title);
                      }}
                      disabled={markingSoldId === item.id}
                    >
                      {markingSoldId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="check-circle" size={18} color="#fff" />
                          <Text style={styles.soldButtonText}>Mark Sold</Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleDelete(item.id, item.title);
                      }}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="trash-2" size={18} color="#fff" />
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}

                {isExpiredItem && (
                  <View style={styles.actionButtonsGrid}>
                    <Pressable
                      style={[styles.actionButton, styles.actionButtonFull, styles.boostButton]}
                      onPress={(e) => handleUpgradeButton(item, e)}
                    >
                      <Feather name="refresh-cw" size={18} color="#fff" />
                      <Text style={styles.boostButtonText}>Renew</Text>
                    </Pressable>
                  </View>
                )}

                {item.status === 'rejected' && (
                  <View style={styles.actionButtonsGrid}>
                    <Pressable
                      style={[styles.actionButton, styles.editButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({ pathname: '/listings/edit', params: { id: item.id } });
                      }}
                    >
                      <Feather name="edit-2" size={18} color="#374151" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.actionButtonFull, styles.resubmitButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleResubmit(item.id, item.title);
                      }}
                      disabled={resubmittingId === item.id}
                    >
                      {resubmittingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={18} color="#fff" />
                          <Text style={styles.resubmitButtonText}>Resubmit</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}

                {item.status === 'sold' && (
                  <View style={styles.actionButtonsGrid}>
                    <Pressable
                      style={[styles.actionButton, styles.actionButtonFull, styles.restoreButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleMarkAsActive(item.id, item.title);
                      }}
                      disabled={markingActiveId === item.id}
                    >
                      {markingActiveId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="rotate-ccw" size={18} color="#fff" />
                          <Text style={styles.restoreButtonText}>Mark Active</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <AppScreenBanners banners={listingsBanners} isLoading={isListingsBannersLoading} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first listing to get started. Pending approvals and status badges will
              appear here.
            </Text>
            <Pressable style={styles.createButton} onPress={() => router.push('/(tabs)/create')}>
              <Feather name="plus" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Listing</Text>
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={upgradeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeUpgradeModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeUpgradeModal} />

          <View style={styles.upgradeModalSheet}>
            <View style={styles.upgradeModalHeader}>
              <View>
                <Text style={styles.upgradeModalTitle}>
                  {isListingExpired(selectedUpgradeItem) ? 'Renew Listing' : 'Boost Listing'}
                </Text>
                <Text style={styles.upgradeModalSubtitle} numberOfLines={1}>
                  {selectedUpgradeItem?.title || 'Select a plan'}
                </Text>
                {isListingExpired(selectedUpgradeItem) && (
                  <Text style={styles.upgradeModalRenewNote}>
                    Renewal extends this listing only (does not renew your subscription plan).
                  </Text>
                )}
              </View>
              <Pressable style={styles.upgradeModalCloseButton} onPress={closeUpgradeModal}>
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.currentPlanInfo}>
              <Text style={styles.currentPlanLabel}>Current Plan</Text>
              <Text style={styles.currentPlanValue}>
                {getCurrentPlanDuration(selectedUpgradeItem)} days
              </Text>
            </View>

            <View style={styles.plansContainer}>
              {getAvailableUpgradePlans(selectedUpgradeItem).length === 0 ? (
                <View style={styles.noPlansContainer}>
                  <Text style={styles.noPlansText}>
                    {isListingExpired(selectedUpgradeItem)
                      ? 'No renewal plans available right now.'
                      : 'No higher plans available for this listing.'}
                  </Text>
                </View>
              ) : (
                getAvailableUpgradePlans(selectedUpgradeItem).map((plan) => (
                  <View key={plan.duration} style={styles.planCard}>
                    <View style={styles.planTopRow}>
                      <View>
                        <Text style={styles.planLabel}>{plan.label}</Text>
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                      </View>
                      <Text style={styles.planPrice}>₹{plan.price}</Text>
                    </View>

                    <Pressable
                      style={styles.selectPlanButton}
                      onPress={() =>
                        processUpgrade(selectedUpgradeItem.id, plan.duration, plan.price)
                      }
                      disabled={upgradingDuration !== null}
                    >
                      {upgradingDuration === plan.duration ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.selectPlanButtonText}>
                          Pay ₹{plan.price} for {plan.label}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <View style={styles.feedbackModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setFeedbackModalVisible(false)}
          />
          {feedbackModalType === 'success' ? (
            <LinearGradient
              colors={['#ECFDF3', '#D1FAE5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedbackSuccessCard}
            >
              <View style={styles.feedbackSuccessIconOuter}>
                <View style={styles.feedbackSuccessIconInner}>
                  <Feather name="check" size={28} color="#fff" />
                </View>
              </View>
              <Text style={styles.feedbackSuccessTitle}>{feedbackModalTitle}</Text>
              <Text style={styles.feedbackSuccessMessage}>{feedbackModalMessage}</Text>
              <Pressable
                style={styles.feedbackSuccessButton}
                onPress={() => setFeedbackModalVisible(false)}
              >
                <Text style={styles.feedbackSuccessButtonText}>Awesome</Text>
              </Pressable>
            </LinearGradient>
          ) : (
            <View style={styles.feedbackModalCard}>
              <View style={[styles.feedbackIconWrap, styles.feedbackIconError]}>
                <Feather name="x" size={20} color="#fff" />
              </View>
              <Text style={styles.feedbackModalTitle}>{feedbackModalTitle}</Text>
              <Text style={styles.feedbackModalMessage}>{feedbackModalMessage}</Text>
              <Pressable
                style={styles.feedbackModalButton}
                onPress={() => setFeedbackModalVisible(false)}
              >
                <Text style={styles.feedbackModalButtonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
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
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyticsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  listingItem: {
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  cardContainer: {
    borderRadius: 18,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTapArea: {
    backgroundColor: Colors.surface,
  },
  imageContainer: {
    height: 200,
    position: 'relative',
    backgroundColor: Colors.borderLight,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  activeStatusBadge: {
    backgroundColor: '#10b981',
  },
  premiumStatusBadge: {
    backgroundColor: '#f59e0b',
  },
  pendingStatusBadge: {
    backgroundColor: '#f97316',
  },
  rejectedStatusBadge: {
    backgroundColor: '#dc2626',
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.35,
  },
  conditionBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  conditionBadgeText: {
    color: '#1e293b',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  detailsSection: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
  },
  rejectionReasonContainer: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#991b1b',
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#7f1d1d',
    lineHeight: 18,
  },
  priceText: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  priceUnitText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  originalPriceText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'line-through',
  },
  titleText: {
    marginTop: 6,
    fontSize: 16,
    color: Colors.text,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 21,
  },
  metaRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  planInfoContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 6,
  },
  boostedTimerBanner: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boostedTimerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#166534',
  },
  planInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planInfoLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  planInfoValue: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    maxWidth: '70%',
    textAlign: 'right',
  },
  metaDot: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  analyticsItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  analyticsValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  analyticsLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  analyticsDivider: {
    width: 1,
    height: 34,
    backgroundColor: Colors.border,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionButton: {
    flexBasis: '48%',
    maxWidth: '49%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonFull: {
    flexBasis: '100%',
    maxWidth: '100%',
  },
  editButton: {
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  boostButton: {
    backgroundColor: Colors.success,
  },
  boostButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  soldButton: {
    backgroundColor: Colors.primary,
  },
  soldButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  deleteButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  restoreButton: {
    backgroundColor: Colors.primaryDark,
  },
  restoreButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  resubmitButton: {
    backgroundColor: '#2563eb',
  },
  resubmitButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  listContent: {
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
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
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  createButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  upgradeModalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  upgradeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  upgradeModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  upgradeModalSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    maxWidth: 260,
  },
  upgradeModalRenewNote: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    maxWidth: 280,
  },
  upgradeModalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderLight,
  },
  currentPlanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  currentPlanLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  currentPlanValue: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  plansContainer: {
    gap: 10,
  },
  noPlansContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  noPlansText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  planCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.surface,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  planLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  planSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  planPrice: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  selectPlanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPlanButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  feedbackSuccessCard: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
  feedbackSuccessIconOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  feedbackSuccessIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackSuccessTitle: {
    fontSize: 23,
    fontFamily: 'Inter_800ExtraBold',
    color: '#065F46',
    textAlign: 'center',
    lineHeight: 30,
  },
  feedbackSuccessMessage: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#047857',
    textAlign: 'center',
    lineHeight: 22,
  },
  feedbackSuccessButton: {
    marginTop: 18,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  feedbackSuccessButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  feedbackModalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  feedbackIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  feedbackIconSuccess: {
    backgroundColor: Colors.success,
  },
  feedbackIconError: {
    backgroundColor: Colors.error,
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  feedbackModalMessage: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  feedbackModalButton: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  feedbackModalButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
