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
  mainCategoryIcon?: string;
  subcategories: string[];
  subcategoryIcons?: Record<string, string>;
};

type MasterAttribute = {
  id: string;
  name: string;
  fieldType: string;
  unit: string;
  required: boolean;
  status: 'Active' | 'Inactive' | string;
};

type MasterAttributeAssignment = {
  attributeId: string;
  required: boolean;
  status: string;
};

type MasterDataSnapshot = {
  listingCategoryGroups: MasterCategoryGroup[];
  listingPriceUnits: string[];
  listingUnitsByKey: Record<string, string[]>;
  attributeCatalog: MasterAttribute[];
  commonFieldAssignments: MasterAttributeAssignment[];
  commonFields: MasterAttribute[];
  attributeAssignmentsByKey: Record<string, MasterAttributeAssignment[]>;
  attributesByKey: Record<string, MasterAttribute[]>;
};

type LegacyAttributeInput = {
  id?: unknown;
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

function normalizeIconMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, icon]) => {
      const normalizedKey = normalizeText(key);
      const normalizedIcon = normalizeText(icon);
      if (normalizedKey && normalizedIcon) acc[normalizedKey] = normalizedIcon;
      return acc;
    },
    {}
  );
}

function buildAttributeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `attribute:${slug || 'field'}`;
}

function normalizeGroups(value: unknown): MasterCategoryGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const entry = item as {
        mainCategory?: unknown;
        mainCategoryIcon?: unknown;
        subcategories?: unknown;
        subcategoryIcons?: unknown;
      };
      const mainCategoryIcon = normalizeText(entry.mainCategoryIcon);
      const subcategoryIcons = normalizeIconMap(entry.subcategoryIcons);
      return {
        mainCategory: normalizeText(entry.mainCategory),
        ...(mainCategoryIcon ? { mainCategoryIcon } : {}),
        subcategories: Array.isArray(entry.subcategories)
          ? Array.from(
              new Set(entry.subcategories.map((sub) => normalizeText(sub)).filter(Boolean))
            )
          : [],
        ...(Object.keys(subcategoryIcons).length > 0 ? { subcategoryIcons } : {}),
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
            id: normalizeText(entry.id) || buildAttributeId(name),
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

function normalizeAttributeCatalog(value: unknown): MasterAttribute[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, MasterAttribute>();
  for (const item of value) {
    const entry = item as LegacyAttributeInput;
    const name = normalizeText(entry.name);
    if (!name) continue;
    const id = normalizeText(entry.id) || buildAttributeId(name);
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name,
        fieldType: normalizeText(entry.fieldType) || 'Text',
        unit: normalizeText(entry.unit),
        required: Boolean(entry.required),
        status: normalizeText(entry.status) || 'Active',
      });
    }
  }
  return Array.from(byId.values());
}

function normalizeAttributeAssignmentsByKey(
  value: unknown
): Record<string, MasterAttributeAssignment[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, MasterAttributeAssignment[]>
  >((acc, [key, rawAssignments]) => {
    const normalizedKey = normalizeText(key);
    if (!normalizedKey || !Array.isArray(rawAssignments)) return acc;
    const assignments = rawAssignments
      .map((item) => {
        if (typeof item === 'string') {
          const attributeId = normalizeText(item);
          return attributeId ? { attributeId, required: false, status: 'Active' } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const entry = item as {
          attributeId?: unknown;
          required?: unknown;
          status?: unknown;
        };
        const attributeId = normalizeText(entry.attributeId);
        if (!attributeId) return null;
        return {
          attributeId,
          required: Boolean(entry.required),
          status: normalizeText(entry.status) || 'Active',
        } satisfies MasterAttributeAssignment;
      })
      .filter((item): item is MasterAttributeAssignment => Boolean(item));
    if (assignments.length > 0) acc[normalizedKey] = assignments;
    return acc;
  }, {});
}

function normalizeCommonFieldAssignments(value: unknown): MasterAttributeAssignment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const attributeId = normalizeText(item);
        return attributeId ? { attributeId, required: false, status: 'Active' } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const entry = item as {
        attributeId?: unknown;
        required?: unknown;
        status?: unknown;
      };
      const attributeId = normalizeText(entry.attributeId);
      if (!attributeId) return null;
      return {
        attributeId,
        required: Boolean(entry.required),
        status: normalizeText(entry.status) || 'Active',
      } satisfies MasterAttributeAssignment;
    })
    .filter((item): item is MasterAttributeAssignment => {
      if (!item || seen.has(item.attributeId)) return false;
      seen.add(item.attributeId);
      return true;
    });
}

function buildAttributeModelFromExpanded(attributesByKey: Record<string, MasterAttribute[]>): {
  attributeCatalog: MasterAttribute[];
  attributeAssignmentsByKey: Record<string, MasterAttributeAssignment[]>;
} {
  const catalogById = new Map<string, MasterAttribute>();
  const assignmentsByKey: Record<string, MasterAttributeAssignment[]> = {};
  for (const [key, attributes] of Object.entries(attributesByKey)) {
    const assignments: MasterAttributeAssignment[] = [];
    for (const attribute of attributes) {
      const id = normalizeText(attribute.id) || buildAttributeId(attribute.name);
      if (!catalogById.has(id)) catalogById.set(id, { ...attribute, id });
      assignments.push({
        attributeId: id,
        required: Boolean(attribute.required),
        status: normalizeText(attribute.status) || 'Active',
      });
    }
    if (assignments.length > 0) assignmentsByKey[key] = assignments;
  }
  return {
    attributeCatalog: Array.from(catalogById.values()),
    attributeAssignmentsByKey: assignmentsByKey,
  };
}

function resolveAttributesByKey(
  attributeCatalog: MasterAttribute[],
  assignmentsByKey: Record<string, MasterAttributeAssignment[]>
): Record<string, MasterAttribute[]> {
  const catalogById = new Map(attributeCatalog.map((attribute) => [attribute.id, attribute]));
  return Object.entries(assignmentsByKey).reduce<Record<string, MasterAttribute[]>>(
    (acc, [key, assignments]) => {
      const attributes = assignments
        .map((assignment) => {
          const attribute = catalogById.get(assignment.attributeId);
          if (!attribute) return null;
          return {
            ...attribute,
            required: Boolean(assignment.required),
            status: assignment.status || attribute.status || 'Active',
          };
        })
        .filter((attribute): attribute is MasterAttribute => Boolean(attribute));
      if (attributes.length > 0) acc[key] = attributes;
      return acc;
    },
    {}
  );
}

function resolveAttributeAssignments(
  attributeCatalog: MasterAttribute[],
  assignments: MasterAttributeAssignment[]
): MasterAttribute[] {
  const catalogById = new Map(attributeCatalog.map((attribute) => [attribute.id, attribute]));
  return assignments
    .map((assignment) => {
      const attribute = catalogById.get(assignment.attributeId);
      if (!attribute) return null;
      return {
        ...attribute,
        required: Boolean(assignment.required),
        status: assignment.status || attribute.status || 'Active',
      };
    })
    .filter((attribute): attribute is MasterAttribute => Boolean(attribute));
}

function mergeCommonAttributes(
  commonFields: MasterAttribute[],
  attributesByKey: Record<string, MasterAttribute[]>,
  listingCategoryGroups: MasterCategoryGroup[]
): Record<string, MasterAttribute[]> {
  const keys = new Set(Object.keys(attributesByKey));
  if (commonFields.length > 0) {
    for (const group of listingCategoryGroups) {
      for (const subcategory of group.subcategories) {
        keys.add(buildAttributeKey(group.mainCategory, subcategory));
      }
    }
  }

  return Array.from(keys).reduce<Record<string, MasterAttribute[]>>((acc, key) => {
    const byId = new Map<string, MasterAttribute>();
    for (const attribute of commonFields) byId.set(attribute.id, attribute);
    for (const attribute of attributesByKey[key] || []) {
      if (!byId.has(attribute.id)) byId.set(attribute.id, attribute);
    }
    const attributes = Array.from(byId.values());
    if (attributes.length > 0) acc[key] = attributes;
    return acc;
  }, {});
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
      id: buildAttributeId(row.attributeName),
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
  const legacyAttributeModel = buildAttributeModelFromExpanded(legacyAttributes);
  const snapshot: MasterDataSnapshot = {
    listingCategoryGroups: legacyGroups.length > 0 ? legacyGroups : DEFAULT_CATEGORY_GROUPS,
    listingPriceUnits: legacyUnits.length > 0 ? legacyUnits : DEFAULT_PRICE_UNITS,
    listingUnitsByKey: {},
    commonFieldAssignments: [],
    commonFields: [],
    ...legacyAttributeModel,
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
      iconUrl: masterListingSubcategories.iconUrl,
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
    .select({
      id: masterListingUnits.id,
      name: masterListingUnits.name,
      subcategoryId: masterListingUnits.subcategoryId,
      sortOrder: masterListingUnits.sortOrder,
    })
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
    ...(category.iconUrl ? { mainCategoryIcon: category.iconUrl } : {}),
    subcategories: subcategoryRows
      .filter((sub) => sub.categoryId === category.id)
      .map((sub) => sub.name),
    subcategoryIcons: Object.fromEntries(
      subcategoryRows
        .filter((sub) => sub.categoryId === category.id && sub.iconUrl)
        .map((sub) => [sub.name, sub.iconUrl as string])
    ),
  }));

  const subcategoryById = new Map(
    subcategoryRows.map((subcategory) => [subcategory.id, subcategory])
  );
  const listingUnitsByKey = unitRows.reduce<Record<string, string[]>>((acc, unit) => {
    const subcategory = unit.subcategoryId ? subcategoryById.get(unit.subcategoryId) : undefined;
    if (!subcategory) return acc;
    const key = buildAttributeKey(subcategory.categoryName, subcategory.name);
    if (!acc[key]) acc[key] = [];
    if (!acc[key].includes(unit.name)) acc[key].push(unit.name);
    return acc;
  }, {});
  const listingPriceUnits = Array.from(
    new Set(unitRows.filter((unit) => !unit.subcategoryId).map((unit) => unit.name))
  );
  const legacyAttributesByKey = groupAttributesByTableRows(attributeRows);
  const derivedAttributeModel = buildAttributeModelFromExpanded(legacyAttributesByKey);
  const hasConfiguredAttributeModel =
    Array.isArray(settings?.listingAttributeCatalog) &&
    settings?.listingAttributeAssignmentsByKey &&
    typeof settings.listingAttributeAssignmentsByKey === 'object' &&
    !Array.isArray(settings.listingAttributeAssignmentsByKey);
  const attributeCatalog = hasConfiguredAttributeModel
    ? normalizeAttributeCatalog(settings.listingAttributeCatalog)
    : derivedAttributeModel.attributeCatalog;
  const attributeAssignmentsByKey = hasConfiguredAttributeModel
    ? normalizeAttributeAssignmentsByKey(settings.listingAttributeAssignmentsByKey)
    : derivedAttributeModel.attributeAssignmentsByKey;
  const commonFieldAssignments = normalizeCommonFieldAssignments(
    settings?.listingCommonFieldAssignments
  );
  const commonFields = resolveAttributeAssignments(attributeCatalog, commonFieldAssignments);
  const localAttributesByKey = resolveAttributesByKey(attributeCatalog, attributeAssignmentsByKey);
  const resolvedCategoryGroups =
    listingCategoryGroups.length > 0 ? listingCategoryGroups : DEFAULT_CATEGORY_GROUPS;
  const attributesByKey = mergeCommonAttributes(
    commonFields,
    localAttributesByKey,
    resolvedCategoryGroups
  );

  return {
    listingCategoryGroups: resolvedCategoryGroups,
    listingPriceUnits: listingPriceUnits.length > 0 ? listingPriceUnits : DEFAULT_PRICE_UNITS,
    listingUnitsByKey,
    attributeCatalog,
    commonFieldAssignments,
    commonFields,
    attributeAssignmentsByKey,
    attributesByKey,
  };
}

export async function syncMasterDataTables(input: MasterDataSnapshot): Promise<void> {
  const categories = normalizeGroups(input.listingCategoryGroups);
  const attributeCatalog = normalizeAttributeCatalog(input.attributeCatalog);
  const attributeAssignmentsByKey = normalizeAttributeAssignmentsByKey(
    input.attributeAssignmentsByKey
  );
  const commonFieldAssignments = normalizeCommonFieldAssignments(input.commonFieldAssignments);
  const commonFields = resolveAttributeAssignments(attributeCatalog, commonFieldAssignments);
  const localAttributesByKey = resolveAttributesByKey(attributeCatalog, attributeAssignmentsByKey);
  const attributesByKey = mergeCommonAttributes(commonFields, localAttributesByKey, categories);
  const listingUnitsByKey: Record<string, string[]> = {};
  for (const [key, attributes] of Object.entries(attributesByKey)) {
    const fieldUnits = attributes.map((attribute) => attribute.unit).filter(Boolean);
    if (fieldUnits.length > 0) listingUnitsByKey[key] = Array.from(new Set(fieldUnits));
  }
  await db.transaction(async (tx) => {
    const desiredCategoryNames = new Set(categories.map((category) => category.mainCategory));

    const existingCategories = await tx.select().from(masterListingCategories);
    const categoryRows: Array<{ id: string; name: string }> = [];
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
      const group = categories[categoryIndex];
      const existingCategory = existingCategories.find(
        (category) => category.name === group.mainCategory
      );
      const [categoryRow] = await tx
        .insert(masterListingCategories)
        .values({
          name: group.mainCategory,
          iconUrl: group.mainCategoryIcon ?? existingCategory?.iconUrl ?? null,
          sortOrder: categoryIndex,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: masterListingCategories.name,
          set: {
            sortOrder: categoryIndex,
            iconUrl: group.mainCategoryIcon ?? existingCategory?.iconUrl ?? null,
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

    const existingSubcategories = await tx.select().from(masterListingSubcategories);
    const subcategoryRows: Array<{ id: string; categoryName: string; name: string }> = [];
    const desiredSubcategoryPairs = new Set<string>();
    for (const categoryRow of categoryRows) {
      const group = categories.find((item) => item.mainCategory === categoryRow.name);
      if (!group) continue;
      for (let subIndex = 0; subIndex < group.subcategories.length; subIndex += 1) {
        const subcategoryName = group.subcategories[subIndex];
        const existingSubcategory = existingSubcategories.find(
          (subcategory) =>
            subcategory.categoryId === categoryRow.id && subcategory.name === subcategoryName
        );
        const requestedIcon = group.subcategoryIcons?.[subcategoryName];
        desiredSubcategoryPairs.add(`${categoryRow.name}::${subcategoryName}`);
        const [subcategoryRow] = await tx
          .insert(masterListingSubcategories)
          .values({
            categoryId: categoryRow.id,
            name: subcategoryName,
            iconUrl: requestedIcon ?? existingSubcategory?.iconUrl ?? null,
            sortOrder: subIndex,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [masterListingSubcategories.categoryId, masterListingSubcategories.name],
            set: {
              sortOrder: subIndex,
              iconUrl: requestedIcon ?? existingSubcategory?.iconUrl ?? null,
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

    const unitRows: Array<{ id: string; name: string; subcategoryId: string | null }> = [];
    const existingUnits = await tx.select().from(masterListingUnits);
    const subcategoryByKey = new Map(
      subcategoryRows.map((subcategory) => [
        buildAttributeKey(subcategory.categoryName, subcategory.name),
        subcategory,
      ])
    );
    const unitByScopedKey = new Map<string, { id: string; name: string; subcategoryId: string }>();
    const unitByLegacyName = new Map<string, { id: string; name: string; subcategoryId: null }>();

    for (const [key, scopedUnits] of Object.entries(listingUnitsByKey)) {
      const subcategory = subcategoryByKey.get(key);
      if (!subcategory) continue;
      for (let unitIndex = 0; unitIndex < scopedUnits.length; unitIndex += 1) {
        const unitName = scopedUnits[unitIndex];
        const [unitRow] = await tx
          .insert(masterListingUnits)
          .values({
            name: unitName,
            subcategoryId: subcategory.id,
            sortOrder: unitIndex,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [masterListingUnits.subcategoryId, masterListingUnits.name],
            set: {
              sortOrder: unitIndex,
              isActive: true,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: masterListingUnits.id,
            name: masterListingUnits.name,
            subcategoryId: masterListingUnits.subcategoryId,
          });
        if (!unitRow || !unitRow.subcategoryId) continue;
        const normalizedRow = {
          id: unitRow.id,
          name: unitRow.name,
          subcategoryId: unitRow.subcategoryId,
        };
        unitRows.push(normalizedRow);
        unitByScopedKey.set(`${subcategory.id}::${unitName}`, normalizedRow);
      }
    }

    const legacyUnits = input.listingPriceUnits.map((unit) => normalizeText(unit)).filter(Boolean);
    for (let unitIndex = 0; unitIndex < legacyUnits.length; unitIndex += 1) {
      const unitName = legacyUnits[unitIndex];
      const existingUnit = existingUnits.find(
        (unit) => unit.subcategoryId === null && unit.name === unitName
      );
      if (existingUnit) {
        await tx
          .update(masterListingUnits)
          .set({ sortOrder: unitIndex, isActive: true, updatedAt: new Date() })
          .where(eq(masterListingUnits.id, existingUnit.id));
        const normalizedRow = {
          id: existingUnit.id,
          name: existingUnit.name,
          subcategoryId: null,
        } as const;
        unitRows.push(normalizedRow);
        unitByLegacyName.set(unitName, normalizedRow);
        continue;
      }

      const [unitRow] = await tx
        .insert(masterListingUnits)
        .values({
          name: unitName,
          subcategoryId: null,
          sortOrder: unitIndex,
          isActive: true,
        })
        .returning({
          id: masterListingUnits.id,
          name: masterListingUnits.name,
          subcategoryId: masterListingUnits.subcategoryId,
        });
      if (unitRow) {
        const normalizedRow = { id: unitRow.id, name: unitRow.name, subcategoryId: null } as const;
        unitRows.push(normalizedRow);
        unitByLegacyName.set(unitName, normalizedRow);
      }
    }
    const desiredUnitIds = new Set(unitRows.map((unit) => unit.id));
    const unitsToDelete = existingUnits.filter((unit) => !desiredUnitIds.has(unit.id));
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
        const scopedUnit = attribute.unit
          ? unitByScopedKey.get(`${subcategory.id}::${attribute.unit}`)
          : undefined;
        const legacyUnit = attribute.unit ? unitByLegacyName.get(attribute.unit) : undefined;
        desiredAttributeKeys.add(`${subcategory.id}::${attribute.name}`);
        await tx
          .insert(masterListingAttributes)
          .values({
            subcategoryId: subcategory.id,
            name: attribute.name,
            fieldType: attribute.fieldType || 'Text',
            unitId: scopedUnit?.id || legacyUnit?.id || null,
            required: Boolean(attribute.required),
            status: attribute.status || 'Active',
            sortOrder: attributeIndex,
          })
          .onConflictDoUpdate({
            target: [masterListingAttributes.subcategoryId, masterListingAttributes.name],
            set: {
              fieldType: attribute.fieldType || 'Text',
              unitId: scopedUnit?.id || legacyUnit?.id || null,
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
