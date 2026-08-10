import { describe, expect, it, vi } from 'vitest';
import { validators } from '../utils/validators';

describe('admin listing validators', () => {
  it('accepts a valid listing form', () => {
    expect(
      validators.validateListingForm({
        title: 'Refurbished laptop',
        description: 'Good condition laptop with charger',
        price: '25000',
        location: 'Vijayawada',
      })
    ).toEqual([]);
  });

  it('reports all invalid listing fields together', () => {
    expect(
      validators.validateListingForm({ title: '', description: 'x'.repeat(2001), price: '-1' })
    ).toEqual([
      { field: 'title', message: 'Title is required' },
      { field: 'description', message: 'Description must not exceed 2000 characters' },
      { field: 'price', message: 'Price must be a valid positive number' },
    ]);
  });

  it('normalizes coupon codes while validating their shape', () => {
    expect(validators.validateCouponCode('nearhub_2026')).toBeNull();
    expect(validators.validateCouponCode('bad code')).toEqual({
      field: 'code',
      message: 'Code can only contain letters, numbers, dashes and underscores',
    });
  });

  it('covers individual coupon, tier, and listing validation branches', () => {
    expect(validators.validateCouponCode('')).toMatchObject({ message: 'Coupon code is required' });
    expect(validators.validateCouponCode('ab')).toMatchObject({
      message: 'Code must be at least 3 characters',
    });
    expect(validators.validateDiscountPercentage('bad')).toMatchObject({
      message: 'Discount must be a valid number',
    });
    expect(validators.validateDiscountPercentage(-1)).toMatchObject({
      message: 'Discount must be between 0 and 100',
    });
    expect(validators.validateDiscountPercentage(100)).toBeNull();
    expect(validators.validateMaxUsage('bad')).toMatchObject({
      message: 'Max usage must be at least 1',
    });
    expect(validators.validateMaxUsage(0)).not.toBeNull();
    expect(validators.validatePrice('bad')).not.toBeNull();
    expect(validators.validatePrice(0)).toBeNull();
    expect(validators.validateTierName('')).toMatchObject({ message: 'Tier name is required' });
    expect(validators.validateTierName('a')).toMatchObject({
      message: 'Tier name must be at least 2 characters',
    });
    expect(validators.validateTierName('x'.repeat(51))).toMatchObject({
      message: 'Tier name must not exceed 50 characters',
    });
    expect(validators.validateTierName('Premium')).toBeNull();
    expect(validators.validateListingTitle('')).toMatchObject({ message: 'Title is required' });
    expect(validators.validateListingTitle('abc')).toMatchObject({
      message: 'Title must be at least 5 characters',
    });
    expect(validators.validateListingTitle('x'.repeat(101))).toMatchObject({
      message: 'Title must not exceed 100 characters',
    });
    expect(validators.validateListingTitle('A valid title')).toBeNull();
    expect(validators.validateListingDescription('x'.repeat(2001))).not.toBeNull();
    expect(validators.validateListingDescription('')).toBeNull();
    expect(validators.validateDuration('bad')).not.toBeNull();
    expect(validators.validateDuration(0)).not.toBeNull();
    expect(validators.validateDuration(366)).toMatchObject({
      message: 'Duration cannot exceed 365 days',
    });
    expect(validators.validateDuration(30)).toBeNull();
    expect(validators.validateMaxListings('bad')).not.toBeNull();
    expect(validators.validateMaxListings(3)).toBeNull();
  });

  it('validates expiry dates and aggregates tier/coupon errors', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect(validators.validateExpiryDate('')).toMatchObject({ message: 'Expiry date is required' });
    expect(validators.validateExpiryDate('2025-12-31')).toMatchObject({
      message: 'Expiry date must be in the future',
    });
    expect(validators.validateExpiryDate('2026-01-02')).toBeNull();
    expect(
      validators.validateTierForm({ name: '', price: 'bad', durationDays: 0, maxListings: 0 })
    ).toHaveLength(4);
    expect(
      validators.validateCouponForm({
        code: '',
        discountPercentage: 'bad',
        maxUsageCount: 0,
        expiresAt: '',
      })
    ).toHaveLength(4);
    vi.useRealTimers();
  });
});
