export const MOBILE_MARKET_RULES = {
  softwareSupport: {
    supported: { label: 'Supported', multiplier: 1, score: 100 },
    limited: { label: 'Limited support', multiplier: 0.9, score: 75 },
    legacy: { label: 'Legacy', multiplier: 0.75, score: 40 },
    eos: { label: 'End of Support', multiplier: 0.65, score: 20 },
    eol: { label: 'End of Life', multiplier: 0.55, score: 5 },
    unknown: { label: 'Unknown', multiplier: 0.85, score: 50 },
  },
  brandDemand: {
    apple: { multiplier: 1.15, popularity: 98 },
    samsung: { multiplier: 1.05, popularity: 95 },
    google: { multiplier: 1, popularity: 82 },
    motorola: { multiplier: 0.95, popularity: 70 },
    lg: { multiplier: 0.85, popularity: 58 },
    default: { multiplier: 1, popularity: 70 },
  },
  usability: {
    androidPenaltyPerVersion: 6,
    unsupportedAppsPenalty: 20,
    securityPenalty: 15,
    batteryPenalty: 15,
  },
  rating: { excellent: 90, good: 75, fair: 60, poor: 40 },
  confidence: { aiDetection: 40, userInput: 20, imeiVerified: 20, physicalInspection: 20 },
} as const;
