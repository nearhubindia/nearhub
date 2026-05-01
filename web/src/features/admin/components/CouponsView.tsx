import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  useDeactivateCoupon,
} from '@/features/admin/hooks';
import { formatters, validators } from '@/features/admin/utils';
import { ApiError } from '@/features/admin/api';

interface CouponRow {
  id: string;
  code: string;
  discountPercentage: number;
  maxUsageCount: number;
  usageCount?: number;
  expiresAt?: string;
  isActive: boolean;
}

export default function CouponsView() {
  const { data: couponsData, isLoading } = useCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const deactivateCoupon = useDeactivateCoupon();

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<CouponRow | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    code: '',
    discountPercentage: '',
    maxUsageCount: '',
    expiresAt: '',
  });

  const coupons: CouponRow[] = Array.isArray(couponsData?.coupons)
    ? (couponsData.coupons as CouponRow[])
    : [];

  const columns: ColumnDef<CouponRow>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter code...' },
      cell: ({ row }) => (
        <span className="font-bold text-slate-900">
          {formatters.formatCouponCode(row.original.code)}
        </span>
      ),
    },
    {
      accessorKey: 'discountPercentage',
      header: 'Discount',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter discount...' },
      cell: ({ row }) => <span className="text-slate-600">{row.original.discountPercentage}%</span>,
    },
    {
      id: 'usage',
      header: 'Usage',
      enableColumnFilter: true,
      accessorFn: (coupon) => `${coupon.usageCount || 0}/${coupon.maxUsageCount}`,
      meta: { filterPlaceholder: 'Filter usage...' },
      cell: ({ row }) => (
        <span className="rounded bg-slate-100 px-3 py-1 text-xs font-bold">
          {row.original.usageCount || 0}/{row.original.maxUsageCount}
        </span>
      ),
    },
    {
      accessorKey: 'expiresAt',
      header: 'Expires',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter expiry...' },
      cell: ({ row }) =>
        row.original.expiresAt ? formatters.formatDate(row.original.expiresAt) : '-',
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
            onClick={() => handleEdit(row.original)}
            className="cursor-pointer font-bold text-teal-600 transition hover:text-teal-800 hover:underline"
            type="button"
          >
            Edit
          </button>
          {row.original.isActive && (
            <button
              onClick={() => void handleDeactivate(row.original)}
              className="cursor-pointer font-bold text-amber-600 transition hover:text-amber-800 hover:underline"
              type="button"
            >
              Deactivate
            </button>
          )}
          <button
            onClick={() => handleDelete(row.original)}
            className="cursor-pointer font-bold text-red-600 transition hover:text-red-800 hover:underline"
            type="button"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    const errors = validators.validateCouponForm({
      code: editingCoupon ? editingCoupon.code : formData.code,
      discountPercentage: formData.discountPercentage,
      maxUsageCount: formData.maxUsageCount,
      expiresAt: formData.expiresAt,
    });

    if (errors.length > 0) {
      const errorMap = errors.reduce((acc, err) => ({ ...acc, [err.field]: err.message }), {});
      setFormErrors(errorMap);
      return;
    }

    const payload: Record<string, unknown> = {
      discountPercentage: Number(formData.discountPercentage),
      maxUsageCount: Number(formData.maxUsageCount),
    };

    if (!editingCoupon) {
      payload.code = formData.code.toUpperCase();
    }

    if (formData.expiresAt) {
      payload.expiresAt = new Date(formData.expiresAt).toISOString();
    }

    try {
      if (editingCoupon) {
        await updateCoupon.mutateAsync({
          id: editingCoupon.id as string,
          data: payload,
        });
      } else {
        await createCoupon.mutateAsync(payload);
      }
      closeCouponModal();
    } catch (error) {
      console.error('Failed to save coupon:', error);
      setFormErrors({ submit: 'Failed to save coupon. Please try again.' });
    }
  };

  const handleEdit = (coupon: CouponRow): void => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountPercentage: String(Number(coupon.discountPercentage ?? 0)),
      maxUsageCount: String(Number(coupon.maxUsageCount ?? 1)),
      expiresAt: coupon.expiresAt || '',
    });
    setShowCouponModal(true);
  };

  const handleDelete = (coupon: CouponRow): void => {
    setCouponToDelete(coupon);
    setShowDeleteModal(true);
  };

  const handleDeactivate = async (coupon: CouponRow): Promise<void> => {
    try {
      await deactivateCoupon.mutateAsync(coupon.id as string);
    } catch (error) {
      console.error('Failed to deactivate coupon:', error);
      const message =
        error instanceof ApiError
          ? error.message
          : 'Failed to deactivate coupon. Please try again.';
      alert(message);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!couponToDelete) return;

    try {
      await deleteCoupon.mutateAsync(couponToDelete.id as string);
      setShowDeleteModal(false);
      setCouponToDelete(null);
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      const message =
        error instanceof ApiError ? error.message : 'Failed to delete coupon. Please try again.';
      alert(message);
    }
  };

  const closeCouponModal = (): void => {
    setShowCouponModal(false);
    setEditingCoupon(null);
    setFormData({ code: '', discountPercentage: '', maxUsageCount: '', expiresAt: '' });
    setFormErrors({});
  };

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white sm:p-6">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Coupons</h1>
        <p className="text-slate-300">Create and manage discount coupons</p>
      </div>

      <div className="p-4 sm:p-6">
        <button
          onClick={() => {
            setEditingCoupon(null);
            setFormData({ code: '', discountPercentage: '', maxUsageCount: '', expiresAt: '' });
            setShowCouponModal(true);
          }}
          className="mb-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 font-bold text-white transition hover:bg-teal-600 hover:shadow-lg"
          type="button"
        >
          <Plus size={18} />
          New Coupon
        </button>

        {isLoading ? (
          <div className="py-12 text-center">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No coupons yet. Create one to get started!
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={coupons}
            searchPlaceholder="Search coupons..."
            showSearch
          />
        )}
      </div>

      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 border-b bg-gradient-to-r from-teal-500 to-cyan-500 p-6 text-white">
              <h2 className="text-2xl font-black">
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
              {formErrors.submit && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  {formErrors.submit}
                </div>
              )}

              {!editingCoupon && (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., SAVE30"
                    className={`w-full rounded-lg border px-4 py-2 focus:outline-none ${
                      formErrors.code
                        ? 'border-red-500 focus:border-red-700'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                    required
                  />
                  {formErrors.code && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.code}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900">Discount %</label>
                  <input
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) =>
                      setFormData({ ...formData, discountPercentage: e.target.value })
                    }
                    className={`w-full rounded-lg border px-4 py-2 focus:outline-none ${
                      formErrors.discountPercentage
                        ? 'border-red-500 focus:border-red-700'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                  />
                  {formErrors.discountPercentage && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.discountPercentage}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900">Max Usage</label>
                  <input
                    type="number"
                    value={formData.maxUsageCount}
                    onChange={(e) => setFormData({ ...formData, maxUsageCount: e.target.value })}
                    className={`w-full rounded-lg border px-4 py-2 focus:outline-none ${
                      formErrors.maxUsageCount
                        ? 'border-red-500 focus:border-red-700'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                  />
                  {formErrors.maxUsageCount && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.maxUsageCount}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-900">Expires At</label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCouponModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white transition hover:bg-teal-700"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold text-slate-900">Delete Coupon</h3>
            <p className="mb-6 text-slate-600">
              Are you sure you want to delete coupon{' '}
              <span className="font-bold">{couponToDelete?.code}</span>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setCouponToDelete(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 transition hover:bg-slate-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
