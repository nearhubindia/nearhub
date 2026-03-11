import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCreateListing } from '@/features/admin/hooks';
import { validators } from '@/features/admin/utils';

interface CreateListingModalProps {
  onClose: () => void;
}

export default function CreateListingModal({ onClose }: CreateListingModalProps) {
  const createListing = useCreateListing();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    offerPrice: '',
    category: 'Electronics',
    condition: 'good',
    location: '',
    contactPhone: '',
    userId: 'admin',
    images: [] as string[],
    videos: [] as string[],
    featured: false,
    sponsored: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const categories = [
    'Electronics',
    'Vehicles',
    'Real Estate',
    'Services',
    'Jobs',
    'Fashion',
    'Home & Garden',
    'Sports',
    'Books',
    'Pets',
    'Food',
    'Other',
  ];
  const conditions = ['new', 'like_new', 'good', 'fair', 'poor'];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), base64String],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData((prev) => ({
          ...prev,
          videos: [...(prev.videos || []), base64String],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number): void => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const removeVideo = (index: number): void => {
    const newVideos = [...(formData.videos || [])];
    newVideos.splice(index, 1);
    setFormData({ ...formData, videos: newVideos });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    // Validate form
    const errors = validators.validateListingForm({
      title: formData.title,
      description: formData.description,
      price: formData.price,
      location: formData.location,
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
        location: formData.location,
        contactPhone: String(formData.contactPhone || '').trim(),
        userId: formData.userId,
        images: formData.images,
        videos: formData.videos,
        featured: Boolean(formData.featured),
        sponsored: Boolean(formData.sponsored),
        listingType:
          formData.videos.length > 0 && formData.images.length === 0
            ? 'video'
            : formData.videos.length > 0
              ? 'mixed'
              : 'image',
      };

      if (formData.offerPrice && Number(formData.offerPrice) > 0) {
        payload.offerPrice = Number(formData.offerPrice);
      }

      await createListing.mutateAsync(payload);
      onClose();
    } catch (error) {
      console.error('Failed to create listing:', error);
      setFormErrors({ submit: 'Failed to create listing. Please try again.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-6 border-b border-teal-600">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <Plus size={24} />
            Create New Listing
          </h2>
          <p className="text-teal-50 text-sm mt-2">Fill in the details to create a new listing</p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {formErrors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {formErrors.submit}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-slate-900">Basic Information</h3>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter listing title"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter listing description (optional)"
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Price (₹) *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  required
                />
                <p className="text-xs text-slate-600 mt-1">Price in INR (₹)</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Offer Price (₹){' '}
                  <span className="text-xs font-normal text-slate-500">Optional</span>
                </label>
                <input
                  type="number"
                  value={formData.offerPrice}
                  onChange={(e) => setFormData({ ...formData, offerPrice: e.target.value })}
                  placeholder="Discounted price"
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
                {formData.offerPrice &&
                  parseFloat(formData.offerPrice) > 0 &&
                  parseFloat(formData.offerPrice) >= parseFloat(formData.price || '0') && (
                    <p className="text-red-600 text-xs mt-1">
                      ⚠ Offer price must be less than listed price
                    </p>
                  )}
                {formData.offerPrice &&
                  parseFloat(formData.offerPrice) > 0 &&
                  parseFloat(formData.offerPrice) < parseFloat(formData.price || '0') && (
                    <p className="text-green-600 text-xs mt-1">
                      ✓ Saving ₹
                      {(
                        parseFloat(formData.price || '0') - parseFloat(formData.offerPrice)
                      ).toLocaleString()}
                    </p>
                  )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Condition *</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  required
                >
                  {conditions.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Location *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  required
                />
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
                  placeholder="e.g. 9876543210"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Images</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-teal-500 transition">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Plus className="text-slate-400 mb-2" size={32} />
                  <p className="text-sm text-slate-600 text-center">
                    Click to upload images
                    <br />
                    <span className="text-xs text-slate-500">
                      Supports: JPG, PNG, GIF (Max 5 images)
                    </span>
                  </p>
                </label>
              </div>

              {/* Image Previews */}
              {formData.images && formData.images.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {formData.images.map((img: string, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video Upload Section */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Videos</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-teal-500 transition">
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Plus className="text-slate-400 mb-2" size={32} />
                  <p className="text-sm text-slate-600 text-center">
                    Click to upload videos
                    <br />
                    <span className="text-xs text-slate-500">Supports: MP4, MOV, WEBM</span>
                  </p>
                </label>
              </div>

              {formData.videos && formData.videos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {formData.videos.map((video: string, index: number) => (
                    <div key={index} className="relative group">
                      <video
                        src={video}
                        className="w-full h-28 object-cover rounded-lg border-2 border-slate-200 bg-slate-100"
                        controls
                      />
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>💡 Info:</strong> Users need an active subscription or coupon code with free
                listings to create listings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg p-4">
                <input
                  type="checkbox"
                  checked={formData.sponsored}
                  onChange={(e) => setFormData({ ...formData, sponsored: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Sponsored Tag</p>
                  <p className="text-xs text-amber-800">Show sponsored label in cards/details.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-blue-50 border border-blue-200 rounded-lg p-4">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Featured Listing</p>
                  <p className="text-xs text-blue-800">
                    Use featured ranking separately from sponsored.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex gap-3 bg-slate-100 border-t border-slate-200 p-6">
            <button
              type="button"
              onClick={onClose}
              disabled={createListing.isPending}
              className="flex-1 px-6 py-3 rounded-lg font-bold border border-slate-300 text-slate-900 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                createListing.isPending || !formData.title || !formData.price || !formData.location
              }
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createListing.isPending ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
