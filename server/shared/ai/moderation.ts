import { isGeminiModerationConfigured, moderateListingWithGemini } from './gemini-moderation';
import { moderateMediaWithRekognition } from './aws-moderation';

export type ListingModerationDecision = {
  shouldAutoApprove: boolean;
  requiresManualReview: boolean;
  confidence: number;
  reasons: string[];
  detectedRisks: Array<'nudity' | 'drugs' | 'guns' | 'knives'>;
  provider: 'gemini' | 'aws-rekognition';
};

function getModerationProvider(): 'gemini' | 'aws' {
  const value = String(process.env.AI_MODERATION_PROVIDER || 'gemini')
    .trim()
    .toLowerCase();
  return value === 'aws' ? 'aws' : 'gemini';
}

export async function moderateListing(input: {
  title: string;
  description: string;
  category: string;
  imageUrls?: string[];
  videoUrls?: string[];
}): Promise<ListingModerationDecision> {
  const provider = getModerationProvider();
  const imageUrls = (input.imageUrls || []).filter(Boolean);
  const videoUrls = (input.videoUrls || []).filter(Boolean);

  if (provider === 'aws') {
    const awsResult = await moderateMediaWithRekognition({
      imageUrls,
      videoUrls,
    });
    const requiresManualReview = !awsResult.safe;
    return {
      shouldAutoApprove: !requiresManualReview,
      requiresManualReview,
      confidence: awsResult.confidence,
      reasons: awsResult.reasons.length > 0 ? awsResult.reasons : ['AWS moderation completed'],
      detectedRisks: awsResult.detectedRisks,
      provider: 'aws-rekognition',
    };
  }

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

  const decision = await moderateListingWithGemini(input);
  return {
    shouldAutoApprove: decision.shouldAutoApprove,
    requiresManualReview: decision.requiresManualReview,
    confidence: decision.confidence,
    reasons: decision.reasons,
    detectedRisks: decision.detectedRisks,
    provider: 'gemini',
  };
}
