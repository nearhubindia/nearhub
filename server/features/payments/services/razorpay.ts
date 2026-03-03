/**
 * Razorpay Payment Service
 * Handles payment initialization, verification, and webhooks
 */

import crypto from 'crypto';

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

interface CreateOrderParams {
  amount: number; // in paise (₹1 = 100 paise)
  notes: {
    sellerId: string;
    listingId: string;
    subscriptionId: string;
    listingTitle?: string;
    duration: number;
  };
  receipt: string;
  customer_notify?: 1 | 0;
}

interface PaymentVerificationParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor(config: RazorpayConfig) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;

    if (!this.keyId || !this.keySecret) {
      throw new Error(
        'Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET'
      );
    }
  }

  /**
   * Create a Razorpay order
   */
  async createOrder(params: CreateOrderParams): Promise<{
    id: string;
    entity: string;
    amount: number;
    currency: string;
    status: string;
    created_at: number;
  }> {
    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: 'INR',
          receipt: params.receipt,
          notes: params.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Razorpay API error: ${error}`);
      }

      return await response.json() as {
        id: string;
        entity: string;
        amount: number;
        currency: string;
        status: string;
        created_at: number;
      };
    } catch (error) {
      console.error('[Razorpay] Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Verify payment signature
   * This is the critical security check - verify that the payment is legitimate
   */
  verifyPaymentSignature(params: PaymentVerificationParams): boolean {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

      // Create the payload to verify
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;

      // Generate signature using HMAC SHA256
      const signature = crypto.createHmac('sha256', this.keySecret).update(payload).digest('hex');

      // Compare with provided signature
      return signature === razorpay_signature;
    } catch (error) {
      console.error('[Razorpay] Failed to verify signature:', error);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch payment details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Razorpay] Failed to fetch payment details:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async createRefund(paymentId: string, amount?: number): Promise<any> {
    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const params = new URLSearchParams({
        payment_id: paymentId,
      });

      if (amount) {
        params.append('amount', amount.toString());
      }

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to create refund: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Razorpay] Failed to create refund:', error);
      throw error;
    }
  }

  /**
   * Webhook signature verification
   * Razorpay sends this header with every webhook
   */
  verifyWebhookSignature(payload: string, razorpaySignature: string): boolean {
    try {
      const signature = crypto.createHmac('sha256', this.keySecret).update(payload).digest('hex');

      return signature === razorpaySignature;
    } catch (error) {
      console.error('[Razorpay] Failed to verify webhook signature:', error);
      return false;
    }
  }

  /**
   * Generate order receipt ID
   */
  generateReceiptId(sellerId: string, listingId: string): string {
    const timestamp = Date.now();
    return `ADLI-${sellerId.substring(0, 4).toUpperCase()}-${listingId.substring(0, 4).toUpperCase()}-${timestamp}`;
  }
}

/**
 * Initialize Razorpay service
 */
let razorpayInstance: RazorpayService | null = null;

export function initializeRazorpay(): RazorpayService {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_API_SECRET || '';
    razorpayInstance = new RazorpayService({ keyId, keySecret });
  }
  return razorpayInstance;
}

export function getRazorpayService(): RazorpayService {
  if (!razorpayInstance) {
    throw new Error('Razorpay service not initialized. Call initializeRazorpay() first.');
  }
  return razorpayInstance;
}
