import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { getApiUrl } from '@/lib/config';
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

const SCREEN_OPTIONS: BannerScreen[] = ['home', 'search', 'profile', 'listings'];

const DEFAULT_FORM_STATE: BannerFormState = {
  title: '',
  screen: 'home',
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};

async function requestPresignedUpload(params: {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const response = await fetch(`${getApiUrl()}/api/media/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaType: 'image',
      fileName: params.fileName,
      contentType: params.contentType,
      fileSizeBytes: params.fileSizeBytes,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: { uploadUrl?: string; publicUrl?: string };
  } | null;

  if (!response.ok || !payload?.success || !payload.data?.uploadUrl || !payload.data?.publicUrl) {
    throw new Error(payload?.error || 'Failed to create banner upload URL');
  }

  return {
    uploadUrl: payload.data.uploadUrl,
    publicUrl: payload.data.publicUrl,
  };
}

async function uploadImageFile(file: File): Promise<string> {
  const contentType = file.type || 'image/jpeg';
  const signed = await requestPresignedUpload({
    fileName: file.name,
    contentType,
    fileSizeBytes: file.size,
  });

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Banner upload failed (${uploadResponse.status})`);
  }

  return signed.publicUrl;
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
      const publicUrl = await uploadImageFile(selectedFile);
      setFormState((prev) => ({ ...prev, imageUrl: publicUrl }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to upload selected image');
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
        setSubmitError(
          'Cannot connect to API server. Please ensure backend is running on port 5000.'
        );
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

  const columns: ColumnDef<AppScreenBanner>[] = [
    {
      id: 'preview',
      header: 'Preview',
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      accessorFn: (banner) => banner.imageUrl,
      cell: ({ row }) => (
        <img
          src={row.original.imageUrl}
          alt={row.original.title}
          className="h-16 w-28 rounded border border-slate-200 object-cover"
        />
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter title...' },
    },
    {
      accessorKey: 'screen',
      header: 'Screen',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter screen...' },
      cell: ({ row }) => <span className="uppercase">{row.original.screen}</span>,
    },
    {
      accessorKey: 'sortOrder',
      header: 'Order',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter order...' },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter status...' },
      cell: ({ row }) => (
        <span
          className={`rounded px-3 py-1 text-xs font-bold ${
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
        <div className="space-x-2">
          <button
            onClick={() => openEditForm(row.original)}
            className="font-bold text-teal-600 transition hover:text-teal-800 hover:underline"
            type="button"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="font-bold text-red-600 transition hover:text-red-800 hover:underline"
            type="button"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white sm:p-6">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">App Banners</h1>
        <p className="text-slate-300">Upload and manage banners shown on app screens</p>
      </div>

      <div className="p-4 sm:p-6">
        <button
          onClick={openCreateForm}
          className="mb-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 font-bold text-white transition hover:bg-teal-600 hover:shadow-lg"
          type="button"
        >
          <Plus size={18} />
          New Banner
        </button>

        {isLoading ? (
          <div className="py-12 text-center">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No banners yet. Create your first banner.
          </div>
        ) : (
          <DataTable columns={columns} data={banners} searchPlaceholder="Search banners..." />
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 border-b bg-gradient-to-r from-teal-500 to-cyan-500 p-6 text-white">
              <h2 className="text-2xl font-black">
                {editingBanner ? 'Edit Banner' : 'Create Banner'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  {submitError}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-900">Title</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900">Screen</label>
                  <select
                    value={formState.screen}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        screen: e.target.value as BannerScreen,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-teal-500 focus:outline-none"
                  >
                    {SCREEN_OPTIONS.map((screen) => (
                      <option key={screen} value={screen}>
                        {screen}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900">Order</label>
                  <input
                    type="number"
                    value={formState.sortOrder}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="h-4 w-4 accent-teal-600"
                />
                <span className="text-sm font-medium text-slate-700">Banner is active</span>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-900">Upload Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-teal-500 focus:outline-none"
                />
                {isUploading && <p className="mt-2 text-sm text-slate-500">Reading image...</p>}
                {formState.imageUrl && (
                  <img
                    src={formState.imageUrl}
                    alt="Preview"
                    className="mt-3 h-40 w-full rounded-lg border border-slate-200 object-cover"
                  />
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white transition hover:bg-teal-700"
                >
                  Save Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
