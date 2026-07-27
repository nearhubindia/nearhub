export type MobileDeviceMaster = {
  brand: string;
  model: string;
  modelNumber?: string;
  codename?: string;
  aliases?: string[];
  announcedDate: string;
  releaseDate: string;
  discontinued: boolean;
  launchPriceInr?: number;
  launchAndroid?: string;
  latestOfficialAndroid?: string;
  latestSecurityPatchYear?: number;
  chipset?: string;
  cpu?: string;
  gpu?: string;
  ramOptionsGb?: number[];
  storageOptionsGb?: number[];
  batteryCapacityMah?: number;
  display?: string;
  displayResolution?: string;
  refreshRateHz?: number;
  fingerprintSensor?: boolean;
  faceUnlock?: boolean;
  nfc?: boolean;
  wirelessCharging?: boolean;
  fiveG?: boolean;
  manufacturerSupportEnded: boolean;
  popularityScore?: number;
  collectorDevice?: boolean;
  demandMultiplier?: number;
};

// Immutable model metadata. Expand this catalog as supported devices are added.
export const MOBILE_DEVICE_MASTER: MobileDeviceMaster[] = [
  {
    brand: 'LG',
    model: 'Nexus 5',
    modelNumber: 'D820',
    codename: 'hammerhead',
    aliases: ['LG D820', 'LG D821', 'Google Nexus 5', 'Nexus5'],
    announcedDate: '2013-10-31',
    releaseDate: '2013-10-31',
    discontinued: true,
    launchPriceInr: 22324,
    launchAndroid: '4.4 KitKat',
    latestOfficialAndroid: '6.0.1',
    latestSecurityPatchYear: 2016,
    chipset: 'Qualcomm Snapdragon 800',
    cpu: 'Quad-core 2.26 GHz Krait 400',
    gpu: 'Adreno 330',
    ramOptionsGb: [2],
    storageOptionsGb: [16, 32],
    batteryCapacityMah: 2300,
    display: '4.95-inch IPS LCD',
    displayResolution: '1920 × 1080',
    refreshRateHz: 60,
    fingerprintSensor: false,
    faceUnlock: false,
    nfc: true,
    wirelessCharging: true,
    fiveG: false,
    manufacturerSupportEnded: true,
    popularityScore: 70,
    collectorDevice: true,
    demandMultiplier: 0.92,
  },
];

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function findMobileDeviceMaster(
  brand: string,
  model: string
): MobileDeviceMaster | undefined {
  return MOBILE_DEVICE_MASTER.find((device) => {
    const brandMatches = normalize(device.brand) === normalize(brand);
    const modelCandidates = [device.model, ...(device.aliases || [])].map(normalize);
    return brandMatches && modelCandidates.includes(normalize(model));
  });
}
