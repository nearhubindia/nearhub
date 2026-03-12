import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Keyboard,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { getApiUrl } from '@/lib/query-client';
import { extractInvoiceFromResponse, storeInvoice } from '@/lib/invoice-storage';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

interface SubscriptionTier {
  id: string;
  name: string;
  type?: 'bundle' | 'boost' | string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  maxListings: number;
  featuredListingsPerMonth: number;
  boostCredits?: number;
  features: string[];
  highlight: boolean;
  price: number;
  offerPrice?: number | null;
  durationDays: number;
}

const getDurationLabel = (days: number): string => {
  if (days <= 30) return '30 days';
  if (days <= 90) return '90 days';
  if (days <= 180) return '180 days';
  if (days <= 365) return '1 year';
  return `${days} days`;
};

const getDurationShort = (days: number): string => {
  if (days <= 30) return '30d';
  if (days <= 90) return '90d';
  if (days <= 180) return '180d';
  if (days <= 365) return '1yr';
  return `${days}d`;
};

interface CouponDiscount {
  coupon: {
    code: string;
    discountPercentage: number;
  };
  discountAmount: number;
  finalAmount: number;
}

interface ActiveSubscription {
  id: string;
  status: string;
  expiresAt: string;
  subscribedAt: string;
  listingsUsed: number;
  totalListingsCreated: number;
  boostsRemaining?: number;
  tier: {
    id: string;
    name: string;
    type?: 'bundle' | 'boost' | string;
    price: string;
    durationDays: number;
    maxListings: number;
    featuredListingsPerMonth: number;
    boostCredits?: number;
    features: string[];
  } | null;
}

interface StarterCreditsSummary {
  isActive: boolean;
  listingsTotal: number;
  listingsUsed: number;
  listingsRemaining: number;
  boostsTotal: number;
  boostsUsed: number;
  boostsRemaining: number;
}

interface ConsolidatedActiveSubscription {
  key: string;
  tierId: string;
  tierName: string;
  tierPrice: number;
  durationDays: number;
  count: number;
  totalUsed: number;
  totalAvailable: number;
  totalLimit: number;
  shortestExpiryDays: number;
  latestExpiryAt: Date;
  hasUnlimited: boolean;
  isBoostPack: boolean;
  boostEntitlement: number;
  totalBoostsRemaining: number;
  subscriptions: ActiveSubscription[];
}

interface PaymentSuccessModalState {
  visible: boolean;
  planName: string;
  duration: number;
  invoiceNumber?: string;
  totalAmount?: number;
  invoiceFailed?: boolean;
}

export default function SubscriptionsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState<CouponDiscount | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [starterCredits, setStarterCredits] = useState<StarterCreditsSummary | null>(null);
  const [selectedActiveSubscriptionId, setSelectedActiveSubscriptionId] = useState<string | null>(
    null
  );
  const [defaultActiveSubscriptionId, setDefaultActiveSubscriptionId] = useState<string | null>(
    null
  );
  const [paymentSuccessModal, setPaymentSuccessModal] = useState<PaymentSuccessModalState>({
    visible: false,
    planName: '',
    duration: 30,
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const couponInputRef = useRef<TextInput>(null);
  const couponSectionY = useRef<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const selectedActiveSubscriptionIdRef = useRef<string | null>(null);
  const defaultActiveSubscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedActiveSubscriptionIdRef.current = selectedActiveSubscriptionId;
  }, [selectedActiveSubscriptionId]);

  useEffect(() => {
    defaultActiveSubscriptionIdRef.current = defaultActiveSubscriptionId;
  }, [defaultActiveSubscriptionId]);

  // Keyboard listener to scroll to coupon input & hide bottom bar
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (): void => {
      setKeyboardVisible(true);
      if (couponInputRef.current?.isFocused()) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: couponSectionY.current - 100,
            animated: true,
          });
        }, 100);
      }
    };

    const onKeyboardHide = (): void => {
      setKeyboardVisible(false);
    };

    const sub1 = Keyboard.addListener(showEvent, onKeyboardShow);
    const sub2 = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const fetchTiers = useCallback(async (): Promise<void> => {
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/subscription-tiers`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.tiers)) {
        setTiers(data.tiers);
      } else {
        setTiers([]);
      }
    } catch (error) {
      console.error('[Subscriptions] Error fetching tiers:', error);
      setTiers([]);
    }
  }, []);

  const fetchActiveSubscription = useCallback(async (): Promise<void> => {
    if (!user?.id) return;
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/subscriptions`, {
        headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
      });
      const data = await response.json();
      setStarterCredits(data?.starterCredits || null);
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        // Keep all active non-expired subscriptions
        const activeSubs = data.data.filter(
          (s: ActiveSubscription) => s.status === 'active' && new Date(s.expiresAt) > new Date()
        );
        setActiveSubscriptions(activeSubs);
        if (activeSubs.length > 0) {
          const firstId = activeSubs[0].id;
          const currentSelected = selectedActiveSubscriptionIdRef.current;
          const currentDefault = defaultActiveSubscriptionIdRef.current;

          const selectedStillValid = currentSelected
            ? activeSubs.some((s: ActiveSubscription) => s.id === currentSelected)
            : false;
          const defaultStillValid = currentDefault
            ? activeSubs.some((s: ActiveSubscription) => s.id === currentDefault)
            : false;

          setSelectedActiveSubscriptionId(selectedStillValid ? currentSelected : firstId);
          setDefaultActiveSubscriptionId(defaultStillValid ? currentDefault : firstId);
        } else {
          setSelectedActiveSubscriptionId(null);
          setDefaultActiveSubscriptionId(null);
        }
      } else {
        setActiveSubscriptions([]);
        setSelectedActiveSubscriptionId(null);
        setDefaultActiveSubscriptionId(null);
      }
    } catch (error) {
      console.error('[Subscriptions] Error fetching active subscription:', error);
      setActiveSubscriptions([]);
      setStarterCredits(null);
      setSelectedActiveSubscriptionId(null);
      setDefaultActiveSubscriptionId(null);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTiers(), fetchActiveSubscription()]).finally(() => setLoading(false));
  }, [fetchTiers, fetchActiveSubscription]);

  // Refetch data when screen comes into focus (e.g., returning from admin panel)
  useFocusEffect(
    useCallback(() => {
      // Refetch without showing loading spinner
      fetchTiers();
      fetchActiveSubscription();
    }, [fetchTiers, fetchActiveSubscription])
  );

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await Promise.all([fetchTiers(), fetchActiveSubscription()]);
    setRefreshing(false);
  };

  const validateCoupon = useCallback(async (): Promise<void> => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    if (!user?.id) {
      setCouponError('Please log in to use coupons');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError(null);
    setCouponDiscount(null);

    try {
      const apiUrl = await getApiUrl();
      const selectedTierForCoupon = tiers.find((tier) => tier.id === selectedTierId) || null;
      const amount = selectedTierForCoupon ? getPrice(selectedTierForCoupon) : 0;

      const url = selectedTierId
        ? `${apiUrl}/api/coupons/calculate-discount?code=${couponCode.trim()}&amount=${amount}&userId=${user.id}&tierId=${selectedTierId}`
        : `${apiUrl}/api/coupons/calculate-discount?code=${couponCode.trim()}&amount=${amount}&userId=${user.id}`;

      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCouponError(data.error || 'Invalid coupon code');
        setCouponDiscount(null);
        return;
      }

      setCouponDiscount({
        coupon: {
          code: couponCode.trim(),
          discountPercentage: data.discountPercentage,
        },
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount,
      });
      setCouponError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[Subscriptions] Error validating coupon:', error);
      setCouponError('Failed to validate coupon. Please try again.');
      setCouponDiscount(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  }, [couponCode, user?.id, selectedTierId, tiers]);

  const clearCoupon = (): void => {
    setCouponCode('');
    setCouponDiscount(null);
    setCouponError(null);
  };

  const getRegularPrice = (tier: SubscriptionTier): number => {
    return Number(tier.price) || tier.monthlyPrice;
  };

  const getPrice = (tier: SubscriptionTier): number => {
    const regularPrice = getRegularPrice(tier);
    const discounted = Number(tier.offerPrice);
    if (Number.isFinite(discounted) && discounted > 0 && discounted < regularPrice) {
      return discounted;
    }
    return regularPrice;
  };

  const displayTiers = useMemo((): SubscriptionTier[] => {
    if (!tiers.length) return [];

    return [...tiers].sort((a, b) => {
      const aPrice = Number(a.price) || a.monthlyPrice;
      const bPrice = Number(b.price) || b.monthlyPrice;
      const aIsFree = aPrice <= 0;
      const bIsFree = bPrice <= 0;
      if (aIsFree !== bIsFree) return aIsFree ? -1 : 1;

      const aBoost = Number(a.boostCredits || 0) > 0 ? 1 : 0;
      const bBoost = Number(b.boostCredits || 0) > 0 ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;

      if (aPrice !== bPrice) return aPrice - bPrice;

      return (a.durationDays || 30) - (b.durationDays || 30);
    });
  }, [tiers]);

  useEffect(() => {
    if (!selectedTierId) return;
    const selectedStillExists = displayTiers.some((tier) => tier.id === selectedTierId);
    if (!selectedStillExists) {
      setSelectedTierId(null);
      setCouponCode('');
      setCouponDiscount(null);
      setCouponError(null);
    }
  }, [displayTiers, selectedTierId]);

  const selectedTier =
    (selectedTierId && displayTiers.find((tier) => tier.id === selectedTierId)) ||
    (selectedTierId && tiers.find((tier) => tier.id === selectedTierId)) ||
    null;
  const hasStarterCredits = Boolean(
    starterCredits &&
    starterCredits.isActive &&
    ((starterCredits.listingsRemaining || 0) > 0 || (starterCredits.boostsRemaining || 0) > 0)
  );

  const consolidatedActiveSubscriptions = useMemo((): ConsolidatedActiveSubscription[] => {
    if (!activeSubscriptions.length) return [];

    const groups = new Map<string, ConsolidatedActiveSubscription>();
    const now = Date.now();

    activeSubscriptions.forEach((sub) => {
      if (!sub.tier) return;

      const key = `${sub.tier.id}-${sub.tier.durationDays}`;
      const tierPrice = parseFloat(sub.tier.price) || 0;
      const maxListings = sub.tier.maxListings;
      const available = maxListings === -1 ? -1 : Math.max(0, maxListings - sub.listingsUsed);
      const isBoostPack = String(sub.tier.type || 'bundle') === 'boost';
      const boostEntitlement = Number(sub.tier.boostCredits || 0);
      const boostsRemaining = Number(sub.boostsRemaining || 0);
      const expiry = new Date(sub.expiresAt);
      const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - now) / (1000 * 60 * 60 * 24)));

      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          key,
          tierId: sub.tier.id,
          tierName: sub.tier.name,
          tierPrice,
          durationDays: sub.tier.durationDays,
          count: 1,
          totalUsed: sub.listingsUsed,
          totalAvailable: available,
          totalLimit: maxListings === -1 ? -1 : maxListings,
          shortestExpiryDays: daysLeft,
          latestExpiryAt: expiry,
          hasUnlimited: maxListings === -1,
          isBoostPack,
          boostEntitlement,
          totalBoostsRemaining: boostsRemaining,
          subscriptions: [sub],
        });
        return;
      }

      existing.count += 1;
      existing.totalUsed += sub.listingsUsed;
      existing.shortestExpiryDays = Math.min(existing.shortestExpiryDays, daysLeft);
      if (expiry > existing.latestExpiryAt) {
        existing.latestExpiryAt = expiry;
      }
      existing.totalBoostsRemaining += boostsRemaining;
      existing.subscriptions.push(sub);

      if (existing.hasUnlimited || maxListings === -1) {
        existing.hasUnlimited = true;
        existing.totalAvailable = -1;
        existing.totalLimit = -1;
      } else {
        existing.totalAvailable += available;
        existing.totalLimit += maxListings;
      }
    });

    return Array.from(groups.values())
      .filter((group) => group.hasUnlimited || group.totalAvailable > 0)
      .sort((a, b) => {
        if (a.tierPrice !== b.tierPrice) return a.tierPrice - b.tierPrice;
        if (a.durationDays !== b.durationDays) return a.durationDays - b.durationDays;
        return a.tierName.localeCompare(b.tierName);
      });
  }, [activeSubscriptions]);

  useEffect(() => {
    if (!consolidatedActiveSubscriptions.length) {
      setSelectedActiveSubscriptionId(null);
      setDefaultActiveSubscriptionId(null);
      return;
    }

    const visibleIds = new Set(
      consolidatedActiveSubscriptions.flatMap((group) => group.subscriptions.map((sub) => sub.id))
    );
    const firstVisibleId = consolidatedActiveSubscriptions[0]?.subscriptions[0]?.id ?? null;

    if (!selectedActiveSubscriptionId || !visibleIds.has(selectedActiveSubscriptionId)) {
      setSelectedActiveSubscriptionId(firstVisibleId);
    }
    if (!defaultActiveSubscriptionId || !visibleIds.has(defaultActiveSubscriptionId)) {
      setDefaultActiveSubscriptionId(firstVisibleId);
    }
  }, [consolidatedActiveSubscriptions, selectedActiveSubscriptionId, defaultActiveSubscriptionId]);

  const handleSubscribe = useCallback(async (): Promise<void> => {
    if (!selectedTierId) {
      Alert.alert('Select a Plan', 'Please select a subscription plan to continue.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Login Required', 'Please log in to subscribe.', [
        { text: 'Cancel' },
        { text: 'Login', onPress: () => router.push('/auth/register' as any) },
      ]);
      return;
    }

    const selectedTier =
      (selectedTierId && displayTiers.find((tier) => tier.id === selectedTierId)) ||
      (selectedTierId && tiers.find((tier) => tier.id === selectedTierId)) ||
      null;
    if (!selectedTier) return;

    const price = getPrice(selectedTier);
    const duration = selectedTier.durationDays || 30;

    setIsSubscribing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const apiUrl = await getApiUrl();

      // Step 1: Create subscription
      const subRes = await fetch(`${apiUrl}/api/subscriptions`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
        body: JSON.stringify({ tierId: selectedTierId, duration }),
      });
      const subData = await subRes.json();

      if (!subData.success && !subData.id) {
        Alert.alert('Error', subData.error || 'Failed to create subscription');
        return;
      }

      const subscriptionId = subData.id;

      // Step 2: Checkout — get Razorpay order
      const checkoutRes = await fetch(`${apiUrl}/api/subscriptions/checkout`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
        body: JSON.stringify({
          subscriptionId,
          userId: user.id,
          listingId: 'subscription-' + subscriptionId,
          listingTitle: `${selectedTier.name} Plan`,
          totalFee: price,
          duration,
          tierId: selectedTierId,
          couponCode: couponDiscount ? couponCode : undefined,
        }),
      });
      const checkoutData = await checkoutRes.json();

      if (!checkoutData.success) {
        Alert.alert('Error', checkoutData.error || 'Failed to initiate payment');
        return;
      }

      // If 100% discount — subscription is free
      if (checkoutData.isFree) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchActiveSubscription();
        Alert.alert('Success!', checkoutData.message || 'Subscription activated for free!', [
          { text: 'OK' },
          {
            text: 'Create Listing',
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      // Step 3: Open Razorpay
      const { razorpayOrderId, amount, key } = checkoutData.payment;

      const razorpayOptions = {
        description: `${selectedTier.name} Plan - ${duration} Days`,
        image: 'https://nearhub.app/nearhub-logo.png',
        currency: 'INR',
        key,
        amount: String(amount),
        order_id: razorpayOrderId,
        name: 'NearHub',
        prefill: {
          email: user.email || '',
          contact: user.phone || '',
          name: user.name || '',
        },
        theme: { color: '#0A66C2' },
      };

      // @ts-ignore - dynamic import to avoid New Architecture crash
      const RazorpayCheckout = require('react-native-razorpay').default;

      const paymentResult = await RazorpayCheckout.open(razorpayOptions);

      // Step 4: Verify payment
      const verifyRes = await fetch(`${apiUrl}/api/subscriptions/verify-payment`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
        body: JSON.stringify({
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
          subscriptionId,
          couponCode: couponDiscount ? couponCode : undefined,
          discountAmount: checkoutData.discount?.amount,
          generateInvoice: true,
          customerId: user.id,
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: user.phone,
          invoiceItems: [
            {
              description: `${selectedTier.name} Plan - ${duration} Days`,
              quantity: 1,
              unitPrice: price,
              amount: checkoutData.discount?.finalAmount ?? price,
            },
          ],
        }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (verifyData.invoice) {
          try {
            const storedInvoice = extractInvoiceFromResponse({
              ...verifyData,
              paymentId: verifyData.paymentId || paymentResult.razorpay_payment_id,
              orderId: verifyData.orderId || paymentResult.razorpay_order_id,
            });
            if (storedInvoice) {
              await storeInvoice(storedInvoice);
              console.log('[Subscriptions] Invoice stored locally:', storedInvoice.invoiceNumber);
            }
          } catch (invoiceError) {
            console.error('[Subscriptions] Failed to store invoice locally:', invoiceError);
          }
        }

        // Force refresh subscription data
        await fetchActiveSubscription();

        console.log('[Subscriptions] Payment successful:', verifyData);

        setPaymentSuccessModal({
          visible: true,
          planName: selectedTier.name,
          duration,
          invoiceNumber: verifyData.invoice?.invoiceNumber,
          totalAmount: verifyData.invoice?.total,
          invoiceFailed: verifyData.invoiceGenerated === false,
        });
      } else {
        Alert.alert(
          'Verification Failed',
          verifyData.error || 'Payment verification failed. Contact support.'
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Payment failed';
      console.error('[Subscriptions] Payment error:', error);
      if (errMsg.includes('cancelled') || errMsg.includes('dismissed')) {
        // User cancelled — no alert needed
      } else {
        Alert.alert('Payment Error', errMsg);
      }
    } finally {
      setIsSubscribing(false);
    }
  }, [
    selectedTierId,
    user,
    displayTiers,
    tiers,
    couponCode,
    couponDiscount,
    fetchActiveSubscription,
  ]);

  const getFeaturesList = (tier: SubscriptionTier): string[] => {
    const features: string[] = [];

    const isBoostPack = String(tier.type || 'bundle') === 'boost';
    if (isBoostPack) {
      const credits = Number(tier.boostCredits || 0);
      features.push(`${credits} boost credit${credits === 1 ? '' : 's'}`);
      features.push('Use credits from My Listings -> Boost');
    } else {
      features.push(
        tier.maxListings === -1 ? 'Unlimited listings' : `Up to ${tier.maxListings} listings/month`
      );
      const credits = Number(tier.boostCredits || 0);
      if (credits > 0) {
        features.push(`${credits} boost credit${credits === 1 ? '' : 's'}`);
      }
    }

    if (tier.features?.includes('priority_support')) {
      features.push('Priority support');
    }
    if (tier.features?.includes('verified_badge')) {
      features.push('Verified badge');
    }
    if (tier.features?.includes('video')) {
      features.push('Video listings');
    }
    if (tier.features?.includes('analytics')) {
      features.push('Advanced analytics');
    }
    return features;
  };

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
        <Text style={styles.headerTitle}>Subscription & Boost Plans</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Active Subscription Card */}
        {consolidatedActiveSubscriptions.length > 0 && (
          <View style={styles.activeSubsList}>
            <Text style={styles.activeSubsTitle}>
              Choose Subscription ({consolidatedActiveSubscriptions.length})
            </Text>
            {consolidatedActiveSubscriptions.map((group) => {
              const representative =
                group.subscriptions.find((sub) => sub.id === defaultActiveSubscriptionId) ||
                group.subscriptions.find((sub) => sub.id === selectedActiveSubscriptionId) ||
                group.subscriptions[0];
              const representativeId = representative?.id || group.subscriptions[0]?.id;
              const isSelected =
                !!representativeId &&
                group.subscriptions.some((sub) => sub.id === selectedActiveSubscriptionId);
              const isDefault = group.subscriptions.some(
                (sub) => sub.id === defaultActiveSubscriptionId
              );
              const usagePercent =
                group.hasUnlimited || group.totalLimit <= 0
                  ? 0
                  : Math.min(100, (group.totalUsed / group.totalLimit) * 100);
              const effectiveExpiryDays = group.shortestExpiryDays;

              return (
                <Pressable
                  key={group.key}
                  style={[styles.activeSubCard, isSelected && styles.activeSubCardSelected]}
                  onPress={() => {
                    if (representativeId) {
                      setSelectedActiveSubscriptionId(representativeId);
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <LinearGradient
                    colors={['#0A66C2', '#0D8AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeSubGradient}
                  >
                    {/* Header */}
                    <View style={styles.activeSubHeader}>
                      <View style={styles.activeSubBadge}>
                        <Feather name="check-circle" size={14} color="#fff" />
                        <Text style={styles.activeSubBadgeText}>Active Plan</Text>
                      </View>
                      <Text style={styles.activeSubDays}>
                        {effectiveExpiryDays} day{effectiveExpiryDays !== 1 ? 's' : ''} left
                      </Text>
                    </View>

                    {/* Plan name */}
                    <View style={styles.activeSubNameRow}>
                      <Text style={styles.activeSubPlanName}>{group.tierName}</Text>
                      {group.count > 1 && (
                        <View style={styles.activeSubCountBadge}>
                          <Text style={styles.activeSubCountText}>x{group.count}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.activeSubPrice}>
                      ₹{group.tierPrice.toFixed(0)} / {getDurationShort(group.durationDays)}
                    </Text>
                    <View style={styles.activeSubMetaRow}>
                      {isDefault && (
                        <View style={[styles.activeSubMetaBadge, styles.activeSubMetaDefault]}>
                          <Text style={styles.activeSubMetaText}>Default</Text>
                        </View>
                      )}
                      {isSelected && (
                        <View style={[styles.activeSubMetaBadge, styles.activeSubMetaSelected]}>
                          <Text style={styles.activeSubMetaText}>Selected</Text>
                        </View>
                      )}
                    </View>

                    {/* Listing Stats */}
                    <View style={styles.activeSubStats}>
                      <View style={styles.activeSubStatRow}>
                        <View style={styles.activeSubStatItem}>
                          <Text style={styles.activeSubStatValue}>{group.totalUsed}</Text>
                          <Text style={styles.activeSubStatLabel}>
                            {group.count > 1 ? 'Total Used' : 'Active Listings'}
                          </Text>
                        </View>
                        <View style={styles.activeSubStatDivider} />
                        <View style={styles.activeSubStatItem}>
                          <Text style={styles.activeSubStatValue}>
                            {group.hasUnlimited ? '∞' : group.totalAvailable}
                          </Text>
                          <Text style={styles.activeSubStatLabel}>
                            {group.count > 1 ? 'Total Left' : 'Available'}
                          </Text>
                        </View>
                        <View style={styles.activeSubStatDivider} />
                        <View style={styles.activeSubStatItem}>
                          <Text style={styles.activeSubStatValue}>
                            {group.hasUnlimited ? '∞' : group.totalLimit}
                          </Text>
                          <Text style={styles.activeSubStatLabel}>
                            {group.count > 1 ? 'Combined' : 'Plan Limit'}
                          </Text>
                        </View>
                      </View>

                      {/* Progress bar */}
                      {!group.hasUnlimited && (
                        <View style={styles.activeSubProgress}>
                          <View style={styles.activeSubProgressTrack}>
                            <View
                              style={[
                                styles.activeSubProgressFill,
                                { width: `${usagePercent}%` },
                                usagePercent >= 90 && { backgroundColor: '#FF6B6B' },
                              ]}
                            />
                          </View>
                          <Text style={styles.activeSubProgressText}>
                            {group.totalUsed}/{group.totalLimit} listings used
                          </Text>
                        </View>
                      )}

                      {(group.boostEntitlement > 0 || group.totalBoostsRemaining > 0) && (
                        <View style={styles.activeSubBoostRow}>
                          <View style={styles.activeSubBoostMeta}>
                            <Feather name="zap" size={12} color="#FDE68A" />
                            <Text style={styles.activeSubBoostText}>
                              {group.isBoostPack
                                ? `${group.boostEntitlement} credits per pack`
                                : `${group.boostEntitlement} credits in plan`}
                            </Text>
                          </View>
                          <Text style={styles.activeSubBoostRemaining}>
                            Left: {group.totalBoostsRemaining}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Expiry */}
                    <View style={styles.activeSubExpiry}>
                      <Feather name="calendar" size={13} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.activeSubExpiryText}>
                        Expires{' '}
                        {group.latestExpiryAt.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        )}

        {hasStarterCredits && starterCredits && (
          <View style={styles.starterCreditsCard}>
            <View style={styles.starterCreditsHeader}>
              <Feather name="gift" size={14} color={Colors.primary} />
              <Text style={styles.starterCreditsTitle}>Starter Credits Available</Text>
              {consolidatedActiveSubscriptions.length === 0 && (
                <View style={styles.starterCreditsBadge}>
                  <Text style={styles.starterCreditsBadgeText}>Use Now</Text>
                </View>
              )}
            </View>
            <View style={styles.starterCreditsStatsRow}>
              <View style={styles.starterCreditsStat}>
                <Text style={styles.starterCreditsStatValue}>
                  {starterCredits.listingsRemaining}
                </Text>
                <Text style={styles.starterCreditsStatLabel}>Listings Left</Text>
              </View>
              <View style={styles.starterCreditsStatDivider} />
              <View style={styles.starterCreditsStat}>
                <Text style={styles.starterCreditsStatValue}>{starterCredits.boostsRemaining}</Text>
                <Text style={styles.starterCreditsStatLabel}>Boosts Left</Text>
              </View>
            </View>
            {consolidatedActiveSubscriptions.length === 0 && (
              <Text style={styles.starterCreditsHint}>
                No active paid plan. Starter credits can be used immediately.
              </Text>
            )}
          </View>
        )}

        {/* Info Banner */}
        {consolidatedActiveSubscriptions.length === 0 && !hasStarterCredits && (
          <View style={styles.infoBanner}>
            <Feather name="shopping-bag" size={20} color={Colors.primary} />
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Subscribe to List</Text>
              <Text style={styles.infoBannerText}>
                Choose a plan to create listings and get boost visibility. Or use a coupon code for
                free listings.
              </Text>
            </View>
          </View>
        )}

        {/* Coupon Code Section */}
        <View
          style={styles.couponSection}
          onLayout={(e) => {
            couponSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.couponHeader}>
            <Feather name="tag" size={18} color={Colors.primary} />
            <Text style={styles.couponTitle}>Have a Coupon Code?</Text>
          </View>

          <View style={styles.couponInputContainer}>
            <TextInput
              ref={couponInputRef}
              style={styles.couponInput}
              placeholder="Enter coupon code"
              value={couponCode}
              onChangeText={(text) => {
                setCouponCode(text.toUpperCase());
                setCouponError(null);
              }}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({
                    y: couponSectionY.current - 100,
                    animated: true,
                  });
                }, 150);
              }}
              autoCapitalize="characters"
              editable={!isValidatingCoupon}
              placeholderTextColor={Colors.textTertiary}
            />
            {couponDiscount ? (
              <Pressable style={styles.clearButton} onPress={clearCoupon}>
                <Feather name="x" size={16} color={Colors.accent} />
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.applyButton,
                  (isValidatingCoupon || !couponCode.trim()) && styles.applyButtonDisabled,
                ]}
                onPress={validateCoupon}
                disabled={isValidatingCoupon || !couponCode.trim()}
              >
                {isValidatingCoupon ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyButtonText}>Apply</Text>
                )}
              </Pressable>
            )}
          </View>

          {couponError && (
            <View style={styles.couponErrorRow}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.couponErrorText}>{couponError}</Text>
            </View>
          )}

          {couponDiscount && (
            <View style={styles.discountBanner}>
              <Feather name="check-circle" size={16} color={Colors.success} />
              <View style={styles.discountContent}>
                <Text style={styles.discountApplied}>
                  {couponDiscount.coupon.code} — {couponDiscount.coupon.discountPercentage}% off
                </Text>
                {couponDiscount.coupon.discountPercentage === 100 ? (
                  <Text style={styles.discountFree}>Free subscription for 30 days!</Text>
                ) : (
                  <Text style={styles.discountAmount}>
                    You save ₹{couponDiscount.discountAmount.toLocaleString('en-IN')} · Pay ₹
                    {couponDiscount.finalAmount.toLocaleString('en-IN')}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Tier Cards */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : displayTiers.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Plans Available</Text>
            <Text style={styles.emptySubtitle}>
              Subscription and boost plans will appear here when available.
            </Text>
          </View>
        ) : (
          <View style={styles.tiersList}>
            {displayTiers.map((tier) => {
              const isSelected = selectedTierId === tier.id;
              const price = getPrice(tier);
              const regularPrice = getRegularPrice(tier);
              const hasOffer = regularPrice > price;
              const features = getFeaturesList(tier);
              const hasBoost = Number(tier.boostCredits || 0) > 0;
              const isBoostPack = String(tier.type || 'bundle') === 'boost';
              const days = tier.durationDays || 30;
              const perDay = (price / days).toFixed(1);

              return (
                <Pressable
                  key={tier.id}
                  style={[
                    styles.tierCard,
                    tier.highlight && styles.tierCardPopular,
                    isSelected && styles.tierCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedTierId(isSelected ? null : tier.id);
                    if (couponDiscount) clearCoupon();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {/* Left accent bar */}
                  <View
                    style={[
                      styles.tierAccentBar,
                      isSelected && { backgroundColor: Colors.primary },
                      !isSelected && tier.highlight && { backgroundColor: Colors.warning },
                      !isSelected && !tier.highlight && { backgroundColor: Colors.border },
                    ]}
                  />

                  <View style={styles.tierCardBody}>
                    {/* Row 1: Name + Popular badge + Price + Radio */}
                    <View style={styles.tierTopRow}>
                      <View style={styles.tierNameCol}>
                        <View style={styles.tierNameRow}>
                          <Text
                            numberOfLines={1}
                            style={[styles.tierName, isSelected && styles.tierNameSelected]}
                          >
                            {tier.name}
                          </Text>
                        </View>
                        {tier.highlight && (
                          <View style={styles.popularBadge}>
                            <Feather name="star" size={10} color="#fff" />
                            <Text style={styles.popularBadgeText}>Popular</Text>
                          </View>
                        )}
                        {hasBoost && (
                          <View style={styles.boostIncludedBadge}>
                            <Feather name="zap" size={10} color="#fff" />
                            <Text style={styles.boostIncludedBadgeText}>Boost Included</Text>
                          </View>
                        )}
                        {isBoostPack && (
                          <View style={styles.boostIncludedBadge}>
                            <Feather name="zap" size={10} color="#fff" />
                            <Text style={styles.boostIncludedBadgeText}>Boost Pack</Text>
                          </View>
                        )}
                        <Text style={styles.tierPerDay}>₹{perDay}/day</Text>
                      </View>

                      <View style={styles.tierPriceCol}>
                        <View style={styles.tierPriceRow}>
                          <Text
                            style={[
                              styles.tierPriceCurrency,
                              isSelected && { color: Colors.primary },
                            ]}
                          >
                            ₹
                          </Text>
                          <Text
                            style={[
                              styles.tierPriceAmount,
                              isSelected && { color: Colors.primary },
                            ]}
                          >
                            {price.toLocaleString('en-IN')}
                          </Text>
                        </View>
                        {hasOffer && (
                          <Text style={styles.tierOriginalPrice}>
                            ₹{regularPrice.toLocaleString('en-IN')}
                          </Text>
                        )}
                        <Text style={styles.tierPricePeriod}>
                          /{getDurationShort(tier.durationDays || 30)}
                        </Text>
                      </View>

                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <Feather name="check" size={13} color="#fff" />}
                      </View>
                    </View>

                    {/* Row 2: Feature chips */}
                    <View style={styles.featureChips}>
                      {features.slice(0, 4).map((feature, idx) => (
                        <View
                          key={idx}
                          style={[styles.featureChip, isSelected && styles.featureChipSelected]}
                        >
                          <Feather
                            name="check"
                            size={10}
                            color={isSelected ? Colors.primary : Colors.success}
                          />
                          <Text
                            style={[
                              styles.featureChipText,
                              isSelected && styles.featureChipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={paymentSuccessModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPaymentSuccessModal((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={22} color="#fff" />
            </View>

            <Text style={styles.successTitle}>Subscription Updated Successfully</Text>
            <Text style={styles.successSubtitle}>
              Your {paymentSuccessModal.planName} {paymentSuccessModal.duration}-day plan is now
              active.
            </Text>

            <View style={styles.successInvoiceBox}>
              <Text style={styles.successInvoiceLabel}>Invoice Access</Text>
              <Text style={styles.successInvoiceNumber}>
                You can download your invoice anytime from the Invoices screen.
              </Text>
            </View>

            {paymentSuccessModal.invoiceFailed && (
              <Text style={styles.successInvoiceWarning}>
                Your subscription is active. Invoice sync may take a moment.
              </Text>
            )}

            <View style={styles.successActionsRow}>
              <Pressable
                style={[styles.successActionButton, styles.successActionSecondary]}
                onPress={() => {
                  setPaymentSuccessModal((prev) => ({
                    ...prev,
                    visible: false,
                  }));
                  fetchActiveSubscription();
                }}
              >
                <Text style={styles.successActionSecondaryText}>OK</Text>
              </Pressable>

              <Pressable
                style={[styles.successActionButton, styles.successActionPrimary]}
                onPress={() => {
                  setPaymentSuccessModal((prev) => ({
                    ...prev,
                    visible: false,
                  }));
                  fetchActiveSubscription();
                  router.back();
                }}
              >
                <Text style={styles.successActionPrimaryText}>Create Listing</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticky Subscribe Button */}
      {selectedTier && !keyboardVisible && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Price summary */}
          <View style={styles.bottomSummary}>
            <Text style={styles.bottomLabel}>Total</Text>
            <View style={styles.bottomPriceRow}>
              {couponDiscount ? (
                <>
                  <Text style={styles.bottomPriceStrike}>
                    ₹{getPrice(selectedTier).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.bottomPrice}>
                    ₹{couponDiscount.finalAmount.toLocaleString('en-IN')}
                  </Text>
                </>
              ) : (
                <Text style={styles.bottomPrice}>
                  ₹{getPrice(selectedTier).toLocaleString('en-IN')}
                </Text>
              )}
              <Text style={styles.bottomPeriod}>
                /{getDurationLabel(selectedTier.durationDays || 30)}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.subscribeButton,
              pressed && { opacity: 0.9 },
              isSubscribing && { opacity: 0.7 },
            ]}
            onPress={handleSubscribe}
            disabled={isSubscribing}
          >
            <LinearGradient
              colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subscribeGradient}
            >
              {isSubscribing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="credit-card" size={18} color="#fff" />
                  <Text style={styles.subscribeButtonText}>
                    {couponDiscount?.coupon.discountPercentage === 100
                      ? 'Activate Free Plan'
                      : 'Buy Now'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },

  // Info Banner
  starterCreditsCard: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  starterCreditsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  starterCreditsTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  starterCreditsBadge: {
    marginLeft: 'auto',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  starterCreditsBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#1D4ED8',
  },
  starterCreditsStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingVertical: 8,
  },
  starterCreditsStat: {
    flex: 1,
    alignItems: 'center',
  },
  starterCreditsStatValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  starterCreditsStatLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  starterCreditsStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#DBEAFE',
  },
  starterCreditsHint: {
    marginTop: 7,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#1D4ED8',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '10',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Loading / Empty
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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

  // Tier Cards
  tiersList: {
    gap: 10,
    marginBottom: 24,
  },
  tierCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  tierCardPopular: {
    borderColor: Colors.warning + '50',
    backgroundColor: '#FFFCF5',
  },
  tierCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F7FF',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tierAccentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  tierCardBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 16,
  },
  tierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierNameCol: {
    flex: 1,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    letterSpacing: -0.2,
    maxWidth: '100%',
    flexShrink: 1,
  },
  tierNameSelected: {
    color: Colors.primary,
  },
  tierPerDay: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  tierPriceCol: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  tierPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tierPriceCurrency: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginRight: 1,
  },
  tierPriceAmount: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  tierPricePeriod: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  tierOriginalPrice: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 2,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  boostIncludedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 2,
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  boostIncludedBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },

  // Feature chips
  featureChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border + '80',
  },
  featureChipSelected: {
    backgroundColor: Colors.primary + '0A',
    borderColor: Colors.primary + '25',
  },
  featureChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  featureChipTextSelected: {
    color: Colors.primary,
  },

  // Coupon Section
  couponSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  couponTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  couponInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 92,
    minHeight: 44,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  couponErrorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.error,
  },
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
  },
  discountContent: {
    flex: 1,
  },
  discountApplied: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
    marginBottom: 2,
  },
  discountFree: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#10B981',
  },
  discountAmount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 14,
  },
  bottomSummary: {
    flex: 1,
  },
  bottomLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bottomPrice: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  bottomPriceStrike: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  bottomPeriod: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  subscribeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
    minHeight: 50,
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 12,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },

  // Active Subscription Card
  activeSubCard: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    shadowColor: '#0A66C2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
  activeSubCardSelected: {
    borderWidth: 1.5,
    borderColor: '#083A72',
  },
  activeSubsList: {
    marginBottom: 4,
  },
  activeSubsTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  activeSubGradient: {
    padding: 8,
    borderRadius: 8,
  },
  activeSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  activeSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
  },
  activeSubBadgeText: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeSubDays: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.9)',
  },
  activeSubPlanName: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 0,
  },
  activeSubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 0,
  },
  activeSubCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  activeSubCountText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  activeSubPrice: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  activeSubMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  activeSubMetaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
  },
  activeSubMetaDefault: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  activeSubMetaSelected: {
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderColor: 'rgba(167,243,208,0.55)',
  },
  activeSubMetaText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  activeSubStats: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 3,
  },
  activeSubStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  activeSubStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  activeSubStatValue: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 1,
  },
  activeSubStatLabel: {
    fontSize: 7,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  activeSubStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeSubProgress: {
    marginTop: 3,
  },
  activeSubProgressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 2,
  },
  activeSubProgressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 3,
  },
  activeSubProgressText: {
    fontSize: 7,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  activeSubBoostRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  activeSubBoostMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  activeSubBoostText: {
    fontSize: 8,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.88)',
  },
  activeSubBoostRemaining: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#FDE68A',
  },
  activeSubExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeSubExpiryText: {
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  successIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  successInvoiceBox: {
    marginTop: 14,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    gap: 2,
  },
  successInvoiceLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  successInvoiceNumber: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  successInvoiceAmount: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
  },
  successInvoiceWarning: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.warning,
  },
  successActionsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  successActionButton: {
    flex: 1,
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  successActionSecondary: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
  },
  successActionPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  successActionSecondaryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  successActionPrimaryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
