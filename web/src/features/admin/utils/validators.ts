/**
 * Admin Feature Validators
 * Utility functions for validating data
 */

export interface ValidationError {
  field: string;
  message: string;
}

interface TierFormInput {
  name: string;
  price: string | number;
  durationDays: string | number;
  maxListings: string | number;
}

interface CouponFormInput {
  code: string;
  discountPercentage: string | number;
  maxUsageCount: string | number;
  expiresAt: string;
}

interface ListingFormInput {
  title: string;
  description: string;
  price: string | number;
  location?: string;
}

export const validators = {
  /**
   * Validate coupon code
   */
  validateCouponCode(code: string): ValidationError | null {
    if (!code || !code.trim()) {
      return { field: 'code', message: 'Coupon code is required' };
    }
    if (code.length < 3) {
      return { field: 'code', message: 'Code must be at least 3 characters' };
    }
    if (!/^[A-Z0-9_-]+$/.test(code.toUpperCase())) {
      return {
        field: 'code',
        message: 'Code can only contain letters, numbers, dashes and underscores',
      };
    }
    return null;
  },

  /**
   * Validate discount percentage
   */
  validateDiscountPercentage(value: string | number): ValidationError | null {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) {
      return { field: 'discountPercentage', message: 'Discount must be a valid number' };
    }
    if (num < 0 || num > 100) {
      return { field: 'discountPercentage', message: 'Discount must be between 0 and 100' };
    }
    return null;
  },

  /**
   * Validate max usage count
   */
  validateMaxUsage(value: string | number): ValidationError | null {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num < 1) {
      return { field: 'maxUsageCount', message: 'Max usage must be at least 1' };
    }
    return null;
  },

  /**
   * Validate price
   */
  validatePrice(price: string | number): ValidationError | null {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num) || num < 0) {
      return { field: 'price', message: 'Price must be a valid positive number' };
    }
    return null;
  },

  /**
   * Validate tier name
   */
  validateTierName(name: string): ValidationError | null {
    if (!name || !name.trim()) {
      return { field: 'name', message: 'Tier name is required' };
    }
    if (name.length < 2) {
      return { field: 'name', message: 'Tier name must be at least 2 characters' };
    }
    if (name.length > 50) {
      return { field: 'name', message: 'Tier name must not exceed 50 characters' };
    }
    return null;
  },

  /**
   * Validate listing title
   */
  validateListingTitle(title: string): ValidationError | null {
    if (!title || !title.trim()) {
      return { field: 'title', message: 'Title is required' };
    }
    if (title.length < 5) {
      return { field: 'title', message: 'Title must be at least 5 characters' };
    }
    if (title.length > 100) {
      return { field: 'title', message: 'Title must not exceed 100 characters' };
    }
    return null;
  },

  /**
   * Validate listing description
   */
  validateListingDescription(description: string): ValidationError | null {
    if (description && description.length > 2000) {
      return { field: 'description', message: 'Description must not exceed 2000 characters' };
    }
    return null;
  },

  /**
   * Validate expiry date
   */
  validateExpiryDate(date: string): ValidationError | null {
    if (!date) {
      return { field: 'expiresAt', message: 'Expiry date is required' };
    }
    const expiryDate = new Date(date);
    const today = new Date();
    if (expiryDate <= today) {
      return { field: 'expiresAt', message: 'Expiry date must be in the future' };
    }
    return null;
  },

  /**
   * Validate duration (in days)
   */
  validateDuration(days: string | number): ValidationError | null {
    const num = typeof days === 'string' ? parseFloat(days) : days;
    if (isNaN(num) || num < 1) {
      return { field: 'durationDays', message: 'Duration must be at least 1 day' };
    }
    if (num > 365) {
      return { field: 'durationDays', message: 'Duration cannot exceed 365 days' };
    }
    return null;
  },

  /**
   * Validate maximum listings count
   */
  validateMaxListings(count: string | number): ValidationError | null {
    const num = typeof count === 'string' ? parseFloat(count) : count;
    if (isNaN(num) || num < 1) {
      return { field: 'maxListings', message: 'Must allow at least 1 listing' };
    }
    return null;
  },

  /**
   * Validate all tier fields
   */
  validateTierForm(data: TierFormInput): ValidationError[] {
    const errors: ValidationError[] = [];

    const nameError = this.validateTierName(data.name);
    if (nameError) errors.push(nameError);

    const priceError = this.validatePrice(data.price);
    if (priceError) errors.push(priceError);

    const durationError = this.validateDuration(data.durationDays);
    if (durationError) errors.push(durationError);

    const maxListingsError = this.validateMaxListings(data.maxListings);
    if (maxListingsError) errors.push(maxListingsError);

    return errors;
  },

  /**
   * Validate all coupon fields
   */
  validateCouponForm(data: CouponFormInput): ValidationError[] {
    const errors: ValidationError[] = [];

    const codeError = this.validateCouponCode(data.code);
    if (codeError) errors.push(codeError);

    const discountError = this.validateDiscountPercentage(data.discountPercentage);
    if (discountError) errors.push(discountError);

    const maxUsageError = this.validateMaxUsage(data.maxUsageCount);
    if (maxUsageError) errors.push(maxUsageError);

    const expiryError = this.validateExpiryDate(data.expiresAt);
    if (expiryError) errors.push(expiryError);

    return errors;
  },

  /**
   * Validate all listing fields
   */
  validateListingForm(data: ListingFormInput): ValidationError[] {
    const errors: ValidationError[] = [];

    const titleError = this.validateListingTitle(data.title);
    if (titleError) errors.push(titleError);

    const descriptionError = this.validateListingDescription(data.description);
    if (descriptionError) errors.push(descriptionError);

    const priceError = this.validatePrice(data.price);
    if (priceError) errors.push(priceError);

    return errors;
  },
};

export default validators;
