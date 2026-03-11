/**
 * Server Configuration
 * Centralized environment variable management for the backend
 */

export const SERVER_CONFIG = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.SERVER_PORT || '5000', 10),
  HOST: process.env.SERVER_HOST || 'localhost',

  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub',
  DB_MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  DB_IDLE_TIMEOUT_MS: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  DB_CONNECTION_TIMEOUT_MS: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '2000', 10),

  // CORS configuration
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  CORS_ALLOW_LOCALHOST: process.env.CORS_ALLOW_LOCALHOST !== 'false',
  CORS_ALLOW_LOCAL_NETWORK: process.env.CORS_ALLOW_LOCAL_NETWORK !== 'false',

  // OTP & SMS
  BSNL_DLT_ENABLED: process.env.BSNL_DLT_ENABLED === 'true',
  BSNL_DLT_USERNAME: process.env.BSNL_DLT_USERNAME || '',
  BSNL_DLT_PASSWORD: process.env.BSNL_DLT_PASSWORD || '',
  BSNL_DLT_SENDER_ID: process.env.BSNL_DLT_SENDER_ID || 'NRHUB',
  BSNL_DLT_ROUTE: parseInt(process.env.BSNL_DLT_ROUTE || '1', 10),
  BSNL_DLT_TEMPLATE_ID: process.env.BSNL_DLT_TEMPLATE_ID || '',

  MSG91_ENABLED: process.env.MSG91_ENABLED !== 'false',
  MSG91_API_KEY: process.env.MSG91_API_KEY || '',
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID || 'NRHUB',
  MSG91_ROUTE: parseInt(process.env.MSG91_ROUTE || '4', 10),
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || '',

  // OTP Service
  OTP_VALIDITY_MINUTES: parseInt(process.env.OTP_VALIDITY_MINUTES || '5', 10),
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
  OTP_RATE_LIMIT_REQUESTS: parseInt(process.env.OTP_RATE_LIMIT_REQUESTS || '5', 10),
  OTP_RATE_LIMIT_WINDOW: parseInt(process.env.OTP_RATE_LIMIT_WINDOW || '3600', 10),

  // Payment Gateway
  RAZORPAY_API_KEY: process.env.RAZORPAY_API_KEY || '',
  RAZORPAY_API_SECRET: process.env.RAZORPAY_API_SECRET || '',
  RAZORPAY_ACCOUNT_ID: process.env.RAZORPAY_ACCOUNT_ID || '',

  // Geo-location
  DEFAULT_GEO_RADIUS_KM: parseInt(process.env.DEFAULT_GEO_RADIUS_KM || '10', 10),
  MAX_GEO_RADIUS_KM: parseInt(process.env.MAX_GEO_RADIUS_KM || '50', 10),

  // Caching
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),

  // Search & Indexing
  ELASTICSEARCH_ENABLED: process.env.ELASTICSEARCH_ENABLED === 'true',
  ELASTICSEARCH_HOST: process.env.ELASTICSEARCH_HOST || 'localhost:9200',
  ELASTICSEARCH_INDEX_NAME: process.env.ELASTICSEARCH_INDEX_NAME || 'nearhub-listings',

  // File Storage
  STORAGE_TYPE: process.env.STORAGE_TYPE || 'local',
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || '/tmp/nearhub-storage',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  AWS_S3_REGION: process.env.AWS_S3_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  CLOUDFLARE_R2_ENABLED: process.env.CLOUDFLARE_R2_ENABLED === 'true',
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || '',
  CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  CLOUDFLARE_R2_PUBLIC_BASE_URL: process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '',
  CLOUDFLARE_R2_PRESIGN_EXPIRES_SECONDS: parseInt(
    process.env.CLOUDFLARE_R2_PRESIGN_EXPIRES_SECONDS || '900',
    10
  ),
  CLOUDFLARE_R2_MAX_IMAGE_BYTES: parseInt(
    process.env.CLOUDFLARE_R2_MAX_IMAGE_BYTES || String(10 * 1024 * 1024),
    10
  ),
  CLOUDFLARE_R2_MAX_VIDEO_BYTES: parseInt(
    process.env.CLOUDFLARE_R2_MAX_VIDEO_BYTES || String(300 * 1024 * 1024),
    10
  ),

  // AI
  GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY || '',
  AI_FEATURES_ENABLED: process.env.AI_FEATURES_ENABLED !== 'false',

  // Admin
  ADMIN_DEFAULT_EMAIL: process.env.ADMIN_DEFAULT_EMAIL || 'admin@nearhub.local',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || 'admin@123',
  ADMIN_JWT_SECRET:
    process.env.ADMIN_JWT_SECRET ||
    'your_very_secure_admin_jwt_secret_key_change_this_in_production',
  ADMIN_JWT_EXPIRES_IN: process.env.ADMIN_JWT_EXPIRES_IN || '24h',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ACCESS_LOGS_ENABLED: process.env.ACCESS_LOGS_ENABLED !== 'false',

  // Email
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'smtp',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@nearhub.com',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'NearHub',

  // Feature Flags
  LISTING_EXPIRATION_ENABLED: process.env.LISTING_EXPIRATION_ENABLED !== 'false',
  LISTING_EXPIRATION_DAYS: parseInt(process.env.LISTING_EXPIRATION_DAYS || '60', 10),
  SUBSCRIPTIONS_ENABLED: process.env.SUBSCRIPTIONS_ENABLED !== 'false',
  SPAM_DETECTION_ENABLED: process.env.SPAM_DETECTION_ENABLED !== 'false',
};

export function isDevelopment(): boolean {
  return SERVER_CONFIG.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return SERVER_CONFIG.NODE_ENV === 'production';
}

export function isTest(): boolean {
  return SERVER_CONFIG.NODE_ENV === 'test';
}

export function logDebug(message: string, data?: any): void {
  console.log(`[Server] ${message}`, data || '');
}

export function logInfo(message: string, data?: any): void {
  console.info(`[Server] ${message}`, data || '');
}

export function logError(message: string, error?: any): void {
  console.error(`[Server] ERROR: ${message}`, error || '');
}

export function logWarn(message: string, data?: any): void {
  console.warn(`[Server] WARN: ${message}`, data || '');
}

/**
 * Validate environment variables on startup
 * Add strict validation in production
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required variables
  if (!SERVER_CONFIG.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (isProduction()) {
    if (!SERVER_CONFIG.ADMIN_JWT_SECRET || SERVER_CONFIG.ADMIN_JWT_SECRET.includes('very_secure')) {
      errors.push('ADMIN_JWT_SECRET must be set to a secure value in production');
    }
  }

  if (errors.length > 0) {
    logError('Configuration validation failed:', errors);
    if (isProduction()) {
      process.exit(1);
    }
  }

  if (!isDevelopment()) {
    logInfo('Configuration validated successfully');
  }
}
