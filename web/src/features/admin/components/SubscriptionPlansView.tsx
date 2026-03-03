import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  useSubscriptionTiers,
  useCreateSubscriptionTier,
  useUpdateSubscriptionTier,
  useDeleteSubscriptionTier,
} from '@/features/admin/hooks';

interface TierRow {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  features: string[] | string;
  maxListings: number;
  featuredListingsPerMonth: number;
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    durationDays: 30,
    features: ['image'],
    maxListings: 5,
    featuredListingsPerMonth: 0,
    highlight: false,
    isActive: true,
  });

  const tiers: TierRow[] = Array.isArray(tiersData?.tiers) ? (tiersData.tiers as TierRow[]) : [];

  const handleSaveTier = async (): Promise<void> => {
    try {
      if (editingTier) {
        await updateTier.mutateAsync({
          id: editingTier.id as string,
          data: formData,
        });
      } else {
        await createTier.mutateAsync(formData);
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
      alert('Error deleting tier');
    }
  };

  const openCreateModal = (): void => {
    setEditingTier(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      durationDays: 30,
      features: ['image'],
      maxListings: 5,
      featuredListingsPerMonth: 0,
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
      description: (tier.description as string) || '',
      price: Number(tier.price ?? 0),
      durationDays: Number(tier.durationDays ?? 30),
      features: features as string[],
      maxListings: Number(tier.maxListings ?? 5),
      featuredListingsPerMonth: Number(tier.featuredListingsPerMonth ?? 0),
      highlight: tier.highlight as boolean,
      isActive: tier.isActive as boolean,
    });
    setShowCreateModal(true);
  };

  const closeModal = (): void => {
    setShowCreateModal(false);
    setEditingTier(null);
  };

  const toggleFeature = (feature: string): void => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const renderFeatures = (tier: TierRow): string => {
    const features =
      typeof tier.features === 'string'
        ? JSON.parse(tier.features as string)
        : Array.isArray(tier.features)
          ? tier.features
          : [];
    return (
      (features as string[])
        .map((f: string) => f.charAt(0).toUpperCase() + f.slice(1))
        .join(', ') || 'None'
    );
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
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                          Duration
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
                          <td className="px-6 py-4 text-sm font-bold text-teal-600">
                            {(tier.price as number) === 0 ? 'Free' : `₹${tier.price as number}`}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {tier.durationDays as number} days
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
                    <label className="block text-sm font-bold text-slate-900 mb-2">Price (₹)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Duration (Days)
                    </label>
                    <input
                      type="number"
                      value={formData.durationDays}
                      onChange={(e) =>
                        setFormData({ ...formData, durationDays: Number(e.target.value) })
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

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Max Listings
                    </label>
                    <input
                      type="number"
                      value={formData.maxListings}
                      onChange={(e) =>
                        setFormData({ ...formData, maxListings: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="-1"
                      placeholder="-1 for unlimited"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Featured Listings
                    </label>
                    <input
                      type="number"
                      value={formData.featuredListingsPerMonth}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          featuredListingsPerMonth: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                      min="0"
                      placeholder="0 for none, total for plan duration"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-4">✨ Features</h3>
                  <div className="space-y-3">
                    {['image', 'video', 'featured'].map((feature) => (
                      <label
                        key={feature}
                        className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition"
                      >
                        <input
                          type="checkbox"
                          checked={formData.features.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                          className="w-5 h-5 accent-teal-500"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {feature.charAt(0).toUpperCase() + feature.slice(1)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {feature === 'image' && 'Allow image uploads'}
                            {feature === 'video' && 'Allow video uploads'}
                            {feature === 'featured' && 'Feature in top searched'}
                          </span>
                        </div>
                      </label>
                    ))}
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
