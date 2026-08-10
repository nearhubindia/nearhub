import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filterActiveListings,
  filterFeaturedListings,
  getHomeListingLocationLabel,
  sortListingsByEngagement,
  sortListingsByRecency,
} from '../lib/home-feed';

const active = {
  id: 'active',
  createdAt: '2026-01-02',
  featured: true,
  likeCount: 1,
  chatCount: 2,
};

describe('landing home feed', () => {
  afterEach(() => vi.useRealTimers());

  it('filters inactive, non-active, and expired listings', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    expect(
      filterActiveListings([
        active,
        { id: 'inactive', isActive: false },
        { id: 'pending', status: 'pending' },
        { id: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' },
      ]).map((item) => item.id)
    ).toEqual(['active']);
    expect(filterFeaturedListings([active, { id: 'not-featured' }]).map((item) => item.id)).toEqual(
      ['active']
    );
  });

  it('sorts without mutating the source array', () => {
    const items = [
      { id: 'old', createdAt: '2026-01-01', likeCount: 10, chatCount: 0 },
      { id: 'new', createdAt: '2026-01-02', likeCount: 1, chatCount: 3 },
    ];
    expect(sortListingsByRecency(items).map((item) => item.id)).toEqual(['new', 'old']);
    expect(sortListingsByEngagement(items).map((item) => item.id)).toEqual(['old', 'new']);
    expect(items.map((item) => item.id)).toEqual(['old', 'new']);
  });

  it('returns human-readable location labels', () => {
    expect(getHomeListingLocationLabel({ id: '1', location: '  Vijayawada ' })).toBe('Vijayawada');
    expect(getHomeListingLocationLabel({ id: '2', location: { city: 'Guntur' } })).toBe('Guntur');
    expect(getHomeListingLocationLabel({ id: '3', location: { city: ' ' } })).toBe(
      'Location unavailable'
    );
  });
});
