/**
 * Rate limiting middleware configuration
 * Protects API endpoints from abuse and DDoS attacks
 */
import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';

const isDevelopment = process.env.NODE_ENV !== 'production';

function getRequestPath(req: { originalUrl?: string; url?: string; path?: string }): string {
  return req.originalUrl || req.url || req.path || '';
}

/**
 * General API rate limiter
 * 500 requests per 15 minutes per IP
 * (Increased for mobile app with frequent read operations)
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 5000 : 500, // Higher limit in development to avoid false positives
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => req.get('x-user-id') || ipKeyGenerator(req.ip || ''),
  skip: (req) => {
    const requestPath = getRequestPath(req);

    // Streaming and chunked upload endpoints make many rapid requests by design.
    if (requestPath.includes('/api/videos/stream/')) return true;
    if (requestPath.includes('/api/videos/progress/')) return true;
    if (requestPath.includes('/api/videos/initiate')) return true;
    if (requestPath.includes('/api/videos/upload-chunk')) return true;
    if (requestPath.includes('/api/videos/finalize')) return true;
    if (requestPath.includes('/api/videos/cancel')) return true;

    // Public banner reads are frequent (home focus/navigation) and should not be throttled
    if (requestPath.includes('/api/banners')) return true;

    return false;
  },
  // Skip successful requests from counting against limit (optional)
  skipSuccessfulRequests: false,
});

/**
 * Strict rate limiter for auth endpoints
 * 5 requests per 15 minutes per IP (login, signup, OTP)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 attempts per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * AI/Search rate limiter (more expensive operations)
 * 10 requests per minute per IP
 */
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 AI requests per minute
  message: {
    success: false,
    error: 'Too many AI requests, please slow down.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter
 * 20 uploads per hour per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    success: false,
    error: 'Upload limit exceeded, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Payment rate limiter
 * 10 payment attempts per hour per IP
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: 'Too many payment attempts, please contact support.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Listing creation limiter
 * 50 listings per day per user
 */
export const listingCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50,
  message: {
    success: false,
    code: 'DAILY_LISTING_LIMIT_REACHED',
    error: 'You have reached your daily listing limit (50 listings/day).',
    retryAfter: '24 hours',
    limit: 50,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const requestWithUser = req as typeof req & { userId?: string };
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : undefined;
    return (
      requestWithUser.userId ||
      req.get('x-user-id') ||
      userId ||
      ipKeyGenerator(req.ip || '')
    );
  },
  skip: (req) => {
    // Do not apply listing/day limits to admin-created listings
    const ownerId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    return ownerId.startsWith('admin');
  },
});
