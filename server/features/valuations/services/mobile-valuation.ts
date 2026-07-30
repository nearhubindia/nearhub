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
  buildModel: z.string().trim().max(120).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  usageHoursLast30Days: z.coerce.number().min(0).max(744).optional(),
  batteryCycleCount: z.coerce.number().int().min(0).max(5000).optional(),
});

export type MobileValuationInput = z.infer<typeof mobileValuationInputSchema>;
type AgeBasis = 'model_release' | 'user_reported' | 'unknown';

const MODEL_RELEASES = [
  {
    brands: ['xiaomi', 'redmi', 'poco'],
    models: ['23124rn87c', 'redmi13c', 'pococ65'],
    releaseDate: '2023-11-10',
  },
  ...[
    ['oneplus 3', '2016-06-15'], ['oneplus 3t', '2016-11-22'],
    ['oneplus 5', '2017-06-22'], ['oneplus 5t', '2017-11-21'],
    ['oneplus 6', '2018-05-21'], ['oneplus 6t', '2018-11-01'],
    ['oneplus 7', '2019-06-04'], ['oneplus 7 pro', '2019-05-17'],
    ['oneplus 7t', '2019-09-28'], ['oneplus 7t pro', '2019-10-12'],
    ['oneplus 8', '2020-04-29'], ['oneplus 8 pro', '2020-04-29'],
    ['oneplus 8t', '2020-10-16'], ['oneplus 9', '2021-03-23'],
    ['oneplus 9 pro', '2021-03-23'], ['oneplus 9r', '2021-04-14'],
    ['oneplus 10 pro', '2022-03-31'], ['oneplus 10r', '2022-05-04'],
    ['oneplus 10t', '2022-08-06'], ['oneplus 11', '2023-02-07'],
    ['oneplus 11r', '2023-02-07'], ['oneplus 12', '2024-01-30'],
    ['oneplus 12r', '2024-02-06'], ['oneplus 13', '2025-01-10'],
    ['oneplus 13r', '2025-01-10'], ['oneplus nord', '2020-08-04'],
    ['cph2645', '2025-01-10'], ['cph2647', '2025-01-10'], ['cph2691', '2025-01-10'],
    ['cph2465', '2023-04-04'], ['cph2467', '2023-04-04'],
    ['oneplus nord 2', '2021-07-28'], ['oneplus nord 2t', '2022-07-05'],
    ['oneplus nord ce', '2021-06-16'], ['oneplus nord ce 2', '2022-04-22'],
    ['oneplus nord ce 3', '2023-08-04'], ['oneplus nord ce 3 lite', '2023-04-04'],
    ['oneplus nord 3', '2023-07-15'], ['oneplus nord ce 4', '2024-04-04'],
    ['oneplus nord 4', '2024-08-08'], ['oneplus nord 5', '2025-07-08'],
    ['oneplus nord ce 5', '2025-07-08'],
  ].map(([model, releaseDate]) => ({
    brands: ['oneplus'],
    models: [model.replace(/ /g, '')],
    releaseDate,
  })),
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
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
  const diagnosticFlags = [
    input.usageHoursLast30Days !== undefined
      ? `Android reported ${Math.round(input.usageHoursLast30Days * 10) / 10} active usage hours in the last 30 days.`
      : null,
    input.batteryCycleCount !== undefined
      ? `Android reported ${input.batteryCycleCount} battery cycles.`
      : null,
  ].filter((flag): flag is string => Boolean(flag));
  if (input.purchaseDate) {
    const purchase = new Date(`${input.purchaseDate}T00:00:00Z`);
    if (!Number.isNaN(purchase.getTime()) && purchase <= now) {
      const purchaseAge = monthsSince(input.purchaseDate, now);
      return {
        input: { ...input, ageMonths: purchaseAge, ageSource: 'user_reported' },
        ageBasis: 'user_reported',
        verifiedReleaseDate: null,
        flags: ['Purchase date was captured as ownership age; usage and condition drive unit wear.', ...diagnosticFlags],
      };
    }
  }
  const knownModel = MODEL_RELEASES.find(
    (candidate) =>
      new Date(`${candidate.releaseDate}T00:00:00Z`) >= fiveYearsAgo &&
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
      flags: [...flags, ...diagnosticFlags],
    };
  }
  if (input.ageSource === 'unknown') {
    // A neutral 24-month assumption avoids pretending an unverified age is a fact.
    return {
      input: { ...input, ageMonths: 24 },
      ageBasis: 'unknown',
      verifiedReleaseDate: null,
      flags: [
        'Device age is unknown; a neutral age assumption was used for valuation only.',
        ...diagnosticFlags,
      ],
    };
  }
  return {
    input: { ...input, ageSource: 'user_reported' },
    ageBasis: 'user_reported',
    verifiedReleaseDate: null,
    flags: diagnosticFlags,
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
  resolvedBrand: string | null;
  resolvedModel: string | null;
  releaseDate: string | null;
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
  resolvedBrand: null,
  resolvedModel: null,
  releaseDate: null,
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

function normalizeUsedMarketEvidence(review: AiReview, input: MobileValuationInput): AiReview {
  if (!review.currentNewPrice || !review.marketMedian) return review;

  // Use the customer's ownership age when available. Release date identifies
  // the model, but does not prove how long this particular unit was used.
  const ageMonths = input.ageMonths;
  const maximumRatio =
    ageMonths < 12 ? 0.8 : ageMonths < 24 ? 0.7 : ageMonths < 36 ? 0.6 : ageMonths < 48 ? 0.5 : 0.4;
  const ceiling = Math.round(review.currentNewPrice * maximumRatio);
  const marketMedian = Math.min(review.marketMedian, ceiling);
  const marketLow = review.marketLow === null ? null : Math.min(review.marketLow, marketMedian);
  const marketHigh = review.marketHigh === null
    ? null
    : Math.max(marketMedian, Math.min(review.marketHigh, ceiling));

  if (
    marketMedian === review.marketMedian &&
    marketLow === review.marketLow &&
    marketHigh === review.marketHigh
  ) {
    return review;
  }

  return {
    ...review,
    marketMedian,
    marketLow,
    marketHigh,
    flags: [
      ...review.flags,
      `Used-market values capped at ${maximumRatio * 100}% of current-new price for device age (${ageMonths} months).`,
    ].slice(0, 5),
  };
}

function usageWearMultiplier(input: MobileValuationInput): number {
  const usage = input.usageHoursLast30Days === undefined
    ? 1
    : input.usageHoursLast30Days <= 60
      ? 1.02
      : input.usageHoursLast30Days <= 180
        ? 1
        : input.usageHoursLast30Days <= 360
          ? 0.97
          : 0.93;
  const cycles = input.batteryCycleCount === undefined
    ? 1
    : input.batteryCycleCount <= 300
      ? 1
      : input.batteryCycleCount <= 600
        ? 0.97
        : input.batteryCycleCount <= 1000
          ? 0.93
          : 0.88;
  return usage * cycles;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function extractGroundedSources(response: unknown): MarketSource[] {
  const chunks = (response as any)?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
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
    usageWearMultiplier(input) *
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

export async function getAiReview(
  input: MobileValuationInput,
  baseline: ReturnType<typeof calculateMobileValuationBaseline>,
  comparables: ComparableSummary
): Promise<AiReview> {
  if (!isGoogleGenAIConfigured())
    return unavailableAiReview(
      'AI provider unavailable',
      'Rules-based fallback used; live market search was unavailable.'
    );
  const prompt = `You are NearHub's used-mobile market validator in India. First resolve the exact consumer model from the supplied readable model and Android build model. Then use Google Search now to find (1) current model-specific used or refurbished asking prices and (2) the current new retail price, when this exact configuration is still sold, all in INR. Prefer recently updated reputable Indian resale, refurbishment and retail marketplaces. Match model number, RAM and storage. Exclude launch MSRP unless it is also the current selling price, accessories, exchange bonuses, EMI amounts, unrelated models and obvious outliers. Never invent a price or source. If fewer than two useful used-price observations exist, return null used market values and evidenceQuality "low". A discontinued or unavailable new device must have currentNewPriceInr null. Return ONLY valid JSON with no markdown: {"resolvedBrand":"string|null","resolvedModel":"string|null","releaseDate":"YYYY-MM-DD|null","marketMedianInr":number|null,"marketLowInr":number|null,"marketHighInr":number|null,"currentNewPriceInr":number|null,"evidenceQuality":"low|medium|high","adjustmentPercent":number,"confidence":number,"flags":["short flag"],"rationale":"one sentence describing the resolved model and searched new and used market evidence"}. confidence must be 0-100.\nSearch date: ${new Date().toISOString().slice(0, 10)}\nDevice input: ${JSON.stringify(input)}\nDeterministic estimate INR: ${Math.round(baseline.centre)}\nNearHub comparable summary: ${JSON.stringify(comparables)}`;
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
    if (!parsed.resolvedModel || !/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.releaseDate || ''))) {
      // Gemini may return market evidence while omitting identity fields. Ask
      // once more with a deliberately narrow schema before using unknown age.
      const identityResponse = await withTimeout(
        callGeminiWithRetry(
          'Gemini device identity resolution',
          () =>
            ai.models.generateContent({
              model: AI_MODEL,
              contents: [{
                role: 'user',
                parts: [{
                  text: `Identify this exact phone from its manufacturer, readable model and Android build model. Use reliable web sources if needed. Return ONLY valid JSON: {"resolvedBrand":"string|null","resolvedModel":"string|null","releaseDate":"YYYY-MM-DD|null"}. Never guess a release date. Device: ${JSON.stringify({ brand: input.brand, model: input.model, buildModel: input.buildModel, manufacturer: input.manufacturer })}`,
                }],
              }],
              config: { tools: [{ googleSearch: {} }] },
            }),
          { attempts: 2 }
        ),
        30000,
        'Gemini device identity resolution'
      );
      const identityMatch = extractTextFromGeminiResponse(identityResponse).match(/\{[\s\S]*\}/);
      const identity = identityMatch ? JSON.parse(identityMatch[0]) : null;
      if (identity) {
        parsed.resolvedBrand ||= identity.resolvedBrand;
        parsed.resolvedModel ||= identity.resolvedModel;
        parsed.releaseDate ||= identity.releaseDate;
      }
    }
    let sources = extractGroundedSources(response);
    const price = (value: unknown) => {
      const parsedPrice = Number(value);
      return Number.isFinite(parsedPrice) && parsedPrice >= 100 && parsedPrice <= 500000
        ? Math.round(parsedPrice)
        : null;
    };
    let marketMedian = price(parsed.marketMedianInr);
    let marketLow = price(parsed.marketLowInr);
    let marketHigh = price(parsed.marketHighInr);

    // Gemini sometimes finds used listings but only describes them in its
    // rationale. Make a focused second pass that requires structured used
    // observation before rendering or storing market prices.
    if (!marketMedian || sources.length < 1) {
      try {
        const evidenceResponse = await withTimeout(
          callGeminiWithRetry(
            'Gemini used-market evidence extraction',
            () =>
              ai.models.generateContent({
                model: AI_MODEL,
                contents: [{
                  role: 'user',
                  parts: [{
                text: `Find a current Indian used or refurbished asking price for this exact phone and configuration from one reputable source. Do not substitute another RAM/storage variant. Return ONLY valid JSON: {"observations":[{"priceInr":0,"sourceHint":"short source name"}],"marketMedianInr":0,"marketLowInr":0,"marketHighInr":0}. Include only a real asking price from the search results. Never put prices only in prose. Device: ${JSON.stringify({ brand: parsed.resolvedBrand || input.brand, model: parsed.resolvedModel || input.model, buildModel: input.buildModel, ram: input.ram, storage: input.storage })}`,
                  }],
                }],
                config: { tools: [{ googleSearch: {} }] },
              }),
            { attempts: 2 }
          ),
          45000,
          'Gemini used-market evidence extraction'
        );
        const evidenceMatch = extractTextFromGeminiResponse(evidenceResponse).match(/\{[\s\S]*\}/);
        const evidence = evidenceMatch ? JSON.parse(evidenceMatch[0]) : null;
        const evidenceSources = extractGroundedSources(evidenceResponse);
        if (evidenceSources.length > sources.length) sources = evidenceSources;
        const observations = Array.isArray(evidence?.observations)
          ? evidence.observations.map((item: any) => price(item?.priceInr)).filter(Boolean)
          : [];
        if (observations.length >= 1) {
          marketMedian = price(evidence.marketMedianInr) || median(observations);
          marketLow = price(evidence.marketLowInr) || Math.min(...observations);
          marketHigh = price(evidence.marketHighInr) || Math.max(...observations);
        }
      } catch (error) {
        console.warn('[MobileValuation] Used-market evidence extraction failed:', error);
      }
    }
    const requestedQuality = ['low', 'medium', 'high'].includes(parsed.evidenceQuality)
      ? parsed.evidenceQuality
      : 'low';
    const evidenceQuality =
      sources.length < 1 ? 'low' : (requestedQuality as 'low' | 'medium' | 'high');
    if (sources.length < 1 && !marketMedian) {
      marketMedian = null;
      marketLow = null;
      marketHigh = null;
    }
    return {
      used: true,
      adjustmentPercent: Math.max(-5, Math.min(5, Number(parsed.adjustmentPercent) || 0)),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 5).map(String) : [],
      rationale: String(parsed.rationale || 'Grounded market validation completed.').slice(0, 400),
      model: AI_MODEL,
      resolvedBrand: parsed.resolvedBrand ? String(parsed.resolvedBrand).slice(0, 80) : null,
      resolvedModel: parsed.resolvedModel ? String(parsed.resolvedModel).slice(0, 120) : null,
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.releaseDate || '')) ? parsed.releaseDate : null,
      marketMedian,
      marketLow: marketMedian ? marketLow : null,
      marketHigh: marketMedian ? marketHigh : null,
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

export async function storeAiKnowledge(input: MobileValuationInput, ai: AiReview): Promise<void> {
  if (!ai.used || !ai.resolvedBrand || !ai.resolvedModel) return;
  try {
    await db.execute(sql`
      INSERT INTO mobile_ai_knowledge (
        brand, model, build_model, ram_gb, storage_gb, release_date,
        current_new_price_inr, market_low_inr, market_median_inr, market_high_inr,
        evidence_quality, confidence, source_urls, last_updated, expires_at
      ) VALUES (
        ${ai.resolvedBrand}, ${ai.resolvedModel}, ${input.buildModel || ''},
        ${input.ram}, ${input.storage}, ${ai.releaseDate},
        ${ai.currentNewPrice}, ${ai.marketLow}, ${ai.marketMedian}, ${ai.marketHigh},
        ${ai.evidenceQuality}, ${ai.confidence}, ${JSON.stringify(ai.sources)}::jsonb,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month'
      )
      ON CONFLICT (brand, model, build_model, ram_gb, storage_gb) DO UPDATE SET
        release_date = EXCLUDED.release_date,
        current_new_price_inr = EXCLUDED.current_new_price_inr,
        market_low_inr = EXCLUDED.market_low_inr,
        market_median_inr = EXCLUDED.market_median_inr,
        market_high_inr = EXCLUDED.market_high_inr,
        evidence_quality = EXCLUDED.evidence_quality,
        confidence = EXCLUDED.confidence,
        source_urls = EXCLUDED.source_urls,
        last_updated = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
    `);
  } catch (error) {
    console.warn('[MobileValuation] Could not store AI knowledge:', error);
  }
}

export async function getFreshAiKnowledge(input: MobileValuationInput): Promise<AiReview | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM mobile_ai_knowledge
      WHERE (lower(brand) = lower(${input.brand}) OR lower(brand) = lower(${input.manufacturer || ''}))
        AND (lower(model) = lower(${input.model}) OR build_model = ${input.model} OR build_model = ${input.buildModel || ''})
        AND ram_gb = ${input.ram}
        AND storage_gb = ${input.storage}
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_updated DESC LIMIT 1
    `);
    const row: any = result.rows?.[0];
    if (!row) return null;
    return {
      used: true,
      resolvedBrand: String(row.brand),
      resolvedModel: String(row.model),
      releaseDate: row.release_date ? String(row.release_date).slice(0, 10) : null,
      adjustmentPercent: 0,
      confidence: Number(row.confidence) || 0,
      flags: ['Reused market intelligence updated within the last month.'],
      rationale: 'Market intelligence was reused because it is less than one month old.',
      model: 'stored-gemini-result',
      marketMedian: row.market_median_inr ? Number(row.market_median_inr) : null,
      marketLow: row.market_low_inr ? Number(row.market_low_inr) : null,
      marketHigh: row.market_high_inr ? Number(row.market_high_inr) : null,
      currentNewPrice: row.current_new_price_inr ? Number(row.current_new_price_inr) : null,
      evidenceQuality: row.evidence_quality || 'low',
      sources: Array.isArray(row.source_urls) ? row.source_urls : [],
    };
  } catch (error) {
    console.warn('[MobileValuation] Could not read AI knowledge:', error);
    return null;
  }
}

export async function createMobileValuation(input: MobileValuationInput, userId?: string | null) {
  let ageValidation = validateAndNormalizeMobileAge(input);
  input = ageValidation.input;
  let baseline = calculateMobileValuationBaseline(input);
  // External market intelligence is the benchmark source. NearHub's own
  // listings are intentionally excluded because the sample is too small.
  const comparables: ComparableSummary = {
    count: 0,
    median: null,
    minimum: null,
    maximum: null,
  };
  const ai = normalizeUsedMarketEvidence(
    (await getFreshAiKnowledge(input)) || (await getAiReview(input, baseline, comparables)),
    input
  );
  if (ai.model !== 'stored-gemini-result') await storeAiKnowledge(input, ai);
  if (ai.releaseDate && !input.purchaseDate) {
    const resolvedAge = monthsSince(ai.releaseDate, new Date());
    input = {
      ...input,
      brand: ai.resolvedBrand || input.brand,
      model: ai.resolvedModel || input.model,
      ageMonths: resolvedAge,
      ageSource: 'model_release',
    };
    ageValidation = {
      input,
      ageBasis: 'model_release',
      verifiedReleaseDate: ai.releaseDate,
      flags: [
        ...ageValidation.flags,
      ],
    };
    baseline = calculateMobileValuationBaseline(input);
  } else if (ai.releaseDate) {
    ageValidation = {
      ...ageValidation,
      verifiedReleaseDate: ai.releaseDate,
    };
  }
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
      ai.marketMedian * baseline.conditionMultiplier * usageWearMultiplier(input) * liquidityFactor - batteryReserve
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
    buildModel: input.buildModel,
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
    purchaseDate: input.purchaseDate,
    ownershipAgeMonths: input.purchaseDate ? monthsSince(input.purchaseDate, now) : undefined,
    usageHoursLast30Days: input.usageHoursLast30Days,
    batteryCycleCount: input.batteryCycleCount,
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
      resolvedBrand: ai.resolvedBrand,
      resolvedModel: ai.resolvedModel,
      resolvedReleaseDate: ai.releaseDate,
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
