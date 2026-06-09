import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/config';
import {
  ADMIN_CATEGORY_GROUPS,
  type ListingAttributeDefinition,
  type AdminCategoryGroup,
} from '@/features/admin/constants/listing-taxonomy';

const DEFAULT_PRICE_UNITS = ['per unit', 'per piece'];
const DEFAULT_ATTRIBUTES_BY_KEY: Record<string, ListingAttributeDefinition[]> = {};

function isValidGroup(value: unknown): value is AdminCategoryGroup {
  if (!value || typeof value !== 'object') return false;
  const entry = value as { mainCategory?: unknown; subcategories?: unknown };
  return (
    typeof entry.mainCategory === 'string' &&
    Array.isArray(entry.subcategories) &&
    entry.subcategories.every((item) => typeof item === 'string')
  );
}

function isValidAttribute(value: unknown): value is ListingAttributeDefinition {
  if (!value || typeof value !== 'object') return false;
  const entry = value as {
    name?: unknown;
    fieldType?: unknown;
    unit?: unknown;
    required?: unknown;
    status?: unknown;
  };
  return (
    typeof entry.name === 'string' &&
    typeof entry.fieldType === 'string' &&
    typeof entry.unit === 'string' &&
    typeof entry.required === 'boolean' &&
    (entry.status === undefined ||
      entry.status === null ||
      typeof entry.status === 'string')
  );
}

function normalizeAttributesByKey(value: unknown): Record<string, ListingAttributeDefinition[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_ATTRIBUTES_BY_KEY;
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, ListingAttributeDefinition[]>>(
    (acc, [key, rawValue]) => {
      if (!Array.isArray(rawValue)) return acc;
      const next = rawValue.filter(isValidAttribute);
      if (next.length > 0) acc[key] = next;
      return acc;
    },
    {}
  );
}

export function useListingTaxonomy() {
  const query = useQuery({
    queryKey: ['admin-listing-taxonomy'],
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/admin/settings`);
      const payload = await response.json().catch(() => null);
      const groups = payload?.settings?.listingCategoryGroups;
      const units = payload?.settings?.listingPriceUnits;
      const attributesByKey = payload?.settings?.attributesByKey;
      const normalizedGroups = Array.isArray(groups) ? groups.filter(isValidGroup) : [];
      const normalizedUnits = Array.isArray(units)
        ? units.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      return {
        groups: normalizedGroups.length > 0 ? normalizedGroups : ADMIN_CATEGORY_GROUPS,
        priceUnits: normalizedUnits.length > 0 ? normalizedUnits : DEFAULT_PRICE_UNITS,
        attributesByKey: normalizeAttributesByKey(attributesByKey),
      };
    },
  });

  return {
    groups: query.data?.groups || ADMIN_CATEGORY_GROUPS,
    priceUnits: query.data?.priceUnits || DEFAULT_PRICE_UNITS,
    attributesByKey: query.data?.attributesByKey || DEFAULT_ATTRIBUTES_BY_KEY,
    isLoading: query.isLoading,
  };
}
