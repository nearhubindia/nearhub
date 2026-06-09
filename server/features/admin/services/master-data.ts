import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../data/db';
import {
  adminSettings as adminSettingsTable,
  masterListingAttributes,
  masterListingCategories,
  masterListingSubcategories,
  masterListingUnits,
  type AdminSettings,
} from '../models/admin-settings';

type MasterCategoryGroup = {
  mainCategory: string;
  subcategories: string[];
};

type MasterAttribute = {
  name: string;
  fieldType: string;
  unit: string;
  required: boolean;
  status: 'Active' | 'Inactive' | string;
};

type MasterDataSnapshot = {
  listingCategoryGroups: MasterCategoryGroup[];
  listingPriceUnits: string[];
  attributesByKey: Record<string, MasterAttribute[]>;
};

type LegacyAttributeInput = {
  name?: unknown;
  fieldType?: unknown;
  unit?: unknown;
  required?: unknown;
  status?: unknown;
};

const DEFAULT_CATEGORY_GROUPS: MasterCategoryGroup[] = [
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

const DEFAULT_PRICE_UNITS = ['per unit', 'per piece'];

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeGroups(value: unknown): MasterCategoryGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const entry = item as { mainCategory?: unknown; subcategories?: unknown };
      return {
        mainCategory: normalizeText(entry.mainCategory),
        subcategories: Array.isArray(entry.subcategories)
          ? Array.from(
              new Set(entry.subcategories.map((sub) => normalizeText(sub)).filter(Boolean))
            )
          : [],
      };
    })
    .filter((item) => item.mainCategory && item.subcategories.length > 0);
}

function normalizeUnits(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
}

function normalizeAttributesByKey(value: unknown): Record<string, MasterAttribute[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, MasterAttribute[]>>(
    (acc, [key, rawAttributes]) => {
      if (!Array.isArray(rawAttributes)) return acc;
      const attributes = rawAttributes
        .map((item) => {
          const entry = item as LegacyAttributeInput;
          const name = normalizeText(entry.name);
          if (!name) return null;
          return {
            name,
            fieldType: normalizeText(entry.fieldType) || 'Text',
            unit: normalizeText(entry.unit),
            required: Boolean(entry.required),
            status: normalizeText(entry.status) || 'Active',
          } satisfies MasterAttribute;
        })
        .filter((item): item is MasterAttribute => Boolean(item));
      if (attributes.length > 0) acc[key] = attributes;
      return acc;
    },
    {}
  );
}

function buildAttributeKey(mainCategory: string, subCategory: string): string {
  return `${mainCategory}::${subCategory}`;
}

function groupAttributesByTableRows(
  rows: Array<{
    categoryName: string;
    subcategoryName: string;
    attributeName: string;
    fieldType: string;
    unitName: string | null;
    required: boolean;
    status: string;
  }>
): Record<string, MasterAttribute[]> {
  return rows.reduce<Record<string, MasterAttribute[]>>((acc, row) => {
    const key = buildAttributeKey(row.categoryName, row.subcategoryName);
    const nextAttribute: MasterAttribute = {
      name: row.attributeName,
      fieldType: row.fieldType || 'Text',
      unit: row.unitName || '',
      required: Boolean(row.required),
      status: row.status || 'Active',
    };
    if (!acc[key]) acc[key] = [];
    acc[key].push(nextAttribute);
    return acc;
  }, {});
}

async function seedMasterDataFromLegacy(settings: AdminSettings): Promise<void> {
  const legacyGroups = normalizeGroups(settings.listingCategoryGroups);
  const legacyUnits = normalizeUnits(settings.listingPriceUnits);
  const legacyAttributes = normalizeAttributesByKey(settings.attributesByKey);
  const snapshot: MasterDataSnapshot = {
    listingCategoryGroups: legacyGroups.length > 0 ? legacyGroups : DEFAULT_CATEGORY_GROUPS,
    listingPriceUnits: legacyUnits.length > 0 ? legacyUnits : DEFAULT_PRICE_UNITS,
    attributesByKey: legacyAttributes,
  };
  await syncMasterDataTables(snapshot);
}

export async function loadMasterDataSnapshot(): Promise<MasterDataSnapshot> {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .orderBy(asc(adminSettingsTable.updatedAt))
    .limit(1);

  const categoryCount = await db.$count(masterListingCategories);
  const subcategoryCount = await db.$count(masterListingSubcategories);
  const unitCount = await db.$count(masterListingUnits);
  const attributeCount = await db.$count(masterListingAttributes);

  if (categoryCount === 0 && subcategoryCount === 0 && unitCount === 0 && attributeCount === 0) {
    await seedMasterDataFromLegacy(settings || ({} as AdminSettings));
  }

  const categoryRows = await db
    .select()
    .from(masterListingCategories)
    .where(eq(masterListingCategories.isActive, true))
    .orderBy(masterListingCategories.sortOrder, masterListingCategories.name);

  const subcategoryRows = await db
    .select({
      id: masterListingSubcategories.id,
      categoryId: masterListingSubcategories.categoryId,
      categoryName: masterListingCategories.name,
      name: masterListingSubcategories.name,
      sortOrder: masterListingSubcategories.sortOrder,
    })
    .from(masterListingSubcategories)
    .innerJoin(
      masterListingCategories,
      eq(masterListingSubcategories.categoryId, masterListingCategories.id)
    )
    .where(
      and(eq(masterListingSubcategories.isActive, true), eq(masterListingCategories.isActive, true))
    )
    .orderBy(
      masterListingCategories.sortOrder,
      masterListingSubcategories.sortOrder,
      masterListingSubcategories.name
    );

  const unitRows = await db
    .select()
    .from(masterListingUnits)
    .where(eq(masterListingUnits.isActive, true))
    .orderBy(masterListingUnits.sortOrder, masterListingUnits.name);

  const attributeRows = await db
    .select({
      categoryName: masterListingCategories.name,
      subcategoryName: masterListingSubcategories.name,
      attributeName: masterListingAttributes.name,
      fieldType: masterListingAttributes.fieldType,
      unitName: masterListingUnits.name,
      required: masterListingAttributes.required,
      status: masterListingAttributes.status,
      sortOrder: masterListingAttributes.sortOrder,
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
        eq(masterListingAttributes.status, 'Active'),
        eq(masterListingSubcategories.isActive, true),
        eq(masterListingCategories.isActive, true)
      )
    )
    .orderBy(
      masterListingCategories.sortOrder,
      masterListingSubcategories.sortOrder,
      masterListingAttributes.sortOrder,
      masterListingAttributes.name
    );

  const listingCategoryGroups = categoryRows.map((category) => ({
    mainCategory: category.name,
    subcategories: subcategoryRows
      .filter((sub) => sub.categoryId === category.id)
      .map((sub) => sub.name),
  }));

  const listingPriceUnits = unitRows.map((unit) => unit.name);
  const attributesByKey = groupAttributesByTableRows(attributeRows);

  return {
    listingCategoryGroups:
      listingCategoryGroups.length > 0 ? listingCategoryGroups : DEFAULT_CATEGORY_GROUPS,
    listingPriceUnits: listingPriceUnits.length > 0 ? listingPriceUnits : DEFAULT_PRICE_UNITS,
    attributesByKey,
  };
}

export async function syncMasterDataTables(input: MasterDataSnapshot): Promise<void> {
  const categories = normalizeGroups(input.listingCategoryGroups);
  const units = Array.from(
    new Set(input.listingPriceUnits.map((unit) => normalizeText(unit)).filter(Boolean))
  );
  const attributesByKey = normalizeAttributesByKey(input.attributesByKey);

  await db.transaction(async (tx) => {
    const desiredCategoryNames = new Set(categories.map((category) => category.mainCategory));
    const desiredUnitNames = new Set(units);

    const existingCategories = await tx.select().from(masterListingCategories);
    const categoryRows: Array<{ id: string; name: string }> = [];
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
      const group = categories[categoryIndex];
      const [categoryRow] = await tx
        .insert(masterListingCategories)
        .values({
          name: group.mainCategory,
          sortOrder: categoryIndex,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: masterListingCategories.name,
          set: {
            sortOrder: categoryIndex,
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning({ id: masterListingCategories.id, name: masterListingCategories.name });
      if (categoryRow) categoryRows.push(categoryRow);
    }

    const currentCategories = await tx.select().from(masterListingCategories);
    const categoriesToDelete = existingCategories.filter(
      (category) => !desiredCategoryNames.has(category.name)
    );
    if (categoriesToDelete.length > 0) {
      await tx.delete(masterListingCategories).where(
        inArray(
          masterListingCategories.id,
          categoriesToDelete.map((category) => category.id)
        )
      );
    }

    const subcategoryRows: Array<{ id: string; categoryName: string; name: string }> = [];
    const existingSubcategories = await tx.select().from(masterListingSubcategories);
    const desiredSubcategoryPairs = new Set<string>();
    for (const categoryRow of categoryRows) {
      const group = categories.find((item) => item.mainCategory === categoryRow.name);
      if (!group) continue;
      for (let subIndex = 0; subIndex < group.subcategories.length; subIndex += 1) {
        const subcategoryName = group.subcategories[subIndex];
        desiredSubcategoryPairs.add(`${categoryRow.name}::${subcategoryName}`);
        const [subcategoryRow] = await tx
          .insert(masterListingSubcategories)
          .values({
            categoryId: categoryRow.id,
            name: subcategoryName,
            sortOrder: subIndex,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [masterListingSubcategories.categoryId, masterListingSubcategories.name],
            set: {
              sortOrder: subIndex,
              isActive: true,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: masterListingSubcategories.id,
            name: masterListingSubcategories.name,
            categoryId: masterListingSubcategories.categoryId,
          });
        if (subcategoryRow) {
          subcategoryRows.push({
            id: subcategoryRow.id,
            categoryName: categoryRow.name,
            name: subcategoryRow.name,
          });
        }
      }
    }

    const subcategoriesToDelete = existingSubcategories.filter((sub) => {
      const category = currentCategories.find((item) => item.id === sub.categoryId);
      if (!category) return true;
      return !desiredSubcategoryPairs.has(`${category.name}::${sub.name}`);
    });
    if (subcategoriesToDelete.length > 0) {
      await tx.delete(masterListingSubcategories).where(
        inArray(
          masterListingSubcategories.id,
          subcategoriesToDelete.map((sub) => sub.id)
        )
      );
    }

    const unitRows: Array<{ id: string; name: string }> = [];
    const existingUnits = await tx.select().from(masterListingUnits);
    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
      const unitName = units[unitIndex];
      const [unitRow] = await tx
        .insert(masterListingUnits)
        .values({
          name: unitName,
          sortOrder: unitIndex,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: masterListingUnits.name,
          set: {
            sortOrder: unitIndex,
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning({ id: masterListingUnits.id, name: masterListingUnits.name });
      if (unitRow) unitRows.push(unitRow);
    }
    const unitByName = new Map(unitRows.map((unit) => [unit.name, unit]));
    const unitsToDelete = existingUnits.filter((unit) => !desiredUnitNames.has(unit.name));
    if (unitsToDelete.length > 0) {
      await tx.delete(masterListingUnits).where(
        inArray(
          masterListingUnits.id,
          unitsToDelete.map((unit) => unit.id)
        )
      );
    }

    const existingAttributes = await tx.select().from(masterListingAttributes);
    const desiredAttributeKeys = new Set<string>();

    for (const [key, attributes] of Object.entries(attributesByKey)) {
      const [categoryName, subcategoryName] = key.split('::');
      const subcategory = subcategoryRows.find(
        (row) => row.categoryName === categoryName && row.name === subcategoryName
      );
      if (!subcategory) continue;

      for (let attributeIndex = 0; attributeIndex < attributes.length; attributeIndex += 1) {
        const attribute = attributes[attributeIndex];
        desiredAttributeKeys.add(`${subcategory.id}::${attribute.name}`);
        await tx
          .insert(masterListingAttributes)
          .values({
            subcategoryId: subcategory.id,
            name: attribute.name,
            fieldType: attribute.fieldType || 'Text',
            unitId: unitByName.get(attribute.unit)?.id || null,
            required: Boolean(attribute.required),
            status: attribute.status || 'Active',
            sortOrder: attributeIndex,
          })
          .onConflictDoUpdate({
            target: [masterListingAttributes.subcategoryId, masterListingAttributes.name],
            set: {
              fieldType: attribute.fieldType || 'Text',
              unitId: unitByName.get(attribute.unit)?.id || null,
              required: Boolean(attribute.required),
              status: attribute.status || 'Active',
              sortOrder: attributeIndex,
              updatedAt: new Date(),
            },
          });
      }
    }

    const attributesToDelete = existingAttributes.filter((attribute) => {
      const subcategory = subcategoryRows.find((row) => row.id === attribute.subcategoryId);
      if (!subcategory) return true;
      return !desiredAttributeKeys.has(`${subcategory.id}::${attribute.name}`);
    });
    if (attributesToDelete.length > 0) {
      await tx.delete(masterListingAttributes).where(
        inArray(
          masterListingAttributes.id,
          attributesToDelete.map((attribute) => attribute.id)
        )
      );
    }
  });
}
