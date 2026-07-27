export type PricingFactors = {
  benchmark: number;
  age: number;
  software: number;
  processor: number;
  battery: number;
  condition: number;
  demand: number;
};

/** Pure, auditable pricing calculation. AI must not call or alter this function. */
export function calculateDeterministicPrice(factors: PricingFactors): number {
  return Math.round(
    factors.benchmark * factors.age * factors.software * factors.processor * factors.battery * factors.condition * factors.demand
  );
}
