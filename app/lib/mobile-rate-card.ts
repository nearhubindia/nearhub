/**
 * Mobile Valuation Rate Card
 *
 * Centralized valuation constants used by the pricing engine.
 * This file is intentionally versioned so it can later be replaced
 * by an Admin-configurable or API-driven rate card without changing
 * the valuation algorithm.
 */

export const MOBILE_RATE_CARD = Object.freeze({
  id: 'mobile-rate-card',
  version: '2026.07',
  algorithm: 'weighted-v1',
  assetType: 'mobile',
  currency: 'INR',

  effectiveFrom: '2026-07-01',
  validityDays: 30,

  /**
   * Base value before hardware adjustments.
   */
  baseValue: 3500,

  /**
   * Processor valuation.
   */
  processor: {
    entry: {
      label: 'Entry level',
      score: 10,
      price: 1800,
    },
    mid: {
      label: 'Mid range',
      score: 18,
      price: 3240,
    },
    upperMid: {
      label: 'Upper mid range',
      score: 26,
      price: 4680,
    },
    flagship: {
      label: 'Flagship',
      score: 34,
      price: 6120,
    },
  },

  /**
   * RAM contribution.
   */
  ram: {
    scorePerGb: 2.4,
    pricePerGb: 650,
  },

  /**
   * Storage contribution.
   */
  storage: {
    scorePerGb: 4,
    pricePerGb: 18,
  },

  /**
   * Cosmetic condition.
   */
  condition: {
    likeNew: {
      label: 'Like new',
      score: 20,
      multiplier: 1.0,
    },
    good: {
      label: 'Good',
      score: 15,
      multiplier: 0.88,
    },
    fair: {
      label: 'Fair',
      score: 9,
      multiplier: 0.72,
    },
    needsRepair: {
      label: 'Needs repair',
      score: 3,
      multiplier: 0.48,
    },
  },

  /**
   * Battery health contribution.
   */
  battery: {
    scorePerPercent: 0.12,
    priceMultiplierDivisor: 500,
    valueAdjustments: [
      { minimum: 95, adjustment: 0 },
      { minimum: 80, adjustment: -0.05 },
      { minimum: 60, adjustment: -0.12 },
      { minimum: 40, adjustment: -0.22 },
      { minimum: 0, adjustment: -0.35 },
    ],
  },

  /**
   * Age depreciation.
   */
  age: {
    scorePenaltyPerMonth: 0.7,
    monthlyDepreciation: 0.025,
    minimumResidualFactor: 0.28,
  },
  softwareSupport: {
    Supported: 0,
    'Limited support': -0.15,
    Legacy: -0.25,
    'End of Support': -0.35,
    'End of Life (EOL)': -0.45,
    Unknown: -0.2,
  },
  demand: {
    apple: 1.15,
    samsung: 1.05,
    google: 1,
    motorola: 0.95,
    lg: 0.85,
    default: 1,
  },

  /**
   * Neutral fair-market band: 20% total width (±10% around the estimate).
   */
  valuationBand: {
    lowerMultiplier: 0.9,
    upperMultiplier: 1.1,
  },

  /**
   * Overall score limits.
   */
  score: {
    minimum: 0,
    maximum: 100,
  },
} as const);

export type MobileRateCard = typeof MOBILE_RATE_CARD;

export type MobileProcessor = keyof typeof MOBILE_RATE_CARD.processor;

export type MobileCondition = keyof typeof MOBILE_RATE_CARD.condition;
