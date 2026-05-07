import { NativeModules, Platform } from 'react-native';

type InstallReferrerModuleType = {
  getInstallReferrer: () => Promise<string | null>;
};

function getNativeInstallReferrerModule(): InstallReferrerModuleType | null {
  if (Platform.OS !== 'android') return null;
  const module = (NativeModules as any)?.NearHubInstallReferrer;
  if (!module || typeof module.getInstallReferrer !== 'function') return null;
  return module as InstallReferrerModuleType;
}

export async function getInstallReferrer(): Promise<string | null> {
  const module = getNativeInstallReferrerModule();
  if (!module) return null;

  try {
    const value = await module.getInstallReferrer();
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  } catch (error) {
    console.warn('[InstallReferrer] Failed to fetch install referrer:', error);
    return null;
  }
}
