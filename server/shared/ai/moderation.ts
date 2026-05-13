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

type TextRisk = 'nudity' | 'drugs' | 'guns' | 'knives';

const TEXT_RISK_RULES: Array<{ risk: TextRisk; pattern: RegExp; reason: string }> = [
  { risk: 'drugs', pattern: /\b(drug|cocaine|heroin|ganja|weed|marijuana|mdma|ecstasy|lsd)\b/i, reason: 'Text indicates drugs-related content' },
  { risk: 'guns', pattern: /\b(gun|pistol|revolver|rifle|shotgun|firearm|ammo|ammunition)\b/i, reason: 'Text indicates firearms-related content' },
  { risk: 'knives', pattern: /\b(knife|dagger|machete|switchblade|sword)\b/i, reason: 'Text indicates edged-weapon content' },
  { risk: 'nudity', pattern: /\b(nude|nudity|explicit|porn|sexual|escort)\b/i, reason: 'Text indicates sexual/adult content' },
];

function analyzeTextRisk(title: string, description: string): {
  hasRisk: boolean;
  detectedRisks: TextRisk[];
  reasons: string[];
} {
  const content = `${title || ''}\n${description || ''}`.trim();
  if (!content) {
    return { hasRisk: false, detectedRisks: [], reasons: [] };
  }

  const detected = new Set<TextRisk>();
  const reasons: string[] = [];
  for (const rule of TEXT_RISK_RULES) {
    if (rule.pattern.test(content)) {
      detected.add(rule.risk);
      reasons.push(rule.reason);
    }
  }

  // Fallback keyword scan to avoid edge-cases in regex matching across runtimes.
  const lowered = content.toLowerCase();
  if (
    ['drug', 'drugs', 'cocaine', 'heroin', 'ganja', 'weed', 'marijuana', 'mdma', 'ecstasy', 'lsd'].some((term) =>
      lowered.includes(term)
    )
  ) {
    detected.add('drugs');
    if (!reasons.includes('Text indicates drugs-related content')) {
      reasons.push('Text indicates drugs-related content');
    }
  }
  if (
    ['gun', 'guns', 'handgun', 'pistol', 'revolver', 'rifle', 'shotgun', 'firearm', 'ammo', 'ammunition'].some((term) =>
      lowered.includes(term)
    )
  ) {
    detected.add('guns');
    if (!reasons.includes('Text indicates firearms-related content')) {
      reasons.push('Text indicates firearms-related content');
    }
  }

  return {
    hasRisk: detected.size > 0,
    detectedRisks: Array.from(detected),
    reasons,
  };
}

export async function moderateListing(input: {
  title: string;
  description: string;
  category: string;
  imageUrls?: string[];
  videoUrls?: string[];
}): Promise<ListingModerationDecision> {
  const provider = getModerationProvider();
  const textRisk = analyzeTextRisk(input.title, input.description);
  const imageUrls = (input.imageUrls || []).filter(Boolean);
  const videoUrls = (input.videoUrls || []).filter(Boolean);

  if (provider === 'aws') {
    const awsResult = await moderateMediaWithRekognition({
      imageUrls,
      videoUrls,
    });
    const combinedDetectedRisks = Array.from(new Set([...awsResult.detectedRisks, ...textRisk.detectedRisks]));
    const combinedReasons = [...awsResult.reasons, ...textRisk.reasons];
    const requiresManualReview = !awsResult.safe || textRisk.hasRisk;
    return {
      shouldAutoApprove: !requiresManualReview,
      requiresManualReview,
      confidence: awsResult.confidence,
      reasons: combinedReasons.length > 0 ? combinedReasons : ['AWS moderation completed'],
      detectedRisks: combinedDetectedRisks,
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
  const combinedDetectedRisks = Array.from(
    new Set([...decision.detectedRisks, ...textRisk.detectedRisks])
  );
  const combinedReasons = [...decision.reasons, ...textRisk.reasons];
  const requiresManualReview = decision.requiresManualReview || textRisk.hasRisk;
  return {
    shouldAutoApprove: !requiresManualReview,
    requiresManualReview,
    confidence: decision.confidence,
    reasons: combinedReasons,
    detectedRisks: combinedDetectedRisks,
    provider: 'gemini',
  };
}
