import { NativeModules, Platform } from 'react-native';
import type { MobileDeviceMaster } from '@/lib/mobile-device-master';

export type DisplayCapabilities = {
  supportedModes: { width: number; height: number; refreshRate: number }[];
  densityDpi: number;
  hdr: boolean | null;
  hdrTypes: string[];
  wideColorGamut: boolean | null;
};

export type DisplayAssessment = {
  status: 'matches' | 'partial' | 'mismatch' | 'unavailable';
  label: string;
  details: string[];
  authenticity: 'unverified';
};

export async function readDisplayCapabilities(): Promise<DisplayCapabilities | null> {
  if (Platform.OS !== 'android') return null;
  const module = NativeModules.NearHubDisplayCapabilities as
    | { getCapabilities: () => Promise<DisplayCapabilities> }
    | undefined;
  if (!module?.getCapabilities) return null;
  try {
    return await module.getCapabilities();
  } catch {
    return null;
  }
}

function expectedResolution(value?: string): [number, number] | null {
  const dimensions = value?.match(/(\d+)\D+(\d+)/);
  return dimensions ? [Number(dimensions[1]), Number(dimensions[2])] : null;
}

export function compareDisplayCapabilities(
  device: MobileDeviceMaster | undefined,
  measured: DisplayCapabilities | null
): DisplayAssessment {
  if (!measured)
    return {
      status: 'unavailable',
      label: 'Display test unavailable',
      details: [],
      authenticity: 'unverified',
    };
  if (!device)
    return {
      status: 'unavailable',
      label: 'OEM display profile unavailable',
      details: [],
      authenticity: 'unverified',
    };

  const checks: { matches: boolean; text: string }[] = [];
  const resolution = expectedResolution(device.displayResolution);
  if (resolution) {
    const matches = measured.supportedModes.some(
      (mode) =>
        (mode.width === resolution[0] && mode.height === resolution[1]) ||
        (mode.width === resolution[1] && mode.height === resolution[0])
    );
    checks.push({
      matches,
      text: `Resolution ${matches ? 'matches' : 'differs from'} ${resolution[0]}×${resolution[1]}`,
    });
  }
  if (device.refreshRateHz) {
    const matches = measured.supportedModes.some(
      (mode) => Math.abs(mode.refreshRate - device.refreshRateHz!) <= 1
    );
    checks.push({
      matches,
      text: `${device.refreshRateHz} Hz mode ${matches ? 'detected' : 'not detected'}`,
    });
  }
  if (typeof device.hdr === 'boolean' && measured.hdr !== null) {
    const matches = measured.hdr === device.hdr;
    checks.push({
      matches,
      text: `HDR ${matches ? 'matches expected profile' : 'differs from expected profile'}`,
    });
  }
  if (typeof device.wideColorGamut === 'boolean' && measured.wideColorGamut !== null) {
    const matches = measured.wideColorGamut === device.wideColorGamut;
    checks.push({
      matches,
      text: `Wide colour gamut ${matches ? 'matches expected profile' : 'differs from expected profile'}`,
    });
  }

  if (!checks.length)
    return {
      status: 'unavailable',
      label: 'OEM display profile incomplete',
      details: [],
      authenticity: 'unverified',
    };
  const passed = checks.filter((check) => check.matches).length;
  const status = passed === checks.length ? 'matches' : passed === 0 ? 'mismatch' : 'partial';
  const label =
    status === 'matches'
      ? 'Matches expected display specifications'
      : status === 'partial'
        ? 'Partially matches expected specifications'
        : 'Does not match expected display specifications';
  return { status, label, details: checks.map((check) => check.text), authenticity: 'unverified' };
}
