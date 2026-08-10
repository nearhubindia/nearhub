/**
 * Pricing Components for React Native (Expo)
 * Used for listing creation and subscription flows
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PricingOption {
  duration: number;
  fee: number;
  label: string;
  savings?: number;
}

interface PricingDisplayProps {
  productPrice: number;
  onDurationSelected?: (duration: number, fee: number) => void;
  isLoading?: boolean;
}

/**
 * PricingDisplay Component
 * Shows pricing options for a product
 */
export const PricingDisplay: React.FC<PricingDisplayProps> = ({
  productPrice,
  onDurationSelected,
  isLoading = false,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const pricingOptions: PricingOption[] = [
    { duration: 30, fee: 99, label: '30 days' },
    { duration: 90, fee: 297, label: '3 months', savings: 1 },
    { duration: 180, fee: 594, label: '6 months', savings: 2 },
  ];

  const handleSelect = (duration: number, fee: number) => {
    setSelectedDuration(duration);
    onDurationSelected?.(duration, fee);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{'💳 Choose Duration'}</Text>
        <Text style={styles.headerSubtitle}>
          Product Price: ₹{productPrice.toLocaleString('en-IN')}
        </Text>
      </View>

      {/* Paid Tier Options */}
      <>
        <View style={styles.paidTierHeader}>
          <Text style={styles.paidTierTitle}>Choose Listing Duration</Text>
          <Text style={styles.paidTierSubtitle}>Select the duration for your listing</Text>
        </View>

        <View style={styles.optionsContainer}>
          {pricingOptions.map((option) => (
            <TouchableOpacity
              key={option.duration}
              style={[
                styles.optionCard,
                selectedDuration === option.duration && styles.optionCardSelected,
              ]}
              onPress={() => handleSelect(option.duration, option.fee)}
              disabled={isLoading}
            >
              <LinearGradient
                colors={
                  selectedDuration === option.duration
                    ? ['#2D82DC', '#0A66C2']
                    : ['#1e293b', '#0f172a']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.optionGradient}
              >
                {/* Duration */}
                <View style={styles.optionHeader}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {option.savings && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>Save ₹{option.savings * 99}</Text>
                    </View>
                  )}
                </View>

                {/* Fee */}
                <View style={styles.optionFooter}>
                  <Text style={styles.optionFee}>₹{option.fee}</Text>
                  <Text style={styles.optionFeeSubtitle}>
                    ₹{(option.fee / option.duration).toFixed(1)}/day
                  </Text>
                </View>

                {/* Checkmark */}
                {selectedDuration === option.duration && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkIcon}>✓</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary */}
        {selectedDuration && (
          <View style={styles.summaryCard}>
            {(() => {
              const selected = pricingOptions.find((o) => o.duration === selectedDuration);
              const expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate() + selectedDuration!);

              return (
                <>
                  <Text style={styles.summaryTitle}>Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration:</Text>
                    <Text style={styles.summaryValue}>{selected?.label}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Fee:</Text>
                    <Text style={styles.summaryValue}>₹{selected?.fee}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Expires On:</Text>
                    <Text style={styles.summaryValue}>
                      {expiryDate.toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </>
              );
            })()}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How It Works</Text>
          <InfoPoint icon="1" text="Choose a duration above" />
          <InfoPoint icon="2" text="Proceed to secure payment" />
          <InfoPoint icon="3" text="Your listing goes live immediately" />
          <InfoPoint icon="4" text="Get buyer inquiries via chat" />
        </View>
      </>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A66C2" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </ScrollView>
  );
};

/**
 * PricingHeader Component - Minimal header for pricing info
 */
export const PricingHeader: React.FC<{ price: number }> = ({ price }) => {
  return (
    <View style={styles.miniHeader}>
      <View>
        <Text style={styles.miniHeaderLabel}>Listing Fee</Text>
        <Text style={styles.miniHeaderValue}>📋 Paid</Text>
      </View>
      <View>
        <Text style={styles.miniHeaderLabel}>Product Price</Text>
        <Text style={styles.miniHeaderValue}>₹{price.toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );
};

/**
 * CheckoutModal Component - Full checkout flow modal
 */
interface CheckoutModalProps {
  visible: boolean;
  productPrice: number;
  listingTitle: string;
  onClose: () => void;
  onCheckout: (duration: number) => Promise<void>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  productPrice,
  listingTitle,
  onClose,
  onCheckout,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const insets = useSafeAreaInsets();

  const handleCheckout = async () => {
    if (!selectedDuration) {
      Alert.alert('Select Duration', 'Please choose a listing duration');
      return;
    }

    setIsProcessing(true);
    try {
      await onCheckout(selectedDuration || 0);
    } catch (error) {
      Alert.alert('Error', 'Failed to process checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '92%' }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirm Listing</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Listing Preview */}
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>{listingTitle}</Text>
              <Text style={styles.previewPrice}>₹{productPrice.toLocaleString('en-IN')}</Text>
            </View>

            {/* Pricing Options */}
            <PricingDisplay
              productPrice={productPrice}
              onDurationSelected={(duration) => setSelectedDuration(duration)}
            />
          </ScrollView>

          {/* Action Button */}
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.buttonPrimary, !selectedDuration && styles.buttonDisabled]}
              onPress={handleCheckout}
              disabled={!selectedDuration || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Proceed to Payment</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Helper Components
 */

const BenefitRow: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.benefitRow}>
    <Text style={styles.benefitIcon}>{icon}</Text>
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const InfoPoint: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.infoPoint}>
    <View style={styles.infoBullet}>
      <Text style={styles.infoBulletText}>{icon}</Text>
    </View>
    <Text style={styles.infoPointText}>{text}</Text>
  </View>
);

// ============= Styles =============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Header
  header: {
    marginBottom: 24,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },

  // Free Tier
  freeTierCard: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  freeTierTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  freeTierText: {
    fontSize: 14,
    color: '#ecfdf5',
    marginBottom: 12,
    lineHeight: 20,
  },
  freeTierBenefits: {
    marginTop: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  benefitIcon: {
    fontSize: 18,
    marginRight: 8,
    width: 24,
  },
  benefitText: {
    fontSize: 13,
    color: '#ecfdf5',
    flex: 1,
  },

  // Paid Tier
  paidTierHeader: {
    marginBottom: 16,
  },
  paidTierTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  paidTierSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },

  // Options
  optionsContainer: {
    marginBottom: 24,
  },
  optionCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#0A66C2',
    shadowColor: '#0A66C2',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  optionGradient: {
    padding: 16,
    position: 'relative',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  savingsBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 12,
    color: '#86efac',
    fontWeight: '600',
  },
  optionFooter: {
    marginBottom: 8,
  },
  optionFee: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  optionFeeSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },

  // Summary
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#0A66C2',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D82DC',
  },

  // Info Box
  infoBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  infoPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  infoBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0A66C2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoBulletText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoPointText: {
    fontSize: 14,
    color: '#94a3b8',
    flex: 1,
    marginTop: 2,
  },

  // Loading
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '90%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#94a3b8',
  },
  modalBody: {
    flex: 1,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },

  // Preview
  previewCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  previewPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D82DC',
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: '#0A66C2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },

  // Mini Header
  miniHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  miniHeaderLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  miniHeaderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PricingDisplay;
