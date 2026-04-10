import { useEffect, useState } from 'react';
import { BadgeCheck, MapPin, User, X } from 'lucide-react';
import { useCreateUser, useUpdateUser } from '@/features/admin/hooks';
import type { AdminUserRow, AdminUserWriteData } from '@/features/admin/types/admin-types';

interface UserFormModalProps {
  mode: 'create' | 'edit';
  user?: AdminUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}

type UserFormState = {
  displayName: string;
  mobile: string;
  location: string;
  isVerified: boolean;
};

const EMPTY_FORM: UserFormState = {
  displayName: '',
  mobile: '',
  location: '',
  isVerified: false,
};

export default function UserFormModal({ mode, user, onClose, onSaved }: UserFormModalProps) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [formData, setFormData] = useState<UserFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData({
        displayName: typeof user.displayName === 'string' ? user.displayName.trim() : '',
        mobile: typeof user.mobile === 'string' ? user.mobile.trim() : '',
        location:
          typeof user.autoDetectedLocation === 'string' && user.autoDetectedLocation.trim()
            ? user.autoDetectedLocation.trim()
            : typeof user.location === 'string'
              ? user.location.trim()
              : '',
        isVerified: Boolean(user.isVerified),
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setFormErrors({});
  }, [mode, user]);

  const isSaving = createUser.isPending || updateUser.isPending;

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-100';
  const labelClass = 'mb-2 block text-sm font-semibold tracking-wide text-slate-700';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    const displayName = formData.displayName.trim();
    const mobile = formData.mobile.trim();
    const location = formData.location.trim();

    if (mode === 'create' && !displayName) {
      setFormErrors({
        displayName: 'Display name is required',
      });
      return;
    }

    if (!mobile || !location) {
      setFormErrors({
        mobile: 'Mobile number is required',
        location: 'Location is required',
      });
      return;
    }

    const payload: AdminUserWriteData = {
      displayName,
      mobile,
      location,
      isVerified: Boolean(formData.isVerified),
    };

    try {
      if (mode === 'create') {
        await createUser.mutateAsync(payload);
      } else if (user) {
        await updateUser.mutateAsync({ id: user.id, data: payload });
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error(`[Admin Users] Failed to ${mode === 'create' ? 'create' : 'update'} user:`, error);
      setFormErrors({
        submit:
          mode === 'create' ? 'Failed to create user. Please try again.' : 'Failed to update user.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 z-20 rounded-full bg-white/90 p-2 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
        >
          <X size={16} />
        </button>

        <div className="relative overflow-hidden border-b border-cyan-200 bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-6 text-white sm:px-8">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <p className="relative mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <User size={14} />
            Seller Registry
          </p>
          <h2 className="relative flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {mode === 'create' ? <User size={24} /> : <BadgeCheck size={24} />}
            {mode === 'create' ? 'Add User' : 'Edit User'}
          </h2>
          <p className="relative mt-1 text-sm text-cyan-50/95">
            {mode === 'create'
              ? 'Create a seller profile you can use for demo listings.'
              : 'Update the seller profile details shown in admin and public listings.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 p-6 sm:p-8">
            {formErrors.submit && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                {formErrors.submit}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>
                  Display Name {mode === 'create' ? '*' : <span className="text-xs font-normal text-slate-500">Optional</span>}
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. Arjun Sharma"
                  className={inputClass}
                />
                {formErrors.displayName && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {formErrors.displayName}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Buyers see this name on the listing card and seller profile.
                </p>
              </div>

              <div>
                <label className={labelClass}>Mobile *</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className={inputClass}
                />
                {formErrors.mobile && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.mobile}</p>
                )}
              </div>

              <div>
                <label className={`${labelClass} flex items-center gap-2`}>
                  <MapPin size={14} /> Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State"
                  className={inputClass}
                />
                {formErrors.location && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.location}</p>
                )}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <input
                type="checkbox"
                checked={formData.isVerified}
                onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                className="h-4 w-4 accent-emerald-600"
              />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Verified Seller</p>
                <p className="text-xs text-emerald-800">
                  Mark this seller as trusted in admin views.
                </p>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-5 sm:flex-row sm:p-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                !formData.mobile.trim() ||
                !formData.location.trim() ||
                (mode === 'create' && !formData.displayName.trim())
              }
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {isSaving ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
