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
import Colors from '@/constants/colors';
import { useAuth, PLANS, SubscriptionPlan, PlanDetails } from '@/lib/auth-context';

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
        <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
          {plan.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
            ₹{plan.price}
          </Text>
          <Text style={[styles.planPeriod, isSelected && styles.planPeriodSelected]}>
            /{plan.period}
          </Text>
        </View>
      </View>

      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Feather
              name="check"
              size={16}
              color={isSelected ? '#fff' : Colors.success}
            />
            <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.selectIndicator,
          isSelected && styles.selectIndicatorActive,
        ]}
      >
        {isSelected && <Feather name="check" size={16} color="#fff" />}
      </View>
    </Pressable>
  );
}

export default function SelectPlanScreen() {
  const insets = useSafeAreaInsets();
  const { subscribeToPlan } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('standard');
  const [isProcessing, setIsProcessing] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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

      const plan = PLANS.find((p) => p.id === selectedPlan);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Subscription Active',
        `You're now on the ${plan?.name} plan! Enjoy adli.`,
        [{ text: 'Start Exploring', onPress: () => router.replace('/(tabs)') }],
      );
    } catch (e) {
      Alert.alert('Payment Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selected = PLANS.find((p) => p.id === selectedPlan);

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
        <View style={styles.headerSection}>
          <Text style={styles.brandName}>adli</Text>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Select a plan that works best for you. You can upgrade or change anytime.
          </Text>
        </View>

        <View style={styles.plansContainer}>
          {PLANS.map((plan) => (
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
            <Text style={styles.totalPrice}>₹{selected?.price}/mo</Text>
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
              colors={['#0D9488', '#0F766E', '#065F56']}
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
                  <Feather name="credit-card" size={20} color="#fff" />
                  <Text style={styles.payText}>Pay ₹{selected?.price}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  plansContainer: {
    gap: 14,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomLeftRadius: 14,
  },
  popularText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
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
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  planPriceSelected: {
    color: '#fff',
  },
  planPeriod: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  planPeriodSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  featuresContainer: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  featureTextSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  selectIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
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
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  totalPrice: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  payButton: {
    borderRadius: 18,
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
    paddingVertical: 18,
    gap: 10,
  },
  payText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
