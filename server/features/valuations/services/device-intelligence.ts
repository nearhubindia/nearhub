/** Normalized device evidence consumed by valuation services. */
export type DeviceIntelligence = {
  brand: string;
  model: string;
  ram: number;
  storage: number;
  processor: 'entry' | 'mid' | 'upperMid' | 'flagship';
  androidVersion?: string;
  manufacturer?: string;
  cpuArchitecture?: string;
  detectedStorage?: number;
};

export function normalizeDeviceIntelligence(input: DeviceIntelligence): DeviceIntelligence {
  return {
    ...input,
    brand: input.brand.trim(),
    model: input.model.trim(),
    androidVersion: input.androidVersion?.trim() || '',
    manufacturer: input.manufacturer?.trim() || '',
    cpuArchitecture: input.cpuArchitecture?.trim() || '',
  };
}
