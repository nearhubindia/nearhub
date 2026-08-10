import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  MoreVertical,
  Plus,
  Search,
  Tag,
  Trash2,
  Pencil,
  ImagePlus,
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { compressImageFile } from '@/lib/image-compression';
import { uploadImageToBackend } from '@/lib/media-upload';
import { getAdminToken } from '@/features/admin/constants/admin-constants';
import AdminDrawer from '@/features/admin/components/AdminDrawer';
import {
  ADMIN_CATEGORY_GROUPS,
  type AdminCategoryGroup,
} from '@/features/admin/constants/listing-taxonomy';

type ListingAttribute = {
  id: string;
  name: string;
  fieldType: string;
  unit: string;
  required: boolean;
  status: 'Active' | 'Inactive';
};

type AttributeAssignment = {
  attributeId: string;
  required: boolean;
  status: string;
};

type FieldScope = 'common' | 'subcategory';

type ModalType =
  | 'category'
  | 'subcategory'
  | 'attribute'
  | 'commonField'
  | 'catalogAttribute'
  | null;
type EditingContext = {
  type: Exclude<ModalType, null>;
  index: number;
  categoryIndex?: number;
};

function normalizeCategoryGroups(value: unknown): AdminCategoryGroup[] {
  if (!Array.isArray(value)) return ADMIN_CATEGORY_GROUPS;
  const groups = value
    .map((item) => {
      const entry = item as {
        mainCategory?: unknown;
        mainCategoryIcon?: unknown;
        subcategories?: unknown;
        subcategoryIcons?: unknown;
      };
      const mainCategoryIcon = String(entry.mainCategoryIcon || '').trim();
      const subcategoryIcons =
        entry.subcategoryIcons && typeof entry.subcategoryIcons === 'object'
          ? Object.entries(entry.subcategoryIcons as Record<string, unknown>).reduce<
              Record<string, string>
            >((acc, [key, icon]) => {
              const normalizedKey = String(key || '').trim();
              const normalizedIcon = String(icon || '').trim();
              if (normalizedKey && normalizedIcon) acc[normalizedKey] = normalizedIcon;
              return acc;
            }, {})
          : {};
      return {
        mainCategory: String(entry.mainCategory || '').trim(),
        ...(mainCategoryIcon ? { mainCategoryIcon } : {}),
        subcategories: Array.isArray(entry.subcategories)
          ? entry.subcategories.map((sub) => String(sub || '').trim()).filter(Boolean)
          : [],
        ...(Object.keys(subcategoryIcons).length > 0 ? { subcategoryIcons } : {}),
      };
    })
    .filter((item) => item.mainCategory && item.subcategories.length > 0);
  return groups.length ? groups : ADMIN_CATEGORY_GROUPS;
}

async function uploadMasterDataIcon(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  const compressedFile = await compressImageFile(file, 'icon');
  return uploadImageToBackend(compressedFile, { preset: 'icon' });
}

function IconUploadField({
  value,
  label,
  isUploading,
  error,
  onUpload,
}: {
  value: string;
  label: string;
  isUploading: boolean;
  error?: string;
  onUpload: (file: File) => void;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = '';
          }}
        />
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
          {value ? (
            <img src={value} alt="Icon preview" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus size={20} className="text-slate-400" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-700">
            {isUploading ? 'Uploading icon...' : value ? 'Change icon' : `Upload ${label} icon`}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">PNG, JPG, WEBP</span>
        </span>
      </label>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

function getAttributeId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `attribute:${slug || 'field'}`;
}

function normalizeAttributes(value: unknown): Record<string, ListingAttribute[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, ListingAttribute[]>
  >((acc, [key, rawAttributes]) => {
    if (!Array.isArray(rawAttributes)) return acc;
    const attributes = rawAttributes
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const entry = item as Record<string, unknown>;
        const name = String(entry.name || '').trim();
        if (!name) return null;
        return {
          id: String(entry.id || getAttributeId(name)).trim(),
          name,
          fieldType: String(entry.fieldType || 'Text').trim() || 'Text',
          unit: String(entry.unit || '').trim(),
          required: Boolean(entry.required),
          status: (String(entry.status || 'Active').trim() || 'Active') as 'Active' | 'Inactive',
        };
      })
      .filter((item): item is ListingAttribute => Boolean(item));
    if (attributes.length > 0) acc[key] = attributes;
    return acc;
  }, {});
}

function buildAttributeModel(attributesByKey: Record<string, ListingAttribute[]>): {
  catalog: ListingAttribute[];
  assignments: Record<string, AttributeAssignment[]>;
} {
  const catalog = new Map<string, ListingAttribute>();
  const assignments: Record<string, AttributeAssignment[]> = {};
  Object.entries(attributesByKey).forEach(([key, attributes]) => {
    assignments[key] = attributes.map((attribute) => {
      const id = attribute.id || getAttributeId(attribute.name);
      if (!catalog.has(id)) catalog.set(id, { ...attribute, id });
      return {
        attributeId: id,
        required: Boolean(attribute.required),
        status: attribute.status || 'Active',
      };
    });
  });
  return { catalog: Array.from(catalog.values()), assignments };
}

function getAttributeKey(category?: string, subcategory?: string): string {
  return `${String(category || '').trim()}::${String(subcategory || '').trim()}`;
}

function pillCount(count: number): string {
  return String(count).padStart(2, '0');
}

function colorByIndex(index: number): string {
  const colors = [
    'bg-emerald-50 text-emerald-600 border-emerald-100',
    'bg-blue-50 text-blue-600 border-blue-100',
    'bg-violet-50 text-violet-600 border-violet-100',
    'bg-orange-50 text-orange-500 border-orange-100',
    'bg-pink-50 text-pink-600 border-pink-100',
    'bg-cyan-50 text-cyan-600 border-cyan-100',
  ];
  return colors[index % colors.length];
}

export default function MasterDataManagementPage() {
  const [listingCategoryGroups, setListingCategoryGroups] =
    useState<AdminCategoryGroup[]>(ADMIN_CATEGORY_GROUPS);
  const [attributeCatalog, setAttributeCatalog] = useState<ListingAttribute[]>([]);
  const [attributeAssignmentsByKey, setAttributeAssignmentsByKey] = useState<
    Record<string, AttributeAssignment[]>
  >({});
  const [commonFieldAssignments, setCommonFieldAssignments] = useState<AttributeAssignment[]>([]);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedSubcategoryIndex, setSelectedSubcategoryIndex] = useState(0);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [attributeQuery, setAttributeQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [subCategoryIcon, setSubCategoryIcon] = useState('');
  const [subCategoryMainCategory, setSubCategoryMainCategory] = useState('');
  const [fieldMainCategory, setFieldMainCategory] = useState('');
  const [fieldSubcategory, setFieldSubcategory] = useState('');
  const [attributeId, setAttributeId] = useState('');
  const [attributeName, setAttributeName] = useState('');
  const [attributeFieldType, setAttributeFieldType] = useState('Text');
  const [attributeUnit, setAttributeUnit] = useState('');
  const [attributeRequired, setAttributeRequired] = useState(false);
  const [attributeScope, setAttributeScope] = useState<FieldScope>('subcategory');
  const [editingContext, setEditingContext] = useState<EditingContext | null>(null);
  const [categoryMenuIndex, setCategoryMenuIndex] = useState<number | null>(null);
  const [subcategoryMenuIndex, setSubcategoryMenuIndex] = useState<number | null>(null);
  const [attributeMenuIndex, setAttributeMenuIndex] = useState<number | null>(null);
  const [commonFieldMenuIndex, setCommonFieldMenuIndex] = useState<number | null>(null);
  const [catalogMenuIndex, setCatalogMenuIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconUploadError, setIconUploadError] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const hasLoadedMasterData = useRef(false);
  const skipNextAutoSave = useRef(true);
  const saveInFlight = useRef(false);
  const pendingAutoSave = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    const fetchSettings = async () => {
      let loaded = false;
      try {
        const response = await fetch(`${getApiUrl()}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.settings?.listingCategoryGroups)) {
          setListingCategoryGroups(normalizeCategoryGroups(data.settings.listingCategoryGroups));
        }
        const legacyAttributes = normalizeAttributes(data.settings?.attributesByKey);
        const legacyModel = buildAttributeModel(legacyAttributes);
        const configuredCatalog =
          normalizeAttributes({
            catalog: data.settings?.attributeCatalog,
          }).catalog || [];
        const configuredAssignments = data.settings?.attributeAssignmentsByKey;
        if (
          configuredCatalog.length > 0 ||
          (configuredAssignments && typeof configuredAssignments === 'object')
        ) {
          setAttributeCatalog(configuredCatalog);
          setAttributeAssignmentsByKey(
            (configuredAssignments || {}) as Record<string, AttributeAssignment[]>
          );
        } else {
          setAttributeCatalog(legacyModel.catalog);
          setAttributeAssignmentsByKey(legacyModel.assignments);
        }
        if (Array.isArray(data.settings?.commonFieldAssignments)) {
          setCommonFieldAssignments(data.settings.commonFieldAssignments);
        }
        loaded = true;
      } finally {
        if (loaded) hasLoadedMasterData.current = true;
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const selectedCategory = listingCategoryGroups[selectedCategoryIndex] || listingCategoryGroups[0];
  const selectedSubcategoryIndexForView = Math.min(
    selectedSubcategoryIndex,
    Math.max(0, (selectedCategory?.subcategories.length || 1) - 1)
  );
  const selectedSubcategory =
    selectedCategory?.subcategories[selectedSubcategoryIndexForView] || '';
  const selectedAttributeKey = getAttributeKey(selectedCategory?.mainCategory, selectedSubcategory);
  const selectedAttributes = useMemo(() => {
    const catalogById = new Map(attributeCatalog.map((attribute) => [attribute.id, attribute]));
    return (attributeAssignmentsByKey[selectedAttributeKey] || [])
      .map((assignment) => {
        const attribute = catalogById.get(assignment.attributeId);
        return attribute
          ? {
              ...attribute,
              required: assignment.required,
              status: (assignment.status || attribute.status || 'Active') as 'Active' | 'Inactive',
            }
          : null;
      })
      .filter((attribute): attribute is ListingAttribute => Boolean(attribute));
  }, [attributeAssignmentsByKey, attributeCatalog, selectedAttributeKey]);
  const commonFields = useMemo(() => {
    const catalogById = new Map(attributeCatalog.map((attribute) => [attribute.id, attribute]));
    return commonFieldAssignments
      .map((assignment) => {
        const attribute = catalogById.get(assignment.attributeId);
        return attribute
          ? {
              ...attribute,
              required: assignment.required,
              status: (assignment.status || attribute.status || 'Active') as 'Active' | 'Inactive',
            }
          : null;
      })
      .filter((attribute): attribute is ListingAttribute => Boolean(attribute));
  }, [attributeCatalog, commonFieldAssignments]);
  const displayedFields = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...commonFields.map((attribute) => ({ ...attribute, isCommon: true })),
      ...selectedAttributes
        .filter((attribute) => !commonFields.some((common) => common.id === attribute.id))
        .map((attribute) => ({ ...attribute, isCommon: false })),
    ].filter((attribute) => {
      if (seen.has(attribute.id)) return false;
      seen.add(attribute.id);
      return true;
    });
  }, [commonFields, selectedAttributes]);
  const filteredCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();
    return listingCategoryGroups.filter((group) => {
      if (!term) return true;
      return (
        group.mainCategory.toLowerCase().includes(term) ||
        group.subcategories.some((sub) => sub.toLowerCase().includes(term))
      );
    });
  }, [categoryQuery, listingCategoryGroups]);

  const filteredSubcategories = useMemo(() => {
    const term = subcategoryQuery.trim().toLowerCase();
    const subs = selectedCategory?.subcategories || [];
    return term ? subs.filter((sub) => sub.toLowerCase().includes(term)) : subs;
  }, [selectedCategory, subcategoryQuery]);

  const filteredAttributes = useMemo(() => {
    const term = attributeQuery.trim().toLowerCase();
    return term
      ? displayedFields.filter((item) => {
          const text = `${item.name} ${item.fieldType} ${item.unit}`.toLowerCase();
          return text.includes(term);
        })
      : displayedFields;
  }, [attributeQuery, displayedFields]);

  const filteredCatalog = useMemo(() => {
    const term = catalogQuery.trim().toLowerCase();
    return term
      ? attributeCatalog.filter((attribute) =>
          `${attribute.name} ${attribute.fieldType} ${attribute.unit}`.toLowerCase().includes(term)
        )
      : attributeCatalog;
  }, [attributeCatalog, catalogQuery]);
  const fieldSubcategoryOptions = useMemo(
    () =>
      listingCategoryGroups.find((group) => group.mainCategory === fieldMainCategory)
        ?.subcategories || [],
    [fieldMainCategory, listingCategoryGroups]
  );

  const save = useCallback(async () => {
    if (saveInFlight.current) {
      pendingAutoSave.current = true;
      return;
    }

    saveInFlight.current = true;
    try {
      setIsSaving(true);
      setMessage(null);
      const response = await fetch(`${getApiUrl()}/api/admin/settings/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          listingCategoryGroups,
          attributeCatalog,
          commonFieldAssignments,
          attributeAssignmentsByKey,
        }),
      });
      if (!response.ok) throw new Error('Failed to save master data');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save master data',
      });
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
      if (pendingAutoSave.current) {
        pendingAutoSave.current = false;
        autoSaveTimer.current = setTimeout(() => {
          autoSaveTimer.current = null;
          void saveRef.current();
        }, 350);
      }
    }
  }, [attributeAssignmentsByKey, attributeCatalog, commonFieldAssignments, listingCategoryGroups]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (isLoading || !hasLoadedMasterData.current) return;
    if (skipNextAutoSave.current) {
      skipNextAutoSave.current = false;
      return;
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (saveInFlight.current) {
      pendingAutoSave.current = true;
      return;
    }

    autoSaveTimer.current = setTimeout(() => {
      autoSaveTimer.current = null;
      void saveRef.current();
    }, 550);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    attributeAssignmentsByKey,
    attributeCatalog,
    commonFieldAssignments,
    isLoading,
    listingCategoryGroups,
  ]);

  const openModal = (type: ModalType) => {
    setModalType(type);
    setEditingContext(null);
    setCategoryName('');
    setCategoryIcon('');
    setIconUploadError('');
    setSubCategoryName('');
    setSubCategoryIcon('');
    setSubCategoryMainCategory(
      selectedCategory?.mainCategory || listingCategoryGroups[0]?.mainCategory || ''
    );
    setFieldMainCategory(
      selectedCategory?.mainCategory || listingCategoryGroups[0]?.mainCategory || ''
    );
    setFieldSubcategory(
      selectedSubcategory ||
        listingCategoryGroups.find(
          (group) =>
            group.mainCategory ===
            (selectedCategory?.mainCategory || listingCategoryGroups[0]?.mainCategory)
        )?.subcategories[0] ||
        ''
    );
    setAttributeId(attributeCatalog[0]?.id || '');
    setAttributeName('');
    setAttributeFieldType('Text');
    setAttributeUnit('');
    setAttributeRequired(false);
    setAttributeScope(type === 'commonField' ? 'common' : 'subcategory');
  };

  const openEditModal = (type: Exclude<ModalType, null>, index: number) => {
    setEditingContext({
      type,
      index,
      categoryIndex: type === 'subcategory' ? selectedCategoryIndex : undefined,
    });
    setModalType(type);
    setCategoryName('');
    setCategoryIcon('');
    setIconUploadError('');
    setSubCategoryName('');
    setSubCategoryIcon('');
    setSubCategoryMainCategory(
      selectedCategory?.mainCategory || listingCategoryGroups[0]?.mainCategory || ''
    );
    setFieldMainCategory(
      selectedCategory?.mainCategory || listingCategoryGroups[0]?.mainCategory || ''
    );
    setFieldSubcategory(selectedSubcategory || '');
    setAttributeId(attributeCatalog[0]?.id || '');
    setAttributeName('');
    setAttributeFieldType('Text');
    setAttributeUnit('');
    setAttributeRequired(false);
    setAttributeScope(type === 'commonField' ? 'common' : 'subcategory');

    if (type === 'category') {
      setCategoryName(listingCategoryGroups[index]?.mainCategory || '');
      setCategoryIcon(listingCategoryGroups[index]?.mainCategoryIcon || '');
    }
    if (type === 'subcategory') {
      const name = selectedCategory?.subcategories[index] || '';
      setSubCategoryName(name);
      setSubCategoryIcon(selectedCategory?.subcategoryIcons?.[name] || '');
      setSubCategoryMainCategory(selectedCategory?.mainCategory || '');
    }
    if (type === 'attribute') {
      const attribute = selectedAttributes[index];
      setAttributeId(attribute?.id || '');
      setAttributeRequired(Boolean(attribute?.required));
    }
    if (type === 'commonField') {
      const attribute = commonFields[index];
      setAttributeId(attribute?.id || '');
      setAttributeRequired(Boolean(attribute?.required));
    }
    if (type === 'catalogAttribute') {
      const attribute = attributeCatalog[index];
      setAttributeId(attribute?.id || '');
      setAttributeName(attribute?.name || '');
      setAttributeFieldType(attribute?.fieldType || 'Text');
      setAttributeUnit(attribute?.unit || '');
      setAttributeRequired(Boolean(attribute?.required));
    }
  };

  const closeModal = () => {
    setModalType(null);
    setEditingContext(null);
  };

  const handleIconUpload = async (file: File, setIcon: (value: string) => void) => {
    try {
      setIsUploadingIcon(true);
      setIconUploadError('');
      setMessage(null);
      setIcon(await uploadMasterDataIcon(file));
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to upload icon',
      });
      setIconUploadError(error instanceof Error ? error.message : 'Failed to upload icon');
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const submitModal = () => {
    if (modalType === 'category') {
      const name = categoryName.trim();
      if (!name) return;
      setListingCategoryGroups((groups) =>
        editingContext?.type === 'category'
          ? groups.map((group, index) =>
              index === editingContext.index
                ? {
                    ...group,
                    mainCategory: name,
                    ...(categoryIcon ? { mainCategoryIcon: categoryIcon } : {}),
                  }
                : group
            )
          : [
              ...groups,
              {
                mainCategory: name,
                subcategories: ['Other'],
                ...(categoryIcon ? { mainCategoryIcon: categoryIcon } : {}),
              },
            ]
      );
    }

    if (modalType === 'subcategory') {
      const name = subCategoryName.trim();
      const targetCategoryIndex = listingCategoryGroups.findIndex(
        (group) => group.mainCategory === subCategoryMainCategory
      );
      if (!name || targetCategoryIndex < 0) return;
      setListingCategoryGroups((groups) => {
        const nextGroups = groups.map((group) => ({
          ...group,
          subcategories: [...group.subcategories],
          subcategoryIcons: { ...(group.subcategoryIcons || {}) },
        }));
        const isEditing = editingContext?.type === 'subcategory';
        if (!isEditing) {
          const targetGroup = nextGroups[targetCategoryIndex];
          if (!targetGroup.subcategories.includes(name)) targetGroup.subcategories.push(name);
          if (subCategoryIcon) targetGroup.subcategoryIcons[name] = subCategoryIcon;
          return nextGroups;
        }

        const sourceCategoryIndex = editingContext.categoryIndex ?? selectedCategoryIndex;
        const sourceGroup = nextGroups[sourceCategoryIndex];
        const previousName = sourceGroup?.subcategories[editingContext.index];
        if (!sourceGroup || !previousName) return groups;
        const icon = subCategoryIcon || sourceGroup.subcategoryIcons[previousName];
        sourceGroup.subcategories.splice(editingContext.index, 1);
        delete sourceGroup.subcategoryIcons[previousName];

        const targetGroup = nextGroups[targetCategoryIndex];
        if (sourceCategoryIndex === targetCategoryIndex) {
          targetGroup.subcategories.splice(editingContext.index, 0, name);
        } else if (!targetGroup.subcategories.includes(name)) {
          targetGroup.subcategories.push(name);
        }
        if (icon) targetGroup.subcategoryIcons[name] = icon;
        return nextGroups;
      });
    }

    if (modalType === 'catalogAttribute') {
      const name = attributeName.trim();
      if (!name) return;
      const id =
        editingContext?.type === 'catalogAttribute'
          ? attributeCatalog[editingContext.index]?.id || getAttributeId(name)
          : getAttributeId(name);
      if (
        editingContext?.type !== 'catalogAttribute' &&
        attributeCatalog.some((attribute) => attribute.id === id)
      ) {
        setMessage({ type: 'error', text: 'That attribute already exists in the catalog.' });
        return;
      }
      const value: ListingAttribute = {
        id,
        name,
        fieldType: attributeFieldType,
        unit: attributeUnit.trim(),
        required: false,
        status: 'Active',
      };
      setAttributeCatalog((catalog) =>
        editingContext?.type === 'catalogAttribute'
          ? catalog.map((attribute, index) =>
              index === editingContext.index
                ? { ...attribute, ...value, required: false }
                : attribute
            )
          : [...catalog, value]
      );
    }

    if (modalType === 'attribute' || modalType === 'commonField') {
      if (!attributeId || !attributeCatalog.some((attribute) => attribute.id === attributeId)) {
        setMessage({ type: 'error', text: 'Select an attribute from the catalog first.' });
        return;
      }
      const value: AttributeAssignment = {
        attributeId,
        required: attributeRequired,
        status: 'Active',
      };
      if (attributeScope === 'common') {
        if (
          commonFieldAssignments.some(
            (assignment, index) =>
              assignment.attributeId === attributeId &&
              !(editingContext?.type === 'commonField' && index === editingContext.index)
          )
        ) {
          setMessage({
            type: 'error',
            text: 'That attribute is already enabled as a common field.',
          });
          return;
        }
        setCommonFieldAssignments((current) => {
          const next = [...current];
          if (editingContext?.type === 'commonField') next[editingContext.index] = value;
          else if (!next.some((assignment) => assignment.attributeId === attributeId))
            next.push(value);
          return next;
        });
      } else {
        const targetAttributeKey = getAttributeKey(fieldMainCategory, fieldSubcategory);
        if (!fieldMainCategory || !fieldSubcategory) {
          setMessage({
            type: 'error',
            text: 'Select a category and subcategory for this field.',
          });
          return;
        }
        if (
          commonFieldAssignments.some((assignment) => assignment.attributeId === attributeId) &&
          editingContext?.type !== 'attribute'
        ) {
          setMessage({
            type: 'error',
            text: 'This is already a common field and is included automatically.',
          });
          return;
        }
        setAttributeAssignmentsByKey((current) => {
          const next = [...(current[targetAttributeKey] || [])];
          if (editingContext?.type === 'attribute') next[editingContext.index] = value;
          else if (!next.some((assignment) => assignment.attributeId === attributeId))
            next.push(value);
          return { ...current, [targetAttributeKey]: next };
        });
      }
    }

    closeModal();
  };

  const renderHeader = () => (
    <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-sky-50 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Master Data Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage categories, sub categories, common fields, and listing-specific fields from one
            place.
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {isSaving ? 'Saving...' : 'Changes save automatically'}
        </span>
      </div>
    </div>
  );

  const renderMenu = (
    items: Array<{
      label: string;
      danger?: boolean;
      onClick: () => void;
    }>
  ) => (
    <div className="absolute right-0 top-10 z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.5)]">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          {item.danger ? <Trash2 size={14} /> : <Pencil size={14} />}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50">
      {renderHeader()}

      <div className="px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Loading master data...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.95fr]">
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Categories</h2>
                    <p className="text-xs text-slate-500">
                      {pillCount(listingCategoryGroups.length)} total
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('category')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                <div className="px-4 py-4">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Search size={15} className="text-slate-400" />
                    <input
                      value={categoryQuery}
                      onChange={(e) => setCategoryQuery(e.target.value)}
                      placeholder="Search categories..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>
                </div>
                <div className="max-h-[430px] space-y-2 overflow-auto px-4 pb-4">
                  {filteredCategories.map((group) => {
                    const index = listingCategoryGroups.indexOf(group);
                    const active = index === selectedCategoryIndex;
                    return (
                      <div
                        key={`${group.mainCategory}-${index}`}
                        className={`relative flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                          active
                            ? 'border-blue-200 bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryIndex(index)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border ${colorByIndex(index)}`}
                          >
                            {group.mainCategoryIcon ? (
                              <img
                                src={group.mainCategoryIcon}
                                alt=""
                                className="h-7 w-7 object-contain"
                              />
                            ) : (
                              <Tag size={16} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {group.mainCategory}
                              </p>
                              <ArrowRight size={14} className="shrink-0 text-slate-400" />
                            </div>
                            <p className="text-xs text-slate-500">
                              {group.subcategories.length} sub categories
                            </p>
                          </div>
                          <span className="ml-2 min-w-8 text-right text-xs text-slate-500">
                            {pillCount(group.subcategories.length)}
                          </span>
                        </button>
                        <div className="relative ml-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCategoryMenuIndex((current) => (current === index ? null : index))
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {categoryMenuIndex === index
                            ? renderMenu([
                                {
                                  label: 'Edit',
                                  onClick: () => {
                                    setCategoryMenuIndex(null);
                                    openEditModal('category', index);
                                  },
                                },
                                {
                                  label: 'Delete',
                                  danger: true,
                                  onClick: () => {
                                    setListingCategoryGroups((groups) =>
                                      groups.filter((_, itemIndex) => itemIndex !== index)
                                    );
                                    setCategoryMenuIndex(null);
                                  },
                                },
                              ])
                            : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  Total Categories: {listingCategoryGroups.length}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Sub Categories ({selectedCategory?.mainCategory || 'Vehicles'})
                    </h2>
                    <p className="text-xs text-slate-500">
                      {pillCount(selectedCategory?.subcategories.length || 0)} total
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('subcategory')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                <div className="px-4 py-4">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Search size={15} className="text-slate-400" />
                    <input
                      value={subcategoryQuery}
                      onChange={(e) => setSubcategoryQuery(e.target.value)}
                      placeholder="Search sub categories..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>
                </div>
                <div className="max-h-[430px] space-y-2 overflow-auto px-4 pb-4">
                  {filteredSubcategories.map((subcategory) => {
                    const index = (selectedCategory?.subcategories || []).indexOf(subcategory);
                    const active = index === selectedSubcategoryIndexForView;
                    return (
                      <div
                        key={`${subcategory}-${index}`}
                        className={`relative flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                          active
                            ? 'border-blue-200 bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSubcategoryIndex(index)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border ${colorByIndex(index + 1)}`}
                          >
                            {selectedCategory?.subcategoryIcons?.[subcategory] ? (
                              <img
                                src={selectedCategory.subcategoryIcons[subcategory]}
                                alt=""
                                className="h-7 w-7 object-contain"
                              />
                            ) : (
                              <Tag size={16} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {subcategory}
                              </p>
                              <ArrowRight size={14} className="shrink-0 text-slate-400" />
                            </div>
                            <p className="text-xs text-slate-500">Sub category</p>
                          </div>
                          <span className="ml-2 min-w-8 text-right text-xs text-slate-500">1</span>
                        </button>
                        <div className="relative ml-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSubcategoryMenuIndex((current) =>
                                current === index ? null : index
                              )
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {subcategoryMenuIndex === index
                            ? renderMenu([
                                {
                                  label: 'Edit',
                                  onClick: () => {
                                    setSubcategoryMenuIndex(null);
                                    openEditModal('subcategory', index);
                                  },
                                },
                                {
                                  label: 'Delete',
                                  danger: true,
                                  onClick: () => {
                                    setListingCategoryGroups((groups) =>
                                      groups.map((group, groupIndex) =>
                                        groupIndex === selectedCategoryIndex
                                          ? (() => {
                                              const nextIcons = {
                                                ...(group.subcategoryIcons || {}),
                                              };
                                              delete nextIcons[group.subcategories[index]];
                                              return {
                                                ...group,
                                                subcategories: group.subcategories.filter(
                                                  (_, itemIndex) => itemIndex !== index
                                                ),
                                                ...(Object.keys(nextIcons).length > 0
                                                  ? { subcategoryIcons: nextIcons }
                                                  : {}),
                                              };
                                            })()
                                          : group
                                      )
                                    );
                                    setSubcategoryMenuIndex(null);
                                  },
                                },
                              ])
                            : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  Total Sub Categories: {selectedCategory?.subcategories.length || 0}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Fields · {selectedSubcategory || 'Cars'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {pillCount(displayedFields.length)} active · includes common fields
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('attribute')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                <div className="px-4 py-4">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Search size={15} className="text-slate-400" />
                    <input
                      value={attributeQuery}
                      onChange={(e) => setAttributeQuery(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>
                </div>
                <div className="max-h-[430px] space-y-2 overflow-auto px-4 pb-4">
                  {filteredAttributes.map((attribute, displayIndex) => {
                    const isCommonField = attribute.isCommon;
                    const index = isCommonField
                      ? commonFields.findIndex((item) => item.id === attribute.id)
                      : selectedAttributes.findIndex((item) => item.id === attribute.id);
                    return (
                      <div
                        key={`${attribute.id}-${index}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorByIndex(displayIndex)}`}
                          >
                            {isCommonField ? 'All' : attribute.fieldType.slice(0, 3)}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{attribute.name}</p>
                            <p className="text-xs text-slate-500">
                              {isCommonField ? 'Common field' : attribute.fieldType}
                              {!isCommonField && attribute.unit ? ` · ${attribute.unit}` : ''}
                              {isCommonField && attribute.unit ? ` · ${attribute.unit}` : ''}
                              {attribute.required ? ' · Required' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              isCommonField
                                ? setCommonFieldMenuIndex((current) =>
                                    current === index ? null : index
                                  )
                                : setAttributeMenuIndex((current) =>
                                    current === index ? null : index
                                  )
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {(
                            isCommonField
                              ? commonFieldMenuIndex === index
                              : attributeMenuIndex === index
                          )
                            ? renderMenu([
                                {
                                  label: 'Edit',
                                  onClick: () => {
                                    setAttributeMenuIndex(null);
                                    setCommonFieldMenuIndex(null);
                                    openEditModal(
                                      isCommonField ? 'commonField' : 'attribute',
                                      index
                                    );
                                  },
                                },
                                {
                                  label: 'Delete',
                                  danger: true,
                                  onClick: () => {
                                    if (isCommonField) {
                                      setCommonFieldAssignments((current) =>
                                        current.filter((_, itemIndex) => itemIndex !== index)
                                      );
                                    } else {
                                      setAttributeAssignmentsByKey((current) => ({
                                        ...current,
                                        [selectedAttributeKey]: (
                                          current[selectedAttributeKey] || []
                                        ).filter((_, itemIndex) => itemIndex !== index),
                                      }));
                                    }
                                    setAttributeMenuIndex(null);
                                    setCommonFieldMenuIndex(null);
                                  },
                                },
                              ])
                            : null}
                        </div>
                      </div>
                    );
                  })}
                  {filteredAttributes.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-slate-500">
                      No fields assigned yet. Add a common field or a subcategory field.
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  Total Fields: {displayedFields.length} ({commonFields.length} common)
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Reusable Attributes</h2>
                  <p className="text-xs text-slate-500">
                    Create an attribute once, then assign it to any sub category as a field.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openModal('catalogAttribute')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              <div className="px-4 py-4">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Search size={15} className="text-slate-400" />
                  <input
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder="Search reusable attributes..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </label>
              </div>
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Attribute</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Used In</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatalog.length > 0 ? (
                      filteredCatalog.map((attribute) => {
                        const usedIn = Object.values(attributeAssignmentsByKey).filter(
                          (assignments) =>
                            assignments.some(
                              (assignment) => assignment.attributeId === attribute.id
                            )
                        ).length;
                        const isCommon = commonFieldAssignments.some(
                          (assignment) => assignment.attributeId === attribute.id
                        );
                        const index = attributeCatalog.indexOf(attribute);
                        return (
                          <tr key={attribute.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {attribute.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{attribute.fieldType}</td>
                            <td className="px-4 py-3 text-slate-600">{attribute.unit || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {isCommon
                                ? 'All categories'
                                : `${usedIn} sub categor${usedIn === 1 ? 'y' : 'ies'}`}
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCatalogMenuIndex((current) =>
                                      current === index ? null : index
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {catalogMenuIndex === index
                                  ? renderMenu([
                                      {
                                        label: 'Edit',
                                        onClick: () => {
                                          setCatalogMenuIndex(null);
                                          openEditModal('catalogAttribute', index);
                                        },
                                      },
                                      {
                                        label: 'Delete',
                                        danger: true,
                                        onClick: () => {
                                          const attributeIdToRemove =
                                            attributeCatalog[index]?.id || '';
                                          setAttributeCatalog((catalog) =>
                                            catalog.filter((_, itemIndex) => itemIndex !== index)
                                          );
                                          if (attributeIdToRemove) {
                                            setCommonFieldAssignments((assignments) =>
                                              assignments.filter(
                                                (assignment) =>
                                                  assignment.attributeId !== attributeIdToRemove
                                              )
                                            );
                                            setAttributeAssignmentsByKey((assignmentsByKey) =>
                                              Object.fromEntries(
                                                Object.entries(assignmentsByKey).map(
                                                  ([key, assignments]) => [
                                                    key,
                                                    assignments.filter(
                                                      (assignment) =>
                                                        assignment.attributeId !==
                                                        attributeIdToRemove
                                                    ),
                                                  ]
                                                )
                                              )
                                            );
                                          }
                                          setCatalogMenuIndex(null);
                                        },
                                      },
                                    ])
                                  : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                          No reusable attributes yet. Add one before assigning fields.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {message ? (
              <div
                className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white ${
                  message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              >
                {message.text}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {modalType ? (
        <AdminDrawer
          onClose={closeModal}
          ariaLabel={editingContext ? 'Edit master data' : 'Add master data'}
          header={
            <div className="border-b border-slate-100 bg-white px-5 py-4 pr-16 sm:px-6 sm:py-5 sm:pr-20">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Tag size={18} className="text-blue-600" />
                  {modalType === 'category'
                    ? `${editingContext ? 'Edit' : 'Add'} Category`
                    : modalType === 'subcategory'
                      ? `${editingContext ? 'Edit' : 'Add'} Sub Category`
                      : modalType === 'catalogAttribute'
                        ? `${editingContext ? 'Edit' : 'Add'} Attribute`
                        : modalType === 'commonField'
                          ? `${editingContext ? 'Edit' : 'Add'} Common Field`
                          : `${editingContext ? 'Edit' : 'Add'} Field`}
                </h3>
                <p className="text-sm text-slate-500">
                  {modalType === 'category'
                    ? 'Create a new category.'
                    : modalType === 'subcategory'
                      ? 'Choose the main category and add its sub category.'
                      : modalType === 'catalogAttribute'
                        ? 'Create a reusable attribute definition.'
                        : 'Choose a reusable attribute and decide where it should appear.'}
                </p>
              </div>
            </div>
          }
          footer={
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={
                  isUploadingIcon ||
                  (modalType === 'subcategory' && !subCategoryMainCategory) ||
                  ((modalType === 'attribute' || modalType === 'commonField') && !attributeId)
                }
                className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingContext
                  ? 'Save Changes'
                  : modalType === 'attribute'
                    ? 'Add Field'
                    : modalType === 'commonField'
                      ? 'Save Common Field'
                      : modalType === 'catalogAttribute'
                        ? 'Add Attribute'
                        : 'Add'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {modalType === 'category' ? (
              <>
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                />
                <IconUploadField
                  value={categoryIcon}
                  label="category"
                  isUploading={isUploadingIcon}
                  error={iconUploadError}
                  onUpload={(file) => void handleIconUpload(file, setCategoryIcon)}
                />
              </>
            ) : null}

            {modalType === 'subcategory' ? (
              <>
                <select
                  value={subCategoryMainCategory}
                  onChange={(event) => setSubCategoryMainCategory(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                >
                  <option value="">Select main category</option>
                  {listingCategoryGroups.map((group) => (
                    <option key={group.mainCategory} value={group.mainCategory}>
                      {group.mainCategory}
                    </option>
                  ))}
                </select>
                <input
                  value={subCategoryName}
                  onChange={(e) => setSubCategoryName(e.target.value)}
                  placeholder="Sub category name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                />
                <IconUploadField
                  value={subCategoryIcon}
                  label="sub category"
                  isUploading={isUploadingIcon}
                  error={iconUploadError}
                  onUpload={(file) => void handleIconUpload(file, setSubCategoryIcon)}
                />
              </>
            ) : null}

            {modalType === 'attribute' || modalType === 'commonField' ? (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="mb-2 block">Field scope</span>
                  <select
                    value={attributeScope}
                    onChange={(event) => setAttributeScope(event.target.value as FieldScope)}
                    disabled={Boolean(editingContext)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb] disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="subcategory">Subcategory-specific</option>
                    <option value="common">Common (all categories)</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="mb-2 block">Main category</span>
                  <select
                    value={fieldMainCategory}
                    onChange={(event) => {
                      const nextMainCategory = event.target.value;
                      setFieldMainCategory(nextMainCategory);
                      setFieldSubcategory(
                        listingCategoryGroups.find(
                          (group) => group.mainCategory === nextMainCategory
                        )?.subcategories[0] || ''
                      );
                    }}
                    disabled={Boolean(editingContext) || attributeScope === 'common'}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb] disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Select main category</option>
                    {listingCategoryGroups.map((group) => (
                      <option key={group.mainCategory} value={group.mainCategory}>
                        {group.mainCategory}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="mb-2 block">Subcategory</span>
                  <select
                    value={fieldSubcategory}
                    onChange={(event) => setFieldSubcategory(event.target.value)}
                    disabled={
                      Boolean(editingContext) ||
                      attributeScope === 'common' ||
                      fieldSubcategoryOptions.length === 0
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb] disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Select subcategory</option>
                    {fieldSubcategoryOptions.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="mb-2 block">Field assignment</span>
                  <select
                    value={attributeId}
                    onChange={(event) => setAttributeId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                  >
                    <option value="">Select reusable attribute</option>
                    {attributeCatalog.map((attribute) => (
                      <option key={attribute.id} value={attribute.id}>
                        {attribute.name} {attribute.unit ? `(${attribute.unit})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {attributeCatalog.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    Add an attribute to the Reusable Attributes catalog first.
                  </p>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={attributeRequired}
                    onChange={(e) => setAttributeRequired(e.target.checked)}
                  />
                  Required field
                </label>
              </>
            ) : null}

            {modalType === 'catalogAttribute' ? (
              <>
                <input
                  value={attributeName}
                  onChange={(e) => setAttributeName(e.target.value)}
                  placeholder="Attribute name, e.g. Mileage"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={attributeFieldType}
                    onChange={(e) => setAttributeFieldType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                  >
                    <option>Text</option>
                    <option>Dropdown</option>
                    <option>Number</option>
                    <option>Price</option>
                    <option>Boolean</option>
                  </select>
                  <input
                    value={attributeUnit}
                    onChange={(e) => setAttributeUnit(e.target.value)}
                    placeholder="Unit (optional), e.g. km, kg"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                  />
                </div>
              </>
            ) : null}
          </div>
        </AdminDrawer>
      ) : null}
    </div>
  );
}
