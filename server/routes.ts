import type { Express } from 'express';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import axios from 'axios';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
// Location routes from search feature
import { registerLocationRoutes } from './features/search/routes/location';
// Admin feature routes
import { registerAdminAuthRoutes, adminAuthMiddleware } from './features/admin/routes/admin-auth';
import { registerAdminSettingsRoutes } from './features/admin/routes/admin-settings';
import { registerAdminRoutes } from './features/admin/routes/admin';
import { registerAdminUsersRoutes } from './features/admin/routes/admin-users';
import { registerAdminListingsRoutes } from './features/admin/routes/admin-listings';
import { registerAdminBannersRoutes } from './features/admin/routes/admin-banners';
import { registerAdminContactSubmissionRoutes } from './features/admin/routes/admin-contact-submissions';
import { registerReportsRoutes } from './features/admin/routes/reports';
import { registerAdminUserLifecycleRoutes } from './features/admin/routes/admin-user-lifecycle';
import { registerErrorLogRoutes } from './features/admin/routes/error-logs';
// Auth feature routes
import { registerAuthRoutes } from './features/auth/routes/auth';
// AI feature routes (shared)
import { registerAIRoutes } from './features/shared/routes/ai';
import { registerContactRoutes } from './features/shared/routes/contact';
// Listings feature routes
import { registerListingRoutes } from './features/listings/routes/listings';
import { registerListingExpirationRoutes } from './features/listings/routes/listing-expiration';
import { registerDealRoutes } from './features/listings/routes/deals';
// Media feature routes
import { registerMediaCleanupRoutes } from './features/media/routes/media-cleanup';
import { registerCloudflareMediaRoutes } from './features/media/routes/cloudflare-media';
// Payments feature routes
import { registerDynamicPricingRoutes } from './features/payments/routes/dynamic-pricing';
// Search feature routes
import { registerGeoSearchRoutes } from './features/search/routes/geo-search';
import { registerSearchRoutes } from './features/search/routes/search';
// Subscriptions feature routes
import { registerSubscriptionRoutes } from './features/subscriptions/routes/subscriptions';
import { registerSubscriptionPlansRoutes } from './features/subscriptions/routes/subscription-admin';
// Coupons feature routes
import { registerCouponRoutes } from './features/coupons/routes/coupons';
// Invoices feature routes (in users)
import { registerInvoiceRoutes } from './features/users/routes/invoices';
// Users feature routes
import { registerUserRoutes } from './features/users/routes/users';
// Push notifications feature routes
import { registerPushNotificationRoutes } from './features/push/routes/push';
// In-app notifications feature routes
import { registerInAppNotificationRoutes } from './features/notifications/routes/in-app';
// Messages feature routes
import { registerMessageRoutes } from './features/messages/routes/messages';
// Worker management routes
import { registerWorkerRoutes } from './features/workers/routes/workers';
import { registerApiDocsRoutes } from './shared/routes/api-docs';
import { registerMobileValuationRoutes } from './features/valuations/routes/mobile-valuations';
import { SERVER_CONFIG } from './lib/config';
import {
  getGoogleGenAIAuthMode,
  getGoogleGenAIClient,
  isGoogleGenAIConfigured,
} from './shared/ai/genai-client';
import {
  getGoogleTtsEndpoint,
  getGoogleTtsHeaders,
  hasGoogleTtsAuth,
} from './shared/ai/google-tts';
import { callGeminiWithRetry } from './shared/ai/genai-resilience';

type AiHealthCachedResult = {
  expiresAt: number;
  statusCode: number;
  body: any;
};

let aiHealthDeepCache: AiHealthCachedResult | null = null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      origin: req.header('origin') || '(no origin header)',
    });
  });

  app.get('/api/health/ai', async (req, res) => {
    const deepCheck =
      String(req.query.deep || '')
        .trim()
        .toLowerCase() === 'true';
    const now = Date.now();
    if (deepCheck && aiHealthDeepCache && aiHealthDeepCache.expiresAt > now) {
      return res.status(aiHealthDeepCache.statusCode).json({
        ...aiHealthDeepCache.body,
        cached: true,
      });
    }

    const moderationProvider = (process.env.AI_MODERATION_PROVIDER || 'aws').toLowerCase();
    const moderationModel = process.env.GEMINI_MODERATION_MODEL || 'gemini-2.5-flash';
    const ttsModel = process.env.GOOGLE_TTS_VOICE_NAME || 'google-cloud-tts';
    const ttsProvider: string = 'google';
    const translationProvider = (process.env.AI_TRANSLATION_PROVIDER || 'aws').toLowerCase();
    const googleGenAIConfigured = isGoogleGenAIConfigured();
    const googleGenAIAuthMode = getGoogleGenAIAuthMode();
    const aiFeaturesEnabled = Boolean(SERVER_CONFIG.AI_FEATURES_ENABLED);
    const requiresGoogle = moderationProvider !== 'aws' || translationProvider !== 'aws';
    const googleCredentialsPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
    const googleLicenseReady =
      getGoogleGenAIAuthMode() === 'api_key'
        ? Boolean(SERVER_CONFIG.GOOGLE_GENAI_API_KEY)
        : Boolean(process.env.GOOGLE_CLOUD_PROJECT);
    const awsLicenseReady =
      Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      (translationProvider !== 'aws' && moderationProvider !== 'aws');
    const licensing = {
      google: {
        authMode: googleGenAIAuthMode,
        configured: googleGenAIConfigured,
        licenseReady: googleLicenseReady,
        hasVertexProject: Boolean(process.env.GOOGLE_CLOUD_PROJECT),
        hasTtsAuth: hasGoogleTtsAuth(),
        hasCredentialsFile:
          googleGenAIAuthMode === 'vertex'
            ? Boolean(googleCredentialsPath && existsSync(googleCredentialsPath))
            : null,
      },
      aws: {
        required: translationProvider === 'aws' || moderationProvider === 'aws',
        licenseReady: awsLicenseReady,
        hasAccessKeyId: Boolean(process.env.AWS_ACCESS_KEY_ID),
        hasSecretAccessKey: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      },
    };

    if (!aiFeaturesEnabled) {
      return res.status(503).json({
        success: false,
        status: 'degraded',
        message: 'AI features are disabled',
        timestamp: new Date().toISOString(),
        checks: {
          licensing,
          googleGenAIConfigured,
          googleGenAIAuthMode,
          moderation: { ok: false, model: moderationModel, reason: 'AI_FEATURES_DISABLED' },
          tts: { ok: false, model: ttsModel, reason: 'AI_FEATURES_DISABLED' },
        },
      });
    }

    if (!googleGenAIConfigured && requiresGoogle) {
      return res.status(503).json({
        success: false,
        status: 'degraded',
        message: 'Google GenAI is not configured',
        timestamp: new Date().toISOString(),
        checks: {
          licensing,
          googleGenAIConfigured: false,
          googleGenAIAuthMode,
          moderation: { ok: false, model: moderationModel, reason: 'MISSING_GOOGLE_GENAI_CONFIG' },
          tts: {
            ok: false,
            provider: ttsProvider,
            model: ttsModel,
            reason: 'MISSING_GOOGLE_GENAI_CONFIG',
          },
        },
      });
    }

    const ai = requiresGoogle && googleGenAIConfigured ? getGoogleGenAIClient() : null;
    let moderationCheck: { ok: boolean; model: string; error?: string } = {
      ok: false,
      model: moderationModel,
    };
    let ttsCheck: { ok: boolean; provider: string; model: string; error?: string } = {
      ok: false,
      provider: ttsProvider,
      model: ttsModel,
    };
    let translationCheck: { ok: boolean; provider: string; model: string; error?: string } = {
      ok: false,
      provider: translationProvider,
      model: translationProvider === 'aws' ? 'translate:TranslateText' : moderationModel,
    };

    if (!deepCheck) {
      return res.status(200).json({
        success: true,
        status: 'ready',
        message: 'AI readiness check passed (light mode)',
        timestamp: new Date().toISOString(),
        deepCheck: false,
        checks: {
          licensing,
          googleGenAIConfigured: requiresGoogle ? googleGenAIConfigured : true,
          googleGenAIAuthMode,
          moderation: { provider: moderationProvider, model: moderationModel },
          tts: { provider: ttsProvider, model: ttsModel },
          translation: {
            provider: translationProvider,
            model: translationProvider === 'aws' ? 'translate:TranslateText' : moderationModel,
          },
        },
        origin: req.header('origin') || '(no origin header)',
      });
    }

    if (moderationProvider === 'aws') {
      moderationCheck = { ok: true, model: 'aws-rekognition:configured' };
    } else {
      try {
        if (!ai) throw new Error('Google GenAI is not configured');
        await callGeminiWithRetry('AI health moderation probe', () =>
          ai.models.generateContent({
            model: moderationModel,
            contents: 'Return exactly: ok',
          })
        );
        moderationCheck = { ok: true, model: moderationModel };
      } catch (error) {
        moderationCheck = {
          ok: false,
          model: moderationModel,
          error: error instanceof Error ? error.message : 'Moderation check failed',
        };
      }
    }

    {
      try {
        const endpoint = getGoogleTtsEndpoint();
        const headers = await getGoogleTtsHeaders();
        const response = await axios.post(
          endpoint,
          {
            input: { text: 'NearHub AI health check' },
            voice: { languageCode: 'en-IN' },
            audioConfig: { audioEncoding: 'LINEAR16' },
          },
          { timeout: 20000, headers }
        );
        const hasAudio = Boolean(String((response.data as any)?.audioContent || '').trim());
        ttsCheck = hasAudio
          ? { ok: true, provider: 'google', model: ttsModel }
          : {
              ok: false,
              provider: 'google',
              model: ttsModel,
              error: 'TTS response had no audio payload',
            };
      } catch (error) {
        ttsCheck = {
          ok: false,
          provider: 'google',
          model: ttsModel,
          error: error instanceof Error ? error.message : 'TTS check failed',
        };
      }
    }

    if (translationProvider === 'aws') {
      try {
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
        const translate = new TranslateClient({ region });
        const response = await translate.send(
          new TranslateTextCommand({
            SourceLanguageCode: 'en',
            TargetLanguageCode: 'hi',
            Text: 'NearHub AI health check',
          })
        );
        const output = String(response.TranslatedText || '').trim();
        translationCheck = output
          ? { ok: true, provider: 'aws', model: 'translate:TranslateText' }
          : {
              ok: false,
              provider: 'aws',
              model: 'translate:TranslateText',
              error: 'Translate response had no translated text',
            };
      } catch (error) {
        translationCheck = {
          ok: false,
          provider: 'aws',
          model: 'translate:TranslateText',
          error: error instanceof Error ? error.message : 'AWS Translate health check failed',
        };
      }
    } else {
      try {
        if (!ai) throw new Error('Google GenAI is not configured');
        await callGeminiWithRetry('AI health translation probe', () =>
          ai.models.generateContent({
            model: moderationModel,
            contents: 'Translate this to Hindi: hello',
          })
        );
        translationCheck = { ok: true, provider: 'google', model: moderationModel };
      } catch (error) {
        translationCheck = {
          ok: false,
          provider: 'google',
          model: moderationModel,
          error: error instanceof Error ? error.message : 'Google translation check failed',
        };
      }
    }

    const allHealthy = moderationCheck.ok && ttsCheck.ok && translationCheck.ok;
    const responseBody = {
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      message: allHealthy ? 'AI providers reachable' : 'One or more AI checks failed',
      timestamp: new Date().toISOString(),
      deepCheck: true,
      checks: {
        licensing,
        googleGenAIConfigured: requiresGoogle ? googleGenAIConfigured : true,
        googleGenAIAuthMode,
        moderation: moderationCheck,
        tts: ttsCheck,
        translation: translationCheck,
      },
      origin: req.header('origin') || '(no origin header)',
    };
    const statusCode = allHealthy ? 200 : 503;
    aiHealthDeepCache = {
      expiresAt: Date.now() + 60_000,
      statusCode,
      body: responseBody,
    };
    return res.status(statusCode).json(responseBody);
  });

  // Domain route modules
  registerApiDocsRoutes(app);
  registerAuthRoutes(app);
  registerAIRoutes(app);
  registerMobileValuationRoutes(app);
  registerContactRoutes(app);
  registerAdminRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminListingsRoutes(app);
  registerAdminBannersRoutes(app);
  registerAdminContactSubmissionRoutes(app);
  app.use(['/api/admin/reports', '/api/admin/revenue'], adminAuthMiddleware);
  registerReportsRoutes(app);
  registerAdminUserLifecycleRoutes(app);
  registerErrorLogRoutes(app);
  registerListingRoutes(app);
  registerDealRoutes(app);

  // Location
  await registerLocationRoutes(app);

  // Admin auth + protected settings middleware (only for POST/update)
  registerAdminAuthRoutes(app);
  // Allow public READ of settings, but protect UPDATE endpoints with auth
  registerAdminSettingsRoutes(app); // Registers GET (public) and POST (will add auth check inside)

  // Feature-domain routes
  registerListingExpirationRoutes(app);
  registerMediaCleanupRoutes(app);
  registerCloudflareMediaRoutes(app);
  registerDynamicPricingRoutes(app);
  registerUserRoutes(app);
  registerGeoSearchRoutes(app);
  registerSearchRoutes(app);

  // Subscription & payment
  registerSubscriptionRoutes(app);
  registerSubscriptionPlansRoutes(app);
  registerCouponRoutes(app);
  registerInvoiceRoutes(app);

  // Push notifications
  registerPushNotificationRoutes(app);

  // In-app notifications
  registerInAppNotificationRoutes(app);
  registerMessageRoutes(app);

  // Background workers
  registerWorkerRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
