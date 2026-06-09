export type AdminCategoryGroup = {
  mainCategory: string;
  subcategories: string[];
};

export type ListingAttributeDefinition = {
  name: string;
  fieldType: string;
  unit: string;
  required: boolean;
  status?: 'Active' | 'Inactive' | string;
};

export const ADMIN_CATEGORY_GROUPS: AdminCategoryGroup[] = [
  {
    mainCategory: 'Vehicles',
    subcategories: ['Vehicles', 'Commercial Vehicles', 'Bikes', 'Spare Parts'],
  },
  {
    mainCategory: 'Electronics & Appliances',
    subcategories: ['Electronics', 'Mobiles', 'Computers', 'Appliances'],
  },
  {
    mainCategory: 'Home, Property & Living',
    subcategories: ['Furniture', 'Home & Garden', 'Real Estate', 'Rentals'],
  },
  {
    mainCategory: 'Fashion & Lifestyle',
    subcategories: ['Fashion', 'Clothing', 'Beauty', 'Kids'],
  },
  {
    mainCategory: 'Jobs & Services',
    subcategories: ['Jobs', 'Freelance', 'Services', 'Business', 'Education', 'Health'],
  },
  {
    mainCategory: 'Food, Travel & Events',
    subcategories: ['Food', 'Travel', 'Events'],
  },
  {
    mainCategory: 'Community, Pets & Others',
    subcategories: [
      'Sports',
      'Books',
      'Agriculture',
      'Pets',
      'Pets Accessories',
      'Community',
      'Other',
    ],
  },
];

const CONDITION_OPTIONAL_MAIN_CATEGORIES = new Set(['jobs & services']);
const CONDITION_OPTIONAL_SUB_CATEGORIES = new Set([
  'jobs',
  'freelance',
  'services',
  'business',
  'education',
  'health',
]);

export function getDefaultAdminSubCategory(): string {
  return ADMIN_CATEGORY_GROUPS[0]?.subcategories[0] || 'Other';
}

export function getDefaultAdminMainCategory(): string {
  return ADMIN_CATEGORY_GROUPS[0]?.mainCategory || 'Community, Pets & Others';
}

export function getMainCategoryForSubCategory(subCategory?: string | null): string {
  if (!subCategory) return getDefaultAdminMainCategory();
  const normalized = subCategory.trim();
  if (!normalized) return getDefaultAdminMainCategory();

  const group = ADMIN_CATEGORY_GROUPS.find((entry) => entry.subcategories.includes(normalized));
  return group?.mainCategory || getDefaultAdminMainCategory();
}

export function getSubCategoriesForMainCategory(mainCategory?: string | null): string[] {
  if (!mainCategory) return ADMIN_CATEGORY_GROUPS[0]?.subcategories || ['Other'];
  const normalized = mainCategory.trim();
  if (!normalized) return ADMIN_CATEGORY_GROUPS[0]?.subcategories || ['Other'];
  const group = ADMIN_CATEGORY_GROUPS.find((entry) => entry.mainCategory === normalized);
  return group?.subcategories || ADMIN_CATEGORY_GROUPS[0]?.subcategories || ['Other'];
}

export function shouldRequireConditionForCategory(
  mainCategory?: string | null,
  subCategory?: string | null
): boolean {
  const normalizedMain = String(mainCategory || '')
    .trim()
    .toLowerCase();
  if (CONDITION_OPTIONAL_MAIN_CATEGORIES.has(normalizedMain)) {
    return false;
  }

  const normalizedSub = String(subCategory || '')
    .trim()
    .toLowerCase();
  if (CONDITION_OPTIONAL_SUB_CATEGORIES.has(normalizedSub)) {
    return false;
  }

  return true;
}

export function getAttributeKey(mainCategory?: string | null, subCategory?: string | null): string {
  return `${String(mainCategory || '').trim()}::${String(subCategory || '').trim()}`;
}
