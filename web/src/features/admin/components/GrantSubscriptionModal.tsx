import { useState } from 'react';
import { BadgeCheck, CreditCard, Gift } from 'lucide-react';
import { AdminListingModalFrame } from '@/features/admin/components/AdminListingModalFrame';
import { useGrantUserSubscription, useSubscriptionTiers } from '@/features/admin/hooks';
import type { AdminUserRow } from '@/features/admin/types/admin-types';

type SubscriptionTierOption = {
  id: string;
  name: string;
  durationDays?: number;
  price?: number | string;
  boostCredits?: number;
  maxListings?: number;
  isActive?: boolean;
};

interface GrantSubscriptionModalProps {
  user: AdminUserRow;
  onClose: () => void;
  onSaved: () => void;
}

export default function GrantSubscriptionModal({
  user,
  onClose,
  onSaved,
}: GrantSubscriptionModalProps) {
  const grantSubscription = useGrantUserSubscription();
  const { data: tiersData, isLoading: tiersLoading } = useSubscriptionTiers();
  const tiers: SubscriptionTierOption[] = Array.isArray(tiersData?.tiers)
    ? (tiersData.tiers as SubscriptionTierOption[])
    : [];
  const defaultTier = tiers.find((tier) => tier.isActive !== false) || tiers[0] || null;

  const [tierId, setTierId] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const selectedTierId = tierId || defaultTier?.id || '';
  const selectedTier = tiers.find((tier) => tier.id === selectedTierId) || defaultTier || null;
  const effectiveDurationDays = durationDays || String(selectedTier?.durationDays || '');
  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-100';
  const labelClass = 'mb-2 block text-sm font-semibold tracking-wide text-slate-700';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormErrors({});

    if (!selectedTierId) {
      setFormErrors({ tierId: 'Please choose a subscription tier' });
      return;
    }

    try {
      await grantSubscription.mutateAsync({
        id: user.id,
        data: {
          tierId: selectedTierId,
          durationDays: effectiveDurationDays.trim() ? Number(effectiveDurationDays) : undefined,
        },
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error('[Admin Users] Failed to grant subscription:', error);
      setFormErrors({
        submit: 'Failed to grant subscription. Please try again.',
      });
    }
  };

  return (
    <AdminListingModalFrame
      onClose={onClose}
      onSubmit={handleSubmit}
      header={
        <div className="relative overflow-hidden border-b border-cyan-200 bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-6 text-white sm:px-8">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <p className="relative mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Gift size={14} />
            Manual Grant
          </p>
          <h2 className="relative flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <CreditCard size={24} />
            Grant Subscription
          </h2>
          <p className="relative mt-1 text-sm text-cyan-50/95">
            Grant a paid subscription to {user.displayName || user.mobile || user.id}.
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-5 sm:flex-row sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={grantSubscription.isPending}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={grantSubscription.isPending || tiersLoading || !selectedTierId}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            {grantSubscription.isPending ? 'Granting...' : 'Grant Subscription'}
          </button>
        </div>
      }
    >
      {formErrors.submit && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {formErrors.submit}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <BadgeCheck size={16} /> Choose Tier
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              The subscription will be activated immediately for this user.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Subscription Tier *</label>
            <select
              value={selectedTierId}
              onChange={(e) => {
                setTierId(e.target.value);
                setDurationDays('');
              }}
              className={inputClass}
              disabled={tiersLoading}
            >
              <option value="">Select a tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                  {tier.durationDays ? ` · ${tier.durationDays} days` : ''}
                  {tier.price !== undefined ? ` · ₹${tier.price}` : ''}
                </option>
              ))}
            </select>
            {formErrors.tierId ? (
              <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.tierId}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>
              Duration Days <span className="text-xs font-normal text-slate-500">Optional</span>
            </label>
            <input
              type="number"
              min="1"
              value={effectiveDurationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder={
                selectedTier?.durationDays ? String(selectedTier.durationDays) : 'Tier default'
              }
              className={inputClass}
            />
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Grant Summary</p>
            <p className="mt-1">User: {user.displayName || user.mobile || user.id}</p>
            <p className="mt-1">Tier: {selectedTier?.name || '-'}</p>
            <p className="mt-1">
              Duration: {durationDays || selectedTier?.durationDays || '-'} days
            </p>
          </div>
        </div>
      </div>
    </AdminListingModalFrame>
  );
}
