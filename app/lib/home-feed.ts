export type HomeFeedListingLike = {
  id: string;
  status?: string | null;
  isActive?: boolean | null;
  is_active?: boolean | null;
  expiresAt?: string | null;
  featured?: boolean | null;
  likeCount?: number | string | null;
  chatCount?: number | string | null;
  createdAt?: string | null;
  location?: { city?: string | null } | string | null;
};

function normalizeStatus(value: unknown): string {
  return String(value || 'active')
    .trim()
    .toLowerCase();
}

export function isActiveHomeListing<T extends HomeFeedListingLike>(item: T): boolean {
  const status = normalizeStatus(item.status);
  const isActive = item.isActive ?? item.is_active ?? true;
  if (!isActive || status !== 'active') return false;
  if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export function filterActiveListings<T extends HomeFeedListingLike>(items: T[]): T[] {
  return items.filter(isActiveHomeListing);
}

export function filterFeaturedListings<T extends HomeFeedListingLike>(items: T[]): T[] {
  return filterActiveListings(items).filter((item) => Boolean(item.featured));
}

export function sortListingsByRecency<T extends HomeFeedListingLike>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export function sortListingsByEngagement<T extends HomeFeedListingLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreA = Number(a.likeCount || 0) * 2 + Number(a.chatCount || 0) * 3;
    const scoreB = Number(b.likeCount || 0) * 2 + Number(b.chatCount || 0) * 3;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export function getHomeListingLocationLabel(item: HomeFeedListingLike): string {
  if (typeof item.location === 'string') {
    const trimmed = item.location.trim();
    if (trimmed) return trimmed;
  }
  if (item.location && typeof item.location === 'object') {
    const city = item.location.city?.trim();
    if (city) return city;
  }
  return 'Location unavailable';
}
