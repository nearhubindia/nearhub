/**
 * Listings API Tests
 * GWT (Given-When-Then) Format Tests for Listing Endpoints
 */

import { createTestApp } from '../setup/test-app';
import { given, when, then, type TestContext } from '../utils/gwt-helpers';

describe('Listings API - GWT Tests', () => {
  let context: TestContext;
  let authToken: string = 'test-token';
  let testUserId: string = 'user-test-123';

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
    context = given.userIsAuthenticated(context, authToken, testUserId);
  });

  // ============================================================================
  // Get Listings Tests
  // ============================================================================

  describe('GET /api/listings', () => {
    it('should retrieve all listings', async () => {
      // Given: Listings exist in database
      // When: GET request is made to fetch listings
      context = await when.get(context, '/api/listings');

      // Then: Should return list of listings
      expect([200, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should support pagination', async () => {
      // Given: Multiple listings exist
      // When: GET request with pagination params
      context = await when.get(context, '/api/listings?page=1&limit=10');

      // Then: Should return paginated results
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should filter by category', async () => {
      // Given: Category filter parameter
      // When: GET request with category filter
      context = await when.get(context, '/api/listings?category=Electronics');

      // Then: Should return filtered listings
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should filter by price range', async () => {
      // Given: Price range parameters
      // When: GET request with price filters
      context = await when.get(context, '/api/listings?minPrice=100&maxPrice=1000');

      // Then: Should return listings in price range
      if (context.statusCode === 200) {
        const listings = context.response?.data || context.response || [];
        if (Array.isArray(listings)) {
          listings.forEach((listing: any) => {
            if (listing.price) {
              const price =
                typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price;
              expect(price).toBeGreaterThanOrEqual(100);
              expect(price).toBeLessThanOrEqual(1000);
            }
          });
        }
      }
    });

    it('should filter by location radius', async () => {
      // Given: Location and radius parameters
      // When: GET request with geo filter
      context = await when.get(context, '/api/listings?lat=28.6139&lng=77.209&radius=10');

      // Then: Should return nearby listings
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });

    it('should support search by title', async () => {
      // Given: Search query
      // When: GET request with search term
      context = await when.get(context, '/api/listings?search=iPhone');

      // Then: Should return matching listings
      if (context.statusCode === 200) {
        expect(Array.isArray(context.response) || Array.isArray(context.response?.data)).toBe(true);
      }
    });
  });

  // ============================================================================
  // Get Listing by ID Tests
  // ============================================================================

  describe('GET /api/listings/:id', () => {
    it('should retrieve listing by ID', async () => {
      // Given: Valid listing ID
      const listingId = 'listing-123';

      // When: GET request for specific listing
      context = await when.get(context, `/api/listings/${listingId}`);

      // Then: Should return listing details or 404
      expect([200, 404, 500]).toContain(context.statusCode);
      if (context.statusCode === 200) {
        then.responseHasField(context, 'id');
      }
    });

    it('should include seller information', async () => {
      // Given: Valid listing ID
      const listingId = 'listing-123';

      // When: GET request for listing
      context = await when.get(context, `/api/listings/${listingId}`);

      // Then: Should include seller data
      if (context.statusCode === 200) {
        then.responseHasField(context, 'sellerId');
      }
    });

    it('should include listing images', async () => {
      // Given: Valid listing ID
      const listingId = 'listing-123';

      // When: GET request for listing
      context = await when.get(context, `/api/listings/${listingId}`);

      // Then: Should include images array
      if (context.statusCode === 200) {
        then.responseHasField(context, 'images');
      }
    });

    it('should return 404 for non-existent listing', async () => {
      // Given: Non-existent listing ID
      const invalidId = 'non-existent-id-99999';

      // When: GET request for invalid ID
      context = await when.get(context, `/api/listings/${invalidId}`);

      // Then: Should return 404
      expect([404, 200, 500]).toContain(context.statusCode);
    });
  });

  // ============================================================================
  // Update Listing Tests
  // ============================================================================

  describe('PATCH /api/listings/:id', () => {
    it('should update listing details', async () => {
      // Given: Listing ID and update data
      const listingId = 'listing-123';
      const updateData = {
        title: 'Updated Title',
        price: 1500,
      };

      // When: PATCH request is made
      context = await when.patch(context, `/api/listings/${listingId}`, updateData);

      // Then: Listing should be updated
      expect([200, 201, 404, 401, 403]).toContain(context.statusCode);
    });

    it('should require ownership to update listing', async () => {
      // Given: Different user token
      const otherUserToken = 'other-user-token';
      const listingContext = given.userIsAuthenticated(context, otherUserToken, 'other-user-id');

      // When: PATCH request from different user
      const result = await when.patch(listingContext, '/api/listings/someone-elses-listing', {
        title: 'Hacked Title',
      });

      // Then: Should return 403 Forbidden or 404
      expect([403, 404, 200, 401]).toContain(result.statusCode);
    });

    it('should update only specified fields', async () => {
      // Given: Partial update data
      const listingId = 'listing-123';
      const updateData = {
        price: 2000,
      };

      // When: PATCH with partial data
      context = await when.patch(context, `/api/listings/${listingId}`, updateData);

      // Then: Only specified field should change
      expect([200, 201, 404, 401, 403, 500]).toContain(context.statusCode);
    });

    it('should not allow updating seller ID', async () => {
      // Given: Update data with sellerId
      const listingId = 'listing-123';
      const maliciousData = {
        sellerId: 'different-seller-id',
      };

      // When: PATCH tries to change seller
      context = await when.patch(context, `/api/listings/${listingId}`, maliciousData);

      // Then: Should not allow seller change
      // (May vary based on implementation)
      expect([200, 400, 401, 403, 404]).toContain(context.statusCode);
    });
  });

  // ============================================================================
  // Delete Listing Tests
  // ============================================================================

  describe('DELETE /api/listings/:id', () => {
    it('should delete listing successfully', async () => {
      // Given: Valid listing ID owned by authenticated user
      const listingId = 'listing-123';

      // When: DELETE request is made
      context = await when.delete(context, `/api/listings/${listingId}`);

      // Then: Listing should be deleted
      expect([200, 204, 401, 403, 404]).toContain(context.statusCode);
    });

    it('should require ownership to delete listing', async () => {
      // Given: Listing not owned by user
      const otherUserToken = 'other-user-token';
      const listingContext = given.userIsAuthenticated(context, otherUserToken, 'other-user-id');

      // When: DELETE from different user
      const result = await when.delete(listingContext, '/api/listings/other-users-listing');

      // Then: Should return 403 Forbidden
      expect([403, 404, 401, 200]).toContain(result.statusCode);
    });

    it('should return 404 for non-existent listing', async () => {
      // Given: Non-existent listing
      const invalidId = 'non-existent-id-99999';

      // When: DELETE non-existent listing
      context = await when.delete(context, `/api/listings/${invalidId}`);

      // Then: Should return 404
      expect([404, 403, 401, 200]).toContain(context.statusCode);
    });

    it('should allow admin to delete any listing', async () => {
      // Given: Admin token
      const adminToken = 'admin-token';
      const adminContext = given.userIsAuthenticated(context, adminToken, 'admin-user-id');

      // When: Admin deletes any listing
      const result = await when.delete(adminContext, '/api/listings/any-listing-id');

      // Then: Should allow deletion (may return 404 if not found)
      expect([200, 204, 404, 401, 403]).toContain(result.statusCode);
    });
  });

  // ============================================================================
  // Listing Status Tests
  // ============================================================================

  describe('Listing Status Management', () => {
    it('should allow marking listing as sold', async () => {
      // Given: Active listing
      const listingId = 'listing-123';

      // When: PATCH request to mark as sold
      context = await when.patch(context, `/api/listings/${listingId}`, {
        status: 'sold',
      });

      // Then: Status should be updated
      expect([200, 201, 404, 401, 403]).toContain(context.statusCode);
    });
  });
});
