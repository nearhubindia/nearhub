import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Timer } from 'lucide-react';
import { countdownPartsFromMs, discountPercentage, formatPriceInr } from '@/features/landing/lib';
import { FALLBACK_LISTING_IMAGE, getListingImages } from '@/features/landing/lib';

type ComboDealCardItem = {
  id: string;
  title: string;
  description?: string;
  price?: string | number;
  offerPrice?: string | number;
  image?: string;
  images?: string[];
  comboItems?: string[] | string;
  dealStatus?: string;
  dealEndAt?: string | number | null;
  purchaseLimitType?: string;
};

function parseComboTitle(item: ComboDealCardItem): string {
  const raw = item.comboItems;
  if (Array.isArray(raw) && raw.length >= 2) {
    return `${raw[0]} + ${raw[1]}`;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return `${parsed[0]} + ${parsed[1]}`;
      }
    } catch {
      const parts = raw
        .split(/\r?\n|,/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]} + ${parts[1]}`;
      }
    }
  }
  return item.title;
}

function parseComboSubtitle(item: ComboDealCardItem): string {
  const raw = item.comboItems;
  if (Array.isArray(raw) && raw.length >= 2) {
    return raw.slice(0, 2).join(' + ');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 2).join(' + ');
    } catch {
      const parts = raw
        .split(/\r?\n|,/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 0) return parts.slice(0, 2).join(' + ');
    }
  }
  return item.description || 'Combo deal';
}

function getPurchaseLimitLabel(value?: string): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ONE_TIME') return 'One purchase per customer';
  if (normalized === 'UNLIMITED') return 'Unlimited purchases';
  return '';
}

export function ComboDealCard({
  item,
  saved,
  onToggleSaved,
  nowMs,
  ctaLabel = 'View deal',
}: {
  item: ComboDealCardItem;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  nowMs: number;
  ctaLabel?: string;
}): ReactElement {
  const images = getListingImages(item);
  const leftImage = images[0] || item.image || FALLBACK_LISTING_IMAGE;
  const rightImage = images[1] || images[0] || item.image || FALLBACK_LISTING_IMAGE;
  const comboTitle = parseComboTitle(item);
  const comboSubtitle = parseComboSubtitle(item);
  const isLive = String(item.dealStatus || '').startsWith('Ends in');
  const price = Number(item.price || 0);
  const offer = Number(item.offerPrice || 0);
  const hasOffer = Number.isFinite(price) && Number.isFinite(offer) && price > 0 && offer > 0 && offer < price;
  const dealTag = discountPercentage(hasOffer ? offer : undefined, price) || 'Combo Deal';
  const purchaseLimitLabel = getPurchaseLimitLabel(item.purchaseLimitType);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/listing/${encodeURIComponent(item.id)}`} className="block">
        <div className="relative aspect-[1.18] overflow-hidden bg-white p-2">
          <div className="grid h-full grid-cols-2 gap-2 rounded-xl bg-slate-100 p-0.5">
            {[leftImage, rightImage].map((src, index) => (
              <div
                key={`${item.id}-combo-image-${index}`}
                className="flex min-w-0 items-center justify-center overflow-hidden rounded-lg bg-white"
              >
                <img
                  src={src}
                  alt={`${comboTitle} item ${index + 1}`}
                  className="block h-full w-full object-cover object-center"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_LISTING_IMAGE;
                  }}
                />
              </div>
            ))}
          </div>
          <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-red-600 text-xl font-black leading-none text-white shadow-lg">
            +
          </span>
          <span className="absolute left-3 top-3 rounded-full bg-[#0f172a]/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-sm">
            {dealTag}
          </span>
        </div>
      </Link>

      <div className="relative flex flex-1 flex-col p-3 sm:p-4">
        <button
          type="button"
          onClick={() => onToggleSaved(item.id)}
          className="absolute -top-[calc(100%+0.25rem)] right-2 rounded-full bg-white/90 p-1 text-slate-800 shadow-sm backdrop-blur sm:right-3 sm:p-1.5"
          aria-label={saved ? 'Remove from favourites' : 'Save deal'}
        >
          <Heart size={20} className={`h-4 w-4 sm:h-5 sm:w-5 ${saved ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        <Link to={`/listing/${encodeURIComponent(item.id)}`} className="flex h-full flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-2 text-sm font-black leading-snug text-slate-950">
              {comboTitle}
            </h2>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0759e6]">
              2 items
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">{comboSubtitle}</p>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-black text-slate-950 sm:text-xl">
              {formatPriceInr(item.offerPrice || item.price)}
            </span>
            {hasOffer ? (
              <span className="text-xs font-semibold text-slate-400 line-through">
                {formatPriceInr(item.price)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {purchaseLimitLabel ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#0759e6]">
                {purchaseLimitLabel}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {isLive ? 'Live now' : item.dealStatus || 'Deal status'}
            </span>
          </div>

          <div className="mt-auto pt-3">
            {isLive ? (
              <>
                <div className="grid grid-cols-4 gap-1.5 sm:hidden">
                  {countdownPartsFromMs(
                    item.dealEndAt ? new Date(item.dealEndAt).getTime() : undefined,
                    nowMs
                  ).map((part) => (
                    <div
                      key={part.label}
                      className="grid h-[38px] place-items-center rounded-xl bg-slate-50 text-center text-[#dc1633] ring-1 ring-slate-100"
                    >
                      <span className="block text-[12px] font-black leading-none">{part.value}</span>
                      <span className="mt-0.5 block text-[7px] font-semibold uppercase leading-none tracking-[0.08em] text-slate-500">
                        {part.label}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  to={`/listing/${encodeURIComponent(item.id)}`}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#0759e6] px-3 text-sm font-black text-white transition hover:bg-[#0448bd]"
                >
                  {ctaLabel}
                </Link>
              </>
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="inline-flex items-center gap-1 text-sm font-black text-rose-500">
                  <Timer size={15} /> {item.dealStatus || 'Deal unavailable'}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  View the listing for the full combo details.
                </p>
              </div>
            )}
          </div>
        </Link>
      </div>
    </article>
  );
}
