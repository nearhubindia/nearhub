/**
 * Jest Setup File
 * Global setup for all tests
 */

// Mock environment variables for tests
process.env.NODE_ENV = 'development'; // Use development to get OTP in responses
process.env.DATABASE_URL = 'postgresql://postgres:Synvide%40123@localhost:5432/nearhub';
process.env.API_PORT = '3000';
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MSG91_API_KEY = '';
process.env.ANTHROPIC_API_KEY = '';
process.env.PHI2_MODEL_ID = '';
process.env.BSNL_DLT_ENABLED = 'false';
process.env.MSG91_ENABLED = 'false';
process.env.SERVER_PORT = '5000';
process.env.SERVER_HOST = 'localhost';
process.env.RAZORPAY_KEY_ID = 'test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';

// Suppress console warnings during tests (but keep errors for debugging)
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (!args[0]?.includes?.('[MSG91]') && !args[0]?.includes?.('deprecated')) {
    originalWarn(...args);
  }
};

// Global test timeout
jest.setTimeout(10000);


