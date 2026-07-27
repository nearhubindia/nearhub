import { createHmac, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../data/db';
import { getGoogleGenAIClient, isGoogleGenAIConfigured } from '../../../shared/ai/genai-client';
import { callGeminiWithRetry, extractTextFromGeminiResponse, withTimeout } from '../../../shared/ai/genai-resilience';

const MODEL_VERSION = 'mobile-hybrid-v1';
const AI_MODEL = process.env.GEMINI_VALUATION_MODEL || 'gemini-2.5-flash';
const VALIDITY_DAYS = 30;

export const mobileValuationInputSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  ram: z.coerce.number().int().min(1).max(32),
  storage: z.coerce.number().int().min(8).max(2048),
  processor: z.enum(['entry', 'mid', 'upperMid', 'flagship']),
  ageMonths: z.coerce.number().int().min(0).max(240),
  battery: z.coerce.number().min(1).max(100),
  screenCondition: z.enum(['Intact', 'Minor scratches', 'Deep scratches', 'Cracked', 'Broken']),
  bodyDefect: z.enum(['None', 'Light scratches', 'Heavy scratches', 'Dents']),
  androidVersion: z.string().trim().max(80).optional().default(''),
  manufacturer: z.string().trim().max(80).optional().default(''),
  cpuArchitecture: z.string().trim().max(160).optional().default(''),
  detectedStorage: z.coerce.number().int().min(1).max(4096).optional(),
});

export type MobileValuationInput = z.infer<typeof mobileValuationInputSchema>;

type ComparableSummary = { count: number; median: number | null; minimum: number | null; maximum: number | null };
type AiReview = { used: boolean; adjustmentPercent: number; confidence: number; flags: string[]; rationale: string; model: string | null };

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
    const prices = (result.rows || []).map((row: any) => Number(row.price)).filter((value) => Number.isFinite(value) && value > 0);
    return { count: prices.length, median: median(prices), minimum: prices.length ? Math.min(...prices) : null, maximum: prices.length ? Math.max(...prices) : null };
  } catch (error) {
    console.warn('[MobileValuation] Comparable lookup failed:', error);
    return { count: 0, median: null, minimum: null, maximum: null };
  }
}

export function calculateMobileValuationBaseline(input: MobileValuationInput) {
  const processor = { entry: { price: 1800, score: 10 }, mid: { price: 3240, score: 18 }, upperMid: { price: 4680, score: 26 }, flagship: { price: 6120, score: 34 } }[input.processor];
  const condition = input.screenCondition === 'Broken' || input.bodyDefect === 'Dents' ? { key: 'needsRepair', multiplier: 0.48 } : input.screenCondition === 'Cracked' || input.bodyDefect === 'Heavy scratches' ? { key: 'fair', multiplier: 0.72 } : input.screenCondition === 'Deep scratches' || input.bodyDefect === 'Light scratches' ? { key: 'good', multiplier: 0.88 } : { key: 'good', multiplier: 0.88 };
  const androidMajor = Number(input.androidVersion.match(/\d+/)?.[0] || 0);
  const software = androidMajor >= 14 ? { status: 'Supported', multiplier: 1, score: 100 } : androidMajor >= 12 ? { status: 'Limited support', multiplier: 0.9, score: 75 } : androidMajor >= 10 ? { status: 'Legacy', multiplier: 0.75, score: 40 } : androidMajor >= 7 ? { status: 'End of Support', multiplier: 0.65, score: 20 } : androidMajor > 0 ? { status: 'End of Life (EOL)', multiplier: 0.55, score: 5 } : { status: 'Unknown', multiplier: 0.85, score: 50 };
  const batteryMultiplier = input.battery >= 95 ? 1 : input.battery >= 80 ? 0.95 : input.battery >= 60 ? 0.88 : input.battery >= 40 ? 0.78 : 0.65;
  const ageFactor = Math.max(0.28, 1 - input.ageMonths * 0.025);
  const brandKey = Object.keys({ apple: 1.15, samsung: 1.05, google: 1, motorola: 0.95, lg: 0.85 }).find((key) => input.brand.toLowerCase().includes(key));
  const demandFactor = ({ apple: 1.15, samsung: 1.05, google: 1, motorola: 0.95, lg: 0.85 } as Record<string, number>)[brandKey || ''] || 1;
  const hardwareValue = 3500 + input.ram * 650 + input.storage * 18 + processor.price;
  const centre = hardwareValue * condition.multiplier * ageFactor * batteryMultiplier * software.multiplier * demandFactor;
  const performanceScore = Math.min(100, Math.max(1, Math.round(35 + input.ram * 3 + processor.score * 1.4 + Math.log2(input.storage) * 3)));
  const conditionScore = Math.round(condition.multiplier * 100);
  const marketValueScore = Math.min(100, Math.max(1, Math.round(performanceScore * 0.55 + conditionScore * 0.25 + Math.max(10, 100 - input.ageMonths * 0.7) * 0.2)));
  const score = Math.min(100, Math.max(1, Math.round(marketValueScore * 0.15 + performanceScore * 0.25 + input.battery * 0.15 + software.score * 0.25 + conditionScore * 0.2)));
  return { centre, hardwareValue, condition: condition.key, conditionScore, ageFactor, batteryMultiplier, demandFactor, androidSupportStatus: software.status, softwareSupportScore: software.score, performanceScore, batteryScore: Math.round(input.battery), marketValueScore, usabilityScore: Math.round(software.score * 0.55 + input.battery * 0.25 + performanceScore * 0.2), score };
}

async function getAiReview(input: MobileValuationInput, baseline: ReturnType<typeof calculateMobileValuationBaseline>, comparables: ComparableSummary): Promise<AiReview> {
  if (!isGoogleGenAIConfigured()) return { used: false, adjustmentPercent: 0, confidence: 0, flags: ['AI provider unavailable'], rationale: 'Rules-based fallback used.', model: null };
  const prompt = `You validate used-mobile valuations. Do not invent market facts. Review input consistency and the deterministic estimate. Comparable listings may be noisy asking prices. Recommend an adjustment only when evidence supports it, limited to -8 through +8 percent. Return ONLY JSON: {"adjustmentPercent":number,"confidence":number,"flags":["short flag"],"rationale":"one sentence"}. confidence must be 0-100.\nInput: ${JSON.stringify(input)}\nDeterministic estimate INR: ${Math.round(baseline.centre)}\nComparable summary: ${JSON.stringify(comparables)}`;
  try {
    const ai = getGoogleGenAIClient();
    const response = await withTimeout(callGeminiWithRetry('Gemini mobile valuation', () => ai.models.generateContent({ model: AI_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }] }), { attempts: 2 }), 45000, 'Gemini mobile valuation');
    const match = extractTextFromGeminiResponse(response).match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    if (!parsed) throw new Error('AI response did not contain JSON');
    return { used: true, adjustmentPercent: Math.max(-8, Math.min(8, Number(parsed.adjustmentPercent) || 0)), confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)), flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 5).map(String) : [], rationale: String(parsed.rationale || 'AI validation completed.').slice(0, 300), model: AI_MODEL };
  } catch (error) {
    console.warn('[MobileValuation] AI validation failed:', error);
    return { used: false, adjustmentPercent: 0, confidence: 0, flags: ['AI validation unavailable'], rationale: 'Rules-based fallback used.', model: null };
  }
}

export async function createMobileValuation(input: MobileValuationInput, userId?: string | null) {
  const baseline = calculateMobileValuationBaseline(input);
  const comparables = await getComparables(input);
  const ai = await getAiReview(input, baseline, comparables);
  const comparableAdjustment = comparables.median ? Math.max(-0.1, Math.min(0.1, (comparables.median - baseline.centre) / baseline.centre)) : 0;
  const adjustedCentre = baseline.centre * (1 + comparableAdjustment * 0.35) * (1 + ai.adjustmentPercent / 100);
  const completeness = [input.brand, input.model, input.ram, input.storage, input.cpuArchitecture, input.androidVersion, input.battery].filter(Boolean).length / 7;
  const confidence = Math.round(Math.max(35, Math.min(98, 45 + completeness * 25 + Math.min(comparables.count, 10) * 1.5 + (ai.used ? ai.confidence * 0.13 : 0))));
  const now = new Date();
  const validUntil = new Date(now.getTime() + VALIDITY_DAYS * 86400000);
  const id = randomUUID();
  const reportId = `NH-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;
  const payload = { id, reportId, modelVersion: MODEL_VERSION, brand: input.brand, model: input.model, ram: input.ram, storage: input.storage, processor: input.processor, age: input.ageMonths, condition: baseline.condition, battery: input.battery, androidVersion: input.androidVersion, manufacturer: input.manufacturer, cpuArchitecture: input.cpuArchitecture, detectedStorage: input.detectedStorage, score: baseline.score, confidence, marketValueScore: baseline.marketValueScore, usabilityScore: baseline.usabilityScore, performanceScore: baseline.performanceScore, batteryScore: baseline.batteryScore, softwareSupportScore: baseline.softwareSupportScore, androidSupportStatus: baseline.androidSupportStatus, demandFactor: baseline.demandFactor, low: adjustedCentre * 0.9, high: adjustedCentre * 1.1, createdAt: now.toISOString(), validUntil: validUntil.toISOString(), validation: { status: ai.used ? 'ai_validated' : 'rules_fallback', provider: ai.used ? 'google' : 'none', model: ai.model, rationale: ai.rationale, flags: ai.flags, adjustmentPercent: ai.adjustmentPercent, comparableCount: comparables.count, comparableMedian: comparables.median } };
  const secret = process.env.VALUATION_REPORT_SECRET || process.env.ADMIN_JWT_SECRET || 'nearhub-development-valuation-secret';
  const signature = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  await db.execute(sql`INSERT INTO mobile_valuation_reports (id, report_id, user_id, input_data, result_data, model_version, ai_provider, ai_model, ai_validated, confidence, signature, valid_until) VALUES (${id}, ${reportId}, ${userId || null}, ${JSON.stringify(input)}::jsonb, ${JSON.stringify(payload)}::jsonb, ${MODEL_VERSION}, ${ai.used ? 'google' : 'none'}, ${ai.model}, ${ai.used}, ${confidence}, ${signature}, ${validUntil})`);
  return { ...payload, signature };
}
