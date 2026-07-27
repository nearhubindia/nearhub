export type MarketEvidence = {
  median: number | null;
  low: number | null;
  high: number | null;
  sourceCount: number;
  evidenceQuality: 'none' | 'low' | 'medium' | 'high';
};

export const MARKET_EVIDENCE_MAX_AGE_DAYS = 30;

export function isMarketEvidenceFresh(capturedAt: Date, now = new Date()): boolean {
  return now.getTime() - capturedAt.getTime() <= MARKET_EVIDENCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export async function getFreshMarketEvidence(device: { brand: string; model: string; ram: number; storage: number }) {
  const result = await db.execute(sql`
    SELECT market_median, market_low, market_high, evidence_quality, sources, rationale
    FROM mobile_market_intelligence
    WHERE lower(brand) = lower(${device.brand}) AND lower(model) = lower(${device.model})
      AND ram = ${device.ram} AND storage = ${device.storage} AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `);
  const row: any = result.rows?.[0];
  if (!row) return null;
  return {
    median: row.market_median ? Number(row.market_median) : null,
    low: row.market_low ? Number(row.market_low) : null,
    high: row.market_high ? Number(row.market_high) : null,
    sourceCount: Array.isArray(row.sources) ? row.sources.length : 0,
    evidenceQuality: row.evidence_quality || 'low',
    sources: row.sources || [],
    rationale: row.rationale || '',
  };
}

export async function storeMarketEvidence(device: { brand: string; model: string; ram: number; storage: number }, evidence: any) {
  await db.execute(sql`
    INSERT INTO mobile_market_intelligence
      (brand, model, ram, storage, market_median, market_low, market_high, evidence_quality, sources, rationale, captured_at, expires_at)
    VALUES (${device.brand}, ${device.model}, ${device.ram}, ${device.storage}, ${evidence.median}, ${evidence.low}, ${evidence.high}, ${evidence.evidenceQuality}, ${JSON.stringify(evidence.sources || [])}::jsonb, ${evidence.rationale || ''}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')
    ON CONFLICT (brand, model, ram, storage) DO UPDATE SET
      market_median = EXCLUDED.market_median, market_low = EXCLUDED.market_low, market_high = EXCLUDED.market_high,
      evidence_quality = EXCLUDED.evidence_quality, sources = EXCLUDED.sources, rationale = EXCLUDED.rationale,
      captured_at = CURRENT_TIMESTAMP, expires_at = EXCLUDED.expires_at
  `);
}

/** Contract for market evidence. Collection remains outside the pricing engine. */
export interface MarketIntelligenceService {
  getEvidence(device: { brand: string; model: string; ram: number; storage: number }): Promise<MarketEvidence>;
}
import { sql } from 'drizzle-orm';
import { db } from '../../../data/db';
