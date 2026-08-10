/**
 * Shared listings feature API.
 *
 * Listing creation is used by the public portal and the admin console. The
 * taxonomy and query hook are exposed here so consumers do not reach into
 * another feature's implementation folders.
 */
export {
  ADMIN_CATEGORY_GROUPS,
  getAttributeKey,
  getDefaultAdminMainCategory,
  getDefaultAdminSubCategory,
  getMainCategoryForSubCategory,
  getSubCategoriesForMainCategory,
  shouldRequireConditionForCategory,
} from '../admin';
export type { AdminCategoryGroup, ListingAttributeDefinition } from '../admin';
export { useListingTaxonomy } from '../admin';
