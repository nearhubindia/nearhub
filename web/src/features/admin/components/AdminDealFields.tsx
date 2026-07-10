import type { Dispatch, SetStateAction } from 'react';
import { CalendarClock, Ticket, ToggleLeft } from 'lucide-react';

type DealFormState = {
  isDeal: boolean;
  dealType: string;
  dealStartAt: string;
  dealEndAt: string;
  dealRecurrence: string;
  dealRecurrenceUntil: string;
  purchaseLimitType: string;
  maxDealBookings: string;
  comboItemsText: string;
  dealTerms: string;
  voucherEnabled: boolean;
};

function toPrettyDateTime(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDateTimeValue(value: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const pad = (num: number): string => String(num).padStart(2, '0');
  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type AdminDealFieldsProps<TForm extends DealFormState> = {
  formData: TForm;
  setFormData: Dispatch<SetStateAction<TForm>>;
  inputClass: string;
  labelClass: string;
  formErrors?: Record<string, string>;
  locked?: boolean;
};

export function AdminDealFields<TForm extends DealFormState>({
  formData,
  setFormData,
  inputClass,
  labelClass,
  formErrors = {},
  locked = false,
}: AdminDealFieldsProps<TForm>) {
  const enabled = formData.isDeal;
  const comboItemsVisible = String(formData.dealType || 'normal').toLowerCase() === 'combo';

  return (
    <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Ticket size={16} /> Deal Promotion
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Promote this listing into a timed deal with a future start window.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            disabled={locked}
            onChange={() =>
              setFormData((prev) => ({
                ...prev,
                isDeal: !prev.isDeal,
              }))
            }
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <ToggleLeft size={16} className={enabled ? 'text-cyan-600' : 'text-slate-400'} />
          Treat as deal
        </label>
      </div>

      {enabled ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Deal Type</label>
            <select
              value={formData.dealType}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dealType: e.target.value as string }))
              }
              className={inputClass}
              disabled={locked}
            >
              <option value="normal">Normal Deal</option>
              <option value="combo">Combo Deal</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Purchase Limit Type</label>
            <select
              value={formData.purchaseLimitType}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, purchaseLimitType: e.target.value as string }))
              }
              className={inputClass}
              disabled={locked}
            >
              <option value="ONE_TIME">One Time</option>
              <option value="UNLIMITED">Unlimited</option>
            </select>
          </div>

          <div>
            <label className={`${labelClass} flex items-center gap-2`}>
              <CalendarClock size={14} /> Start At
            </label>
            <input
              type="datetime-local"
              value={toLocalDateTimeValue(formData.dealStartAt)}
              onChange={(e) => setFormData((prev) => ({ ...prev, dealStartAt: e.target.value }))}
              className={inputClass}
              disabled={locked}
            />
            {formErrors.dealStartAt ? (
              <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.dealStartAt}</p>
            ) : null}
          </div>

          <div>
            <label className={`${labelClass} flex items-center gap-2`}>
              <CalendarClock size={14} /> End At
            </label>
            <input
              type="datetime-local"
              value={toLocalDateTimeValue(formData.dealEndAt)}
              onChange={(e) => setFormData((prev) => ({ ...prev, dealEndAt: e.target.value }))}
              className={inputClass}
              disabled={locked}
            />
            {formErrors.dealEndAt ? (
              <p className="mt-1 text-xs font-medium text-rose-600">{formErrors.dealEndAt}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Repeat</label>
            <select
              value={formData.dealRecurrence}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dealRecurrence: e.target.value as string }))
              }
              className={inputClass}
              disabled={locked}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {String(formData.dealRecurrence || 'none').toLowerCase() !== 'none' ? (
            <div>
              <label className={`${labelClass} flex items-center gap-2`}>
                <CalendarClock size={14} /> Repeat Until
              </label>
              <input
                type="datetime-local"
                value={toLocalDateTimeValue(formData.dealRecurrenceUntil)}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dealRecurrenceUntil: e.target.value }))
                }
                className={inputClass}
                disabled={locked}
              />
              {formErrors.dealRecurrenceUntil ? (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {formErrors.dealRecurrenceUntil}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                Choose when this recurring deal should stop repeating.
              </p>
            </div>
          ) : null}

          <div>
            <label className={labelClass}>
              Max Deal Bookings <span className="text-xs font-normal text-slate-500">Optional</span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.maxDealBookings}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, maxDealBookings: e.target.value }))
              }
              placeholder="e.g. 10"
              className={inputClass}
              disabled={locked}
            />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-white p-4">
            <input
              type="checkbox"
              checked={formData.voucherEnabled}
              onChange={() =>
                setFormData((prev) => ({ ...prev, voucherEnabled: !prev.voucherEnabled }))
              }
              className="h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              disabled={locked}
            />
            <div>
              <p className="font-semibold text-slate-900">Enable Voucher</p>
              <p className="text-xs text-slate-500">Allow buyers to redeem a deal voucher.</p>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>
              Deal Terms <span className="text-xs font-normal text-slate-500">Optional</span>
            </label>
            <textarea
              value={formData.dealTerms}
              onChange={(e) => setFormData((prev) => ({ ...prev, dealTerms: e.target.value }))}
              placeholder="Add any restrictions or redemption notes"
              rows={3}
              className={inputClass}
              disabled={locked}
            />
          </div>

          {comboItemsVisible ? (
            <div className="md:col-span-2">
              <label className={labelClass}>
                Combo Items <span className="text-xs font-normal text-slate-500">One per line</span>
              </label>
              <textarea
                value={formData.comboItemsText}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, comboItemsText: e.target.value }))
                }
                placeholder="Item 1\nItem 2\nItem 3"
                rows={4}
                className={inputClass}
                disabled={locked}
              />
            </div>
          ) : null}

          <div className="md:col-span-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Preview</p>
            <p className="mt-1">
              Start: {toPrettyDateTime(formData.dealStartAt)} · End:{' '}
              {toPrettyDateTime(formData.dealEndAt)}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-cyan-100 bg-white/70 p-4 text-sm text-slate-600">
          Toggle this on to configure a future-start deal for the listing.
        </div>
      )}
    </div>
  );
}

export type { DealFormState };
