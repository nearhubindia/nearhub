import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/query-client';
import { type Category, type PriceUnit, PRICE_UNITS } from '@/lib/types';
import {
  DEFAULT_CATEGORY_GROUPS,
  type CategoryGroup,
  type MainCategory,
} from '@/lib/listing-taxonomy';

const FALLBACK_PRICE_UNITS = PRICE_UNITS.default;

export type ListingAttributeDefinition = {
  name: string;
  fieldType: string;
  unit: string;
  required: boolean;
  status?: string;
};

export type ListingAttributeValue = string | number | boolean;

type RawCategoryGroup = {
  mainCategory: string;
  subcategories: string[];
  mainCategoryIcon?: unknown;
  subcategoryIcons?: unknown;
};

function isValidGroup(value: unknown): value is RawCategoryGroup {
  if (!value || typeof value !== 'object') return false;
  const entry = value as {
    mainCategory?: unknown;
    subcategories?: unknown;
    mainCategoryIcon?: unknown;
    subcategoryIcons?: unknown;
  };
  return (
    typeof entry.mainCategory === 'string' &&
    Array.isArray(entry.subcategories) &&
    entry.subcategories.length > 0 &&
    entry.subcategories.every((item) => typeof item === 'string')
  );
}

function normalizeIconMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, icon]) => {
      const normalizedKey = String(key || '').trim();
      const normalizedIcon = String(icon || '').trim();
      if (normalizedKey && normalizedIcon) acc[normalizedKey] = normalizedIcon;
      return acc;
    },
    {}
  );
}

function normalizeCategoryGroups(value: unknown): CategoryGroup[] {
  if (!Array.isArray(value)) return DEFAULT_CATEGORY_GROUPS;

  const normalized = value
    .filter(isValidGroup)
    .map((group) => ({
      mainCategory: group.mainCategory.trim() as MainCategory,
      ...(typeof group.mainCategoryIcon === 'string' && group.mainCategoryIcon.trim()
        ? { mainCategoryIcon: group.mainCategoryIcon.trim() }
        : {}),
      subcategories: Array.from(
        new Set(
          group.subcategories
            .map((item) => String(item || '').trim())
            .filter((item): item is Category => Boolean(item))
        )
      ),
      ...(Object.keys(normalizeIconMap(group.subcategoryIcons)).length > 0
        ? { subcategoryIcons: normalizeIconMap(group.subcategoryIcons) }
        : {}),
    }))
    .filter((group) => group.mainCategory && group.subcategories.length > 0);

  return normalized.length > 0 ? normalized : DEFAULT_CATEGORY_GROUPS;
}

function normalizePriceUnits(value: unknown): PriceUnit[] {
  if (!Array.isArray(value)) return FALLBACK_PRICE_UNITS;

  const normalized = Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item): item is PriceUnit => Boolean(item))
    )
  );

  return normalized.length > 0 ? normalized : FALLBACK_PRICE_UNITS;
}

function normalizeAttributesByKey(value: unknown): Record<string, ListingAttributeDefinition[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, ListingAttributeDefinition[]>
  >((acc, [key, rawAttributes]) => {
    if (!Array.isArray(rawAttributes)) return acc;

    const attributes = rawAttributes
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        name: String(item.name || '').trim(),
        fieldType: String(item.fieldType || 'Text').trim() || 'Text',
        unit: String(item.unit || '').trim(),
        required: Boolean(item.required),
        status: typeof item.status === 'string' ? item.status : undefined,
      }))
      .filter(
        (attribute) =>
          attribute.name && String(attribute.status || 'Active').toLowerCase() !== 'inactive'
      );

    if (attributes.length > 0) acc[key] = attributes;
    return acc;
  }, {});
}

export function getListingAttributeKey(mainCategory?: string | null, subCategory?: string | null) {
  return `${String(mainCategory || '').trim()}::${String(subCategory || '').trim()}`;
}

export function useListingTaxonomy() {
  const query = useQuery({
    queryKey: ['mobile-listing-taxonomy'],
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/admin/settings`);
      if (!response.ok) {
        throw new Error(`Failed to fetch listing taxonomy (${response.status})`);
      }

      const payload = await response.json().catch(() => null);
      return {
        groups: normalizeCategoryGroups(payload?.settings?.listingCategoryGroups),
        priceUnits: normalizePriceUnits(payload?.settings?.listingPriceUnits),
        attributesByKey: normalizeAttributesByKey(payload?.settings?.attributesByKey),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    groups: query.data?.groups || DEFAULT_CATEGORY_GROUPS,
    priceUnits: query.data?.priceUnits || FALLBACK_PRICE_UNITS,
    attributesByKey: query.data?.attributesByKey || {},
    isLoading: query.isLoading,
  };
}
