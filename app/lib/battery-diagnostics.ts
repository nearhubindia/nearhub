import { NativeModules, Platform } from 'react-native';

export type BatteryDiagnostics = {
  androidRelease: string;
  androidApiLevel: number;
  securityPatch: string;
  buildFingerprint: string;
  deviceCodeName: string;
  productName: string;
  hardware: string;
  networkType: '2G' | '3G' | '4G' | '5G' | 'UNKNOWN';
  chargeLevel: number;
  health: string;
  healthPercent: number;
  temperatureC: number;
  voltageMv: number;
  batteryCycleCount: number;
  usageAccessGranted: boolean;
  usageHoursLast30Days: number;
};

export async function readBatteryDiagnostics(): Promise<BatteryDiagnostics | null> {
  if (Platform.OS !== 'android') return null;
  const module = NativeModules.NearHubBatteryDiagnostics as
    | {
        read: () => Promise<BatteryDiagnostics>;
        openUsageAccessSettings?: () => Promise<boolean>;
      }
    | undefined;
  if (!module?.read) return null;
  try {
    return await module.read();
  } catch {
    return null;
  }
}

export async function openUsageAccessSettings(): Promise<boolean> {
  const module = NativeModules.NearHubBatteryDiagnostics as
    | { openUsageAccessSettings?: () => Promise<boolean> }
    | undefined;
  if (!module?.openUsageAccessSettings) return false;
  try {
    return await module.openUsageAccessSettings();
  } catch {
    return false;
  }
}
