type ListingCategoryContext = {
  mainCategory?: unknown;
  subCategory?: unknown;
  category?: unknown;
};

const SERVICE_MAIN_CATEGORIES = new Set(['jobs & services']);
const SERVICE_SUB_CATEGORIES = new Set([
  'jobs',
  'freelance',
  'services',
  'business',
  'education',
  'health',
]);

function normalizeCategory(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isServiceLikeListing(context: ListingCategoryContext): boolean {
  const mainCategory = normalizeCategory(context.mainCategory);
  if (mainCategory && SERVICE_MAIN_CATEGORIES.has(mainCategory)) {
    return true;
  }

  const subCategory = normalizeCategory(context.subCategory) || normalizeCategory(context.category);
  return Boolean(subCategory && SERVICE_SUB_CATEGORIES.has(subCategory));
}

export function requiresListingCondition(context: ListingCategoryContext): boolean {
  return !isServiceLikeListing(context);
}
