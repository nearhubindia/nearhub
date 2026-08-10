import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateBatchDynamicPrices,
  calculateDynamicPrice,
  getDemandSupplyMetrics,
} from '../services/dynamic-pricing';
import { getAdminSettings } from '../../admin/services/admin-settings';

vi.mock('../../admin/services/admin-settings', () => ({
  getAdminSettings: vi.fn(),
}));

const mockedGetAdminSettings = vi.mocked(getAdminSettings);

describe('dynamic pricing', () => {
  beforeEach(() => {
    mockedGetAdminSettings.mockResolvedValue({
      enableDynamicPricing: true,
      imageFeePerDay: '100',
      imageMinPricePerDay: '50',
      imageMaxPricePerDay: '200',
      videoFeePerDay: '150',
      videoMinPricePerDay: '80',
      videoMaxPricePerDay: '300',
      dynamicPricingAlgorithm: 'demand_supply',
    } as never);
  });

  it('returns base price when dynamic pricing is disabled', async () => {
    mockedGetAdminSettings.mockResolvedValueOnce({
      enableDynamicPricing: false,
      imageFeePerDay: '100',
      imageMinPricePerDay: '50',
      imageMaxPricePerDay: '200',
    } as never);
    await expect(
      calculateDynamicPrice('image', {
        totalActiveListings: 10,
        newListingsLast7Days: 1,
        viewsPerListing: 1,
        conversionRate: 1,
        seasonalityFactor: 1,
        categoryDemandScore: 1,
      })
    ).resolves.toMatchObject({ dynamicPrice: 100, adjustmentPercent: 0 });
  });

  it('calculates bounded image/video prices and batch results', async () => {
    const metrics = {
      totalActiveListings: 10,
      newListingsLast7Days: 50,
      viewsPerListing: 200,
      conversionRate: 5,
      seasonalityFactor: 1.3,
      categoryDemandScore: 100,
    };
    const result = await calculateDynamicPrice('image', metrics);
    expect(result.dynamicPrice).toBeGreaterThanOrEqual(result.minPrice);
    expect(result.dynamicPrice).toBeLessThanOrEqual(result.maxPrice);
    expect(result.factors).toMatchObject({ demandScore: 100, seasonalityMultiplier: 1.3 });
    expect(result.recommendation).toBeTruthy();
    const batch = await calculateBatchDynamicPrices(['Cars', 'Mobiles'], 'video');
    expect([...batch.keys()]).toEqual(['Cars', 'Mobiles']);
    expect((await getDemandSupplyMetrics('Cars', 'image')).totalActiveListings).toBe(450);
  });

  it('covers algorithm fallbacks, competition, and recommendation bands', async () => {
    const make = (overrides: Partial<Parameters<typeof calculateDynamicPrice>[1]>) => ({
      totalActiveListings: 500,
      newListingsLast7Days: 1,
      viewsPerListing: 50,
      conversionRate: 2.5,
      seasonalityFactor: 1,
      categoryDemandScore: 50,
      ...overrides,
    });
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({
            totalActiveListings: 1,
            viewsPerListing: 200,
            conversionRate: 10,
            categoryDemandScore: 100,
            newListingsLast7Days: 100,
          })
        )
      ).recommendation
    ).toContain('High demand');
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({
            totalActiveListings: 800,
            viewsPerListing: 200,
            conversionRate: 10,
            categoryDemandScore: 100,
            newListingsLast7Days: 50,
          })
        )
      ).recommendation
    ).toContain('Moderate increase');
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({
            totalActiveListings: 500,
            viewsPerListing: 50,
            conversionRate: 2.5,
            categoryDemandScore: 50,
            newListingsLast7Days: 1,
          })
        )
      ).recommendation
    ).toContain('Stable');
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({
            totalActiveListings: 500,
            viewsPerListing: 50,
            conversionRate: 1,
            categoryDemandScore: 20,
            newListingsLast7Days: 1,
          })
        )
      ).recommendation
    ).toContain('Price reduced');
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({
            totalActiveListings: 2000,
            viewsPerListing: 0,
            conversionRate: 0,
            categoryDemandScore: 0,
            newListingsLast7Days: 0,
          })
        )
      ).recommendation
    ).toContain('Promotional');
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({ totalActiveListings: 0, newListingsLast7Days: 0 })
        )
      ).factors.competitionScore
    ).toBe(0);
    expect(
      (
        await calculateDynamicPrice(
          'image',
          make({ totalActiveListings: 100, newListingsLast7Days: 100 })
        )
      ).factors.competitionScore
    ).toBe(100);
    mockedGetAdminSettings.mockResolvedValueOnce({
      enableDynamicPricing: true,
      imageFeePerDay: '100',
      imageMinPricePerDay: '50',
      imageMaxPricePerDay: '200',
      dynamicPricingAlgorithm: 'ml_based',
    } as never);
    expect((await calculateDynamicPrice('image', make({}))).dynamicPrice).toBe(100);
    mockedGetAdminSettings.mockResolvedValueOnce({
      enableDynamicPricing: true,
      imageFeePerDay: '100',
      imageMinPricePerDay: '50',
      imageMaxPricePerDay: '200',
      dynamicPricingAlgorithm: 'unknown',
    } as never);
    expect((await calculateDynamicPrice('image', make({}))).dynamicPrice).toBe(100);
  });
});
