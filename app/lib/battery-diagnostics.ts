import { NativeModules, Platform } from 'react-native';

export type BatteryDiagnostics = {
  chargeLevel: number;
  health: string;
  healthPercent: number;
  temperatureC: number;
  voltageMv: number;
};

export async function readBatteryDiagnostics(): Promise<BatteryDiagnostics | null> {
  if (Platform.OS !== 'android') return null;
  const module = NativeModules.NearHubBatteryDiagnostics as
    | { read: () => Promise<BatteryDiagnostics> }
    | undefined;
  if (!module?.read) return null;
  try {
    return await module.read();
  } catch {
    return null;
  }
}
