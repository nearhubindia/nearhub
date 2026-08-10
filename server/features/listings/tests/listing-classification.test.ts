import { describe, expect, it } from 'vitest';
import { isServiceLikeListing, requiresListingCondition } from '../services/listing-classification';

describe('listing classification', () => {
  it('recognizes service main and subcategories', () => {
    expect(isServiceLikeListing({ mainCategory: ' Jobs & Services ' })).toBe(true);
    expect(isServiceLikeListing({ subCategory: 'Health' })).toBe(true);
    expect(isServiceLikeListing({ category: 'Education' })).toBe(true);
    expect(isServiceLikeListing({ mainCategory: 'Vehicles', subCategory: 'Cars' })).toBe(false);
    expect(isServiceLikeListing({ mainCategory: 42, subCategory: null })).toBe(false);
  });

  it('requires condition for physical listings only', () => {
    expect(requiresListingCondition({ mainCategory: 'Vehicles' })).toBe(true);
    expect(requiresListingCondition({ subCategory: 'Services' })).toBe(false);
  });
});
