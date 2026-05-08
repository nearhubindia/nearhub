import type { Express } from 'express';
import { createServer, type Server } from 'node:http';
import { GoogleGenAI } from '@google/genai';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
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
// Media feature routes
import { registerMediaCleanupRoutes } from './features/media/routes/media-cleanup';
import { registerCloudflareMediaRoutes } from './features/media/routes/cloudflare-media';
import { registerAIVoiceoverRoutes } from './features/media/routes/ai-voiceover';
import { registerVideoUploadRoutes } from './features/media/routes/video-upload';
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
import { SERVER_CONFIG } from './lib/config';

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
    const moderationModel = process.env.GEMINI_MODERATION_MODEL || 'gemini-2.5-flash';
    const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    const ttsProvider = (process.env.AI_TTS_PROVIDER || 'google').toLowerCase();
    const translationProvider = (process.env.AI_TRANSLATION_PROVIDER || 'google').toLowerCase();
    const hasApiKey = Boolean(SERVER_CONFIG.GOOGLE_GENAI_API_KEY);
    const aiFeaturesEnabled = Boolean(SERVER_CONFIG.AI_FEATURES_ENABLED);

    if (!aiFeaturesEnabled) {
      return res.status(503).json({
        success: false,
        status: 'degraded',
        message: 'AI features are disabled',
        timestamp: new Date().toISOString(),
        checks: {
          apiKeyConfigured: hasApiKey,
          moderation: { ok: false, model: moderationModel, reason: 'AI_FEATURES_DISABLED' },
          tts: { ok: false, model: ttsModel, reason: 'AI_FEATURES_DISABLED' },
        },
      });
    }

    if (!hasApiKey && ttsProvider !== 'aws') {
      return res.status(503).json({
        success: false,
        status: 'degraded',
        message: 'Google GenAI API key is not configured',
        timestamp: new Date().toISOString(),
        checks: {
          apiKeyConfigured: false,
          moderation: { ok: false, model: moderationModel, reason: 'MISSING_API_KEY' },
          tts: { ok: false, provider: ttsProvider, model: ttsModel, reason: 'MISSING_API_KEY' },
        },
      });
    }

    const ai = new GoogleGenAI({ apiKey: SERVER_CONFIG.GOOGLE_GENAI_API_KEY });
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

    try {
      await ai.models.generateContent({
        model: moderationModel,
        contents: 'Return exactly: ok',
      });
      moderationCheck = { ok: true, model: moderationModel };
    } catch (error) {
      moderationCheck = {
        ok: false,
        model: moderationModel,
        error: error instanceof Error ? error.message : 'Moderation check failed',
      };
    }

    if (ttsProvider === 'aws') {
      try {
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
        const polly = new PollyClient({ region });
        const response = await polly.send(
          new SynthesizeSpeechCommand({
            Engine: 'neural',
            OutputFormat: 'mp3',
            Text: 'NearHub AI health check',
            VoiceId: 'Kajal',
            LanguageCode: 'hi-IN',
          })
        );
        const hasAudio = Boolean(response.AudioStream);
        ttsCheck = hasAudio
          ? { ok: true, provider: 'aws', model: 'polly:Kajal' }
          : {
              ok: false,
              provider: 'aws',
              model: 'polly:Kajal',
              error: 'Polly response had no audio payload',
            };
      } catch (error) {
        ttsCheck = {
          ok: false,
          provider: 'aws',
          model: 'polly:Kajal',
          error: error instanceof Error ? error.message : 'Polly health check failed',
        };
      }
    } else {
      try {
        const response = await ai.models.generateContent({
          model: ttsModel,
          contents: 'NearHub AI health check',
          config: {
            responseModalities: ['AUDIO'],
          } as any,
        });
        const parts = Array.isArray(response?.candidates?.[0]?.content?.parts)
          ? (response.candidates?.[0]?.content?.parts as any[])
          : [];
        const hasAudio = parts.some(
          (part) => typeof part?.inlineData?.data === 'string' && part.inlineData.data.length > 0
        );
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
      translationCheck = moderationCheck.ok
        ? { ok: true, provider: 'google', model: moderationModel }
        : {
            ok: false,
            provider: 'google',
            model: moderationModel,
            error: moderationCheck.error || 'Google model check failed',
          };
    }

    const allHealthy = moderationCheck.ok && ttsCheck.ok && translationCheck.ok;
    return res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      message: allHealthy ? 'AI providers reachable' : 'One or more AI checks failed',
      timestamp: new Date().toISOString(),
      checks: {
        apiKeyConfigured: true,
        moderation: moderationCheck,
        tts: ttsCheck,
        translation: translationCheck,
      },
      origin: req.header('origin') || '(no origin header)',
    });
  });

  // Domain route modules
  registerApiDocsRoutes(app);
  registerAuthRoutes(app);
  registerAIRoutes(app);
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

  // Location
  await registerLocationRoutes(app);

  // Admin auth + protected settings middleware (only for POST/update)
  registerAdminAuthRoutes(app);
  // Allow public READ of settings, but protect UPDATE endpoints with auth
  registerAdminSettingsRoutes(app); // Registers GET (public) and POST (will add auth check inside)

  // Feature-domain routes
  registerListingExpirationRoutes(app);
  registerVideoUploadRoutes(app);
  registerMediaCleanupRoutes(app);
  registerCloudflareMediaRoutes(app);
  registerAIVoiceoverRoutes(app);
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
