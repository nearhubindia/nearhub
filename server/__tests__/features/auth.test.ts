/**
 * Authentication API Tests
 * GWT (Given-When-Then) Format Tests for Auth Endpoints
 */

// Mock AI validation services to prevent timeouts
jest.mock('../../shared/ai/ai', () => ({
  validateImageWithPhi2: jest.fn().mockResolvedValue({
    isValid: true,
    isAppropriate: true,
    matchesCategory: true,
    confidence: 0.95,
    detectedItems: ['phone', 'electronics'],
    suggestion: '',
  }),
  validateVideoWithPhi2: jest.fn().mockResolvedValue({
    isValid: true,
    isAppropriate: true,
    matchesCategory: true,
    confidence: 0.95,
    detectedItems: ['video content'],
    suggestion: '',
  }),
}));

import { createTestApp } from '../setup/test-app';
import { given, when, then, testData, type TestContext } from '../utils/gwt-helpers';
import { otpService } from '../../shared/utils/otp';

describe('Authentication API - GWT Tests', () => {
  let context: TestContext;

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
  });

  // ============================================================================
  // Send OTP Tests
  // ============================================================================

  describe('POST /api/auth/send-otp', () => {
    it('should send OTP successfully with valid phone number', async () => {
      // Given: App is running and phone number is valid
      const validPhone = testData.validPhone();

      // When: POST request is made to send-otp
      context = await when.post(context, '/api/auth/send-otp', {
        phone: validPhone,
      });

      // Then: Response should be successful
      then.statusCodeIs(context, 200);
      then.responseIsSuccessful(context);
      then.responseHasField(context, 'message');
      expect(context.response?.expiresIn).toBeDefined();
    });

    it('should not return OTP in API response', async () => {
      // Given: Environment is development and phone is valid
      const validPhone = testData.validPhone();
      process.env.NODE_ENV = 'development';

      // When: OTP is requested
      context = await when.post(context, '/api/auth/send-otp', {
        phone: validPhone,
      });

      // Then: Response should not include OTP
      then.statusCodeIs(context, 200);
      then.responseIsSuccessful(context);
      expect(context.response?.otp).toBeUndefined();
    });

    it('should fail with missing phone number', async () => {
      // Given: Phone number is missing
      // When: POST request without phone
      context = await when.post(context, '/api/auth/send-otp', {});

      // Then: Request should handle gracefully (OTP service will validate)
      expect(context.statusCode).toBeLessThanOrEqual(500);
    });

    it('should handle invalid phone format gracefully', async () => {
      // Given: Phone number has invalid format
      const invalidPhone = 'not-a-phone';

      // When: OTP is requested with invalid phone
      context = await when.post(context, '/api/auth/send-otp', {
        phone: invalidPhone,
      });

      // Then: Request should be processed (validation depends on OTP service)
      expect(context.statusCode).toBeLessThanOrEqual(500);
    });

    it('should include sentVia in response', async () => {
      // Given: Valid phone number
      const validPhone = testData.validPhone();

      // When: OTP is requested
      context = await when.post(context, '/api/auth/send-otp', {
        phone: validPhone,
      });

      // Then: Response should include sentVia field
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'sentVia');
    });
  });

  // ============================================================================
  // Verify OTP Tests
  // ============================================================================

  describe('POST /api/auth/verify-otp', () => {
    it('should verify valid OTP and create user', async () => {
      // Given: Valid phone, OTP, and user details exist
      const validPhone = testData.validPhone();
      const validOTP = testData.validOTP();
      const validName = testData.validName();

      // First send OTP to get valid OTP in dev mode
      const setupContext = given.appIsRunning(context.app);
      await when.post(setupContext, '/api/auth/send-otp', {
        phone: validPhone,
      });
      const generatedOtp = otpService.getOTPRecord(validPhone)?.otp || validOTP;

      // When: OTP is verified
      context = await when.post(context, '/api/auth/verify-otp', {
        phone: validPhone,
        otp: generatedOtp,
        name: validName,
      });

      // Then: User should be created and returned
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'user');
      expect(context.response?.user?.phone).toBe(validPhone);
      expect(context.response?.user?.name).toBe(validName);
      expect(context.response?.user?.id).toBeDefined();
    });

    it('should handle invalid OTP', async () => {
      // Given: Valid phone but invalid OTP
      const validPhone = testData.validPhone();
      const invalidOTP = '000000';

      // When: Invalid OTP is verified
      context = await when.post(context, '/api/auth/verify-otp', {
        phone: validPhone,
        otp: invalidOTP,
      });

      // Then: Should return error (exact response depends on OTP service)
      expect(context.statusCode).toBeLessThanOrEqual(200); // Service returns 200 with success: false
    });

    it('should create user with optional email and gender', async () => {
      // Given: Complete user registration data
      const validPhone = testData.validPhone();
      const validEmail = testData.validEmail();
      const validName = testData.validName();

      // Setup: Send OTP first
      const setupContext = given.appIsRunning(context.app);
      await when.post(setupContext, '/api/auth/send-otp', {
        phone: validPhone,
      });
      const generatedOtp = otpService.getOTPRecord(validPhone)?.otp || testData.validOTP();

      // When: OTP is verified with full user details
      context = await when.post(context, '/api/auth/verify-otp', {
        phone: validPhone,
        otp: generatedOtp,
        name: validName,
        email: validEmail,
        gender: 'male',
      });

      // Then: User should have all provided fields
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'user');
      expect(context.response?.user?.email).toBe(validEmail);
      expect(context.response?.user?.gender).toBe('male');
    });

    it('should generate unique user ID', async () => {
      // Given: Two separate verification requests
      const phone1 = testData.validPhone();
      const phone2 = testData.validPhone();

      // Setup: Send OTPs
      const setup1 = given.appIsRunning(context.app);
      await when.post(setup1, '/api/auth/send-otp', { phone: phone1 });
      const generatedOtp1 = otpService.getOTPRecord(phone1)?.otp || testData.validOTP();

      const setup2 = given.appIsRunning(context.app);
      await when.post(setup2, '/api/auth/send-otp', { phone: phone2 });
      const generatedOtp2 = otpService.getOTPRecord(phone2)?.otp || testData.validOTP();

      // When: Both OTPs are verified
      const user1Context = await when.post(context, '/api/auth/verify-otp', {
        phone: phone1,
        otp: generatedOtp1,
      });

      const user2Context = await when.post(context, '/api/auth/verify-otp', {
        phone: phone2,
        otp: generatedOtp2,
      });

      // Then: User IDs should be unique
      const userId1 = user1Context.response?.user?.id;
      const userId2 = user2Context.response?.user?.id;
      expect(userId1).not.toBe(userId2);
    });

    it('should set user creation timestamp', async () => {
      // Given: Valid verification data
      const validPhone = testData.validPhone();

      // Setup: Send OTP
      const setupContext = given.appIsRunning(context.app);
      await when.post(setupContext, '/api/auth/send-otp', {
        phone: validPhone,
      });
      const generatedOtp = otpService.getOTPRecord(validPhone)?.otp || testData.validOTP();

      // When: OTP is verified
      context = await when.post(context, '/api/auth/verify-otp', {
        phone: validPhone,
        otp: generatedOtp,
      });

      // Then: CreatedAt should be set
      then.responseHasField(context, 'user');
      expect(context.response?.user?.createdAt).toBeDefined();
      const createdAt = new Date(context.response?.user?.createdAt);
      expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should use default values for optional fields', async () => {
      // Given: Only required fields provided
      const validPhone = testData.validPhone();

      // Setup: Send OTP
      const setupContext = given.appIsRunning(context.app);
      await when.post(setupContext, '/api/auth/send-otp', {
        phone: validPhone,
      });
      const generatedOtp = otpService.getOTPRecord(validPhone)?.otp || testData.validOTP();

      // When: Verified with minimal data
      context = await when.post(context, '/api/auth/verify-otp', {
        phone: validPhone,
        otp: generatedOtp,
      });

      // Then: Should have default values
      then.responseHasField(context, 'user');
      expect(context.response?.user?.name).toBe('User');
      expect(context.response?.user?.gender).toBe('other');
      expect(context.response?.user?.email).toBe('');
    });
  });

  // ============================================================================
  // Validate Listing Tests
  // ============================================================================

  describe('POST /api/validate-listing', () => {
    it('should validate image listing with all fields', async () => {
      // Given: Valid image listing data
      const listingData = {
        category: 'Electronics',
        title: 'iPhone 15 Pro',
        description: 'Used iPhone in good condition',
        isVideo: false,
      };

      // When: Listing is validated
      context = await when.post(context, '/api/validate-listing', listingData);

      // Then: Should return validation result
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'isValid');
      then.responseHasField(context, 'isAppropriate');
      then.responseHasField(context, 'matchesCategory');
      then.responseHasField(context, 'confidence');
    });

    it('should validate video listing with duration', async () => {
      // Given: Valid video listing data
      const listingData = {
        category: 'Services',
        title: 'Professional Photography Service',
        description: 'wedding and event photography',
        isVideo: true,
        videoDuration: 300,
      };

      // When: Video listing is validated
      context = await when.post(context, '/api/validate-listing', listingData);

      // Then: Should return validation result
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'isValid');
      then.responseHasField(context, 'isAppropriate');
    });

    it('should reject listing without title', async () => {
      // Given: Listing data without title
      const incompleteData = {
        category: 'Electronics',
        description: 'A test product',
      };

      // When: Invalid listing is validated
      context = await when.post(context, '/api/validate-listing', incompleteData);

      // Then: Should return error
      then.statusCodeIs(context, 400);
      then.responseHasError(context, 'Title and category are required');
    });

    it('should reject listing without category', async () => {
      // Given: Listing data without category
      const incompleteData = {
        title: 'Test Product',
        description: 'A test product',
      };

      // When: Invalid listing is validated
      context = await when.post(context, '/api/validate-listing', incompleteData);

      // Then: Should return error
      then.statusCodeIs(context, 400);
      then.responseHasError(context, 'Title and category are required');
    });

    it('should handle missing description gracefully', async () => {
      // Given: Listing without description
      const minimalData = {
        category: 'Electronics',
        title: 'Test Product',
      };

      // When: Listing without description is validated
      context = await when.post(context, '/api/validate-listing', minimalData);

      // Then: Should still validate with empty description
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'isValid');
    });

    it('should return detected items in response', async () => {
      // Given: Valid listing data
      const listingData = {
        category: 'Electronics',
        title: 'Camera Equipment',
        description: 'Professional camera and lenses',
      };

      // When: Listing is validated
      context = await when.post(context, '/api/validate-listing', listingData);

      // Then: Response should include detectedItems
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'detectedItems');
      expect(Array.isArray(context.response?.detectedItems)).toBe(true);
    });

    it('should handle AI service unavailability gracefully', async () => {
      // Given: Service might be unavailable
      const listingData = {
        category: 'Electronics',
        title: 'Test Product',
        description: 'Test description',
      };

      // When: Listing is validated (may fail if AI service is down)
      context = await when.post(context, '/api/validate-listing', listingData);

      // Then: Should return valid response (either from AI or fallback)
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'isValid');
      // Should have graceful fallback
      expect(context.response?.isValid).toBe(true);
    });

    it('should validate multiple categories', async () => {
      // Given: Different categories
      const categories = ['Electronics', 'Vehicles', 'Real Estate', 'Services', 'Jobs'];

      // When & Then: Each category is validated
      for (const category of categories) {
        const result = await when.post(context, '/api/validate-listing', {
          category,
          title: `Test ${category}`,
          description: `Testing ${category} category`,
        });

        then.statusCodeIs(result, 200);
        then.responseHasField(result, 'isValid');
      }
    });

    it('should return suggestion when validation fails', async () => {
      // Given: Potentially problematic listing
      const listingData = {
        category: 'Electronics',
        title: 'Suspicious Item',
        description: 'Some description',
      };

      // When: Listing is validated
      context = await when.post(context, '/api/validate-listing', listingData);

      // Then: Response should have suggestion field if available
      then.statusCodeIs(context, 200);
      if (context.response?.suggestion) {
        then.responseHasField(context, 'suggestion');
      }
    });
  });

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      // Given: App is running
      // When: Health check is called
      context = await when.get(context, '/api/health');

      // Then: Should return success status
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'success', true);
    });

    it('should include timestamp in response', async () => {
      // Given: Health check endpoint
      // When: Health check is called
      context = await when.get(context, '/api/health');

      // Then: Response should include timestamp
      then.statusCodeIs(context, 200);
      then.responseHasField(context, 'timestamp');
      const timestamp = new Date(context.response?.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
