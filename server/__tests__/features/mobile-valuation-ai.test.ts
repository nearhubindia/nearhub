jest.mock('../../shared/ai/genai-client', () => ({
  getGoogleGenAIClient: jest.fn(() => ({
    models: {
      generateContent: jest.fn(async () => ({
        text: JSON.stringify({
          resolvedBrand: 'OnePlus',
          resolvedModel: 'OnePlus 13',
          releaseDate: '2025-01-10',
          marketMedianInr: 42000,
          marketLowInr: 38000,
          marketHighInr: 46000,
          currentNewPriceInr: 52999,
          evidenceQuality: 'high',
          adjustmentPercent: 0,
          confidence: 92,
          flags: [],
          rationale: 'Resolved from the Android build model and current Indian market sources.',
        }),
        candidates: [{ groundingMetadata: { groundingChunks: [
          { web: { title: 'Retail source', uri: 'https://example.com/new' } },
          { web: { title: 'Used source', uri: 'https://example.com/used' } },
        ] } }],
      })),
    },
  })),
  isGoogleGenAIConfigured: jest.fn(() => true),
}));

import { db } from '../../data/db';
import {
  calculateMobileValuationBaseline,
  createMobileValuation,
  getAiReview,
  getFreshAiKnowledge,
  mobileValuationInputSchema,
} from '../../features/valuations/services/mobile-valuation';

const input = mobileValuationInputSchema.parse({
  brand: 'OnePlus',
  model: 'CPH2645',
  buildModel: 'CPH2645',
  ram: 12,
  storage: 256,
  processor: 'flagship',
  ageMonths: 24,
  ageSource: 'unknown',
  battery: 90,
  screenCondition: 'Intact',
  bodyDefect: 'None',
  androidVersion: '15',
  manufacturer: 'OnePlus',
  cpuArchitecture: 'arm64-v8a',
});

describe('AI mobile valuation integration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves model identity and grounded market prices from Gemini', async () => {
    const review = await getAiReview(input, calculateMobileValuationBaseline(input), {
      count: 0,
      median: null,
      minimum: null,
      maximum: null,
    });

    expect(review.used).toBe(true);
    expect(review.resolvedModel).toBe('OnePlus 13');
    expect(review.releaseDate).toBe('2025-01-10');
    expect(review.currentNewPrice).toBe(52999);
    expect(review.marketMedian).toBe(42000);
    expect(review.sources).toHaveLength(2);
  });

  it('reuses only a fresh stored AI result', async () => {
    jest.spyOn(db, 'execute').mockResolvedValue({
      rows: [{
        brand: 'OnePlus', model: 'OnePlus 13', release_date: '2025-01-10',
        confidence: 90, market_median_inr: 42000, market_low_inr: 38000,
        market_high_inr: 46000, current_new_price_inr: 52999,
        evidence_quality: 'high', source_urls: [],
      }],
    } as any);

    const cached = await getFreshAiKnowledge(input);
    expect(cached?.model).toBe('stored-gemini-result');
    expect(cached?.marketMedian).toBe(42000);
    expect(cached?.flags[0]).toContain('last month');
  });

  it('uses Gemini release date in the final report age and identity', async () => {
    jest.spyOn(db, 'execute')
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValue({ rows: [] } as any);

    const report = await createMobileValuation(input);
    expect(report.model).toBe('OnePlus 13');
    expect(report.ageBasis).toBe('model_release');
    expect(report.verifiedReleaseDate).toBe('2025-01-10');
    expect(report.validation.resolvedModel).toBe('OnePlus 13');
    expect(report.validation.currentNewPrice).toBe(52999);
  });
});
