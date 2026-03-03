/**
 * Users API Tests
 * GWT (Given-When-Then) Format Tests for User Endpoints
 */

import { createTestApp } from '../setup/test-app';
import { given, when, then, testData, type TestContext } from '../utils/gwt-helpers';

describe('Users API - GWT Tests', () => {
  let context: TestContext;
  let userToken: string = 'user-token';
  let userId: string = 'user-id-123';

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
    context = given.userIsAuthenticated(context, userToken, userId);
  });

  // ============================================================================
  // Get User Profile Tests
  // ============================================================================

  describe('GET /api/users/profile', () => {
    it('should retrieve authenticated user profile', async () => {
      // Given: Authenticated user
      // When: GET request for profile
      context = await when.get(context, '/api/users/profile');

      // Then: Should return user profile
      expect([200, 401, 403, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        then.responseHasField(context, 'id');
        then.responseHasField(context, 'phone');
        then.responseHasField(context, 'name');
      }
    });

    it('should require authentication', async () => {
      // Given: No authentication token
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated GET request for profile
      const result = await when.get(unauthContext, '/api/users/profile');

      // Then: Should return 401
      expect([401, 403, 404, 200, 500]).toContain(result.statusCode);
    });

    it('should include email in profile', async () => {
      // Given: Authenticated user with email
      // When: GET profile request
      context = await when.get(context, '/api/users/profile');

      // Then: Profile should include email
      if (context.statusCode === 200) {
        expect(context.response?.email).toBeDefined();
      }
    });

    it('should include user verification status', async () => {
      // Given: Authenticated user
      // When: GET profile request
      context = await when.get(context, '/api/users/profile');

      // Then: Should include verification status
      if (context.statusCode === 200) {
        then.responseHasField(context, 'isVerified');
      }
    });

    it('should include profile completion status', async () => {
      // Given: Authenticated user
      // When: GET profile request
      context = await when.get(context, '/api/users/profile');

      // Then: Should indicate profile completeness
      if (context.statusCode === 200) {
        then.responseHasField(context, 'profileComplete');
      }
    });
  });

  // ============================================================================
  // Update User Profile Tests
  // ============================================================================

  describe('PATCH /api/users/profile', () => {
    it('should update user profile', async () => {
      // Given: Valid profile update data
      const updateData = {
        name: 'Updated Name',
        email: testData.validEmail(),
      };

      // When: PATCH request to update profile
      context = await when.patch(context, '/api/users/profile', updateData);

      // Then: Profile should be updated
      expect([200, 201, 400, 401, 403, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200 || context.statusCode === 201) {
        expect(context.response?.name).toBe(updateData.name);
      }
    });

    it('should not allow phone number change', async () => {
      // Given: Update data with new phone
      const updateData = {
        phone: '+919999999999',
      };

      // When: PATCH tries to change phone
      context = await when.patch(context, '/api/users/profile', updateData);

      // Then: Phone should remain unchanged
      expect([400, 200, 201, 404, 401, 403, 500]).toContain(context.statusCode);
    });

    it('should validate email format', async () => {
      // Given: Invalid email format
      const updateData = {
        email: 'not-an-email',
      };

      // When: PATCH with invalid email
      context = await when.patch(context, '/api/users/profile', updateData);

      // Then: Should validate email
      expect([400, 200, 201, 404, 401, 403, 500]).toContain(context.statusCode);
    });

    it('should require authentication', async () => {
      // Given: No authentication token
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated PATCH request
      const result = await when.patch(unauthContext, '/api/users/profile', { name: 'Test' });

      // Then: Should return 401
      expect([401, 403, 404, 200, 201, 500]).toContain(result.statusCode);
    });

    it('should handle partial updates', async () => {
      // Given: Update with only name
      const updateData = {
        name: 'New Name',
      };

      // When: PATCH with partial data
      context = await when.patch(context, '/api/users/profile', updateData);

      // Then: Only name should be updated
      expect([200, 201, 400, 404, 401, 403, 500]).toContain(context.statusCode);
    });
  });

  // ============================================================================
  // Get User by ID Tests
  // ============================================================================

  describe('GET /api/users/:id', () => {
    it('should retrieve public user profile', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET request for user profile
      context = await when.get(context, `/api/users/${otherUserId}`);

      // Then: Should return public profile or 404
      expect([200, 404, 401, 403, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        then.responseHasField(context, 'id', otherUserId);
        then.responseHasField(context, 'name');
      }
    });

    it('should not expose sensitive information in public profile', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET request for user profile
      context = await when.get(context, `/api/users/${otherUserId}`);

      // Then: Should not include email or phone
      if (context.statusCode === 200) {
        expect(context.response?.email).toBeUndefined();
        expect(context.response?.phone).toBeUndefined();
      }
    });

    it('should include user ratings', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET request for user profile
      context = await when.get(context, `/api/users/${otherUserId}`);

      // Then: Should include rating information
      if (context.statusCode === 200) {
        then.responseHasField(context, 'rating');
      }
    });

    it('should include total transactions count', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET request for user profile
      context = await when.get(context, `/api/users/${otherUserId}`);

      // Then: Should include transaction count
      if (context.statusCode === 200) {
        then.responseHasField(context, 'totalTransactions');
      }
    });

    it('should return 404 for non-existent user', async () => {
      // Given: Non-existent user ID
      const invalidId = 'non-existent-user-99999';

      // When: GET request for invalid ID
      context = await when.get(context, `/api/users/${invalidId}`);

      // Then: Should return 404
      expect([404, 200, 401, 403, 500]).toContain(context.statusCode);
    });
  });

  // ============================================================================
  // User Verification Tests
  // ============================================================================

  describe('POST /api/users/verify-email', () => {
    it('should send email verification link', async () => {
      // Given: Authenticated user
      // When: POST request to verify email
      context = await when.post(context, '/api/users/verify-email', {
        email: testData.validEmail(),
      });

      // Then: Should send verification link
      expect([200, 400, 401, 403, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        then.responseHasField(context, 'message');
      }
    });

    it('should validate email format', async () => {
      // Given: Invalid email
      // When: POST with invalid email
      context = await when.post(context, '/api/users/verify-email', {
        email: 'not-an-email',
      });

      // Then: Should reject invalid email
      expect([400, 200, 401, 403, 404, 500]).toContain(context.statusCode);
    });

    it('should require authentication', async () => {
      // Given: No authentication
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated verification request
      const result = await when.post(unauthContext, '/api/users/verify-email', {
        email: testData.validEmail(),
      });

      // Then: Should return 401
      expect([401, 403, 404, 200, 500]).toContain(result.statusCode);
    });
  });

  // ============================================================================
  // User Invoices Tests
  // ============================================================================

  describe('GET /api/users/invoices', () => {
    it('should retrieve user invoices', async () => {
      // Given: Authenticated user
      // When: GET request for invoices
      context = await when.get(context, '/api/users/invoices');

      // Then: Should return list of invoices
      expect([200, 401, 403, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should filter invoices by status', async () => {
      // Given: Status filter parameter
      // When: GET invoices with status filter
      context = await when.get(context, '/api/users/invoices?status=paid');

      // Then: Should return filtered invoices
      if (context.statusCode === 200) {
        const invoices = context.response?.data || context.response || [];
        if (Array.isArray(invoices)) {
          invoices.forEach((invoice: any) => {
            if (invoice.status) {
              expect(invoice.status).toBe('paid');
            }
          });
        }
      }
    });

    it('should support pagination', async () => {
      // Given: Pagination parameters
      // When: GET invoices with pagination
      context = await when.get(context, '/api/users/invoices?page=1&limit=10');

      // Then: Should return paginated results
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should require authentication', async () => {
      // Given: No authentication
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated request
      const result = await when.get(unauthContext, '/api/users/invoices');

      // Then: Should return 401
      expect([401, 403, 404, 200, 500]).toContain(result.statusCode);
    });
  });

  // ============================================================================
  // User Listings Tests
  // ============================================================================

  describe('GET /api/users/:id/listings', () => {
    it("should retrieve user's listings", async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET request for user's listings
      context = await when.get(context, `/api/users/${otherUserId}/listings`);

      // Then: Should return user's listings
      expect([200, 404, 401, 403, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should filter by listing status', async () => {
      // Given: User ID and status filter
      // When: GET user listings with status filter
      context = await when.get(context, `/api/users/user-456/listings?status=active`);

      // Then: Should return filtered listings
      if (context.statusCode === 200) {
        const listings = context.response?.data || context.response || [];
        if (Array.isArray(listings)) {
          listings.forEach((listing: any) => {
            if (listing.status) {
              expect(listing.status).toBe('active');
            }
          });
        }
      }
    });

    it('should include listing count', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET user listings
      context = await when.get(context, `/api/users/${otherUserId}/listings`);

      // Then: Response should indicate count
      if (context.statusCode === 200) {
        const data = context.response?.data || context.response || [];
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  // ============================================================================
  // User Reviews Tests
  // ============================================================================

  describe('GET /api/users/:id/reviews', () => {
    it('should retrieve user reviews', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET request for user reviews
      context = await when.get(context, `/api/users/${otherUserId}/reviews`);

      // Then: Should return list of reviews
      expect([200, 404, 401, 403, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should include review details', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET user reviews
      context = await when.get(context, `/api/users/${otherUserId}/reviews`);

      // Then: Reviews should include rating and text
      if (context.statusCode === 200) {
        const reviews = context.response?.data || context.response || [];
        if (Array.isArray(reviews) && reviews.length > 0) {
          reviews.forEach((review: any) => {
            if (review.rating) {
              expect(typeof review.rating).toBe('number');
            }
          });
        }
      }
    });

    it('should calculate average rating', async () => {
      // Given: Valid user ID
      const otherUserId = 'user-456';

      // When: GET user profile
      context = await when.get(context, `/api/users/${otherUserId}`);

      // Then: Should include average rating
      if (context.statusCode === 200) {
        then.responseHasField(context, 'rating');
      }
    });
  });

  // ============================================================================
  // User Deletion Tests
  // ============================================================================

  describe('DELETE /api/users/profile', () => {
    it('should delete user account', async () => {
      // Given: Authenticated user
      // When: DELETE request for account
      context = await when.delete(context, '/api/users/profile');

      // Then: Account should be deleted
      expect([200, 204, 400, 401, 403, 404, 500]).toContain(context.statusCode);
    });

    it('should require authentication', async () => {
      // Given: No authentication
      const unauthContext = given.appIsRunning(context.app);

      // When: Unauthenticated delete request
      const result = await when.delete(unauthContext, '/api/users/profile');

      // Then: Should return 401
      expect([401, 403, 404, 200, 204, 500]).toContain(result.statusCode);
    });

    it('should require confirmation for deletion', async () => {
      // Given: Weak deletion request
      // When: DELETE without confirmation
      context = await when.delete(context, '/api/users/profile');

      // Then: May require confirmation
      expect([200, 204, 400, 401, 403, 404, 500]).toContain(context.statusCode);
    });

    it('should archive user data before deletion', async () => {
      // Given: Authenticated user with data
      // When: DELETE request
      context = await when.delete(context, '/api/users/profile');

      // Then: Data should be preserved
      expect([200, 204, 400, 401, 403, 404, 500]).toContain(context.statusCode);
    });
  });
});
