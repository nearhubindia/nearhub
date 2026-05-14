import axios from 'axios';
import { SERVER_CONFIG } from '../../lib/config';
import { getGoogleGenAIClient, isGoogleGenAIConfigured } from './genai-client';
import { callGeminiWithRetry, extractTextFromGeminiResponse } from './genai-resilience';

const GEMINI_MODEL = process.env.GEMINI_MODERATION_MODEL || 'gemini-2.5-flash';

type ModerationRisk = 'nudity' | 'drugs' | 'guns' | 'knives';

export type ListingModerationDecision = {
  shouldAutoApprove: boolean;
  requiresManualReview: boolean;
  confidence: number;
  reasons: string[];
  detectedRisks: ModerationRisk[];
  provider: 'gemini';
};

type GeminiStructuredResult = {
  safe: boolean;
  confidence: number;
  reasons: string[];
  detectedRisks: ModerationRisk[];
};

function clampConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

function guessMimeTypeFromUrl(url: string): string {
  const value = url.toLowerCase();
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function fetchImageAsInlinePart(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 3,
  });
  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  const mimeType =
    contentType.startsWith('image/') && contentType.length < 100
      ? contentType
      : guessMimeTypeFromUrl(url);
  const data = Buffer.from(response.data).toString('base64');
  return { mimeType, data };
}

function parseStructuredJson(text: string): GeminiStructuredResult | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<GeminiStructuredResult>;
    const detectedRisks = Array.isArray(parsed.detectedRisks)
      ? parsed.detectedRisks.filter((risk): risk is ModerationRisk =>
          ['nudity', 'drugs', 'guns', 'knives'].includes(String(risk))
        )
      : [];
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((item) => String(item).trim()).filter(Boolean)
      : [];
    return {
      safe: Boolean(parsed.safe),
      confidence: clampConfidence(parsed.confidence),
      reasons,
      detectedRisks,
    };
  } catch {
    return null;
  }
}

export function isGeminiModerationConfigured(): boolean {
  return Boolean(SERVER_CONFIG.AI_FEATURES_ENABLED && isGoogleGenAIConfigured());
}

export async function moderateListingWithGemini(input: {
  title: string;
  description: string;
  category: string;
  imageUrls?: string[];
  videoUrls?: string[];
}): Promise<ListingModerationDecision> {
  const { title, description, category } = input;
  const imageUrls = (input.imageUrls || []).slice(0, 4).filter(Boolean);
  const videoUrls = (input.videoUrls || []).filter(Boolean);

  if (!isGeminiModerationConfigured()) {
    return {
      shouldAutoApprove: false,
      requiresManualReview: true,
      confidence: 0,
      reasons: ['Gemini moderation is not configured'],
      detectedRisks: [],
      provider: 'gemini',
    };
  }

  try {
    const ai = getGoogleGenAIClient();
    const imageParts = await Promise.all(
      imageUrls.map(async (url) => {
        const inline = await fetchImageAsInlinePart(url);
        return { inlineData: inline };
      })
    );

    const prompt = `You are a strict trust-and-safety moderator for a classified marketplace.
Classify if this listing can be auto-approved or must go to manual review.

AUTO-APPROVE only if clearly safe.
MANUAL REVIEW is required if you detect or suspect any of:
1) Nudity/sexual content
2) Drugs/drug paraphernalia
3) Guns/firearms
4) Knives/edged weapons

Return ONLY valid JSON:
{
  "safe": true/false,
  "confidence": 0.0-1.0,
  "reasons": ["short reason"],
  "detectedRisks": ["nudity"|"drugs"|"guns"|"knives"]
}

Listing metadata:
Title: "${title}"
Category: "${category}"
Description: "${description}"
Video count: ${videoUrls.length}`;

    const response = await callGeminiWithRetry('Gemini moderation', () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
      })
    );

    const parsed = parseStructuredJson(extractTextFromGeminiResponse(response));
    if (!parsed) {
      return {
        shouldAutoApprove: false,
        requiresManualReview: true,
        confidence: 0.25,
        reasons: ['Unable to parse Gemini moderation response'],
        detectedRisks: [],
        provider: 'gemini',
      };
    }

    const detectedRisks = parsed.detectedRisks;
    const suspiciousByConfidence = parsed.confidence < 0.65;
    const hasRisk = detectedRisks.length > 0 || !parsed.safe;
    const hasVideo = videoUrls.length > 0;
    const requiresManualReview = hasRisk || suspiciousByConfidence;

    const reasons = [...parsed.reasons];
    if (suspiciousByConfidence) reasons.push('Low moderation confidence');
    if (hasVideo && !requiresManualReview) reasons.push('Video listing passed moderation checks');

    return {
      shouldAutoApprove: !requiresManualReview,
      requiresManualReview,
      confidence: parsed.confidence,
      reasons: reasons.length > 0 ? reasons : ['Moderation completed'],
      detectedRisks,
      provider: 'gemini',
    };
  } catch (error) {
    console.error('[GeminiModeration] Failed to moderate listing:', error);
    return {
      shouldAutoApprove: false,
      requiresManualReview: true,
      confidence: 0,
      reasons: ['Gemini moderation failed'],
      detectedRisks: [],
      provider: 'gemini',
    };
  }
}
