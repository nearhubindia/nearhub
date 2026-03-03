import { useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import {
  useBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
} from '@/features/admin/hooks';
import type { AppScreenBanner, BannerPayload } from '@/features/admin/types/admin-types';

type BannerScreen = AppScreenBanner['screen'];

interface BannerFormState {
  title: string;
  screen: BannerScreen;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const SCREEN_OPTIONS: BannerScreen[] = ['home', 'search', 'profile', 'shorts', 'listings'];

const DEFAULT_FORM_STATE: BannerFormState = {
  title: '',
  screen: 'home',
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new Error('Failed to read image file'));
    };
    reader.onerror = (): void => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export default function BannersView() {
  const { data, isLoading } = useBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();

  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AppScreenBanner | null>(null);
  const [formState, setFormState] = useState<BannerFormState>(DEFAULT_FORM_STATE);
  const [submitError, setSubmitError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const banners = useMemo(() => data?.banners ?? [], [data]);

  const resetForm = (): void => {
    setShowForm(false);
    setEditingBanner(null);
    setFormState(DEFAULT_FORM_STATE);
    setSubmitError('');
    setIsUploading(false);
  };

  const openCreateForm = (): void => {
    setEditingBanner(null);
    setFormState(DEFAULT_FORM_STATE);
    setSubmitError('');
    setShowForm(true);
  };

  const openEditForm = (banner: AppScreenBanner): void => {
    setEditingBanner(banner);
    setFormState({
      title: banner.title,
      screen: banner.screen,
      imageUrl: banner.imageUrl,
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
    });
    setSubmitError('');
    setShowForm(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    try {
      setIsUploading(true);
      const dataUrl = await fileToDataUrl(selectedFile);
      setFormState((prev) => ({ ...prev, imageUrl: dataUrl }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to read selected image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitError('');

    if (!formState.title.trim()) {
      setSubmitError('Banner title is required');
      return;
    }

    if (!formState.imageUrl.trim()) {
      setSubmitError('Please upload a banner image');
      return;
    }

    const payload: BannerPayload = {
      title: formState.title.trim(),
      screen: formState.screen,
      imageUrl: formState.imageUrl,
      sortOrder: Number(formState.sortOrder),
      isActive: formState.isActive,
    };

    try {
      if (editingBanner) {
        await updateBanner.mutateAsync({
          id: editingBanner.id,
          data: payload,
        });
      } else {
        await createBanner.mutateAsync(payload);
      }
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save banner';
      if (message.toLowerCase().includes('failed to fetch')) {
        setSubmitError('Cannot connect to API server. Please ensure backend is running on port 5000.');
      } else {
        setSubmitError(message);
      }
    }
  };

  const handleDelete = async (bannerId: string): Promise<void> => {
    const confirmed = window.confirm('Delete this banner?');
    if (!confirmed) {
      return;
    }

    try {
      await deleteBanner.mutateAsync(bannerId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete banner');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">App Banners</h1>
        <p className="text-slate-300">Upload and manage banners shown on app screens</p>
      </div>

      <div className="p-6">
        <button
          onClick={openCreateForm}
          className="bg-teal-500 text-white px-6 py-2 rounded-lg hover:bg-teal-600 hover:shadow-lg hover:scale-105 transition flex items-center gap-2 mb-6 font-bold cursor-pointer"
        >
          <Plus size={20} />
          New Banner
        </button>

        {isLoading ? (
          <div className="text-center py-12">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No banners yet. Create your first banner.</div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Preview</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Title</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Screen</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Order</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="h-16 w-28 rounded object-cover border border-slate-200"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{banner.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 uppercase">{banner.screen}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{banner.sortOrder}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded text-xs font-bold ${
                          banner.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {banner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm space-x-2">
                      <button
                        onClick={() => openEditForm(banner)}
                        className="text-teal-600 hover:text-teal-800 hover:underline font-bold cursor-pointer transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id)}
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
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-6 border-b">
              <h2 className="text-2xl font-black">
                {editingBanner ? 'Edit Banner' : 'Create Banner'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Title</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Home promo banner"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Screen</label>
                  <select
                    value={formState.screen}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        screen: event.target.value as BannerScreen,
                      }))
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  >
                    {SCREEN_OPTIONS.map((screen) => (
                      <option key={screen} value={screen}>
                        {screen}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={formState.sortOrder}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        sortOrder: Number(event.target.value),
                      }))
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Banner Image</label>
                <label className="w-full h-36 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 transition">
                  <Upload size={26} className="text-slate-500" />
                  <span className="mt-2 text-sm text-slate-600">
                    {isUploading ? 'Uploading image...' : 'Click to upload image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleImageUpload(event);
                    }}
                  />
                </label>
                {formState.imageUrl && (
                  <img
                    src={formState.imageUrl}
                    alt="Banner preview"
                    className="mt-3 h-28 w-full rounded object-cover border border-slate-200"
                  />
                )}
              </div>

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                  className="w-4 h-4 accent-teal-500"
                />
                Active banner
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBanner.isPending || updateBanner.isPending || isUploading}
                  className="flex-1 bg-teal-500 text-white py-2 rounded-lg font-bold hover:bg-teal-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingBanner ? 'Update Banner' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
