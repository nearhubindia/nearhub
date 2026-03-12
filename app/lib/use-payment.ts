/**
 * Payment Modal Hook
 * Manages Razorpay payment flow and invoice generation
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { getApiUrl } from '@/lib/query-client';
import { storeInvoice, extractInvoiceFromResponse } from '@/lib/invoice-storage';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

export interface PaymentData {
  razorpayOrderId: string;
  amount: number; // in paise
  key: string;
  subscriptionId: string;
}

export interface CustomerData {
  name: string;
  email: string;
  phone: string;
  customerId: string;
}

export interface ListingData {
  title: string;
  price: number;
  duration: number;
  couponCode?: string;
  discountAmount?: number;
}

export interface PaymentResult {
  success: boolean;
  invoiceNumber?: string;
  paymentId?: string;
  message?: string;
}

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initiate Razorpay payment checkout
   */
  const initiatePayment = useCallback(
    async (
      paymentData: PaymentData,
      customerData: CustomerData,
      listingData: ListingData
    ): Promise<RazorpayCheckoutResponse> => {
      try {
        setIsLoading(true);
        setError(null);

        const options = {
          description: `${listingData.title} - ${listingData.duration} Days Subscription`,
          image: 'https://nearhub.app/nearhub-logo.png',
          currency: 'INR',
          key: paymentData.key,
          amount: paymentData.amount,
          order_id: paymentData.razorpayOrderId,
          name: 'NearHub',
          prefill: {
            email: customerData.email,
            contact: customerData.phone,
            name: customerData.name,
          },
          theme: {
            color: '#0A66C2',
          },
          notes: {
            listingTitle: listingData.title,
            duration: listingData.duration.toString(),
          },
        };

        // @ts-ignore - dynamic import to avoid New Architecture crash
        const RazorpayCheckout = require('react-native-razorpay').default;
        const result = (await RazorpayCheckout.open(options)) as RazorpayCheckoutResponse;
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment initialization failed';
        console.error('[Payment] Error initiating payment:', err);
        setError(errorMsg);
        if (!String(errorMsg).toLowerCase().includes('cancel')) {
          Alert.alert('Payment Error', errorMsg);
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Verify payment and generate invoice
   */
  const verifyPaymentAndGenerateInvoice = useCallback(
    async (
      razorpayResponse: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      },
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
      }
    ): Promise<PaymentResult> => {
      try {
        setIsLoading(true);
        setError(null);

        const apiUrl = await getApiUrl();

        const verifyPayload = {
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          subscriptionId: subscriptionData.subscriptionId,

          // Invoice generation
          generateInvoice: true,
          customerId: subscriptionData.customerId,
          customerName: subscriptionData.customerName,
          customerEmail: subscriptionData.customerEmail,
          customerPhone: subscriptionData.customerPhone,

          // Coupon tracking
          couponCode: subscriptionData.couponCode,
        };

        const response = await fetch(`${apiUrl}/api/subscriptions/verify-payment`, {
          method: 'POST',
          headers: buildUserAuthHeaders({
            id: subscriptionData.customerId,
            phone: subscriptionData.customerPhone || '',
          }),
          body: JSON.stringify(verifyPayload),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Payment verification failed');
        }

        // Store invoice if generated
        if (data.invoice) {
          const invoiceData = extractInvoiceFromResponse(data);
          if (invoiceData) {
            await storeInvoice(invoiceData);
            console.log('[Payment] Invoice stored:', data.invoice.invoiceNumber);
          }
        }

        return {
          success: true,
          invoiceNumber: data.invoice?.invoiceNumber,
          paymentId: razorpayResponse.razorpay_payment_id,
          message: data.message,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment verification failed';
        console.error('[Payment] Error verifying payment:', err);
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Handle Razorpay success callback
   */
  const handlePaymentSuccess = useCallback(
    async (
      razorpayResponse: any,
      subscriptionData: any,
      onSuccess: (result: PaymentResult) => void,
      onError: (error: string) => void
    ) => {
      try {
        const result = await verifyPaymentAndGenerateInvoice(razorpayResponse, subscriptionData);
        onSuccess(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Payment verification failed';
        onError(errorMsg);
      }
    },
    [verifyPaymentAndGenerateInvoice]
  );

  /**
   * Handle Razorpay failure callback
   */
  const handlePaymentError = useCallback((error: any) => {
    console.error('[Payment] Razorpay error:', error);
    const errorMsg = error?.description || error?.message || 'Payment failed. Please try again.';
    setError(errorMsg);
    Alert.alert('Payment Failed', errorMsg);
  }, []);

  return {
    isLoading,
    error,
    initiatePayment,
    verifyPaymentAndGenerateInvoice,
    handlePaymentSuccess,
    handlePaymentError,
  };
}
