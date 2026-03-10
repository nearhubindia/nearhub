import { useState } from 'react';
import { Plus } from 'lucide-react';
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
          formData.offerPrice !== null && formData.offerPrice !== undefined
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
        const details = (error.data as any)?.details || {};
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
      type: ((tier.type as any) || 'bundle') as 'bundle' | 'boost',
      description: (tier.description as string) || '',
      price: Number(tier.price ?? 0),
      offerPrice:
        tier.offerPrice !== undefined && tier.offerPrice !== null ? Number(tier.offerPrice) : null,
      durationDays: Number(tier.durationDays ?? 30),
      features: features as string[],
      maxListings: Number(tier.maxListings ?? 5),
      featuredListingsPerMonth: Number(tier.featuredListingsPerMonth ?? 0),
      boostCredits: Number((tier as any).boostCredits ?? 0),
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

    if (Number((tier as any).boostCredits || 0) > 0) {
      labels.push(`Boost Credits: ${Number((tier as any).boostCredits || 0)}`);
    }

    normalized
      .filter((f) => f !== 'featured')
      .forEach((f: string) => labels.push(f.charAt(0).toUpperCase() + f.slice(1)));

    return labels.join(', ') || 'None';
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Subscription Tiers</h1>
        <p className="text-slate-300">Create and manage bundled subscription tiers with features</p>
      </div>

      <div className="p-6 space-y-8">
        <button
          onClick={openCreateModal}
          className="bg-teal-500 text-white px-6 py-2 rounded-lg hover:bg-teal-600 hover:shadow-lg hover:scale-105 transition inline-flex items-center gap-2 font-bold cursor-pointer"
        >
          <Plus size={20} /> New Tier
        </button>

        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading tiers...</div>
        ) : (
          <>
            {/* Unified Tiers Table */}
            {tiers.length > 0 ? (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">📊 Subscription Tiers</h2>
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Offer Price
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Boost Credits
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Features
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Max Listings
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-bold text-slate-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {tiers.map((tier) => (
                        <tr key={tier.id as string} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              {tier.name as string}
                              {!!tier.highlight && (
                                <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs font-bold">
                                  Popular
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {String(tier.type || 'bundle') === 'boost' ? 'Boost Pack' : 'Bundle'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-teal-600">
                            {(tier.price as number) === 0 ? (
                              'Free'
                            ) : (
                              `₹${tier.price as number}`
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-semibold">
                            {tier.offerPrice && Number(tier.offerPrice) > 0
                              ? `₹${Number(tier.offerPrice)}`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {tier.durationDays as number} days
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {Number((tier as any).boostCredits || 0) > 0
                              ? Number((tier as any).boostCredits)
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            <div className="text-xs text-slate-500 max-w-xs line-clamp-2">
                              {renderFeatures(tier)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {(tier.maxListings as number) === -1
                              ? 'Unlimited'
                              : (tier.maxListings as number)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                tier.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {tier.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm space-x-2">
                            <button
                              onClick={() => openEditModal(tier)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-bold cursor-pointer transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTier(tier.id as string)}
                              className="text-red-600 hover:text-red-800 hover:underline font-bold cursor-pointer transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-6 border-b">
                <h2 className="text-2xl font-black">
                  {editingTier ? 'Edit Tier' : 'Create New Tier'}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Tier Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="e.g., Premium Plan"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Tier Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as 'bundle' | 'boost',
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    >
                      <option value="bundle">Bundle (Listings + optional boosts)</option>
                      <option value="boost">Boost Pack (credits only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Price (₹)</label>
                    <input
                      type="number"
                      value={formData.price ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Offer Price (₹)
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="0"
                      placeholder="Optional discounted price"
                    />
                    {formData.offerPrice !== null &&
                      formData.price !== null &&
                      formData.offerPrice >= formData.price && (
                        <p className="text-xs text-red-500 mt-1">
                          Offer price must be less than regular price.
                        </p>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Duration (Days)
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="1"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="Describe this tier..."
                      rows={2}
                    />
                  </div>

                  {formData.type !== 'boost' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-900 mb-2">
                        Max Listings
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
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                        min="-1"
                        placeholder="-1 for unlimited"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Boost Credits
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="0"
                      placeholder="Credits granted per purchase"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-4">✨ Features</h3>
                  <div className="space-y-3">
                    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                      <p className="font-bold text-slate-900">Boost Visibility</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Boost entitlement is controlled by <strong>Boost Credits</strong> for both
                        bundle and boost-pack plans. Image/video uploads are no longer managed as
                        subscription feature toggles.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.highlight}
                      onChange={(e) => setFormData({ ...formData, highlight: e.target.checked })}
                      className="w-5 h-5 accent-teal-500"
                    />
                    <span className="font-bold text-slate-900">Mark as "Most Popular"</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-5 h-5 accent-teal-500"
                    />
                    <span className="font-bold text-slate-900">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 bg-slate-100 border-t p-6">
                <button
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-bold text-slate-900 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTier}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg hover:scale-105 transition cursor-pointer"
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
