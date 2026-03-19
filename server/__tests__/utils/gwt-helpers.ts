/**
 * GWT Test Utilities
 * Given-When-Then testing framework for API tests
 */

import type { Express } from 'express';
import request from 'supertest';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function attachAuthHeaders(req: request.Test, context: TestContext): void {
  if (context.token) {
    req.set('Authorization', `Bearer ${context.token}`);
  }
  if (isUuid(context.userId)) {
    req.set('x-user-id', context.userId);
  }
}

/**
 * Test context for managing test state
 */
export interface TestContext {
  app: Express;
  token?: string;
  userId?: string;
  testData?: Record<string, any>;
  response?: any;
  statusCode?: number;
  error?: any;
}

/**
 * Given: Setup test preconditions
 */
export const given = {
  /**
   * Setup the test application
   */
  appIsRunning: (app: Express): TestContext => ({
    app,
    testData: {},
  }),

  /**
   * User data is available
   */
  userExists: (context: TestContext, user: Record<string, any>): TestContext => ({
    ...context,
    testData: {
      ...context.testData,
      user,
    },
  }),

  /**
   * Authentication token is set
   */
  userIsAuthenticated: (context: TestContext, token: string, userId: string): TestContext => ({
    ...context,
    token,
    userId,
    testData: {
      ...context.testData,
      isAuthenticated: true,
    },
  }),

  /**
   * Listing data exists
   */
  listingExists: (context: TestContext, listing: Record<string, any>): TestContext => ({
    ...context,
    testData: {
      ...context.testData,
      listing,
    },
  }),

  /**
   * Multiple test data items exist
   */
  dataExists: (context: TestContext, key: string, data: any): TestContext => ({
    ...context,
    testData: {
      ...context.testData,
      [key]: data,
    },
  }),
};

/**
 * When: Perform the action being tested
 */
export const when = {
  /**
   * POST request is made
   */
  post: async (
    context: TestContext,
    endpoint: string,
    body?: Record<string, any>
  ): Promise<TestContext> => {
    try {
      const req = request(context.app).post(endpoint);
      attachAuthHeaders(req, context);

      const response = await req.send(body);

      return {
        ...context,
        response: response.body,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        ...context,
        error,
        statusCode: (error as any).status || 500,
      };
    }
  },

  /**
   * GET request is made
   */
  get: async (context: TestContext, endpoint: string): Promise<TestContext> => {
    try {
      const req = request(context.app).get(endpoint);
      attachAuthHeaders(req, context);

      const response = await req;

      return {
        ...context,
        response: response.body,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        ...context,
        error,
        statusCode: (error as any).status || 500,
      };
    }
  },

  /**
   * PATCH request is made
   */
  patch: async (
    context: TestContext,
    endpoint: string,
    body?: Record<string, any>
  ): Promise<TestContext> => {
    try {
      const req = request(context.app).patch(endpoint);
      attachAuthHeaders(req, context);

      const response = await req.send(body);

      return {
        ...context,
        response: response.body,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        ...context,
        error,
        statusCode: (error as any).status || 500,
      };
    }
  },

  /**
   * DELETE request is made
   */
  delete: async (context: TestContext, endpoint: string): Promise<TestContext> => {
    try {
      const req = request(context.app).delete(endpoint);
      attachAuthHeaders(req, context);

      const response = await req;

      return {
        ...context,
        response: response.body,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        ...context,
        error,
        statusCode: (error as any).status || 500,
      };
    }
  },

  /**
   * PUT request is made
   */
  put: async (
    context: TestContext,
    endpoint: string,
    body?: Record<string, any>
  ): Promise<TestContext> => {
    try {
      const req = request(context.app).put(endpoint);
      attachAuthHeaders(req, context);

      const response = await req.send(body);

      return {
        ...context,
        response: response.body,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        ...context,
        error,
        statusCode: (error as any).status || 500,
      };
    }
  },
};

/**
 * Then: Assert the results
 */
export const then = {
  /**
   * Status code should be
   */
  statusCodeIs: (context: TestContext, expectedStatus: number): boolean => {
    expect(context.statusCode).toBe(expectedStatus);
    return context.statusCode === expectedStatus;
  },

  /**
   * Response should have success flag
   */
  responseIsSuccessful: (context: TestContext): boolean => {
    expect(context.response?.success).toBe(true);
    return context.response?.success === true;
  },

  /**
   * Response should have error
   */
  responseHasError: (context: TestContext, expectedMessage?: string): boolean => {
    expect(context.response?.message || context.response?.error).toBeDefined();
    if (expectedMessage) {
      expect(context.response?.message || context.response?.error).toContain(expectedMessage);
    }
    return true;
  },

  /**
   * Response should match expected shape
   */
  responseMatches: (context: TestContext, expected: Record<string, any>): boolean => {
    Object.entries(expected).forEach(([key, value]) => {
      expect(context.response?.[key]).toEqual(value);
    });
    return true;
  },

  /**
   * Response should contain field
   */
  responseHasField: (context: TestContext, fieldName: string, expectedValue?: any): boolean => {
    expect(context.response?.[fieldName]).toBeDefined();
    if (expectedValue !== undefined) {
      expect(context.response?.[fieldName]).toEqual(expectedValue);
    }
    return true;
  },

  /**
   * Response should be empty array
   */
  responseIsEmptyArray: (context: TestContext): boolean => {
    expect(Array.isArray(context.response)).toBe(true);
    expect(context.response).toHaveLength(0);
    return true;
  },

  /**
   * Response should be non-empty array
   */
  responseIsNonEmptyArray: (context: TestContext): boolean => {
    expect(Array.isArray(context.response)).toBe(true);
    expect(context.response.length).toBeGreaterThan(0);
    return true;
  },

  /**
   * Response array length
   */
  responseArrayLength: (context: TestContext, length: number): boolean => {
    expect(Array.isArray(context.response)).toBe(true);
    expect(context.response).toHaveLength(length);
    return true;
  },

  /**
   * Error should be thrown
   */
  errorIsThrown: (context: TestContext, expectedMessage?: string): boolean => {
    expect(context.error).toBeDefined();
    if (expectedMessage) {
      expect((context.error as any).message).toContain(expectedMessage);
    }
    return true;
  },

  /**
   * Custom assertion
   */
  assert: (condition: boolean, message: string): boolean => {
    expect(condition).toBe(true);
    return condition;
  },

  /**
   * Response contains specific data
   */
  responseContains: (context: TestContext, dataKey: string): boolean => {
    expect(context.response?.[dataKey]).toBeDefined();
    return true;
  },
};

/**
 * Test data factory
 */
export const testData = {
  validPhone: () => {
    // Generate a unique phone number for each test to avoid rate limiting
    const random = Math.floor(Math.random() * 1000000);
    return `${6 + Math.floor(Math.random() * 4)}${String(random).padStart(9, '0')}`;
  },
  validOTP: () => '123456',
  validEmail: () => `test${Date.now()}@example.com`,
  validName: () => `Test User ${Date.now()}`,
  validListing: () => ({
    title: `Test Listing ${Date.now()}`,
    description: 'A test listing for testing purposes',
    category: 'Electronics',
    price: 999,
    location: {
      latitude: 28.6139,
      longitude: 77.209,
    },
    images: ['https://example.com/image1.jpg'],
  }),
  validCoupon: () => ({
    code: `TEST${Date.now()}`,
    discountPercentage: 10,
    maxUsageCount: 100,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  validSubscription: () => ({
    userId: `user_${Date.now()}`,
    tierId: 'tier_1',
    startDate: new Date().toISOString(),
    autoRenew: true,
  }),
};
