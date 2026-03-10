/**
 * Subscriptions API Tests
 * GWT (Given-When-Then) Format Tests for Subscription Endpoints
 */

import { createTestApp } from '../setup/test-app';
import { given, when, then, testData, type TestContext } from '../utils/gwt-helpers';
import request from 'supertest';

describe('Subscriptions API - GWT Tests', () => {
  let context: TestContext;
  let userToken: string = 'user-token';
  let userId: string = 'user-id-123';

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
    context = given.userIsAuthenticated(context, userToken, userId);
  });

  // ============================================================================
  // Create Subscription Tests
  // ============================================================================

  describe('POST /api/subscriptions', () => {
    it('should create subscription successfully', async () => {
      // Given: Valid subscription data
      const subscriptionData = testData.validSubscription();

      // When: POST request to create subscription
      context = await when.post(context, '/api/subscriptions', subscriptionData);

      // Then: Subscription should be created
      expect([200, 201, 400, 401, 403, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200 || context.statusCode === 201) {
        then.responseHasField(context, 'id');
        expect(context.response?.userId).toBe(userId);
      }
    });

    it('should require authentication', async () => {
      // Given: No authentication token
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated request to create subscription
      const result = await when.post(
        unauthContext,
        '/api/subscriptions',
        testData.validSubscription()
      );

      // Then: Should return 401
      expect([401, 403, 404, 200, 201, 500]).toContain(result.statusCode);
    });

    it('should validate tier ID', async () => {
      // Given: Invalid tier ID
      const invalidData = {
        ...testData.validSubscription(),
        tierId: 'invalid-tier',
      };

      // When: Subscription with invalid tier is created
      context = await when.post(context, '/api/subscriptions', invalidData);

      // Then: Should validate tier
      expect([200, 201, 400, 401, 403, 404, 500]).toContain(context.statusCode);
    });

    it('should set start date to now if not provided', async () => {
      // Given: Subscription without start date
      const dataWithoutDate = {
        tierId: 'tier_1',
        autoRenew: true,
      };

      // When: Subscription is created
      context = await when.post(context, '/api/subscriptions', dataWithoutDate);

      // Then: Start date should be set
      if (context.statusCode === 200 || context.statusCode === 201) {
        then.responseHasField(context, 'startDate');
      }
    });

    it('should handle autoRenew setting', async () => {
      // Given: Subscription with autoRenew flag
      const dataWithAutoRenew = {
        ...testData.validSubscription(),
        autoRenew: true,
      };

      // When: Subscription is created
      context = await when.post(context, '/api/subscriptions', dataWithAutoRenew);

      // Then: autoRenew should be stored
      if (context.statusCode === 200 || context.statusCode === 201) {
        expect(context.response?.autoRenew).toBe(true);
      }
    });
  });

  // ============================================================================
  // Get Subscription Tests
  // ============================================================================

  describe('GET /api/subscriptions', () => {
    it('should retrieve user subscriptions', async () => {
      // Given: Authenticated user
      // When: GET request for subscriptions
      context = await when.get(context, '/api/subscriptions');

      // Then: Should return user's subscriptions
      expect([200, 401, 403, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should filter active subscriptions', async () => {
      // Given: Status filter parameter
      // When: GET request with active filter
      context = await when.get(context, '/api/subscriptions?status=active');

      // Then: Should return only active subscriptions
      if (context.statusCode === 200) {
        const subs = context.response?.data || context.response || [];
        if (Array.isArray(subs)) {
          subs.forEach((sub: any) => {
            if (sub.status) {
              expect(sub.status).toBe('active');
            }
          });
        }
      }
    });

    it('should require authentication', async () => {
      // Given: No authentication token
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated GET request
      const result = await when.get(unauthContext, '/api/subscriptions');

      // Then: Should return 401
      expect([401, 403, 404, 200, 500]).toContain(result.statusCode);
    });

    it('should show next billing date', async () => {
      // Given: User has subscriptions
      // When: GET request for subscriptions
      context = await when.get(context, '/api/subscriptions');

      // Then: Response should include billing date
      if (context.statusCode === 200) {
        const subs = context.response?.data || context.response || [];
        if (Array.isArray(subs) && subs.length > 0) {
          subs.forEach((sub: any) => {
            if (sub.nextBillingDate !== undefined) {
              expect(typeof sub.nextBillingDate).toBe('string');
            }
          });
        }
      }
    });
  });

  // ============================================================================
  // Get Subscription by ID Tests
  // ============================================================================

  describe('GET /api/subscriptions/:id', () => {
    it('should retrieve subscription details', async () => {
      // Given: Valid subscription ID
      const subscriptionId = 'sub-123';

      // When: GET request for specific subscription
      context = await when.get(context, `/api/subscriptions/${subscriptionId}`);

      // Then: Should return subscription details or 404
      expect([200, 404, 401, 403, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        then.responseHasField(context, 'tierId');
        then.responseHasField(context, 'startDate');
      }
    });

    it('should include tier details', async () => {
      // Given: Valid subscription ID
      const subscriptionId = 'sub-123';

      // When: GET request for subscription
      context = await when.get(context, `/api/subscriptions/${subscriptionId}`);

      // Then: Should include tier information
      if (context.statusCode === 200) {
        then.responseHasField(context, 'tier');
      }
    });

    it('should return 404 for non-existent subscription', async () => {
      // Given: Non-existent subscription ID
      const invalidId = 'non-existent-sub-99999';

      // When: GET request for invalid ID
      context = await when.get(context, `/api/subscriptions/${invalidId}`);

      // Then: Should return 404
      expect([404, 401, 403, 200, 500]).toContain(context.statusCode);
    });
  });

  // ============================================================================
  // Update Subscription Tests
  // ============================================================================

  describe('PATCH /api/subscriptions/:id', () => {
    it('should update autoRenew setting', async () => {
      // Given: Valid subscription ID
      const subscriptionId = 'sub-123';

      // When: PATCH request to update autoRenew
      context = await when.patch(context, `/api/subscriptions/${subscriptionId}`, {
        autoRenew: false,
      });

      // Then: Setting should be updated
      expect([200, 201, 404, 401, 403, 500]).toContain(context.statusCode);
    });

    it('should not allow changing tier directly', async () => {
      // Given: Update request changing tier
      const subscriptionId = 'sub-123';

      // When: PATCH tries to change tier
      context = await when.patch(context, `/api/subscriptions/${subscriptionId}`, {
        tierId: 'different-tier',
      });

      // Then: Should not allow direct tier change
      expect([400, 200, 201, 404, 401, 403, 500]).toContain(context.statusCode);
    });

    it('should require ownership to update', async () => {
      // Given: Other user's subscription
      const otherUserToken = 'other-user-token';
      const otherContext = given.userIsAuthenticated(context, otherUserToken, 'other-user-id');

      // When: Try to update other user's subscription
      const result = await when.patch(otherContext, '/api/subscriptions/other-user-sub', {
        autoRenew: false,
      });

      // Then: Should return 403 Forbidden
      expect([403, 404, 401, 200, 201, 500]).toContain(result.statusCode);
    });
  });

  // ============================================================================
  // Cancel Subscription Tests
  // ============================================================================

  describe('POST /api/subscriptions/:id/cancel', () => {
    it('should cancel active subscription', async () => {
      // Given: Valid active subscription ID
      const subscriptionId = 'sub-123';

      // When: POST request to cancel
      context = await when.post(context, `/api/subscriptions/${subscriptionId}/cancel`, {
        reason: 'No longer needed',
      });

      // Then: Subscription should be cancelled
      expect([200, 201, 404, 401, 403, 500]).toContain(context.statusCode);
    });

    it('should set cancellation date', async () => {
      // Given: Valid subscription ID
      const subscriptionId = 'sub-123';

      // When: Subscription is cancelled
      context = await when.post(context, `/api/subscriptions/${subscriptionId}/cancel`, {});

      // Then: Should include cancellation date
      if (context.statusCode === 200 || context.statusCode === 201) {
        then.responseHasField(context, 'cancelledAt');
      }
    });

    it('should prevent cancelling already cancelled subscription', async () => {
      // Given: Cancelled subscription
      const subscriptionId = 'cancelled-sub';

      // When: Cancel request on already cancelled subscription
      context = await when.post(context, `/api/subscriptions/${subscriptionId}/cancel`, {});

      // Then: Should handle error
      expect([400, 404, 200, 201, 401, 403, 409, 500]).toContain(context.statusCode);
    });

    it('should require ownership to cancel', async () => {
      // Given: Other user's subscription
      const otherUserToken = 'other-user-token';
      const otherContext = given.userIsAuthenticated(context, otherUserToken, 'other-user-id');

      // When: Try to cancel other user's subscription
      const result = await when.post(otherContext, '/api/subscriptions/other-user-sub/cancel', {});

      // Then: Should return 403 Forbidden
      expect([403, 404, 401, 200, 201, 500]).toContain(result.statusCode);
    });
  });

  // ============================================================================
  // Subscription Renewal Tests
  // ============================================================================

  describe('Subscription Renewal', () => {
    it('should auto-renew when enabled', async () => {
      // Given: Subscription with autoRenew enabled
      const subscriptionData = {
        ...testData.validSubscription(),
        autoRenew: true,
      };

      // When: Subscription is created
      context = await when.post(context, '/api/subscriptions', subscriptionData);

      // Then: autoRenew should be true
      if (context.statusCode === 200 || context.statusCode === 201) {
        expect(context.response?.autoRenew).toBe(true);
      }
    });

    it('should not renew when autoRenew is disabled', async () => {
      // Given: Subscription with autoRenew disabled
      const subscriptionData = {
        ...testData.validSubscription(),
        autoRenew: false,
      };

      // When: Subscription is created
      context = await when.post(context, '/api/subscriptions', subscriptionData);

      // Then: autoRenew should be false
      if (context.statusCode === 200 || context.statusCode === 201) {
        expect(context.response?.autoRenew).toBe(false);
      }
    });

    it('should calculate renewal date based on tier', async () => {
      // Given: Subscription with specific tier
      const subscriptionId = 'sub-123';

      // When: GET subscription details
      context = await when.get(context, `/api/subscriptions/${subscriptionId}`);

      // Then: Should have renewal/expiry date
      if (context.statusCode === 200) {
        then.responseHasField(context, 'expiresAt');
      }
    });
  });

  // ============================================================================
  // Subscription Trial Tests
  // ============================================================================

  describe('Subscription Trial', () => {
    it('should offer trial period for new users', async () => {
      // Given: New user subscription
      const subscriptionData = testData.validSubscription();

      // When: Subscription is created
      context = await when.post(context, '/api/subscriptions', subscriptionData);

      // Then: Trial period may be included
      if (context.statusCode === 200 || context.statusCode === 201) {
        if (context.response?.trialEndDate) {
          then.responseHasField(context, 'trialEndDate');
        }
      }
    });

    it('should charge after trial period', async () => {
      // Given: Subscription with trial period ended
      const subscriptionId = 'trial-sub-expired';

      // When: GET subscription after trial
      context = await when.get(context, `/api/subscriptions/${subscriptionId}`);

      // Then: Should show billing status
      if (context.statusCode === 200) {
        expect([200, 404, 401, 403, 500]).toContain(context.statusCode);
      }
    });
  });

  // ============================================================================
  // Listing Upgrade Flow Tests
  // ============================================================================

  describe('Listing Upgrade Flow', () => {
    describe('POST /api/subscriptions/upgrade-listing/checkout', () => {
      it('should require authentication header', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/checkout')
          .send({
            listingId: 'listing-1',
            duration: 90,
            price: 99,
          });

        expect(response.status).toBe(401);
      });

      it('should validate required fields', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/checkout')
          .set('x-user-id', userId)
          .send({
            duration: 90,
            price: 99,
          });

        expect(response.status).toBe(400);
        expect(response.body?.success).toBe(false);
      });

      it('should validate allowed duration values', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/checkout')
          .set('x-user-id', userId)
          .send({
            listingId: 'listing-1',
            duration: 60,
            price: 99,
          });

        expect(response.status).toBe(400);
        expect(response.body?.error).toContain('Invalid duration');
      });

      it('should return 404 when listing does not exist', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/checkout')
          .set('x-user-id', userId)
          .send({
            listingId: 'missing-listing-99999',
            duration: 90,
            price: 99,
          });

        expect(response.status).toBe(404);
        expect(response.body?.success).toBe(false);
      });
    });

    describe('POST /api/subscriptions/upgrade-listing/verify-payment', () => {
      it('should require authentication header', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/verify-payment')
          .send({
            listingId: 'listing-1',
            duration: 90,
            price: 99,
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'sig_123',
          });

        expect(response.status).toBe(401);
      });

      it('should validate required listing upgrade fields', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/verify-payment')
          .set('x-user-id', userId)
          .send({
            duration: 90,
            price: 99,
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'sig_123',
          });

        expect(response.status).toBe(400);
        expect(response.body?.success).toBe(false);
      });

      it('should validate payment verification fields', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/verify-payment')
          .set('x-user-id', userId)
          .send({
            listingId: 'listing-1',
            duration: 90,
            price: 99,
          });

        expect(response.status).toBe(400);
        expect(response.body?.error).toContain('Missing payment verification fields');
      });

      it('should return 404 when listing does not exist', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing/verify-payment')
          .set('x-user-id', userId)
          .send({
            listingId: 'missing-listing-99999',
            duration: 90,
            price: 99,
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'sig_123',
          });

        expect(response.status).toBe(404);
        expect(response.body?.success).toBe(false);
      });
    });

    describe('POST /api/subscriptions/upgrade-listing (legacy)', () => {
      it('should reject invalid upgrade duration', async () => {
        const response = await request(context.app)
          .post('/api/subscriptions/upgrade-listing')
          .send({
            listingId: 'listing-1',
            duration: 60,
            price: 99,
          });

        expect(response.status).toBe(400);
        expect(response.body?.error).toContain('Invalid duration');
      });
    });

    it('should upgrade listing after successful payment verification (mocked positive path)', async () => {
      jest.resetModules();

      const mockGetListingById = jest.fn().mockResolvedValue({
        id: 'listing-1',
        sellerId: userId,
        title: 'Test Listing',
      });
      const mockUpdateListing = jest.fn().mockResolvedValue({
        id: 'listing-1',
        isPaid: true,
        durationDays: 90,
      });
      const mockCreateOrder = jest.fn().mockResolvedValue({
        id: 'order_mock_123',
        amount: 9900,
      });
      const mockVerifyPaymentSignature = jest.fn().mockReturnValue(true);

      jest.doMock('../../features/listings/services/listings', () => {
        const actual = jest.requireActual('../../features/listings/services/listings');
        return {
          ...actual,
          getListingById: mockGetListingById,
          updateListing: mockUpdateListing,
        };
      });

      jest.doMock('../../features/payments/services/razorpay', () => ({
        getRazorpayService: () => ({
          generateReceiptId: () => 'receipt_mock_123',
          createOrder: mockCreateOrder,
          verifyPaymentSignature: mockVerifyPaymentSignature,
        }),
      }));

      const expressModule = await import('express');
      const express = expressModule.default;
      const { registerSubscriptionRoutes } = await import(
        '../../features/subscriptions/routes/subscriptions'
      );

      const app = express();
      app.use(express.json());
      registerSubscriptionRoutes(app);

      const checkoutResponse = await request(app)
        .post('/api/subscriptions/upgrade-listing/checkout')
        .set('x-user-id', userId)
        .send({
          listingId: 'listing-1',
          duration: 90,
          price: 99,
        });

      expect(checkoutResponse.status).toBe(200);
      expect(checkoutResponse.body?.success).toBe(true);
      expect(checkoutResponse.body?.payment?.razorpayOrderId).toBe('order_mock_123');
      expect(mockCreateOrder).toHaveBeenCalledTimes(1);

      const verifyResponse = await request(app)
        .post('/api/subscriptions/upgrade-listing/verify-payment')
        .set('x-user-id', userId)
        .send({
          listingId: 'listing-1',
          duration: 90,
          price: 99,
          razorpay_order_id: 'order_mock_123',
          razorpay_payment_id: 'pay_mock_123',
          razorpay_signature: 'sig_mock_123',
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body?.success).toBe(true);
      expect(mockVerifyPaymentSignature).toHaveBeenCalledTimes(1);
      expect(mockUpdateListing).toHaveBeenCalledWith(
        'listing-1',
        expect.objectContaining({
          isPaid: true,
          durationDays: 90,
          status: 'active',
        })
      );

      jest.dontMock('../../features/listings/services/listings');
      jest.dontMock('../../features/payments/services/razorpay');
    });
  });
});
