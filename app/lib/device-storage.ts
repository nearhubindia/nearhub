const COMMON_STORAGE_TIERS_GB = [16, 32, 64, 128, 256, 512, 1024, 2048];

/**
 * Android reports the app-visible filesystem capacity, which excludes system and
 * reserved partitions. Map that usable capacity back to the phone's marketed
 * total-storage tier instead of presenting values such as 108 GB for a 128 GB SKU.
 */
export function getTotalStorageGb(
  totalDiskCapacityBytes: number,
  modelStorageOptionsGb?: number[]
): number {
  const usableGiB = totalDiskCapacityBytes / 1024 ** 3;
  const tiers = [
    ...(modelStorageOptionsGb?.length ? modelStorageOptionsGb : COMMON_STORAGE_TIERS_GB),
  ]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  const marketedTier = tiers.find((tier) => usableGiB <= tier && usableGiB >= tier * 0.7);

  return marketedTier ?? Math.round(usableGiB);
}
