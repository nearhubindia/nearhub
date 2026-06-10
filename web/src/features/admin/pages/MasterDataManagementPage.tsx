import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  MoreVertical,
  Plus,
  Search,
  Tag,
  LayoutGrid,
  Trash2,
  Pencil,
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { getAdminToken } from '@/features/admin/constants/admin-constants';
import {
  ADMIN_CATEGORY_GROUPS,
  type AdminCategoryGroup,
} from '@/features/admin/constants/listing-taxonomy';

type ListingAttribute = {
  name: string;
  fieldType: string;
  unit: string;
  required: boolean;
  status: 'Active' | 'Inactive';
};

type ModalType = 'category' | 'subcategory' | 'unit' | 'attribute' | null;
type EditingContext = {
  type: Exclude<ModalType, null>;
  index: number;
};

function normalizeCategoryGroups(value: unknown): AdminCategoryGroup[] {
  if (!Array.isArray(value)) return ADMIN_CATEGORY_GROUPS;
  const groups = value
    .map((item) => {
      const entry = item as { mainCategory?: unknown; subcategories?: unknown };
      return {
        mainCategory: String(entry.mainCategory || '').trim(),
        subcategories: Array.isArray(entry.subcategories)
          ? entry.subcategories.map((sub) => String(sub || '').trim()).filter(Boolean)
          : [],
      };
    })
    .filter((item) => item.mainCategory && item.subcategories.length > 0);
  return groups.length ? groups : ADMIN_CATEGORY_GROUPS;
}

function normalizePriceUnits(value: unknown): string[] {
  if (!Array.isArray(value)) return ['per unit', 'per piece'];
  const units = value.map((item) => String(item || '').trim()).filter(Boolean);
  return units.length ? Array.from(new Set(units)) : ['per unit', 'per piece'];
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
  const [listingPriceUnits, setListingPriceUnits] = useState<string[]>(['per unit', 'per piece']);
  const [attributesByKey, setAttributesByKey] = useState<Record<string, ListingAttribute[]>>({});
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedSubcategoryIndex, setSelectedSubcategoryIndex] = useState(0);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [unitQuery, setUnitQuery] = useState('');
  const [attributeQuery, setAttributeQuery] = useState('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [attributeName, setAttributeName] = useState('');
  const [attributeFieldType, setAttributeFieldType] = useState('Text');
  const [attributeUnit, setAttributeUnit] = useState('');
  const [attributeRequired, setAttributeRequired] = useState(false);
  const [editingContext, setEditingContext] = useState<EditingContext | null>(null);
  const [categoryMenuIndex, setCategoryMenuIndex] = useState<number | null>(null);
  const [subcategoryMenuIndex, setSubcategoryMenuIndex] = useState<number | null>(null);
  const [unitMenuIndex, setUnitMenuIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
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
        if (Array.isArray(data.settings?.listingPriceUnits)) {
          setListingPriceUnits(normalizePriceUnits(data.settings.listingPriceUnits));
        }
        if (data.settings?.attributesByKey && typeof data.settings.attributesByKey === 'object') {
          setAttributesByKey(data.settings.attributesByKey as Record<string, ListingAttribute[]>);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const next = listingCategoryGroups[selectedCategoryIndex];
    if (!next) return;
    if (selectedSubcategoryIndex >= next.subcategories.length) {
      setSelectedSubcategoryIndex(0);
    }
  }, [listingCategoryGroups, selectedCategoryIndex, selectedSubcategoryIndex]);

  const selectedCategory = listingCategoryGroups[selectedCategoryIndex] || listingCategoryGroups[0];
  const selectedSubcategory = selectedCategory?.subcategories[selectedSubcategoryIndex] || '';
  const selectedAttributeKey = getAttributeKey(selectedCategory?.mainCategory, selectedSubcategory);
  const selectedAttributes = attributesByKey[selectedAttributeKey] || [];

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

  const filteredUnits = useMemo(() => {
    const term = unitQuery.trim().toLowerCase();
    return term
      ? listingPriceUnits.filter((unit) => unit.toLowerCase().includes(term))
      : listingPriceUnits;
  }, [listingPriceUnits, unitQuery]);

  const filteredAttributes = useMemo(() => {
    const term = attributeQuery.trim().toLowerCase();
    return term
      ? selectedAttributes.filter((item) => {
          const text = `${item.name} ${item.fieldType} ${item.unit}`.toLowerCase();
          return text.includes(term);
        })
      : selectedAttributes;
  }, [attributeQuery, selectedAttributes]);

  const save = async () => {
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
          listingPriceUnits,
          attributesByKey,
        }),
      });
      if (!response.ok) throw new Error('Failed to save master data');
      setMessage({ type: 'success', text: 'Master data saved successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save master data',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = (type: ModalType) => {
    setModalType(type);
    setEditingContext(null);
    setCategoryName('');
    setSubCategoryName('');
    setUnitName('');
    setAttributeName('');
    setAttributeFieldType('Text');
    setAttributeUnit('');
    setAttributeRequired(false);
  };

  const openEditModal = (type: Exclude<ModalType, null>, index: number) => {
    setEditingContext({ type, index });
    setModalType(type);
    setCategoryName('');
    setSubCategoryName('');
    setUnitName('');
    setAttributeName('');
    setAttributeFieldType('Text');
    setAttributeUnit('');
    setAttributeRequired(false);

    if (type === 'category') {
      setCategoryName(listingCategoryGroups[index]?.mainCategory || '');
    }
    if (type === 'subcategory') {
      setSubCategoryName(selectedCategory?.subcategories[index] || '');
    }
    if (type === 'unit') {
      setUnitName(listingPriceUnits[index] || '');
    }
    if (type === 'attribute') {
      const attribute = selectedAttributes[index];
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

  const submitModal = () => {
    if (modalType === 'category') {
      const name = categoryName.trim();
      if (!name) return;
      setListingCategoryGroups((groups) =>
        editingContext?.type === 'category'
          ? groups.map((group, index) =>
              index === editingContext.index ? { ...group, mainCategory: name } : group
            )
          : [...groups, { mainCategory: name, subcategories: ['Other'] }]
      );
    }

    if (modalType === 'subcategory') {
      const name = subCategoryName.trim();
      if (!name) return;
      setListingCategoryGroups((groups) =>
        groups.map((group, index) => {
          if (index !== selectedCategoryIndex) return group;
          if (editingContext?.type === 'subcategory') {
            return {
              ...group,
              subcategories: group.subcategories.map((sub, subIndex) =>
                subIndex === editingContext.index ? name : sub
              ),
            };
          }
          return { ...group, subcategories: [...group.subcategories, name] };
        })
      );
    }

    if (modalType === 'unit') {
      const name = unitName.trim();
      if (!name) return;
      setListingPriceUnits((units) =>
        editingContext?.type === 'unit'
          ? units.map((unit, index) => (index === editingContext.index ? name : unit))
          : [...units, name]
      );
    }

    if (modalType === 'attribute') {
      const name = attributeName.trim();
      if (!name) return;
      setAttributesByKey((current) => ({
        ...current,
        [selectedAttributeKey]: (() => {
          const next = [...(current[selectedAttributeKey] || [])];
          const value = {
            name,
            fieldType: attributeFieldType,
            unit: attributeUnit.trim(),
            required: attributeRequired,
            status: 'Active' as const,
          };
          if (editingContext?.type === 'attribute') {
            next[editingContext.index] = value;
          } else {
            next.push(value);
          }
          return next;
        })(),
      }));
    }

    closeModal();
  };

  const renderHeader = () => (
    <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-sky-50 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Master Data Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage categories, sub categories, units and listing attributes from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          <LayoutGrid size={16} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={16} />
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
                            <Tag size={16} />
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={16} />
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
                    const active = index === selectedSubcategoryIndex;
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
                            <Tag size={16} />
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
                                          ? {
                                              ...group,
                                              subcategories: group.subcategories.filter(
                                                (_, itemIndex) => itemIndex !== index
                                              ),
                                            }
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
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Units</h2>
                    <p className="text-xs text-slate-500">
                      {pillCount(listingPriceUnits.length)} total
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('unit')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="px-4 py-4">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Search size={15} className="text-slate-400" />
                    <input
                      value={unitQuery}
                      onChange={(e) => setUnitQuery(e.target.value)}
                      placeholder="Search units..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>
                </div>
                <div className="max-h-[430px] space-y-2 overflow-auto px-4 pb-4">
                  {filteredUnits.map((unit) => {
                    const index = listingPriceUnits.indexOf(unit);
                    return (
                      <div
                        key={`${unit}-${index}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorByIndex(index)}`}
                          >
                            {unit.split(' ')[0] || 'Unit'}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{unit}</p>
                            <p className="text-xs text-slate-500">Listing unit</p>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setUnitMenuIndex((current) => (current === index ? null : index))
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {unitMenuIndex === index
                            ? renderMenu([
                                {
                                  label: 'Edit',
                                  onClick: () => {
                                    setUnitMenuIndex(null);
                                    openEditModal('unit', index);
                                  },
                                },
                                {
                                  label: 'Delete',
                                  danger: true,
                                  onClick: () => {
                                    setListingPriceUnits((units) =>
                                      units.filter((_, itemIndex) => itemIndex !== index)
                                    );
                                    setUnitMenuIndex(null);
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
                  Total Units: {listingPriceUnits.length}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Attributes / Listing Fields for {selectedSubcategory || 'Cars'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Attach custom fields to the selected category/sub category.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openModal('attribute')}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  <Plus size={15} />
                  Add Attribute
                </button>
              </div>

              <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_280px]">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Search size={15} className="text-slate-400" />
                      <input
                        value={attributeQuery}
                        onChange={(e) => setAttributeQuery(e.target.value)}
                        placeholder="Search attributes..."
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {filteredAttributes.length} results
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Attribute Name</th>
                        <th className="px-4 py-3">Field Type</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Required</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAttributes.length > 0 ? (
                        filteredAttributes.map((attribute) => {
                          const index = selectedAttributes.indexOf(attribute);
                          return (
                            <tr key={`${attribute.name}-${index}`} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {attribute.name}
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600">
                                  {attribute.fieldType}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{attribute.unit || '-'}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                                  {attribute.required ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                                  {attribute.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal('attribute', index)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttributesByKey((current) => ({
                                        ...current,
                                        [selectedAttributeKey]: (
                                          current[selectedAttributeKey] || []
                                        ).filter((_, itemIndex) => itemIndex !== index),
                                      }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                            No attributes yet for this sub category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="mx-auto mb-4 h-24 w-24 rounded-full bg-blue-100" />
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedSubcategory || 'Cars'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedCategory?.mainCategory || 'Vehicles'} &gt;{' '}
                    {selectedSubcategory || 'Cars'}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">Total Attributes</p>
                  <p className="text-4xl font-bold text-blue-600">{selectedAttributes.length}</p>
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalType === 'category'
                    ? 'Add Category'
                    : modalType === 'subcategory'
                      ? 'Add Sub Category'
                      : modalType === 'unit'
                        ? 'Add Unit'
                        : 'Add Attribute'}
                </h3>
                <p className="text-sm text-slate-500">
                  {modalType === 'category'
                    ? 'Create a new category.'
                    : modalType === 'subcategory'
                      ? 'Create a sub category under the selected category.'
                      : modalType === 'unit'
                        ? 'Create a new unit label.'
                        : 'Create a field for the selected sub category.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {modalType === 'category' ? (
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                />
              ) : null}

              {modalType === 'subcategory' ? (
                <input
                  value={subCategoryName}
                  onChange={(e) => setSubCategoryName(e.target.value)}
                  placeholder="Sub category name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                />
              ) : null}

              {modalType === 'unit' ? (
                <input
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="Unit name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                />
              ) : null}

              {modalType === 'attribute' ? (
                <>
                  <input
                    value={attributeName}
                    onChange={(e) => setAttributeName(e.target.value)}
                    placeholder="Attribute name"
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
                    <select
                      value={attributeUnit}
                      onChange={(e) => setAttributeUnit(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2563eb]"
                    >
                      <option value="">Unit (optional)</option>
                      {listingPriceUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
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
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
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
                className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                {editingContext
                  ? 'Save Changes'
                  : modalType === 'attribute'
                    ? 'Add Attribute'
                    : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
