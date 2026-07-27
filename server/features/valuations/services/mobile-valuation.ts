import { createHmac, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../data/db';
import { getGoogleGenAIClient, isGoogleGenAIConfigured } from '../../../shared/ai/genai-client';
import {
  callGeminiWithRetry,
  extractTextFromGeminiResponse,
  withTimeout,
} from '../../../shared/ai/genai-resilience';

const MODEL_VERSION = 'mobile-grounded-v3';
const AI_MODEL = process.env.GEMINI_VALUATION_MODEL || 'gemini-2.5-flash';
const VALIDITY_DAYS = 30;
const AGE_VALUE_FLOOR = 0.12;
const AGE_DECAY_MONTHS = 55;
const BATTERY_REFURBISHMENT_THRESHOLD = 75;

export const mobileValuationInputSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  ram: z.coerce.number().int().min(1).max(32),
  storage: z.coerce.number().int().min(8).max(2048),
  processor: z.enum(['entry', 'mid', 'upperMid', 'flagship']),
  ageMonths: z.coerce.number().int().min(0).max(240).optional().default(0),
  ageSource: z
    .enum(['model_release', 'user_reported', 'unknown'])
    .optional()
    .default('user_reported'),
  battery: z.coerce.number().min(1).max(100).optional().default(85),
  batteryHealthType: z.enum(['measured', 'estimated', 'unavailable']).optional(),
  proposedPurchasePrice: z.coerce.number().min(0).max(500000).optional(),
  batteryReplacementCost: z.coerce.number().min(0).max(50000).optional().default(1500),
  screenCondition: z.enum(['Intact', 'Minor scratches', 'Deep scratches', 'Cracked', 'Broken']),
  bodyDefect: z.enum(['None', 'Light scratches', 'Heavy scratches', 'Dents']),
  androidVersion: z.string().trim().max(80).optional().default(''),
  manufacturer: z.string().trim().max(80).optional().default(''),
  cpuArchitecture: z.string().trim().max(160).optional().default(''),
  detectedStorage: z.coerce.number().int().min(1).max(4096).optional(),
});

export type MobileValuationInput = z.infer<typeof mobileValuationInputSchema>;
type AgeBasis = 'model_release' | 'user_reported' | 'unknown';

const MODEL_RELEASES = [
  {
    brands: ['xiaomi', 'redmi', 'poco'],
    models: ['23124rn87c', 'redmi13c', 'pococ65'],
    releaseDate: '2023-11-10',
  },
] as const;

const normalizeDeviceText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function monthsSince(date: string, now: Date): number {
  const release = new Date(`${date}T00:00:00Z`);
  return Math.max(
    0,
    (now.getUTCFullYear() - release.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      release.getUTCMonth()
  );
}

export function validateAndNormalizeMobileAge(
  input: MobileValuationInput,
  now = new Date()
): {
  input: MobileValuationInput;
  ageBasis: AgeBasis;
  verifiedReleaseDate: string | null;
  flags: string[];
} {
  const brand = normalizeDeviceText(input.brand || input.manufacturer);
  const model = normalizeDeviceText(input.model);
  const knownModel = MODEL_RELEASES.find(
    (candidate) =>
      candidate.brands.includes(brand as never) && candidate.models.includes(model as never)
  );
  if (knownModel) {
    const modelAge = monthsSince(knownModel.releaseDate, now);
    const flags =
      Math.abs(input.ageMonths - modelAge) > 6
        ? [
            `Submitted age (${input.ageMonths} months) replaced with verified model age (${modelAge} months).`,
          ]
        : [];
    return {
      input: { ...input, ageMonths: modelAge, ageSource: 'model_release' },
      ageBasis: 'model_release',
      verifiedReleaseDate: knownModel.releaseDate,
      flags,
    };
  }
  if (input.ageSource === 'unknown') {
    // A neutral 24-month assumption avoids pretending an unverified age is a fact.
    return {
      input: { ...input, ageMonths: 24 },
      ageBasis: 'unknown',
      verifiedReleaseDate: null,
      flags: ['Device age is unknown; a neutral age assumption was used for valuation only.'],
    };
  }
  return {
    input: { ...input, ageSource: 'user_reported' },
    ageBasis: 'user_reported',
    verifiedReleaseDate: null,
    flags: [],
  };
}

type ComparableSummary = {
  count: number;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
};
type MarketSource = { title: string; uri: string };
type AiReview = {
  used: boolean;
  adjustmentPercent: number;
  confidence: number;
  flags: string[];
  rationale: string;
  model: string | null;
  marketMedian: number | null;
  marketLow: number | null;
  marketHigh: number | null;
  currentNewPrice: number | null;
  evidenceQuality: 'none' | 'low' | 'medium' | 'high';
  sources: MarketSource[];
};

const unavailableAiReview = (flag: string, rationale: string): AiReview => ({
  used: false,
  adjustmentPercent: 0,
  confidence: 0,
  flags: [flag],
  rationale,
  model: null,
  marketMedian: null,
  marketLow: null,
  marketHigh: null,
  currentNewPrice: null,
  evidenceQuality: 'none',
  sources: [],
});

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function getComparables(input: MobileValuationInput): Promise<ComparableSummary> {
  const terms = [input.brand, input.model].map((value) => `%${value.replace(/[%_]/g, '')}%`);
  try {
    const result = await db.execute(sql`
      SELECT price FROM listings
      WHERE is_active = true AND status = 'active' AND price > 0
        AND (title ILIKE ${terms[0]} OR title ILIKE ${terms[1]})
        AND (category ILIKE '%mobile%' OR category ILIKE '%phone%' OR sub_category ILIKE '%mobile%')
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '180 days'
      ORDER BY created_at DESC LIMIT 50
    `);
    const prices = (result.rows || [])
      .map((row: any) => Number(row.price))
      .filter((value) => Number.isFinite(value) && value > 0);
    return {
      count: prices.length,
      median: median(prices),
      minimum: prices.length ? Math.min(...prices) : null,
      maximum: prices.length ? Math.max(...prices) : null,
    };
  } catch (error) {
    console.warn('[MobileValuation] Comparable lookup failed:', error);
    return { count: 0, median: null, minimum: null, maximum: null };
  }
}

export function calculateMobileValuationBaseline(input: MobileValuationInput) {
  const processor = {
    entry: { price: 1800, score: 10 },
    mid: { price: 3240, score: 18 },
    upperMid: { price: 4680, score: 26 },
    flagship: { price: 6120, score: 34 },
  }[input.processor];
  const condition =
    input.screenCondition === 'Broken' || input.bodyDefect === 'Dents'
      ? { key: 'needsRepair', multiplier: 0.48 }
      : input.screenCondition === 'Cracked' || input.bodyDefect === 'Heavy scratches'
        ? { key: 'fair', multiplier: 0.72 }
        : input.screenCondition === 'Deep scratches' || input.bodyDefect === 'Light scratches'
          ? { key: 'good', multiplier: 0.88 }
          : { key: 'good', multiplier: 0.88 };
  const androidMajor = Number(input.androidVersion.match(/\d+/)?.[0] || 0);
  const software =
    androidMajor >= 14
      ? { status: 'Supported', multiplier: 1, score: 100 }
      : androidMajor >= 12
        ? { status: 'Limited support', multiplier: 0.9, score: 75 }
        : androidMajor >= 10
          ? { status: 'Legacy', multiplier: 0.75, score: 40 }
          : androidMajor >= 7
            ? { status: 'End of Support', multiplier: 0.65, score: 20 }
            : androidMajor > 0
              ? { status: 'End of Life (EOL)', multiplier: 0.55, score: 5 }
              : { status: 'Unknown', multiplier: 0.85, score: 50 };
  const batteryMultiplier =
    input.battery >= 95
      ? 1
      : input.battery >= 80
        ? 0.95
        : input.battery >= 60
          ? 0.88
          : input.battery >= 40
            ? 0.78
            : 0.65;
  // Gradual depreciation keeps a three-year-old phone materially distinct from
  // an obsolete device. The previous linear curve hit its floor after 29 months.
  const ageFactor = Math.max(AGE_VALUE_FLOOR, Math.exp(-input.ageMonths / AGE_DECAY_MONTHS));
  const brandKey = Object.keys({
    apple: 1.15,
    samsung: 1.05,
    google: 1,
    motorola: 0.95,
    lg: 0.85,
  }).find((key) => input.brand.toLowerCase().includes(key));
  const demandFactor =
    ({ apple: 1.15, samsung: 1.05, google: 1, motorola: 0.95, lg: 0.85 } as Record<string, number>)[
      brandKey || ''
    ] || 1;
  const hardwareValue = 3500 + input.ram * 650 + input.storage * 18 + processor.price;
  const centre =
    hardwareValue *
    condition.multiplier *
    ageFactor *
    batteryMultiplier *
    software.multiplier *
    demandFactor;
  const performanceScore = Math.min(
    100,
    Math.max(
      1,
      Math.round(35 + input.ram * 3 + processor.score * 1.4 + Math.log2(input.storage) * 3)
    )
  );
  const conditionScore = Math.round(condition.multiplier * 100);
  const marketValueScore = Math.min(
    100,
    Math.max(
      1,
      Math.round(
        performanceScore * 0.55 +
          conditionScore * 0.25 +
          Math.max(10, 100 - input.ageMonths * 0.7) * 0.2
      )
    )
  );
  const score = Math.min(
    100,
    Math.max(
      1,
      Math.round(
        marketValueScore * 0.15 +
          performanceScore * 0.25 +
          input.battery * 0.15 +
          software.score * 0.25 +
          conditionScore * 0.2
      )
    )
  );
  return {
    centre,
    hardwareValue,
    condition: condition.key,
    conditionMultiplier: condition.multiplier,
    conditionScore,
    ageFactor,
    batteryMultiplier,
    demandFactor,
    androidSupportStatus: software.status,
    softwareSupportScore: software.score,
    performanceScore,
    batteryScore: Math.round(input.battery),
    marketValueScore,
    usabilityScore: Math.round(
      software.score * 0.55 + input.battery * 0.25 + performanceScore * 0.2
    ),
    score,
  };
}

export type AcquisitionDecision = 'BUY' | 'NEGOTIATE' | 'REVIEW' | 'REJECT';

export function calculateAcquisitionAnalysis(
  input: MobileValuationInput,
  adjustedCentre: number,
  batteryMultiplier: number
) {
  const batteryReplacementRequired = input.battery <= BATTERY_REFURBISHMENT_THRESHOLD;
  const batteryReplacementCost = batteryReplacementRequired
    ? Math.round(input.batteryReplacementCost)
    : 0;
  // Restore the battery-related reduction to estimate resale after replacement.
  const postRefurbishmentCentre = batteryReplacementRequired
    ? adjustedCentre / batteryMultiplier
    : adjustedCentre;
  const conservativeResaleValue = Math.max(0, Math.round(postRefurbishmentCentre * 0.9));
  const operatingCost = 300;
  const warrantyReserve = 300;
  const targetProfit = Math.max(500, Math.round(conservativeResaleValue * 0.15));
  const nonPurchaseCosts = batteryReplacementCost + operatingCost + warrantyReserve;
  const breakEvenPurchasePrice = Math.max(0, conservativeResaleValue - nonPurchaseCosts);
  const maximumRecommendedPurchasePrice = Math.max(0, breakEvenPurchasePrice - targetProfit);
  const proposedPurchasePrice = input.proposedPurchasePrice;
  const projectedProfit =
    proposedPurchasePrice === undefined
      ? null
      : conservativeResaleValue - proposedPurchasePrice - nonPurchaseCosts;
  const projectedMarginPercent =
    projectedProfit === null || conservativeResaleValue <= 0
      ? null
      : Math.round((projectedProfit / conservativeResaleValue) * 1000) / 10;

  let decision: AcquisitionDecision = 'REVIEW';
  if (proposedPurchasePrice !== undefined) {
    decision =
      proposedPurchasePrice <= maximumRecommendedPurchasePrice
        ? 'BUY'
        : proposedPurchasePrice <= breakEvenPurchasePrice
          ? 'NEGOTIATE'
          : 'REJECT';
  }

  return {
    decision,
    proposedPurchasePrice: proposedPurchasePrice ?? null,
    conservativeResaleValue,
    batteryReplacementRequired,
    batteryReplacementCost,
    operatingCost,
    warrantyReserve,
    targetProfit,
    totalLandedCost:
      proposedPurchasePrice === undefined ? null : proposedPurchasePrice + nonPurchaseCosts,
    breakEvenPurchasePrice,
    maximumRecommendedPurchasePrice,
    projectedProfit,
    projectedMarginPercent,
  };
}

async function getAiReview(
  input: MobileValuationInput,
  baseline: ReturnType<typeof calculateMobileValuationBaseline>,
  comparables: ComparableSummary
): Promise<AiReview> {
  if (!isGoogleGenAIConfigured())
    return unavailableAiReview(
      'AI provider unavailable',
      'Rules-based fallback used; live market search was unavailable.'
    );
  const prompt = `You are NearHub's used-mobile market validator in India. Use Google Search now to find (1) current model-specific used or refurbished asking prices and (2) the current new retail price, when this exact configuration is still sold, all in INR. Prefer recently updated reputable Indian resale, refurbishment and retail marketplaces. Match model number, RAM and storage. Exclude launch MSRP unless it is also the current selling price, accessories, exchange bonuses, EMI amounts, unrelated models and obvious outliers. Never invent a price or source. If fewer than two useful used-price observations exist, return null used market values and evidenceQuality "low". A discontinued or unavailable new device must have currentNewPriceInr null. Review the deterministic estimate separately and limit the qualitative adjustment to -5 through +5 percent. Return ONLY valid JSON with no markdown: {"marketMedianInr":number|null,"marketLowInr":number|null,"marketHighInr":number|null,"currentNewPriceInr":number|null,"evidenceQuality":"low|medium|high","adjustmentPercent":number,"confidence":number,"flags":["short flag"],"rationale":"one sentence describing the searched new and used market evidence"}. confidence must be 0-100.\nSearch date: ${new Date().toISOString().slice(0, 10)}\nDevice input: ${JSON.stringify(input)}\nDeterministic estimate INR: ${Math.round(baseline.centre)}\nNearHub comparable summary: ${JSON.stringify(comparables)}`;
  try {
    const ai = getGoogleGenAIClient();
    const response = await withTimeout(
      callGeminiWithRetry(
        'Gemini grounded mobile valuation',
        () =>
          ai.models.generateContent({
            model: AI_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { tools: [{ googleSearch: {} }] },
          }),
        { attempts: 2 }
      ),
      45000,
      'Gemini grounded mobile valuation'
    );
    const match = extractTextFromGeminiResponse(response).match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    if (!parsed) throw new Error('AI response did not contain JSON');
    const chunks = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk: any) => chunk?.web)
      .filter((web: any) => web?.uri && web?.title)
      .map((web: any) => ({
        title: String(web.title).slice(0, 120),
        uri: String(web.uri).slice(0, 1000),
      }))
      .filter(
        (source: MarketSource, index: number, all: MarketSource[]) =>
          all.findIndex((item) => item.uri === source.uri) === index
      )
      .slice(0, 6);
    const price = (value: unknown) => {
      const parsedPrice = Number(value);
      return Number.isFinite(parsedPrice) && parsedPrice >= 100 && parsedPrice <= 500000
        ? Math.round(parsedPrice)
        : null;
    };
    const requestedQuality = ['low', 'medium', 'high'].includes(parsed.evidenceQuality)
      ? parsed.evidenceQuality
      : 'low';
    const evidenceQuality =
      sources.length < 2 ? 'low' : (requestedQuality as 'low' | 'medium' | 'high');
    const marketMedian = sources.length >= 2 ? price(parsed.marketMedianInr) : null;
    return {
      used: true,
      adjustmentPercent: Math.max(-5, Math.min(5, Number(parsed.adjustmentPercent) || 0)),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 5).map(String) : [],
      rationale: String(parsed.rationale || 'Grounded market validation completed.').slice(0, 400),
      model: AI_MODEL,
      marketMedian,
      marketLow: marketMedian ? price(parsed.marketLowInr) : null,
      marketHigh: marketMedian ? price(parsed.marketHighInr) : null,
      currentNewPrice: price(parsed.currentNewPriceInr),
      evidenceQuality,
      sources,
    };
  } catch (error) {
    console.warn('[MobileValuation] AI validation failed:', error);
    return unavailableAiReview(
      'AI market validation unavailable',
      'Rules-based fallback used; live market search was unavailable.'
    );
  }
}

export async function createMobileValuation(input: MobileValuationInput, userId?: string | null) {
  const ageValidation = validateAndNormalizeMobileAge(input);
  input = ageValidation.input;
  const baseline = calculateMobileValuationBaseline(input);
  // External market intelligence is the benchmark source. NearHub's own
  // listings are intentionally excluded because the sample is too small.
  const comparables: ComparableSummary = {
    count: 0,
    median: null,
    minimum: null,
    maximum: null,
  };
  const ai = await getAiReview(input, baseline, comparables);
  let adjustedCentre = baseline.centre;
  let pricingBasis: 'current_market' | 'estimated_market' = 'estimated_market';
  if (ai.marketMedian) {
    // A current-market benchmark already reflects age, hardware generation,
    // support status, and demand. Apply only condition/liquidity adjustments.
    pricingBasis = 'current_market';
    const liquidityFactor = 0.95;
    const batteryReserve = input.batteryHealthType === 'unavailable' ? 500 : 0;
    adjustedCentre = Math.max(
      0,
      ai.marketMedian * baseline.conditionMultiplier * liquidityFactor - batteryReserve
    );
  }
  // AI is evidence collection only. The deterministic pricing engine owns the
  // final calculation; never apply a free-form AI adjustment directly to price.
  const acquisition = calculateAcquisitionAnalysis(
    input,
    adjustedCentre,
    baseline.batteryMultiplier
  );
  const completeness =
    [
      input.brand,
      input.model,
      input.ram,
      input.storage,
      input.cpuArchitecture,
      input.androidVersion,
      input.battery,
    ].filter(Boolean).length / 7;
  const confidence = Math.round(
    Math.max(
      35,
      Math.min(
        98,
        42 +
          completeness * 23 +
          Math.min(comparables.count, 10) * 1.2 +
          Math.min(ai.sources.length, 5) * 2 +
          (ai.used ? ai.confidence * 0.13 : 0)
      )
    )
  );
  const now = new Date();
  const validUntil = new Date(now.getTime() + VALIDITY_DAYS * 86400000);
  const id = randomUUID();
  const reportId = `NH-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;
  const payload = {
    id,
    reportId,
    modelVersion: MODEL_VERSION,
    brand: input.brand,
    model: input.model,
    ram: input.ram,
    storage: input.storage,
    processor: input.processor,
    age: input.ageMonths,
    ageBasis: ageValidation.ageBasis,
    verifiedReleaseDate: ageValidation.verifiedReleaseDate,
    condition: baseline.condition,
    battery: input.battery,
    batteryHealthType: input.batteryHealthType || 'unavailable',
    androidVersion: input.androidVersion,
    manufacturer: input.manufacturer,
    cpuArchitecture: input.cpuArchitecture,
    detectedStorage: input.detectedStorage,
    score: baseline.score,
    confidence,
    marketValueScore: baseline.marketValueScore,
    usabilityScore: baseline.usabilityScore,
    performanceScore: baseline.performanceScore,
    batteryScore: baseline.batteryScore,
    softwareSupportScore: baseline.softwareSupportScore,
    androidSupportStatus: baseline.androidSupportStatus,
    demandFactor: baseline.demandFactor,
    low: adjustedCentre * 0.9,
    high: adjustedCentre * 1.1,
    recommendedSellingPrice: Math.round(adjustedCentre),
    pricingBasis,
    estimatedMarketValueInr: Math.round(adjustedCentre),
    recommendedCustomerPayoutInr: Math.round(adjustedCentre),
    acquisition,
    createdAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    validation: {
      status: ai.used ? 'ai_validated' : 'rules_fallback',
      provider: ai.used ? 'google_search' : 'none',
      model: ai.model,
      rationale: ai.rationale,
      flags: [...ageValidation.flags, ...ai.flags],
      adjustmentPercent: ai.adjustmentPercent,
      comparableCount: comparables.count,
      comparableMedian: comparables.median,
      marketMedian: ai.marketMedian,
      marketLow: ai.marketLow,
      marketHigh: ai.marketHigh,
      currentNewPrice: ai.currentNewPrice,
      evidenceQuality: ai.evidenceQuality,
      marketSources: ai.sources,
      searchedAt: ai.used ? now.toISOString() : null,
    },
  };
  const secret =
    process.env.VALUATION_REPORT_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    'nearhub-development-valuation-secret';
  const signature = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  await db.execute(
    sql`INSERT INTO mobile_valuation_reports (id, report_id, user_id, input_data, result_data, model_version, ai_provider, ai_model, ai_validated, confidence, signature, valid_until) VALUES (${id}, ${reportId}, ${userId || null}, ${JSON.stringify(input)}::jsonb, ${JSON.stringify(payload)}::jsonb, ${MODEL_VERSION}, ${ai.used ? 'google' : 'none'}, ${ai.model}, ${ai.used}, ${confidence}, ${signature}, ${validUntil})`
  );
  return { ...payload, signature };
}
