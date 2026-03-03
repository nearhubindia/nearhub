/**
 * Coupon Input Component
 * Allows users to enter and apply coupon codes for subscription discounts
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import axios from 'axios';

interface CouponDiscount {
  percentage: number;
  amount: number;
  originalAmount: number;
  finalAmount: number;
  couponId?: string;
}

interface CouponInputProps {
  originalFee: number;
  onCouponApplied?: (discount: CouponDiscount & { code: string }) => void;
  onCouponRemoved?: () => void;
  apiBaseUrl?: string;
}

export const CouponInput: React.FC<CouponInputProps> = ({
  originalFee,
  onCouponApplied,
  onCouponRemoved,
  apiBaseUrl = 'http://localhost:5000',
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<CouponDiscount | null>(null);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/coupons/calculate-discount`, {
        params: {
          code: couponCode.toUpperCase(),
          amount: originalFee,
        },
      });

      if (response.data.success) {
        setAppliedCoupon(couponCode.toUpperCase());
        setAppliedDiscount(response.data);
        onCouponApplied?.({
          ...response.data,
          code: couponCode.toUpperCase(),
        });
        Alert.alert('Success', `${response.data.discountPercentage}% discount applied!`);
      } else {
        Alert.alert('Invalid Coupon', response.data.error || 'Coupon code is not valid');
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      Alert.alert('Error', 'Failed to validate coupon code');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setAppliedDiscount(null);
    onCouponRemoved?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Have a coupon code?</Text>
      <Text style={styles.sublabel}>Enter below to get instant discount</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, appliedCoupon && styles.inputDisabled]}
          placeholder="Enter coupon code"
          placeholderTextColor="#999"
          value={couponCode}
          onChangeText={setCouponCode}
          editable={!appliedCoupon}
          autoCapitalize="characters"
          maxLength={50}
        />

        {!appliedCoupon ? (
          <TouchableOpacity
            onPress={handleApplyCoupon}
            disabled={loading || !couponCode.trim()}
            style={[styles.button, (loading || !couponCode.trim()) && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Apply</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleRemoveCoupon}
            style={[styles.button, styles.buttonRemove]}
          >
            <Text style={styles.buttonText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {appliedCoupon && appliedDiscount && (
        <View style={styles.discountCard}>
          <View style={styles.discountRow}>
            <Text style={styles.discountLabel}>Coupon Applied</Text>
            <Text style={styles.discountValue}>{appliedCoupon}</Text>
          </View>
          <View
            style={[
              styles.discountRow,
              { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
            ]}
          >
            <Text style={styles.discountLabel}>Discount ({appliedDiscount.percentage}%)</Text>
            <Text style={styles.discountSavings}>
              -₹{appliedDiscount.amount?.toFixed(2) ?? '0.00'}
            </Text>
          </View>
          <View
            style={[
              styles.discountRow,
              { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
            ]}
          >
            <Text style={styles.finalLabel}>Final Amount</Text>
            <Text style={styles.finalAmount}>
              ₹{appliedDiscount.finalAmount?.toFixed(2) ?? '0.00'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonRemove: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  discountCard: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountLabel: {
    fontSize: 13,
    color: '#666',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  discountSavings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
  },
  finalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  finalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
});
