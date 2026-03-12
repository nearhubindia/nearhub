/**
 * Payment Handler Component
 * Manages Razorpay payment integration for listing subscriptions
 */

import React, { useCallback } from 'react';
import { Text, View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Colors from '@/constants/colors';
import {
  usePayment,
  type PaymentData,
  type CustomerData,
  type ListingData,
  type PaymentResult,
} from '@/lib/use-payment';

interface PaymentHandlerProps {
  onPaymentSuccess?: (result: PaymentResult) => void;
  onPaymentError?: (error: string) => void;
  children?: React.ReactNode;
}

/**
 * Hook-based payment handler
 * Usage:
 * const { processPayment, isLoading } = usePaymentHandler();
 * await processPayment(paymentData, customerData, listingData);
 */
export function usePaymentHandler() {
  const {
    isLoading,
    error,
    initiatePayment,
    verifyPaymentAndGenerateInvoice,
  } = usePayment();

  /**
   * Main payment processing function
   */
  const processPayment = useCallback(
    async (
      paymentData: PaymentData,
      customerData: CustomerData,
      listingData: ListingData,
      subscriptionData: {
        subscriptionId: string;
        customerId: string;
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        listingPrice: number;
        duration: number;
        couponCode?: string;
        discountAmount?: number;
      },
      onSuccess?: (result: PaymentResult) => void,
      onError?: (error: string) => void
    ) => {
      try {
        const razorpayResult = await initiatePayment(paymentData, customerData, listingData);
        const result = await verifyPaymentAndGenerateInvoice(
          {
            razorpay_order_id: razorpayResult.razorpay_order_id,
            razorpay_payment_id: razorpayResult.razorpay_payment_id,
            razorpay_signature: razorpayResult.razorpay_signature,
          },
          subscriptionData
        );

        Alert.alert('Subscription Updated Successfully', 'Your subscription is active. You can download invoices from the Invoices screen.', [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.(result);
            },
          },
        ]);
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment initialization failed';
        console.error('[PaymentHandler] Error in processPayment:', err);
        if (
          !errorMsg.toLowerCase().includes('cancel') &&
          !errorMsg.toLowerCase().includes('dismiss')
        ) {
          Alert.alert('Payment Failed', errorMsg);
        }
        onError?.(errorMsg);
      }
    },
    [initiatePayment, verifyPaymentAndGenerateInvoice]
  );

  return {
    processPayment,
    isLoading,
    error,
  };
}

/**
 * Payment status component
 */
export const PaymentStatus: React.FC<{
  isLoading: boolean;
  error?: string | null;
}> = ({ isLoading, error }) => {
  if (!isLoading && !error) return null;

  return (
    <View style={styles.statusContainer}>
      {isLoading && (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.statusText}>Processing payment...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
  },
  statusText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  errorContent: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
});
