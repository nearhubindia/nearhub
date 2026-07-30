export type MobileDeviceMaster = {
  brand: string;
  brandAliases?: string[];
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
  hdr?: boolean;
  wideColorGamut?: boolean;
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
const fiveYearsAgo = new Date();
fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

export const MOBILE_DEVICE_MASTER: MobileDeviceMaster[] = [
  ...[
    ['Samsung', 'Galaxy S24', '2024-01-31'], ['Samsung', 'Galaxy S23', '2023-02-17'],
    ['Samsung', 'Galaxy S22', '2022-03-04'], ['Samsung', 'Galaxy A55', '2024-03-11'],
    ['Samsung', 'Galaxy A54', '2023-03-24'], ['Samsung', 'Galaxy A34', '2023-03-24'],
    ['Apple', 'iPhone 15', '2023-09-22'], ['Apple', 'iPhone 14', '2022-09-16'],
    ['Apple', 'iPhone 13', '2021-09-24'], ['Apple', 'iPhone 12', '2020-10-30'],
    ['Xiaomi', 'Xiaomi 14', '2024-03-11'], ['Xiaomi', 'Xiaomi 13 Pro', '2023-02-26'],
    ['Redmi', 'Redmi Note 13 Pro+', '2024-01-15'], ['Redmi', 'Redmi Note 12 Pro+', '2023-01-11'],
    ['POCO', 'POCO F6', '2024-05-29'], ['POCO', 'POCO X6 Pro', '2024-01-11'],
    ['Realme', 'Realme GT 6', '2024-06-20'], ['Realme', 'Realme 12 Pro+', '2024-01-29'],
    ['Vivo', 'Vivo X100', '2024-01-04'], ['Vivo', 'Vivo V30', '2024-03-07'],
    ['OPPO', 'OPPO Find X8 Pro', '2024-11-21'], ['OPPO', 'OPPO Reno 12 Pro', '2024-07-18'],
    ['Motorola', 'Motorola Edge 50 Pro', '2024-04-09'], ['Motorola', 'Moto G85', '2024-07-10'],
    ['Nothing', 'Nothing Phone (2)', '2023-07-17'], ['Nothing', 'Nothing Phone (2a)', '2024-03-12'],
    ['Google', 'Pixel 8', '2023-10-12'], ['Google', 'Pixel 7a', '2023-05-11'],
    ['iQOO', 'iQOO 12', '2023-12-14'], ['iQOO', 'iQOO Neo 9 Pro', '2024-05-23'],
  ].map(([brand, model, releaseDate]) => ({
    brand,
    model,
    aliases: [model],
    announcedDate: releaseDate,
    releaseDate,
    discontinued: false,
    manufacturerSupportEnded: false,
  } as MobileDeviceMaster)),
  ...[
    ['OnePlus 3', '2016-06-15'],
    ['OnePlus 3T', '2016-11-22'],
    ['OnePlus 5', '2017-06-22'],
    ['OnePlus 5T', '2017-11-21'],
    ['OnePlus 6', '2018-05-21'],
    ['OnePlus 6T', '2018-11-01'],
    ['OnePlus 7', '2019-06-04'],
    ['OnePlus 7 Pro', '2019-05-17'],
    ['OnePlus 7T', '2019-09-28'],
    ['OnePlus 7T Pro', '2019-10-12'],
    ['OnePlus 8', '2020-04-29'],
    ['OnePlus 8 Pro', '2020-04-29'],
    ['OnePlus 8T', '2020-10-16'],
    ['OnePlus 9', '2021-03-23'],
    ['OnePlus 9 Pro', '2021-03-23'],
    ['OnePlus 9R', '2021-04-14'],
    ['OnePlus 10 Pro', '2022-03-31'],
    ['OnePlus 10R', '2022-05-04'],
    ['OnePlus 10T', '2022-08-06'],
    ['OnePlus 11R', '2023-02-07'],
    ['OnePlus 11', '2023-02-07'],
    ['OnePlus 12R', '2024-02-06'],
    ['OnePlus 12', '2024-01-30'],
    ['OnePlus 13R', '2025-01-10'],
    ['OnePlus 13', '2025-01-10'],
    ['OnePlus Nord', '2020-08-04'],
    ['OnePlus Nord N10 5G', '2020-11-26'],
    ['OnePlus Nord 2', '2021-07-28'],
    ['OnePlus Nord CE', '2021-06-16'],
    ['OnePlus Nord CE 2', '2022-04-22'],
    ['OnePlus Nord 2T', '2022-07-05'],
    ['OnePlus Nord CE 3 Lite', '2023-04-04'],
    ['OnePlus Nord CE 3', '2023-08-04'],
    ['OnePlus Nord 3', '2023-07-15'],
    ['OnePlus Nord CE 4', '2024-04-04'],
    ['OnePlus Nord 4', '2024-08-08'],
    ['OnePlus Nord CE 5', '2025-07-08'],
    ['OnePlus Nord 5', '2025-07-08'],
  ].map(([model, releaseDate]) => ({
    brand: 'OnePlus',
    model,
    aliases: [model],
    announcedDate: releaseDate,
    releaseDate,
    discontinued: false,
    manufacturerSupportEnded: false,
  } as MobileDeviceMaster)),
  {
    brand: 'Xiaomi',
    brandAliases: ['Redmi', 'POCO'],
    model: 'Redmi 13C',
    modelNumber: '23124RN87C',
    aliases: ['23124RN87C', 'Redmi 13C', 'POCO C65'],
    announcedDate: '2023-11-10',
    releaseDate: '2023-11-10',
    discontinued: false,
    launchAndroid: '13',
    chipset: 'MediaTek Helio G85',
    ramOptionsGb: [4, 6, 8],
    storageOptionsGb: [128, 256],
    batteryCapacityMah: 5000,
    display: '6.74-inch IPS LCD',
    displayResolution: '1600 × 720',
    refreshRateHz: 90,
    hdr: false,
    wideColorGamut: false,
    manufacturerSupportEnded: false,
  },
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
].filter((device) => new Date(device.releaseDate) >= fiveYearsAgo);

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
    const brandCandidates = [device.brand, ...(device.brandAliases || [])].map(normalize);
    const modelCandidates = [device.model, device.modelNumber || '', ...(device.aliases || [])]
      .filter(Boolean)
      .map(normalize);
    return brandCandidates.includes(normalize(brand)) && modelCandidates.includes(normalize(model));
  });
}
