import {
  calculateMobileValuationBaseline,
  mobileValuationInputSchema,
} from '../../features/valuations/services/mobile-valuation';

const validInput = {
  brand: 'Samsung',
  model: 'Galaxy S23',
  ram: 8,
  storage: 128,
  processor: 'flagship' as const,
  ageMonths: 24,
  battery: 88,
  screenCondition: 'Intact' as const,
  bodyDefect: 'None' as const,
  androidVersion: '14',
  manufacturer: 'Samsung',
  cpuArchitecture: 'arm64-v8a',
};

describe('mobile valuation engine', () => {
  it('validates bounded device input', () => {
    expect(mobileValuationInputSchema.safeParse(validInput).success).toBe(true);
    expect(mobileValuationInputSchema.safeParse({ ...validInput, battery: 150 }).success).toBe(false);
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
});
