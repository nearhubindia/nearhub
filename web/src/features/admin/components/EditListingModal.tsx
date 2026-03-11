import { useState } from 'react';
import { X, Star, Zap, Check, Target } from 'lucide-react';
import type { Listing, Enhancements } from '@/features/admin/types/admin-types';
import { useUpdateListing } from '@/features/admin/hooks';
import { validators } from '@/features/admin/utils';

interface EditListingModalProps {
  listing: Listing | null;
  onClose: () => void;
}

export default function EditListingModal({ listing, onClose }: EditListingModalProps) {
  const updateListing = useUpdateListing();

  const [formData, setFormData] = useState({
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    price: String(listing?.price ?? ''),
    offerPrice: String(listing?.offerPrice ?? ''),
    category: listing?.category ?? 'Electronics',
    condition: listing?.condition ?? 'good',
    status: listing?.status ?? 'active',
    contactPhone: listing?.contactPhone ?? '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [enhancements, setEnhancements] = useState<Enhancements>({
    featured: Boolean(listing?.featured || listing?.enhancements?.featured),
    priority: listing?.enhancements?.priority || false,
    verified: listing?.enhancements?.verified || false,
    topSearch: listing?.enhancements?.topSearch || false,
  });
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [sponsored, setSponsored] = useState(Boolean(listing?.sponsored));

  const categories = ['Electronics', 'Vehicles', 'Real Estate', 'Services', 'Jobs'];
  const conditions = ['new', 'like_new', 'good', 'fair', 'poor'];

  const generateTitleWithAI = async (): Promise<void> => {
    if (!formData.description) {
      alert('Please enter a description first');
      return;
    }

    setIsGeneratingTitle(true);
    // TODO: Implement AI title generation when API is ready
    setTimeout(() => setIsGeneratingTitle(false), 1000);
  };

  const generateDescriptionWithAI = async (): Promise<void> => {
    if (!formData.title) {
      alert('Please enter a title first');
      return;
    }

    setIsGeneratingDescription(true);
    // TODO: Implement AI description generation when API is ready
    setTimeout(() => setIsGeneratingDescription(false), 1000);
  };

  const suggestCategoryWithAI = async (): Promise<void> => {
    if (!formData.title) {
      alert('Please enter a title first');
      return;
    }

    setIsSuggestingCategory(true);
    // TODO: Implement AI category suggestion when API is ready
    setTimeout(() => setIsSuggestingCategory(false), 1000);
  };

  const handleEnhancementChange = (enhancementKey: keyof Enhancements): void => {
    setEnhancements({
      ...enhancements,
      [enhancementKey]: !enhancements[enhancementKey],
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    if (!listing) {
      setFormErrors({ submit: 'No listing to update' });
      return;
    }

    // Validate form
    const errors = validators.validateListingForm({
      title: formData.title,
      description: formData.description,
      price: formData.price,
      location: listing.location || '',
    });

    if (errors.length > 0) {
      const errorMap = errors.reduce((acc, err) => ({ ...acc, [err.field]: err.message }), {});
      setFormErrors(errorMap);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        category: formData.category,
        condition: formData.condition,
        status: formData.status as 'active' | 'sold' | 'pending',
        contactPhone: String(formData.contactPhone || '').trim(),
        sponsored,
        ...enhancements,
      };

      if (formData.offerPrice && Number(formData.offerPrice) > 0) {
        payload.offerPrice = Number(formData.offerPrice);
      }

      await updateListing.mutateAsync({
        id: listing.id,
        data: payload,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update listing:', error);
      setFormErrors({ submit: 'Failed to update listing. Please try again.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Edit Listing</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-slate-700 p-2 rounded cursor-pointer transition"
            >
              <X size={24} />
            </button>
          </div>
          {listing && (
            <p className="text-slate-300 text-sm mt-2">
              ID: {listing.id} • {listing.title}
            </p>
          )}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {formErrors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {formErrors.submit}
            </div>
          )}
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <span className="text-xl">📝</span> Basic Information
            </h3>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-900">Title</label>
                <button
                  onClick={generateTitleWithAI}
                  disabled={isGeneratingTitle || !formData.description}
                  className="text-xs px-3 py-1 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                >
                  {isGeneratingTitle ? 'Generating...' : '✨ AI Generate'}
                </button>
              </div>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-900">Description</label>
                <button
                  onClick={generateDescriptionWithAI}
                  disabled={isGeneratingDescription || !formData.title}
                  className="text-xs px-3 py-1 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                >
                  {isGeneratingDescription ? 'Generating...' : '✨ AI Generate'}
                </button>
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Price</label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Offer Price <span className="text-xs font-normal text-slate-500">Optional</span>
                </label>
                <input
                  type="text"
                  value={formData.offerPrice || ''}
                  onChange={(e) => setFormData({ ...formData, offerPrice: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  placeholder="Discounted price"
                />
                {formData.offerPrice &&
                  parseFloat(formData.offerPrice) > 0 &&
                  parseFloat(formData.offerPrice) >= parseFloat(formData.price || '0') && (
                    <p className="text-red-600 text-xs mt-1">
                      ⚠ Offer price must be less than listed price
                    </p>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-900">Category</label>
                  <button
                    onClick={suggestCategoryWithAI}
                    disabled={isSuggestingCategory || !formData.title}
                    className="text-xs px-3 py-1 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                  >
                    {isSuggestingCategory ? 'Suggesting...' : '✨ AI Suggest'}
                  </button>
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                >
                  {conditions.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'active' | 'sold' | 'pending',
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Contact Number{' '}
                  <span className="text-xs font-normal text-slate-500">Optional</span>
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
          </div>

          {/* Enhancement Features */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <span className="text-xl">✨</span> Enhancement Features
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Sponsored */}
              <div className="border border-slate-300 rounded-lg p-4 hover:border-amber-500 transition">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sponsored}
                    onChange={() => setSponsored((prev) => !prev)}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Star size={18} className="text-amber-500" />
                      Sponsored Tag
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Separate from featured boost ranking
                    </p>
                  </div>
                </label>
              </div>

              {/* Sponsored */}
              <div className="border border-slate-300 rounded-lg p-4 hover:border-teal-500 transition">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancements.featured}
                    onChange={() => handleEnhancementChange('featured')}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Star size={18} className="text-amber-500" />
                      Featured Listing
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Highlight listing with featured ranking
                    </p>
                  </div>
                </label>
              </div>

              {/* Priority */}
              <div className="border border-slate-300 rounded-lg p-4 hover:border-teal-500 transition">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancements.priority}
                    onChange={() => handleEnhancementChange('priority')}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Zap size={18} className="text-blue-500" />
                      Priority Listing
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Show higher in search results</p>
                  </div>
                </label>
              </div>

              {/* Verified */}
              <div className="border border-slate-300 rounded-lg p-4 hover:border-teal-500 transition">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancements.verified}
                    onChange={() => handleEnhancementChange('verified')}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Check size={18} className="text-green-500" />
                      Verified Badge
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Show verified seller/item badge</p>
                  </div>
                </label>
              </div>

              {/* Top Search */}
              <div className="border border-slate-300 rounded-lg p-4 hover:border-teal-500 transition">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancements.topSearch}
                    onChange={() => handleEnhancementChange('topSearch')}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Target size={18} className="text-red-500" />
                      Top Search Placement
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Appear at top of relevant searches
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Active Enhancements Summary */}
            {(sponsored || Object.values(enhancements).some((v) => v)) && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-sm font-bold text-teal-900 mb-2">Active Enhancements:</p>
                <div className="flex flex-wrap gap-2">
                  {sponsored && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                      📢 Sponsored
                    </span>
                  )}
                  {enhancements.featured && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                      ⭐ Featured
                    </span>
                  )}
                  {enhancements.priority && (
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                      ⚡ Priority
                    </span>
                  )}
                  {enhancements.verified && (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                      ✓ Verified
                    </span>
                  )}
                  {enhancements.topSearch && (
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                      🎯 Top Search
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex gap-3 bg-slate-100 border-t border-slate-200 p-6">
            <button
              type="button"
              onClick={onClose}
              disabled={updateListing.isPending}
              className="flex-1 px-6 py-3 rounded-lg font-bold border border-slate-300 text-slate-900 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateListing.isPending}
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg hover:scale-105 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateListing.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
