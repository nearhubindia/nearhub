/**
 * Discount Summary Component
 * Shows breakdown of subscription fee with coupon discount
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DiscountSummaryProps {
  originalAmount: number;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
}

export const DiscountSummary: React.FC<DiscountSummaryProps> = ({
  originalAmount,
  discountPercentage,
  discountAmount,
  finalAmount,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Subscription Fee</Text>
        <Text style={styles.amount}>₹{originalAmount.toFixed(2)}</Text>
      </View>

      <View style={[styles.row, styles.divider]}>
        <Text style={styles.discountLabel}>Discount ({discountPercentage}%)</Text>
        <Text style={styles.discountAmount}>-₹{discountAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalAmount}>₹{finalAmount.toFixed(2)}</Text>
      </View>

      {discountPercentage === 100 && (
        <View style={styles.freeCard}>
          <Text style={styles.freeText}>🎉 100% discount applied!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  divider: {
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  amount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  discountLabel: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
  },
  discountAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  freeCard: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#d4edda',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  freeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    textAlign: 'center',
  },
});
