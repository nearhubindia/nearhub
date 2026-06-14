import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/query-client';
import { type Category, type PriceUnit, PRICE_UNITS } from '@/lib/types';
import {
  DEFAULT_CATEGORY_GROUPS,
  type CategoryGroup,
  type MainCategory,
} from '@/lib/listing-taxonomy';

const FALLBACK_PRICE_UNITS = PRICE_UNITS.default;

function isValidGroup(value: unknown): value is { mainCategory: string; subcategories: string[] } {
  if (!value || typeof value !== 'object') return false;
  const entry = value as { mainCategory?: unknown; subcategories?: unknown };
  return (
    typeof entry.mainCategory === 'string' &&
    Array.isArray(entry.subcategories) &&
    entry.subcategories.every((item) => typeof item === 'string')
  );
}

function normalizeCategoryGroups(value: unknown): CategoryGroup[] {
  if (!Array.isArray(value)) return DEFAULT_CATEGORY_GROUPS;

  const normalized = value
    .filter(isValidGroup)
    .map((group) => ({
      mainCategory: group.mainCategory.trim() as MainCategory,
      subcategories: Array.from(
        new Set(
          group.subcategories
            .map((item) => String(item || '').trim())
            .filter((item): item is Category => Boolean(item))
        )
      ),
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
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    groups: query.data?.groups || DEFAULT_CATEGORY_GROUPS,
    priceUnits: query.data?.priceUnits || FALLBACK_PRICE_UNITS,
    isLoading: query.isLoading,
  };
}
