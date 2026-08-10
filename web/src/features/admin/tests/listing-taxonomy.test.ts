import { describe, expect, it } from 'vitest';
import {
  ADMIN_CATEGORY_GROUPS,
  getAttributeKey,
  getDefaultAdminMainCategory,
  getDefaultAdminSubCategory,
  getMainCategoryForSubCategory,
  getSubCategoriesForMainCategory,
  shouldRequireConditionForCategory,
} from '../constants/listing-taxonomy';

describe('admin listing taxonomy', () => {
  it('exposes stable defaults and category mappings', () => {
    expect(ADMIN_CATEGORY_GROUPS.length).toBeGreaterThan(5);
    expect(getDefaultAdminMainCategory()).toBe('Vehicles');
    expect(getDefaultAdminSubCategory()).toBe('Vehicles');
    expect(getMainCategoryForSubCategory('Mobiles')).toBe('Electronics & Appliances');
    expect(getMainCategoryForSubCategory('unknown')).toBe('Vehicles');
    expect(getMainCategoryForSubCategory('')).toBe('Vehicles');
    expect(getSubCategoriesForMainCategory('Fashion & Lifestyle')).toContain('Beauty');
    expect(getSubCategoriesForMainCategory('unknown')).toEqual([
      'Vehicles',
      'Commercial Vehicles',
      'Bikes',
      'Spare Parts',
    ]);
    expect(getSubCategoriesForMainCategory(null)).toEqual([
      'Vehicles',
      'Commercial Vehicles',
      'Bikes',
      'Spare Parts',
    ]);
  });

  it('treats service categories as condition-optional', () => {
    expect(shouldRequireConditionForCategory('Jobs & Services', 'Jobs')).toBe(false);
    expect(shouldRequireConditionForCategory('Vehicles', 'Services')).toBe(false);
    expect(shouldRequireConditionForCategory('Vehicles', 'Cars')).toBe(true);
    expect(shouldRequireConditionForCategory(null, null)).toBe(true);
  });

  it('creates a stable attribute lookup key', () => {
    expect(getAttributeKey(' Vehicles ', ' Cars ')).toBe('Vehicles::Cars');
    expect(getAttributeKey(undefined, null)).toBe('::');
  });
});
