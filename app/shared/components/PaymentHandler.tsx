/**
 * Payment Handler Component
 * Manages Razorpay payment integration for listing subscriptions
 */

import React, { useCallback, useRef } from 'react';
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
    handlePaymentSuccess: handleSuccess,
    handlePaymentError: handleError,
  } = usePayment();

  const pendingPaymentData = useRef<{
    subscriptionData: any;
    onSuccess?: (result: PaymentResult) => void;
    onError?: (error: string) => void;
  } | null>(null);

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
        // Store subscription data for verification
        pendingPaymentData.current = {
          subscriptionData,
          onSuccess,
          onError,
        };

        // Open Razorpay checkout
        await initiatePayment(paymentData, customerData, listingData);

        // Setup Razorpay event handlers
        const handleRazorpaySuccess = async (data: any) => {
          console.log('[PaymentHandler] Razorpay payment success:', data);

          if (!pendingPaymentData.current) {
            console.error('[PaymentHandler] No pending payment data found');
            return;
          }

          try {
            const result = await verifyPaymentAndGenerateInvoice(
              {
                razorpay_order_id: data.razorpay_order_id,
                razorpay_payment_id: data.razorpay_payment_id,
                razorpay_signature: data.razorpay_signature,
              },
              pendingPaymentData.current.subscriptionData
            );

            Alert.alert(
              'Payment Successful! 🎉',
              `Your listing is now active.\nInvoice: ${result.invoiceNumber || 'Generated'}`,
              [
                {
                  text: 'View Invoice',
                  onPress: () => {
                    pendingPaymentData.current?.onSuccess?.(result);
                  },
                },
              ]
            );

            pendingPaymentData.current = null;
          } catch (verifyError) {
            const errorMsg =
              verifyError instanceof Error ? verifyError.message : 'Verification failed';
            console.error('[PaymentHandler] Payment verification error:', errorMsg);
            Alert.alert(
              'Verification Failed',
              'Payment was completed but verification failed. Please contact support.'
            );
            pendingPaymentData.current?.onError?.(errorMsg);
            pendingPaymentData.current = null;
          }
        };

        const handleRazorpayError = (error: any) => {
          console.error('[PaymentHandler] Razorpay error:', error);
          const errorMsg = error?.description || error?.message || 'Payment failed';
          Alert.alert('Payment Failed', errorMsg);
          pendingPaymentData.current?.onError?.(errorMsg);
          pendingPaymentData.current = null;
        };

        const handleRazorpayDismiss = () => {
          console.log('[PaymentHandler] Razorpay checkout dismissed');
          pendingPaymentData.current = null;
        };

        // Register Razorpay event handlers
        // @ts-ignore - dynamic import to avoid New Architecture crash
        const RazorpayCheckout = require('react-native-razorpay').default;
        RazorpayCheckout.addEventListener('open', () => {
          console.log('[PaymentHandler] Razorpay opened');
        });

        RazorpayCheckout.addEventListener('success', handleRazorpaySuccess);
        RazorpayCheckout.addEventListener('error', handleRazorpayError);
        RazorpayCheckout.addEventListener('dismiss', handleRazorpayDismiss);

        return {
          cleanup: () => {
            // @ts-ignore
            const RazorpayCheckout = require('react-native-razorpay').default;
            RazorpayCheckout.removeEventListener('success', handleRazorpaySuccess);
            RazorpayCheckout.removeEventListener('error', handleRazorpayError);
            RazorpayCheckout.removeEventListener('dismiss', handleRazorpayDismiss);
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment initialization failed';
        console.error('[PaymentHandler] Error in processPayment:', err);
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
