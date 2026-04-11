import { useState } from 'react';
import { BadgePercent, CalendarDays, Layers, Plus, Sparkles, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import {
  useSubscriptionTiers,
  useCreateSubscriptionTier,
  useUpdateSubscriptionTier,
  useDeleteSubscriptionTier,
} from '@/features/admin/hooks';
import { ApiError } from '@/features/admin/api';

interface TierRow {
  id: string;
  name: string;
  type?: 'bundle' | 'boost' | string;
  description?: string;
  price: number;
  offerPrice?: number | null;
  durationDays: number;
  features: string[] | string;
  maxListings: number;
  featuredListingsPerMonth: number;
  boostCredits?: number;
  highlight: boolean;
  isActive: boolean;
}

interface TierDeleteConflictPayload {
  details?: {
    activeSubscriptions?: number;
    totalSubscriptions?: number;
    linkedListings?: number;
  };
}

interface TierFormData {
  name: string;
  type: 'bundle' | 'boost';
  description: string;
  price: number | null;
  offerPrice: number | null;
  durationDays: number | null;
  features: string[];
  maxListings: number | null;
  featuredListingsPerMonth: number | null;
  boostCredits: number | null;
  highlight: boolean;
  isActive: boolean;
}

export default function SubscriptionPlansView() {
  const { data: tiersData, isLoading } = useSubscriptionTiers();
  const createTier = useCreateSubscriptionTier();
  const updateTier = useUpdateSubscriptionTier();
  const deleteTier = useDeleteSubscriptionTier();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTier, setEditingTier] = useState<TierRow | null>(null);
  const [formData, setFormData] = useState<TierFormData>({
    name: '',
    type: 'bundle',
    description: '',
    price: null,
    offerPrice: null,
    durationDays: 30,
    features: [] as string[],
    maxListings: 5,
    featuredListingsPerMonth: 0,
    boostCredits: 0,
    highlight: false,
    isActive: true,
  });

  const tiers: TierRow[] = Array.isArray(tiersData?.tiers) ? (tiersData.tiers as TierRow[]) : [];

  const handleSaveTier = async (): Promise<void> => {
    try {
      if (
        formData.offerPrice !== null &&
        formData.price !== null &&
        Number(formData.offerPrice) >= Number(formData.price)
      ) {
        alert('Offer price must be less than regular price.');
        return;
      }

      const normalizedFeatures = [
        ...formData.features.filter((feature) => feature !== 'image' && feature !== 'video'),
      ];
      const payload = {
        ...formData,
        price: Number(formData.price ?? 0),
        offerPrice:
          formData.offerPrice !== null &&
          formData.offerPrice !== undefined &&
          Number(formData.offerPrice) > 0
            ? Number(formData.offerPrice)
            : null,
        durationDays: Number(formData.durationDays ?? 30),
        maxListings: formData.type === 'boost' ? 0 : Number(formData.maxListings ?? 0),
        featuredListingsPerMonth: 0,
        boostCredits: Number(formData.boostCredits ?? 0),
        features:
          Number(formData.boostCredits ?? 0) > 0
            ? Array.from(new Set([...normalizedFeatures, 'featured']))
            : normalizedFeatures.filter((feature) => feature !== 'featured'),
      };

      if (editingTier) {
        await updateTier.mutateAsync({
          id: editingTier.id as string,
          data: payload,
        });
      } else {
        await createTier.mutateAsync(payload);
      }
      closeModal();
    } catch (error) {
      console.error('Error saving tier:', error);
      alert('Error saving tier');
    }
  };

  const handleDeleteTier = async (tierId: string): Promise<void> => {
    if (!confirm('Delete this tier? Users with this tier will need to upgrade.')) return;

    try {
      await deleteTier.mutateAsync(tierId);
    } catch (error) {
      console.error('Error deleting tier:', error);
      if (error instanceof ApiError && error.status === 409) {
        const details = (error.data as TierDeleteConflictPayload | null)?.details ?? {};
        const activeSubscriptions = Number(details.activeSubscriptions || 0);
        const totalSubscriptions = Number(details.totalSubscriptions || 0);
        const linkedListings = Number(details.linkedListings || 0);

        alert(
          [
            'Cannot delete this tier because it is in use.',
            `Active subscriptions: ${activeSubscriptions}`,
            `Total subscriptions: ${totalSubscriptions}`,
            `Linked listings: ${linkedListings}`,
            '',
            'Deactivate the tier instead of deleting it.',
          ].join('\n')
        );
        return;
      }
      alert('Error deleting tier. Please try again.');
    }
  };

  const openCreateModal = (): void => {
    setEditingTier(null);
    setFormData({
      name: '',
      type: 'bundle',
      description: '',
      price: null,
      offerPrice: null,
      durationDays: 30,
      features: [],
      maxListings: 5,
      featuredListingsPerMonth: 0,
      boostCredits: 0,
      highlight: false,
      isActive: true,
    });
    setShowCreateModal(true);
  };

  const openEditModal = (tier: TierRow): void => {
    setEditingTier(tier);
    const features =
      typeof tier.features === 'string'
        ? JSON.parse(tier.features as string)
        : Array.isArray(tier.features)
          ? tier.features
          : [];
    setFormData({
      name: tier.name as string,
      type: tier.type === 'boost' ? 'boost' : 'bundle',
      description: (tier.description as string) || '',
      price: Number(tier.price ?? 0),
      offerPrice:
        tier.offerPrice !== undefined && tier.offerPrice !== null && Number(tier.offerPrice) > 0
          ? Number(tier.offerPrice)
          : null,
      durationDays: Number(tier.durationDays ?? 30),
      features: features as string[],
      maxListings: Number(tier.maxListings ?? 5),
      featuredListingsPerMonth: Number(tier.featuredListingsPerMonth ?? 0),
      boostCredits: Number(tier.boostCredits ?? 0),
      highlight: tier.highlight as boolean,
      isActive: tier.isActive as boolean,
    });
    setShowCreateModal(true);
  };

  const closeModal = (): void => {
    setShowCreateModal(false);
    setEditingTier(null);
  };

  const renderFeatures = (tier: TierRow): string => {
    const features =
      typeof tier.features === 'string'
        ? JSON.parse(tier.features as string)
        : Array.isArray(tier.features)
          ? tier.features
          : [];
    const normalized = (features as string[]).filter((f) => f !== 'image' && f !== 'video');
    const labels: string[] = [];

    if (Number(tier.boostCredits || 0) > 0) {
      labels.push(`Boost Credits: ${Number(tier.boostCredits || 0)}`);
    }

    normalized
      .filter((f) => f !== 'featured')
      .forEach((f: string) => labels.push(f.charAt(0).toUpperCase() + f.slice(1)));

    return labels.join(', ') || 'None';
  };

  const columns: ColumnDef<TierRow>[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter name...' },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.name}
            {!!row.original.highlight && (
              <span className="rounded bg-teal-100 px-2 py-1 text-xs font-bold text-teal-800">
                Popular
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter type...' },
        cell: ({ row }) => (String(row.original.type || 'bundle') === 'boost' ? 'Boost Pack' : 'Bundle'),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter price...' },
        cell: ({ row }) => (
          <span className="font-bold text-teal-600">
            {(row.original.price as number) === 0 ? 'Free' : `₹${row.original.price as number}`}
          </span>
        ),
      },
      {
        accessorKey: 'offerPrice',
        header: 'Offer Price',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter offer price...' },
        cell: ({ row }) =>
          row.original.offerPrice && Number(row.original.offerPrice) > 0
            ? `₹${Number(row.original.offerPrice)}`
            : '-',
      },
      {
        accessorKey: 'durationDays',
        header: 'Duration',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter duration...' },
        cell: ({ row }) => `${row.original.durationDays as number} days`,
      },
      {
        accessorKey: 'boostCredits',
        header: 'Boost Credits',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter boost credits...' },
        cell: ({ row }) => (Number(row.original.boostCredits || 0) > 0 ? Number(row.original.boostCredits) : '-'),
      },
      {
        id: 'features',
        header: 'Features',
        enableColumnFilter: true,
        accessorFn: (tier) => renderFeatures(tier),
        meta: { filterPlaceholder: 'Filter features...' },
        cell: ({ row }) => (
          <div className="max-w-xs text-xs text-slate-500 line-clamp-2">{renderFeatures(row.original)}</div>
        ),
      },
      {
        accessorKey: 'maxListings',
        header: 'Max Listings',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter listings...' },
        cell: ({ row }) =>
          (row.original.maxListings as number) === -1
            ? 'Unlimited'
            : (row.original.maxListings as number),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter status...' },
        cell: ({ row }) => (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              row.original.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {row.original.isActive ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        accessorFn: () => '',
        cell: ({ row }) => (
          <div className="space-x-2 text-right">
            <button
              onClick={() => openEditModal(row.original)}
              className="cursor-pointer font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
              type="button"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteTier(row.original.id as string)}
              className="cursor-pointer font-bold text-red-600 transition hover:text-red-800 hover:underline"
              type="button"
            >
              Delete
            </button>
          </div>
        ),
    },
  ];

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-100';
  const labelClass = 'mb-2 block text-sm font-semibold tracking-wide text-slate-700';

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Subscription Tiers</h1>
        <p className="text-slate-300">Create and manage bundled subscription tiers with features</p>
      </div>

      <div className="p-4 sm:p-6 space-y-8">
        <button
          onClick={openCreateModal}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-6 py-2 font-bold text-white transition hover:scale-105 hover:bg-teal-600 hover:shadow-lg sm:w-auto"
        >
          <Plus size={20} /> New Tier
        </button>

        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading tiers...</div>
        ) : (
          <>
            {tiers.length > 0 ? (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">📊 Subscription Tiers</h2>
                <DataTable columns={columns} data={tiers} searchPlaceholder="Search tiers..." />
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No subscription tiers created yet. Create one to get started!
              </div>
            )}
          </>
        )}

        {/* Create/Edit Tier Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
            <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-[0_24px_80px_-24px_rgba(2,6,23,0.65)]">
              <button
                onClick={closeModal}
                aria-label="Close modal"
                className="absolute right-4 top-4 z-20 rounded-full bg-white/90 p-2 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
              >
                <X size={16} />
              </button>

              <div className="relative overflow-hidden border-b border-cyan-200 bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-6 text-white sm:px-8">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                <div className="absolute -bottom-12 left-1/2 h-24 w-32 rounded-full bg-cyan-200/20 blur-2xl" />
                <p className="relative mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
                  <Sparkles size={14} />
                  Subscription Builder
                </p>
                <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {editingTier ? 'Edit Tier' : 'Create New Tier'}
                </h2>
                <p className="relative mt-1 text-sm text-cyan-50/95">
                  Set pricing, validity, and benefits for this plan.
                </p>
              </div>

              <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6 sm:p-8">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>Tier Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass}
                        placeholder="e.g., Premium Plan"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Tier Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            type: e.target.value as 'bundle' | 'boost',
                          })
                        }
                        className={inputClass}
                      >
                        <option value="bundle">Bundle (Listings + optional boosts)</option>
                        <option value="boost">Boost Pack (credits only)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <BadgePercent size={14} /> Price (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.price ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                      min="0"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <BadgePercent size={14} /> Offer Price (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.offerPrice ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          offerPrice: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                      min="0"
                      placeholder="Optional"
                    />
                    {formData.offerPrice !== null &&
                      formData.price !== null &&
                      formData.offerPrice >= formData.price && (
                        <p className="mt-2 text-xs font-medium text-rose-600">
                          Offer price must be less than regular price.
                        </p>
                      )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <CalendarDays size={14} /> Duration (Days)
                    </label>
                    <input
                      type="number"
                      value={formData.durationDays ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          durationDays: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                      min="1"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={inputClass}
                    placeholder="Describe this tier..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {formData.type !== 'boost' && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <label className={`${labelClass} flex items-center gap-2`}>
                        <Layers size={14} /> Max Listings
                      </label>
                      <input
                        type="number"
                        value={formData.maxListings ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxListings: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                        min="-1"
                        placeholder="-1 for unlimited"
                      />
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <label className={`${labelClass} flex items-center gap-2`}>
                      <Sparkles size={14} /> Boost Credits
                    </label>
                    <input
                      type="number"
                      value={formData.boostCredits ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          boostCredits: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                      min="0"
                      placeholder="Credits per purchase"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    <Sparkles size={14} /> Features
                  </h3>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="font-semibold text-slate-900">Boost Visibility</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Boost entitlement is controlled by <strong>Boost Credits</strong> for both
                      bundle and boost-pack plans. Image/video uploads are no longer managed as
                      subscription feature toggles.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm">
                    <input
                      type="checkbox"
                      checked={formData.highlight}
                      onChange={(e) => setFormData({ ...formData, highlight: e.target.checked })}
                      className="mt-0.5 h-5 w-5 accent-cyan-600"
                    />
                    <span>
                      <span className="block font-bold text-slate-900">Mark as Most Popular</span>
                      <span className="text-sm text-slate-500">Highlights this tier in UI</span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="mt-0.5 h-5 w-5 accent-cyan-600"
                    />
                    <span>
                      <span className="block font-bold text-slate-900">Active</span>
                      <span className="text-sm text-slate-500">
                        Users can subscribe to this tier
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-5 sm:flex-row sm:p-6">
                <button
                  onClick={closeModal}
                  className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100 sm:flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTier}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:brightness-105 sm:flex-1"
                >
                  {editingTier ? 'Update Tier' : 'Create Tier'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
