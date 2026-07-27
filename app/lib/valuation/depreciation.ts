export const MOBILE_DEPRECIATION = {
  age: { monthlyDepreciation: 0.025, minimumResidualFactor: 0.28 },
  battery: {
    adjustments: [
      { minimum: 95, multiplier: 1 },
      { minimum: 80, multiplier: 0.95 },
      { minimum: 60, multiplier: 0.88 },
      { minimum: 40, multiplier: 0.78 },
      { minimum: 0, multiplier: 0.65 },
    ],
  },
} as const;
