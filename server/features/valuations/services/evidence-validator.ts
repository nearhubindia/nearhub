export type EvidenceDecisionReason =
  | 'accepted'
  | 'stale'
  | 'insufficient_observations'
  | 'low_quality'
  | 'high_variance'
  | 'insufficient_source_diversity'
  | 'region_mismatch'
  | 'variant_mismatch';

export type EvidenceDecision = {
  accepted: boolean;
  reason: EvidenceDecisionReason;
  freshnessDays: number;
  observationCount: number;
  evidenceQuality: 'low' | 'medium' | 'high';
  coefficientOfVariation: number | null;
  sourceCount: number;
  regionMatched: boolean;
  variantMatched: boolean;
};

export type MarketEvidenceForValidation = {
  capturedAt: Date;
  expiresAt: Date;
  observationCount: number;
  evidenceQuality: 'low' | 'medium' | 'high';
  pricesInr: number[];
  sourceCount: number;
  regionMatched: boolean;
  variantMatched: boolean;
};

export function validateMarketEvidence(
  evidence: MarketEvidenceForValidation,
  now = new Date(),
): EvidenceDecision {
  const freshnessDays = Math.max(0, Math.floor((now.getTime() - evidence.capturedAt.getTime()) / 86400000));
  const mean = evidence.pricesInr.length
    ? evidence.pricesInr.reduce((sum, price) => sum + price, 0) / evidence.pricesInr.length
    : 0;
  const variance = mean > 0 && evidence.pricesInr.length > 1
    ? evidence.pricesInr.reduce((sum, price) => sum + (price - mean) ** 2, 0) / evidence.pricesInr.length
    : null;
  const coefficientOfVariation = variance === null ? null : Math.sqrt(variance) / mean;
  let reason: EvidenceDecisionReason = 'accepted';
  if (now > evidence.expiresAt) reason = 'stale';
  else if (!evidence.variantMatched) reason = 'variant_mismatch';
  else if (!evidence.regionMatched) reason = 'region_mismatch';
  else if (evidence.observationCount < 3) reason = 'insufficient_observations';
  else if (evidence.evidenceQuality === 'low') reason = 'low_quality';
  else if (evidence.sourceCount < 2) reason = 'insufficient_source_diversity';
  else if (coefficientOfVariation !== null && coefficientOfVariation > 0.35) reason = 'high_variance';
  return {
    accepted: reason === 'accepted',
    reason,
    freshnessDays,
    observationCount: evidence.observationCount,
    evidenceQuality: evidence.evidenceQuality,
    coefficientOfVariation,
    sourceCount: evidence.sourceCount,
    regionMatched: evidence.regionMatched,
    variantMatched: evidence.variantMatched,
  };
}
