import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { getApiUrl } from '@/lib/query-client';

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  maxListings: number;
  featuredListingsPerMonth: number;
  features: string[];
  highlight: boolean;
  price: number;
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
  tier: {
    id: string;
    name: string;
    price: string;
    durationDays: number;
    maxListings: number;
    featuredListingsPerMonth: number;
    features: string[];
  } | null;
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
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const couponInputRef = useRef<TextInput>(null);
  const couponSectionY = useRef<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-phone': user.phone || '',
        },
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        // Get all active non-expired subscriptions (no longer combining)
        const activeSubscriptions = data.data.filter(
          (s: ActiveSubscription) => s.status === 'active' && new Date(s.expiresAt) > new Date()
        );

        // Just take the first one for display compatibility
        // (TODO: Show all subscriptions in a list instead)
        setActiveSubscription(activeSubscriptions.length > 0 ? activeSubscriptions[0] : null);
      } else {
        setActiveSubscription(null);
      }
    } catch (error) {
      console.error('[Subscriptions] Error fetching active subscription:', error);
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
      const selectedTier = tiers.find((t) => t.id === selectedTierId);
      const amount = selectedTier ? getPrice(selectedTier) : 0;

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

  const getPrice = (tier: SubscriptionTier): number => {
    return Number(tier.price) || tier.monthlyPrice;
  };

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

    const selectedTier = tiers.find((t) => t.id === selectedTierId);
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          subscriptionId,
          sellerId: user.id,
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
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

        // Force refresh subscription data
        await fetchActiveSubscription();

        // Build success message with invoice info
        let successMessage = `Your ${selectedTier.name} plan is now active for ${duration} days.`;

        if (verifyData.invoiceGenerated && verifyData.invoice?.invoiceNumber) {
          successMessage += `\n\n✅ Invoice Generated: ${verifyData.invoice.invoiceNumber}`;
          successMessage += `\n₹${(verifyData.invoice.total || 0).toFixed(2)}`;
        } else if (verifyData.invoiceGenerated === false) {
          successMessage += '\n\n⚠️ Invoice generation failed. Contact support if needed.';
        }

        console.log('[Subscriptions] Payment successful:', verifyData);

        Alert.alert('Payment Successful!', successMessage, [
          {
            text: 'OK',
            onPress: () => {
              // Force another refresh when user closes alert
              fetchActiveSubscription();
            },
          },
          {
            text: 'Create Listing',
            onPress: () => {
              fetchActiveSubscription();
              router.back();
            },
          },
        ]);
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
  }, [selectedTierId, user, tiers, couponCode, couponDiscount, fetchActiveSubscription]);

  const getFeaturesList = (tier: SubscriptionTier): string[] => {
    const features: string[] = [];
    features.push(
      tier.maxListings === -1 ? 'Unlimited listings' : `Up to ${tier.maxListings} listings/month`
    );

    // Only show featured listings if the tier actually includes them
    if (tier.featuredListingsPerMonth > 0) {
      features.push(
        tier.featuredListingsPerMonth === 999
          ? 'Unlimited featured listings'
          : `${tier.featuredListingsPerMonth} featured listing${tier.featuredListingsPerMonth !== 1 ? 's' : ''}`
      );
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
        <Text style={styles.headerTitle}>Subscription Plans</Text>
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
        {activeSubscription &&
          activeSubscription.tier &&
          (() => {
            const expiresAt = new Date(activeSubscription.expiresAt);
            const now = new Date();
            const daysLeft = Math.max(
              0,
              Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            );
            const maxListings = activeSubscription.tier.maxListings;
            const listingsUsed = activeSubscription.listingsUsed;
            const isUnlimited = maxListings === -1;
            const usagePercent = isUnlimited
              ? 0
              : maxListings > 0
                ? Math.min(100, (listingsUsed / maxListings) * 100)
                : 0;

            return (
              <View style={styles.activeSubCard}>
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
                      {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </Text>
                  </View>

                  {/* Plan name */}
                  <Text style={styles.activeSubPlanName}>{activeSubscription.tier.name}</Text>
                  <Text style={styles.activeSubPrice}>
                    ₹{parseFloat(activeSubscription.tier.price).toFixed(0)}
                  </Text>

                  {/* Listing Stats */}
                  <View style={styles.activeSubStats}>
                    <View style={styles.activeSubStatRow}>
                      <View style={styles.activeSubStatItem}>
                        <Text style={styles.activeSubStatValue}>{listingsUsed}</Text>
                        <Text style={styles.activeSubStatLabel}>Active Listings</Text>
                      </View>
                      <View style={styles.activeSubStatDivider} />
                      <View style={styles.activeSubStatItem}>
                        <Text style={styles.activeSubStatValue}>
                          {isUnlimited ? '∞' : maxListings - listingsUsed}
                        </Text>
                        <Text style={styles.activeSubStatLabel}>Available</Text>
                      </View>
                      <View style={styles.activeSubStatDivider} />
                      <View style={styles.activeSubStatItem}>
                        <Text style={styles.activeSubStatValue}>
                          {activeSubscription.totalListingsCreated}
                        </Text>
                        <Text style={styles.activeSubStatLabel}>Total Created</Text>
                      </View>
                    </View>

                    {/* Progress bar */}
                    {!isUnlimited && (
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
                          {listingsUsed}/{maxListings} listings used
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Expiry */}
                  <View style={styles.activeSubExpiry}>
                    <Feather name="calendar" size={13} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.activeSubExpiryText}>
                      Expires{' '}
                      {expiresAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            );
          })()}

        {/* Info Banner */}
        {!activeSubscription && (
          <View style={styles.infoBanner}>
            <Feather name="shopping-bag" size={20} color={Colors.primary} />
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Subscribe to List</Text>
              <Text style={styles.infoBannerText}>
                Choose a plan to create listings and unlock premium features. Or use a coupon code
                for free listings.
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
        ) : tiers.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Plans Available</Text>
            <Text style={styles.emptySubtitle}>
              Subscription plans will appear here when available.
            </Text>
          </View>
        ) : (
          <View style={styles.tiersList}>
            {tiers.map((tier) => {
              const isSelected = selectedTierId === tier.id;
              const price = getPrice(tier);
              const features = getFeaturesList(tier);
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
                          <Text style={[styles.tierName, isSelected && styles.tierNameSelected]}>
                            {tier.name}
                          </Text>
                          {tier.highlight && (
                            <View style={styles.popularBadge}>
                              <Feather name="star" size={9} color="#fff" />
                              <Text style={styles.popularBadgeText}>Popular</Text>
                            </View>
                          )}
                        </View>
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

      {/* Sticky Subscribe Button */}
      {selectedTierId && !keyboardVisible && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Price summary */}
          <View style={styles.bottomSummary}>
            <Text style={styles.bottomLabel}>Total</Text>
            <View style={styles.bottomPriceRow}>
              {couponDiscount ? (
                <>
                  <Text style={styles.bottomPriceStrike}>
                    ₹{getPrice(tiers.find((t) => t.id === selectedTierId)!).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.bottomPrice}>
                    ₹{couponDiscount.finalAmount.toLocaleString('en-IN')}
                  </Text>
                </>
              ) : (
                <Text style={styles.bottomPrice}>
                  ₹{getPrice(tiers.find((t) => t.id === selectedTierId)!).toLocaleString('en-IN')}
                </Text>
              )}
              <Text style={styles.bottomPeriod}>
                /{getDurationLabel(tiers.find((t) => t.id === selectedTierId)?.durationDays || 30)}
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
                      : 'Subscribe & Pay'}
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
    gap: 8,
  },
  tierName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    letterSpacing: -0.2,
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
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    letterSpacing: 0.3,
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
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
    borderRadius: 14,
    overflow: 'hidden',
    flex: 1,
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },

  // Active Subscription Card
  activeSubCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#0A66C2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  activeSubGradient: {
    padding: 20,
    borderRadius: 20,
  },
  activeSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activeSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activeSubBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeSubDays: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.9)',
  },
  activeSubPlanName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 2,
  },
  activeSubPrice: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 16,
  },
  activeSubStats: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 2,
  },
  activeSubStatLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  activeSubStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeSubProgress: {
    marginTop: 14,
  },
  activeSubProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  activeSubProgressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 3,
  },
  activeSubProgressText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  activeSubExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeSubExpiryText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
  },
});
