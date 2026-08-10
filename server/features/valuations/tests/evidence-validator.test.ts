import { describe, expect, it } from 'vitest';
import {
  validateMarketEvidence,
  type MarketEvidenceForValidation,
} from '../services/evidence-validator';

const now = new Date('2026-01-10T00:00:00.000Z');

type EvidenceOverrides = Omit<Partial<MarketEvidenceForValidation>, 'pricesInr'> & {
  pricesInr?: readonly number[];
};

function evidence(overrides: EvidenceOverrides = {}) {
  const defaults = {
    capturedAt: new Date('2026-01-08T00:00:00.000Z'),
    expiresAt: new Date('2026-01-20T00:00:00.000Z'),
    observationCount: 5,
    evidenceQuality: 'high' as const,
    pricesInr: [100, 105, 110, 95, 100],
    sourceCount: 3,
    regionMatched: true,
    variantMatched: true,
  };
  return {
    ...defaults,
    ...overrides,
    pricesInr: [...(overrides.pricesInr ?? defaults.pricesInr)],
  };
}

describe('market evidence validation', () => {
  it('accepts fresh, diverse, matched evidence and calculates freshness/variance', () => {
    const result = validateMarketEvidence(evidence(), now);
    expect(result.accepted).toBe(true);
    expect(result.reason).toBe('accepted');
    expect(result.freshnessDays).toBe(2);
    expect(result.coefficientOfVariation).not.toBeNull();
  });

  it.each([
    ['stale', { expiresAt: new Date('2026-01-01') }],
    ['variant_mismatch', { variantMatched: false }],
    ['region_mismatch', { regionMatched: false }],
    ['insufficient_observations', { observationCount: 2 }],
    ['low_quality', { evidenceQuality: 'low' as const }],
    ['insufficient_source_diversity', { sourceCount: 1 }],
    ['high_variance', { pricesInr: [1, 1000, 1, 1000] }],
  ] as const)('rejects evidence for %s', (reason, overrides) => {
    expect(validateMarketEvidence(evidence(overrides), now)).toMatchObject({
      accepted: false,
      reason,
    });
  });

  it('handles a single observation without a variance value', () => {
    expect(
      validateMarketEvidence(evidence({ pricesInr: [100], observationCount: 1 }), now)
    ).toMatchObject({
      coefficientOfVariation: null,
      reason: 'insufficient_observations',
    });
  });
});
