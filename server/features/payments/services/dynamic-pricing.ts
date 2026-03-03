/**
 * Dynamic Pricing Service
 * AI-based pricing that adjusts subscription costs based on demand and supply
 */

import { getAdminSettings } from '../../admin/services/admin-settings';

export type ListingType = 'image' | 'video';

export interface DemandSupplyMetrics {
  totalActiveListings: number; // Current active listings in category
  newListingsLast7Days: number; // New listings in past week
  viewsPerListing: number; // Average views per listing
  conversionRate: number; // % of views that lead to contact
  seasonalityFactor: number; // 0.5-2.0 multiplier for time of year
  categoryDemandScore: number; // 0-100 based on search volume
}

export interface DynamicPriceResult {
  basePrice: number; // Current base price
  dynamicPrice: number; // AI-calculated price
  minPrice: number; // Admin-set minimum
  maxPrice: number; // Admin-set maximum
  adjustmentPercent: number; // % change from base
  factors: {
    demandScore: number; // 0-100
    supplyScore: number; // 0-100
    competitionScore: number; // 0-100
    seasonalityMultiplier: number;
  };
  recommendation: string; // Human-readable explanation
}

/**
 * Calculate dynamic pricing based on demand and supply
 */
export async function calculateDynamicPrice(
  listingType: ListingType,
  metrics: DemandSupplyMetrics
): Promise<DynamicPriceResult> {
  const settings = await getAdminSettings();

  // Get base price and constraints
  const basePrice =
    listingType === 'image'
      ? parseFloat(settings.imageFeePerDay ?? '99')
      : parseFloat(settings.videoFeePerDay ?? '149');

  const minPrice =
    listingType === 'image'
      ? parseFloat(settings.imageMinPricePerDay ?? '49')
      : parseFloat(settings.videoMinPricePerDay ?? '79');

  const maxPrice =
    listingType === 'image'
      ? parseFloat(settings.imageMaxPricePerDay ?? '199')
      : parseFloat(settings.videoMaxPricePerDay ?? '299');

  // Check if dynamic pricing is enabled
  if (!settings.enableDynamicPricing) {
    return {
      basePrice,
      dynamicPrice: basePrice,
      minPrice,
      maxPrice,
      adjustmentPercent: 0,
      factors: {
        demandScore: 50,
        supplyScore: 50,
        competitionScore: 50,
        seasonalityMultiplier: 1.0,
      },
      recommendation: 'Dynamic pricing is disabled. Using base price.',
    };
  }

  // Calculate demand score (0-100)
  const demandScore = calculateDemandScore(metrics);

  // Calculate supply score (0-100) - inverse of supply
  const supplyScore = calculateSupplyScore(metrics);

  // Calculate competition score (0-100)
  const competitionScore = calculateCompetitionScore(metrics);

  // Apply algorithm based on settings
  const algorithm = settings.dynamicPricingAlgorithm ?? 'demand_supply';
  let dynamicPrice = basePrice;

  switch (algorithm) {
    case 'demand_supply':
      dynamicPrice = applyDemandSupplyAlgorithm(
        basePrice,
        demandScore,
        supplyScore,
        competitionScore,
        metrics.seasonalityFactor
      );
      break;
    case 'ml_based':
      // TODO: Implement ML-based pricing when we have training data
      dynamicPrice = basePrice;
      break;
    default:
      dynamicPrice = basePrice;
  }

  // Constrain to min/max bounds
  dynamicPrice = Math.max(minPrice, Math.min(maxPrice, dynamicPrice));

  // Round to nearest rupee
  dynamicPrice = Math.round(dynamicPrice);

  const adjustmentPercent = ((dynamicPrice - basePrice) / basePrice) * 100;

  const recommendation = generateRecommendation(
    adjustmentPercent,
    demandScore,
    supplyScore,
    competitionScore
  );

  return {
    basePrice,
    dynamicPrice,
    minPrice,
    maxPrice,
    adjustmentPercent: Math.round(adjustmentPercent),
    factors: {
      demandScore: Math.round(demandScore),
      supplyScore: Math.round(supplyScore),
      competitionScore: Math.round(competitionScore),
      seasonalityMultiplier: metrics.seasonalityFactor,
    },
    recommendation,
  };
}

/**
 * Calculate demand score based on metrics
 * High demand = high views, high conversion, high search volume
 */
function calculateDemandScore(metrics: DemandSupplyMetrics): number {
  const { viewsPerListing, conversionRate, categoryDemandScore, newListingsLast7Days } = metrics;

  // Normalize views (assume 100 views = good demand)
  const viewScore = Math.min(100, (viewsPerListing / 100) * 100);

  // Conversion rate score (assume 5% is excellent)
  const conversionScore = Math.min(100, (conversionRate / 5) * 100);

  // Category demand is already 0-100
  const categoryScore = categoryDemandScore;

  // Growth score - more new listings = more demand
  const growthScore = Math.min(100, (newListingsLast7Days / 50) * 100);

  // Weighted average
  return viewScore * 0.3 + conversionScore * 0.3 + categoryScore * 0.25 + growthScore * 0.15;
}

/**
 * Calculate supply score (inverse - high supply = low score)
 * More competition = lower prices
 */
function calculateSupplyScore(metrics: DemandSupplyMetrics): number {
  const { totalActiveListings } = metrics;

  // Normalize against optimal supply (assume 1000 listings is saturated)
  const saturationPoint = 1000;
  const saturationRatio = totalActiveListings / saturationPoint;

  // Inverse: more supply = lower score
  const supplyScore = Math.max(0, 100 - saturationRatio * 100);

  return supplyScore;
}

/**
 * Calculate competition score
 * High competition = need competitive pricing
 */
function calculateCompetitionScore(metrics: DemandSupplyMetrics): number {
  const { totalActiveListings, newListingsLast7Days } = metrics;

  // High growth = high competition
  const growthRate = totalActiveListings > 0 ? newListingsLast7Days / totalActiveListings : 0;

  // Competition score (0-100, where 100 = very competitive)
  const competitionScore = Math.min(100, growthRate * 1000);

  return competitionScore;
}

/**
 * Apply demand-supply pricing algorithm
 */
function applyDemandSupplyAlgorithm(
  basePrice: number,
  demandScore: number,
  supplyScore: number,
  competitionScore: number,
  seasonalityFactor: number
): number {
  // High demand + low supply = higher price
  // Low demand + high supply = lower price

  const demandSupplyRatio = demandScore / Math.max(1, 100 - supplyScore);

  // Adjustment factor: -50% to +100%
  let adjustmentFactor = 0;

  if (demandSupplyRatio > 1.5) {
    // Very high demand, raise price
    adjustmentFactor = 0.5; // +50%
  } else if (demandSupplyRatio > 1.2) {
    adjustmentFactor = 0.3; // +30%
  } else if (demandSupplyRatio > 0.8) {
    adjustmentFactor = 0; // No change
  } else if (demandSupplyRatio > 0.5) {
    adjustmentFactor = -0.2; // -20%
  } else {
    adjustmentFactor = -0.4; // -40%
  }

  // Apply competition factor (high competition = lower prices)
  if (competitionScore > 70) {
    adjustmentFactor -= 0.1;
  }

  // Apply seasonality
  const seasonalAdjustment = (seasonalityFactor - 1) * 0.5;
  adjustmentFactor += seasonalAdjustment;

  // Clamp to reasonable bounds
  adjustmentFactor = Math.max(-0.5, Math.min(1.0, adjustmentFactor));

  return basePrice * (1 + adjustmentFactor);
}

/**
 * Generate human-readable recommendation
 */
function generateRecommendation(
  adjustmentPercent: number,
  demandScore: number,
  supplyScore: number,
  competitionScore: number
): string {
  if (adjustmentPercent > 30) {
    return `🔥 High demand! Price increased ${Math.abs(adjustmentPercent)}% due to strong market demand and limited supply.`;
  } else if (adjustmentPercent > 10) {
    return `📈 Moderate increase of ${Math.abs(adjustmentPercent)}% based on current market conditions.`;
  } else if (adjustmentPercent > -10) {
    return `✅ Stable pricing. Market conditions are balanced.`;
  } else if (adjustmentPercent > -30) {
    return `📉 Price reduced ${Math.abs(adjustmentPercent)}% to stay competitive with high supply.`;
  } else {
    return `💰 Promotional pricing! ${Math.abs(adjustmentPercent)}% discount due to low demand or oversupply.`;
  }
}

/**
 * Get current demand/supply metrics for a category
 * This is a placeholder - in production, query from database/analytics
 */
export async function getDemandSupplyMetrics(
  category: string,
  listingType: ListingType
): Promise<DemandSupplyMetrics> {
  // TODO: Implement real analytics queries
  // For now, return mock data based on time and category

  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();

  // Peak hours: 6PM-10PM (higher demand)
  const isPeakHour = hour >= 18 && hour <= 22;

  // Festival season: Oct-Dec (India)
  const isFestivalSeason = month >= 9 && month <= 11;

  const seasonalityFactor = isFestivalSeason ? 1.3 : isPeakHour ? 1.1 : 1.0;

  // Mock metrics - replace with real data
  return {
    totalActiveListings: 450,
    newListingsLast7Days: 35,
    viewsPerListing: 85,
    conversionRate: 3.5,
    seasonalityFactor,
    categoryDemandScore: 65,
  };
}

/**
 * Batch calculate dynamic prices for multiple categories
 */
export async function calculateBatchDynamicPrices(
  categories: string[],
  listingType: ListingType
): Promise<Map<string, DynamicPriceResult>> {
  const results = new Map<string, DynamicPriceResult>();

  for (const category of categories) {
    const metrics = await getDemandSupplyMetrics(category, listingType);
    const price = await calculateDynamicPrice(listingType, metrics);
    results.set(category, price);
  }

  return results;
}
