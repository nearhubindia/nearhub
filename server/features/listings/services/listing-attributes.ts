import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../data/db';
import {
  listingAttributeValues,
  masterListingAttributes,
  masterListingCategories,
  masterListingSubcategories,
  masterListingUnits,
} from '../../admin/models/admin-settings';

export type ListingAttributeValueInput = Record<string, string | number | boolean>;

function normalizeAttributeInput(value: unknown): ListingAttributeValueInput | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return normalizeAttributeInput(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const entries = Object.entries(
    value as Record<string, unknown>
  ).reduce<ListingAttributeValueInput>((acc, [key, rawValue]) => {
    if (rawValue === undefined || rawValue === null) return acc;
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) return acc;
      acc[key] = trimmed;
      return acc;
    }
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      acc[key] = rawValue;
    }
    return acc;
  }, {});

  return entries;
}

function normalizeValue(
  fieldType: string,
  rawValue: string | number | boolean
): { textValue?: string; numberValue?: string; booleanValue?: boolean } | null {
  if (typeof rawValue === 'boolean') {
    return { booleanValue: rawValue };
  }
  const normalizedFieldType = fieldType.trim().toLowerCase();
  if (normalizedFieldType === 'number' || normalizedFieldType === 'price') {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return null;
    return { numberValue: String(numericValue) };
  }
  const textValue = String(rawValue).trim();
  if (!textValue) return null;
  return { textValue };
}

export async function replaceListingAttributeValues(params: {
  listingId: string;
  mainCategory?: string | null;
  subCategory?: string | null;
  attributes?: unknown;
}): Promise<void> {
  const listingId = String(params.listingId || '').trim();
  if (!listingId || params.attributes === undefined || params.attributes === null) return;

  const mainCategory = String(params.mainCategory || '').trim();
  const subCategory = String(params.subCategory || '').trim();
  await db.delete(listingAttributeValues).where(eq(listingAttributeValues.listingId, listingId));

  const normalizedAttributes = normalizeAttributeInput(params.attributes);
  if (!normalizedAttributes) return;

  const attributeEntries = Object.entries(normalizedAttributes).filter(
    ([, value]) => value !== undefined
  );
  if (attributeEntries.length === 0) return;

  const attributeNames = attributeEntries.map(([name]) => name);
  const definitions = await db
    .select({
      id: masterListingAttributes.id,
      name: masterListingAttributes.name,
      fieldType: masterListingAttributes.fieldType,
      unitName: masterListingUnits.name,
    })
    .from(masterListingAttributes)
    .innerJoin(
      masterListingSubcategories,
      eq(masterListingAttributes.subcategoryId, masterListingSubcategories.id)
    )
    .innerJoin(
      masterListingCategories,
      eq(masterListingSubcategories.categoryId, masterListingCategories.id)
    )
    .leftJoin(masterListingUnits, eq(masterListingAttributes.unitId, masterListingUnits.id))
    .where(
      and(
        eq(masterListingCategories.name, mainCategory),
        eq(masterListingSubcategories.name, subCategory),
        inArray(masterListingAttributes.name, attributeNames)
      )
    );

  if (definitions.length === 0) return;

  const definitionByName = new Map(definitions.map((definition) => [definition.name, definition]));

  const rows = attributeEntries
    .map(([name, rawValue]) => {
      const definition = definitionByName.get(name);
      if (!definition) return null;
      const normalized = normalizeValue(definition.fieldType, rawValue);
      if (!normalized) return null;
      return {
        listingId,
        attributeId: definition.id,
        ...normalized,
      };
    })
    .filter(Boolean) as Array<{
    listingId: string;
    attributeId: string;
    textValue?: string;
    numberValue?: string;
    booleanValue?: boolean;
  }>;

  if (rows.length === 0) return;
  await db.insert(listingAttributeValues).values(rows);
}

export async function loadListingAttributeValueMap(
  listingId: string
): Promise<Record<string, string | number | boolean>> {
  const rows = await db
    .select({
      attributeName: masterListingAttributes.name,
      fieldType: masterListingAttributes.fieldType,
      unitName: masterListingUnits.name,
      textValue: listingAttributeValues.textValue,
      numberValue: listingAttributeValues.numberValue,
      booleanValue: listingAttributeValues.booleanValue,
    })
    .from(listingAttributeValues)
    .innerJoin(
      masterListingAttributes,
      eq(listingAttributeValues.attributeId, masterListingAttributes.id)
    )
    .leftJoin(masterListingUnits, eq(masterListingAttributes.unitId, masterListingUnits.id))
    .where(eq(listingAttributeValues.listingId, listingId));

  return rows.reduce<Record<string, string | number | boolean>>((acc, row) => {
    if (row.booleanValue !== null && row.booleanValue !== undefined) {
      acc[row.attributeName] = Boolean(row.booleanValue);
      return acc;
    }
    if (row.numberValue !== null && row.numberValue !== undefined) {
      acc[row.attributeName] = Number(row.numberValue);
      return acc;
    }
    if (row.textValue !== null && row.textValue !== undefined) {
      acc[row.attributeName] = row.textValue;
    }
    return acc;
  }, {});
}
