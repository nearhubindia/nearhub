import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import BrandWordmark from '@/shared/components/BrandWordmark';
import { useAuth, PLANS, SubscriptionPlan, PlanDetails } from '@/shared/contexts/auth-context';
import { getCityFromCoordinates } from '@/lib/location-data';
import { getApiUrl } from '@/lib/query-client';
import { createResponsiveStyles } from '@/lib/responsive';

function PlanCard({
  plan,
  isSelected,
  onSelect,
}: {
  plan: PlanDetails;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.planCard,
        isSelected && styles.planCardSelected,
        plan.highlight && styles.planCardHighlight,
      ]}
      onPress={onSelect}
    >
      {plan.highlight && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={[styles.planName, isSelected && styles.planNameSelected]}>{plan.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
            {plan.price === 0 ? 'Free' : `₹${plan.price}`}
          </Text>
          {plan.price !== 0 && (
            <Text style={[styles.planPeriod, isSelected && styles.planPeriodSelected]}>
              /{plan.period}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Feather name="check" size={14} color={isSelected ? '#fff' : Colors.success} />
            <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.selectIndicator, isSelected && styles.selectIndicatorActive]}>
        {isSelected && <Feather name="check" size={14} color="#fff" />}
      </View>
    </Pressable>
  );
}

export default function SelectPlanScreen() {
  const insets = useSafeAreaInsets();
  const { subscribeToPlan, setUserLocation, plans } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const requestLocationPermission = async () => {
    setIsDetectingLocation(true);
    setLocationError(null);

    try {
      // Check if on web platform
      if (Platform.OS === 'web') {
        setLocationError('Location detection not available on web');
        setIsDetectingLocation(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationError('Location permission denied');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setIsDetectingLocation(false);
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;

      // Try to get location from reverse geocoding API
      let location: { city: string; state: string; pincode?: string } | null = null;
      try {
        const baseUrl = getApiUrl();
        const url = new URL(
          `/api/location/reverse-geocode?latitude=${latitude}&longitude=${longitude}`,
          baseUrl
        );
        const response = await fetch(url.toString());
        const json = await response.json();

        if (json.success && json.data) {
          location = {
            city: json.data.city,
            state: json.data.state,
            pincode: json.data.pincode,
          };
          console.log('[SelectPlan] Reverse geocode success:', location);
        }
      } catch (error) {
        console.error('[SelectPlan] Reverse geocode error:', error);
      }

      // Fallback to local function if API fails
      if (!location) {
        location = getCityFromCoordinates(latitude, longitude);
        console.log('[SelectPlan] Fell back to local geocode:', location);
      }

      // Save location to user profile
      await setUserLocation(latitude, longitude, location.city, location.state);

      setUserCity(location.city);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Failed to detect location');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSelect = (planId: SubscriptionPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlan(planId);
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await subscribeToPlan(selectedPlan);

      const plan = (plans || PLANS).find((p) => p.id === selectedPlan);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (Platform.OS === 'web') {
        window.alert(`You're now on the ${plan?.name} plan! Enjoy NearHub.`);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Subscription Active', `You're now on the ${plan?.name} plan! Enjoy NearHub.`, [
          { text: 'Start Exploring', onPress: () => router.replace('/(tabs)') },
        ]);
      }
    } catch (e) {
      Alert.alert('Payment Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selected = (plans || PLANS).find((p) => p.id === selectedPlan);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || webTopInset) + 20,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.skipButton} onPress={() => router.back()}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>

        <View style={styles.headerSection}>
          <BrandWordmark size={34} showAiTag />
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Select a plan that works best for you. You can upgrade or change anytime.
          </Text>
        </View>

        {/* Location Detection Section */}
        <View style={styles.locationBanner}>
          <View style={styles.locationContent}>
            <View style={styles.locationIcon}>
              {isDetectingLocation ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : userCity ? (
                <Feather name="check-circle" size={24} color={Colors.success} />
              ) : (
                <Feather name="map-pin" size={24} color={Colors.primary} />
              )}
            </View>
            <View style={styles.locationText}>
              <Text style={styles.locationTitle}>
                {userCity ? '📍 Location Detected' : 'Enable Location for Better Pricing'}
              </Text>
              <Text style={styles.locationDesc}>
                {userCity
                  ? `Showing pricing for ${userCity}. Pricing adjusts based on demand in your area.`
                  : "We'll show you pricing that reflects demand in your location."}
              </Text>
            </View>
          </View>
          {!userCity && !isDetectingLocation && (
            <Pressable
              style={styles.detectButton}
              onPress={requestLocationPermission}
              disabled={isDetectingLocation}
            >
              <Text style={styles.detectButtonText}>Detect</Text>
            </Pressable>
          )}
          {isDetectingLocation && (
            <View style={styles.detectingIndicator}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
        </View>

        {locationError && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        )}

        <View style={styles.plansContainer}>
          {(plans || PLANS).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlan === plan.id}
              onSelect={() => handleSelect(plan.id)}
            />
          ))}
        </View>

        <View style={styles.guaranteeRow}>
          <Feather name="shield" size={16} color={Colors.success} />
          <Text style={styles.guaranteeText}>7-day free trial, cancel anytime</Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: (insets.bottom || (Platform.OS === 'web' ? 34 : 0)) + 8 },
        ]}
      >
        <LinearGradient
          colors={['rgba(248,249,250,0)', 'rgba(248,249,250,0.95)', Colors.background]}
          style={styles.bottomGradient}
          pointerEvents="none"
        />
        <View style={styles.bottomContent}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalPrice}>
              {selected?.price === 0 ? 'Free' : `₹${selected?.price}/mo`}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.payButton,
              pressed && styles.payButtonPressed,
              isProcessing && styles.payButtonDisabled,
            ]}
            onPress={handleSubscribe}
            disabled={isProcessing}
          >
            <LinearGradient
              colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.payGradient}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.payText}>Processing...</Text>
                </>
              ) : (
                <>
                  <Feather name="credit-card" size={18} color="#fff" />
                  <Text style={styles.payText}>
                    {selected?.price === 0 ? 'Get Free Plan' : `Pay ₹${selected?.price}`}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  title: {
    fontSize: 21,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  plansContainer: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  planCardHighlight: {
    borderColor: Colors.primaryLight,
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomLeftRadius: 14,
  },
  popularText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  planHeader: {
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  planNameSelected: {
    color: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  planPriceSelected: {
    color: '#fff',
  },
  planPeriod: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  planPeriodSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  featuresContainer: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  featureTextSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  selectIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIndicatorActive: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  guaranteeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  bottomGradient: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    height: 40,
  },
  bottomContent: {
    backgroundColor: Colors.background,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  totalPrice: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  payButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  payButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  payText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 12,
  },
  locationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  locationDesc: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  detectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  detectButtonText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  detectingIndicator: {
    paddingHorizontal: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#DC2626',
  },
});
