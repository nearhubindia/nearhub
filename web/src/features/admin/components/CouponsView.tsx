import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
} from '@/features/admin/hooks';
import { formatters, validators } from '@/features/admin/utils';

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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    // Validate form data
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

  const confirmDelete = async (): Promise<void> => {
    if (!couponToDelete) return;

    try {
      await deleteCoupon.mutateAsync(couponToDelete.id as string);
      setShowDeleteModal(false);
      setCouponToDelete(null);
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      alert('Failed to delete coupon');
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Coupons</h1>
        <p className="text-slate-300">Create and manage discount coupons</p>
      </div>

      <div className="p-4 sm:p-6">
        <button
          onClick={() => {
            setEditingCoupon(null);
            setFormData({ code: '', discountPercentage: '', maxUsageCount: '', expiresAt: '' });
            setShowCouponModal(true);
          }}
          className="bg-teal-500 text-white px-6 py-2 rounded-lg hover:bg-teal-600 hover:shadow-lg hover:scale-105 transition flex items-center gap-2 mb-6 font-bold cursor-pointer"
        >
          <Plus size={20} />
          New Coupon
        </button>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No coupons yet. Create one to get started!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[860px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Code</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Discount</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Usage</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Expires</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {formatters.formatCouponCode(coupon.code)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {coupon.discountPercentage}%
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="bg-slate-100 px-3 py-1 rounded text-xs font-bold">
                        {coupon.usageCount || 0}/{coupon.maxUsageCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {coupon.expiresAt ? formatters.formatDate(coupon.expiresAt) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded text-xs font-bold ${
                          coupon.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(coupon)}
                        className="text-teal-600 hover:text-teal-800 hover:underline font-bold cursor-pointer transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(coupon)}
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

      {/* Coupon Form Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-6 border-b">
              <h2 className="text-2xl font-black">
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
              {formErrors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  {formErrors.submit}
                </div>
              )}

              {!editingCoupon && (
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., SAVE30"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none ${
                      formErrors.code
                        ? 'border-red-500 focus:border-red-700'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                    required
                  />
                  {formErrors.code && (
                    <p className="text-red-600 text-sm mt-1">{formErrors.code}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Discount %</label>
                  <input
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) =>
                      setFormData({ ...formData, discountPercentage: e.target.value })
                    }
                    placeholder="0-100"
                    min="0"
                    max="100"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none ${
                      formErrors.discountPercentage
                        ? 'border-red-500 focus:border-red-700'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                    required
                  />
                  {formErrors.discountPercentage && (
                    <p className="text-red-600 text-sm mt-1">{formErrors.discountPercentage}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Max Uses</label>
                  <input
                    type="number"
                    value={formData.maxUsageCount}
                    onChange={(e) => setFormData({ ...formData, maxUsageCount: e.target.value })}
                    placeholder="e.g., 100"
                    min="1"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none ${
                      formErrors.maxUsageCount
                        ? 'border-red-500 focus:border-red-700'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                    required
                  />
                  {formErrors.maxUsageCount && (
                    <p className="text-red-600 text-sm mt-1">{formErrors.maxUsageCount}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Expiry Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none ${
                    formErrors.expiresAt
                      ? 'border-red-500 focus:border-red-700'
                      : 'border-slate-300 focus:border-teal-500'
                  }`}
                />
                {formErrors.expiresAt && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.expiresAt}</p>
                )}
              </div>

              <div className="flex flex-col gap-3 bg-slate-100 border-t p-6 -mx-6 -mb-6 sm:flex-row">
                <button
                  type="button"
                  onClick={closeCouponModal}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-bold text-slate-900 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCoupon.isPending || updateCoupon.isPending}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg hover:scale-105 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createCoupon.isPending || updateCoupon.isPending
                    ? 'Saving...'
                    : editingCoupon
                      ? 'Update Coupon'
                      : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && couponToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 border-b">
              <h2 className="text-2xl font-black">Delete Coupon?</h2>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete the coupon{' '}
                <span className="font-bold text-slate-900">
                  "{formatters.formatCouponCode(couponToDelete.code)}"
                </span>
                ? This action cannot be undone.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800">
                  <span className="font-bold">Current Usage:</span> {couponToDelete.usageCount || 0}{' '}
                  / {couponToDelete.maxUsageCount}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCouponToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-bold text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteCoupon.isPending}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg hover:scale-105 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteCoupon.isPending ? 'Deleting...' : 'Delete Coupon'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
