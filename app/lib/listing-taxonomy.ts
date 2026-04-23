import { CATEGORIES, Category, Listing } from '@/lib/types';

export type MainCategory =
  | 'Vehicles'
  | 'Electronics & Appliances'
  | 'Home, Property & Living'
  | 'Fashion & Lifestyle'
  | 'Jobs & Services'
  | 'Food, Travel & Events'
  | 'Community, Pets & Others';

type ListingFormType = Listing['listingType'];

const CATEGORY_TAXONOMY: Record<MainCategory, Category[]> = {
  Vehicles: ['Vehicles', 'Commercial Vehicles', 'Bikes', 'Spare Parts'],
  'Electronics & Appliances': ['Electronics', 'Mobiles', 'Computers', 'Appliances'],
  'Home, Property & Living': ['Furniture', 'Home & Garden', 'Real Estate', 'Rentals'],
  'Fashion & Lifestyle': ['Fashion', 'Clothing', 'Beauty', 'Kids'],
  'Jobs & Services': ['Jobs', 'Freelance', 'Services', 'Business', 'Education', 'Health'],
  'Food, Travel & Events': ['Food', 'Travel', 'Events'],
  'Community, Pets & Others': [
    'Sports',
    'Books',
    'Agriculture',
    'Pets',
    'Pets Accessories',
    'Community',
    'Other',
  ],
};

const JOB_ALLOWED_SUBCATEGORIES: Category[] = [
  'Jobs',
  'Freelance',
  'Services',
  'Business',
  'Education',
  'Health',
  'Other',
];

const SERVICE_ALLOWED_SUBCATEGORIES: Category[] = [
  'Services',
  'Freelance',
  'Home & Garden',
  'Education',
  'Health',
  'Business',
  'Events',
  'Food',
  'Other',
];

const LISTING_TYPE_ALLOWED_SUBCATEGORIES: Record<ListingFormType, Category[]> = {
  sell: CATEGORIES,
  buy: CATEGORIES,
  service: SERVICE_ALLOWED_SUBCATEGORIES,
  job: JOB_ALLOWED_SUBCATEGORIES,
};

export type CategoryGroup = {
  mainCategory: MainCategory;
  subcategories: Category[];
};

export function getCategoryGroupsForListingType(listingType: ListingFormType): CategoryGroup[] {
  const allowed = new Set(LISTING_TYPE_ALLOWED_SUBCATEGORIES[listingType] ?? CATEGORIES);

  return (Object.entries(CATEGORY_TAXONOMY) as Array<[MainCategory, Category[]]>)
    .map(([mainCategory, subcategories]) => ({
      mainCategory,
      subcategories: subcategories.filter((subcategory) => allowed.has(subcategory)),
    }))
    .filter((group) => group.subcategories.length > 0);
}

export function getMainCategoryForSubcategory(
  subcategory: Category | string | undefined,
  listingType: ListingFormType
): MainCategory | null {
  if (!subcategory) return null;
  const groups = getCategoryGroupsForListingType(listingType);
  const match = groups.find((group) =>
    group.subcategories.includes(subcategory as Category)
  );
  return match?.mainCategory || null;
}

export function getDefaultCategoryForListingType(listingType: ListingFormType): Category {
  const groups = getCategoryGroupsForListingType(listingType);
  return groups[0]?.subcategories[0] || 'Other';
}

export function getDefaultMainCategoryForListingType(listingType: ListingFormType): MainCategory {
  const groups = getCategoryGroupsForListingType(listingType);
  return groups[0]?.mainCategory || 'Community, Pets & Others';
}
