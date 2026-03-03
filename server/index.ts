// Bootstrap env vars FIRST – this must be the very first import so
// that all downstream modules (lib/config, data/db, etc.) see the
// correct process.env values when they are evaluated.
import './data/env';

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { redisCache } from './shared/cache/redis-cache';
import { initializeElasticsearch } from './features/search/services/elasticsearch';
import { initializeRazorpay } from './features/payments/services/razorpay';
import { SERVER_CONFIG } from './lib/config';
import { taskScheduler } from './lib/task-scheduler';
import { checkAndExpireSubscriptions } from './features/subscriptions/workers/subscription-expiration';
import { checkAndDeactivateListings } from './features/listings/workers/listing-expiration';
import { generalLimiter } from './lib/rate-limiter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log DATABASE_URL to verify it's loaded
if (process.env.DATABASE_URL) {
  console.log(`[Env] DATABASE_URL configured: ${process.env.DATABASE_URL.substring(0, 40)}...`);
} else {
  console.log('[Env] ⚠️ WARNING: DATABASE_URL not set!');
}

const app = express();
const log = console.log;

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header('origin');

    // Log incoming requests for debugging
    if (req.path.includes('/api/')) {
      console.log(`[CORS] ${req.method} ${req.path} from origin:`, origin || '(no origin)');
    }

    // Build allowed origins list
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || [];

    // Allow localhost origins for development (any port)
    const isLocalhost =
      origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:');

    // Allow local network IPs for Expo Go and local testing
    const isLocalNetwork =
      origin?.startsWith('http://192.168.') ||
      origin?.startsWith('http://10.') ||
      origin?.startsWith('http://172.');

    // For development: be permissive; for production: check allowlist
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isOriginAllowed =
      origin && (allowedOrigins.includes(origin) || isLocalhost || isLocalNetwork);
    const shouldAllow = isDevelopment || isOriginAllowed;

    if (shouldAllow) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, x-user-id');
      res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  // Add larger limit for JSON bodies and test simple parsing first
  app.use(
    express.json({
      limit: '50mb',
      strict: false,
    })
  );

  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Log body parsing for debugging
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' && req.path.startsWith('/api/')) {
      console.log(`[BodyParser] ${req.method} ${req.path}`);
      console.log(`[BodyParser] Body:`, req.body);
      console.log(`[BodyParser] Content-Type:`, req.get('content-type'));
    }
    next();
  });
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on('finish', () => {
      if (!path.startsWith('/api')) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), 'app.json');
    const appJsonContent = fs.readFileSync(appJsonPath, 'utf-8');
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || 'App Landing Page';
  } catch {
    return 'App Landing Page';
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(process.cwd(), 'static-build', platform, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader('expo-protocol-version', '1');
  res.setHeader('expo-sfv-version', '0');
  res.setHeader('content-type', 'application/json');

  const manifest = fs.readFileSync(manifestPath, 'utf-8');
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol || 'https';
  const forwardedHost = req.header('x-forwarded-host');
  const host = forwardedHost || req.get('host');
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(__dirname, 'templates', 'landing-page.html');
  const landingPageTemplate = fs.readFileSync(templatePath, 'utf-8');
  const appName = getAppName();

  log('Serving static Expo files with dynamic manifest routing');

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    if (req.path !== '/' && req.path !== '/manifest') {
      return next();
    }

    const platform = req.header('expo-platform');
    if (platform && (platform === 'ios' || platform === 'android')) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === '/') {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use('/assets', express.static(path.resolve(process.cwd(), 'assets')));
  app.use(express.static(path.resolve(process.cwd(), 'static-build')));

  // Serve uploaded videos directory (used by chunked uploads)
  const uploadDir = process.env.UPLOAD_DIR || '/tmp/video-uploads';
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    app.use('/videos', express.static(path.resolve(uploadDir)));
  } catch (err) {
    console.warn('Could not create or serve upload directory:', err);
  }

  log('Expo routing: Checking expo-platform header on / and /manifest');
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    console.error('Internal Server Error:', err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  // Initialize Redis cache
  try {
    await redisCache.connect();
    log('✓ Redis cache connected');
  } catch (error) {
    log('✗ Redis connection failed (continuing without cache):', error);
  }

  // Initialize Elasticsearch (optional)
  if (SERVER_CONFIG.ELASTICSEARCH_ENABLED) {
    try {
      await initializeElasticsearch();
      log('✓ Elasticsearch initialized');
    } catch (error) {
      log('⚠ Elasticsearch initialization failed (search will be disabled)');
    }
  } else {
    log('ℹ Elasticsearch disabled (set ELASTICSEARCH_ENABLED=true to enable)');
  }

  setupCors(app);
  setupBodyParsing(app);
  
  // Apply general rate limiting to all API routes
  app.use('/api', generalLimiter);
  log('✓ Rate limiting enabled (100 req/15min per IP)');
  
  setupRequestLogging(app);

  // Initialize Razorpay payment service
  try {
    initializeRazorpay();
    log('✓ Razorpay payment service initialized');
  } catch (error) {
    log('⚠ Razorpay initialization failed (payments will be unavailable):', error);
  }

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(
    {
      port,
      host: '0.0.0.0',
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
      
      // Initialize background workers after server starts
      initializeBackgroundWorkers();
    }
  );
})();

/**
 * Initialize background task workers
 */
function initializeBackgroundWorkers(): void {
  log('[Workers] Initializing background task scheduler...');

  // Subscription expiration worker - runs every 1 hour
  taskScheduler.register(
    'subscription-expiration',
    checkAndExpireSubscriptions,
    60 * 60 * 1000, // 1 hour
    { enabled: true, maxRetries: 3 }
  );

  // Listing expiration worker - runs every 30 minutes
  taskScheduler.register(
    'listing-expiration',
    checkAndDeactivateListings,
    30 * 60 * 1000, // 30 minutes
    { enabled: true, maxRetries: 3 }
  );

  log('✓ Background workers initialized');
  log('  - subscription-expiration: Every 1 hour');
  log('  - listing-expiration: Every 30 minutes');
}
