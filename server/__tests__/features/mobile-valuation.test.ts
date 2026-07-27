import {
  calculateAcquisitionAnalysis,
  calculateMobileValuationBaseline,
  mobileValuationInputSchema,
  validateAndNormalizeMobileAge,
} from '../../features/valuations/services/mobile-valuation';

const validInput = {
  brand: 'Samsung',
  model: 'Galaxy S23',
  ram: 8,
  storage: 128,
  processor: 'flagship' as const,
  ageMonths: 24,
  ageSource: 'user_reported' as const,
  battery: 88,
  batteryReplacementCost: 1500,
  screenCondition: 'Intact' as const,
  bodyDefect: 'None' as const,
  androidVersion: '14',
  manufacturer: 'Samsung',
  cpuArchitecture: 'arm64-v8a',
};

describe('mobile valuation engine', () => {
  it('validates bounded device input', () => {
    expect(mobileValuationInputSchema.safeParse(validInput).success).toBe(true);
    expect(mobileValuationInputSchema.safeParse({ ...validInput, battery: 150 }).success).toBe(
      false
    );
    expect(mobileValuationInputSchema.safeParse({ ...validInput, model: '' }).success).toBe(false);
  });

  it('reduces the baseline for material damage', () => {
    const intact = calculateMobileValuationBaseline(validInput);
    const damaged = calculateMobileValuationBaseline({
      ...validInput,
      screenCondition: 'Broken',
      bodyDefect: 'Dents',
    });

    expect(intact.centre).toBeGreaterThan(damaged.centre);
    expect(intact.conditionScore).toBeGreaterThan(damaged.conditionScore);
  });

  it('reduces the baseline as age and battery condition worsen', () => {
    const recent = calculateMobileValuationBaseline(validInput);
    const older = calculateMobileValuationBaseline({ ...validInput, ageMonths: 60, battery: 55 });

    expect(recent.centre).toBeGreaterThan(older.centre);
    expect(recent.batteryScore).toBeGreaterThan(older.batteryScore);
  });

  it('does not value a 32-month model like an 11-year-old model', () => {
    const modelFrom2023 = calculateMobileValuationBaseline({ ...validInput, ageMonths: 32 });
    const elevenYearsOld = calculateMobileValuationBaseline({ ...validInput, ageMonths: 132 });

    expect(modelFrom2023.ageFactor).toBeCloseTo(0.559, 2);
    expect(elevenYearsOld.ageFactor).toBeCloseTo(0.12, 2);
    expect(modelFrom2023.centre).toBeGreaterThan(elevenYearsOld.centre * 4);
  });

  it('replaces an impossible age with the known model release age', () => {
    const result = validateAndNormalizeMobileAge(
      { ...validInput, brand: 'Redmi', model: '23124RN87C', ageMonths: 132 },
      new Date('2026-07-27T00:00:00Z')
    );

    expect(result.input.ageMonths).toBe(32);
    expect(result.ageBasis).toBe('model_release');
    expect(result.flags[0]).toContain('132 months');
  });

  it('does not present an unknown age as a verified device age', () => {
    const result = validateAndNormalizeMobileAge({
      ...validInput,
      ageMonths: 0,
      ageSource: 'unknown',
    });

    expect(result.input.ageMonths).toBe(24);
    expect(result.ageBasis).toBe('unknown');
    expect(result.flags).toHaveLength(1);
  });

  it('rejects a purchase that loses money after required battery refurbishment', () => {
    const input = mobileValuationInputSchema.parse({
      ...validInput,
      battery: 70,
      proposedPurchasePrice: 4000,
      batteryReplacementCost: 1500,
    });
    const result = calculateAcquisitionAnalysis(input, 4400, 0.88);

    expect(result.conservativeResaleValue).toBe(4500);
    expect(result.totalLandedCost).toBe(6100);
    expect(result.projectedProfit).toBe(-1600);
    expect(result.decision).toBe('REJECT');
    expect(result.maximumRecommendedPurchasePrice).toBe(1725);
  });

  it('does not charge for battery replacement when health passes the threshold', () => {
    const input = mobileValuationInputSchema.parse({
      ...validInput,
      proposedPurchasePrice: 3900,
    });
    const result = calculateAcquisitionAnalysis(input, 6000, 0.95);

    expect(result.batteryReplacementRequired).toBe(false);
    expect(result.batteryReplacementCost).toBe(0);
    expect(result.decision).toBe('BUY');
  });
});
