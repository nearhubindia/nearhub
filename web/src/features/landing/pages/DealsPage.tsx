import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, Sparkles, Timer } from "lucide-react";
import { LandingFooter, LandingHeader } from "@/shared/components";
import { getApiUrl } from "@/lib/config";
import { formatDealStatus, getEffectiveDealWindow } from "@/lib/deal-timer";

type DealListing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  price?: string | number;
  offerPrice?: string | number;
  images?: string[];
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
  isDeal?: boolean;
  is_deal?: boolean;
  dealType?: string;
  deal_type?: string;
  dealStartAt?: string;
  deal_start_at?: string;
  dealEndAt?: string;
  deal_end_at?: string;
  dealRecurrence?: string;
  deal_recurrence?: string;
  dealRecurrenceUntil?: string;
  deal_recurrence_until?: string;
  comboItems?: string[] | string;
  distanceKm?: number | string;
  distance_km?: number | string;
};

type ListingsResponse = {
  success?: boolean;
  data?: DealListing[];
  results?: DealListing[];
};

const SAVED_IDS_KEY = "nearhub_web_saved_listing_ids";
const FALLBACK_IMAGE = "/nearhub.png";

function readSavedIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_IDS_KEY) || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function normalizeImageUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return FALLBACK_IMAGE;
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("/")
  )
    return raw;
  return FALLBACK_IMAGE;
}

function parsePrice(value: string | number | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(value: string | number | undefined): string {
  const amount = parsePrice(value);
  if (!amount) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDistance(value: number | string | undefined): string {
  const distance = typeof value === "string" ? Number(value) : value;
  if (Number.isFinite(distance) && Number(distance) >= 0) {
    const rounded =
      Number(distance) < 10
        ? Number(distance).toFixed(1)
        : Math.round(Number(distance)).toString();
    return `${rounded.replace(/\.0$/, "")} km away`;
  }
  return "1 km away";
}

function formatTimeLeft(item: DealListing, nowMs: number): string {
  const end = getEffectiveDealWindow(item, nowMs)?.endMs || 0;
  const diff = end - nowMs;
  if (!Number.isFinite(end) || diff <= 0) return "Closed";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return days > 0
    ? `${pad(days)}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`
    : `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
}

function getComboSubtitle(item: DealListing): string {
  const raw = item.comboItems;
  if (Array.isArray(raw)) return raw.slice(0, 2).join(" + ");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 2).join(" + ");
    } catch {
      return raw
        .split(/\r?\n|,/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" + ");
    }
  }
  return item.description || item.category || "Combo offer";
}

function getDealTypeLabel(item: DealListing): string {
  return String(item.dealType || item.deal_type || "").toLowerCase() === "combo"
    ? "Combo Deal"
    : "Deal";
}

function isExpiredDeal(item: DealListing, nowMs: number): boolean {
  return formatDealStatus(item, nowMs) === 'Deal expired';
}

function isUpcomingDeal(item: DealListing, nowMs: number): boolean {
  const status = formatDealStatus(item, nowMs);
  return status.startsWith('Deal starts') || status.startsWith('Next deal');
}

function DealCard({
  item,
  saved,
  onToggleSaved,
  nowMs,
  combo = false,
}: {
  item: DealListing;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  nowMs: number;
  combo?: boolean;
}): ReactElement {
  const price = parsePrice(item.price);
  const offer = parsePrice(item.offerPrice);
  const hasOffer = offer > 0 && price > 0 && offer < price;
  const displayPrice = hasOffer ? item.offerPrice : item.price;
  const image = normalizeImageUrl(item.images?.[0]);
  const comboImages = [
    normalizeImageUrl(item.images?.[0]),
    normalizeImageUrl(item.images?.[1] || item.images?.[0]),
  ];
  const dealStatus = formatDealStatus(item, nowMs);
  const distance = formatDistance(item.distanceKm ?? item.distance_km);

  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/listing/${item.id}`} className="block">
        <div className={`relative bg-slate-50 ${combo ? "h-44 overflow-hidden bg-white sm:h-40 xl:h-36" : "aspect-[1.22]"}`}>
          {combo ? (
            <>
              <div className="grid h-full grid-cols-2 gap-px bg-slate-200">
                {comboImages.map((comboImage, index) => (
                  <div
                    key={`${item.id}-combo-image-${index}`}
                    className="flex min-w-0 items-center justify-center overflow-hidden bg-white"
                  >
                    <img
                      src={comboImage}
                      alt={`${item.title} item ${index + 1}`}
                      className="block h-full w-full object-contain"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                  </div>
                ))}
              </div>
              <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-red-600 text-2xl font-black leading-none text-white shadow-lg">
                +
              </span>
            </>
          ) : (
            <img
              src={image}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
          )}
          <span className="absolute left-3 top-3 rounded-full bg-[#181c33] px-2.5 py-1 text-xs font-bold text-white">
            {getDealTypeLabel(item)}
          </span>
        </div>
      </Link>
      <div className="relative p-3">
        <button
          type="button"
          onClick={() => onToggleSaved(item.id)}
          className="absolute -top-[calc(100%+0.25rem)] right-3 rounded-full bg-white/90 p-1.5 text-slate-800 shadow-sm"
          aria-label={saved ? "Remove from favourites" : "Save deal"}
        >
          <Heart
            size={20}
            className={saved ? "fill-rose-500 text-rose-500" : ""}
          />
        </button>
        <Link to={`/listing/${item.id}`} className="block">
          <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-snug text-slate-950">
            {item.title}
          </h2>
          {combo ? (
            <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-snug text-slate-500 sm:text-sm">
              {getComboSubtitle(item)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-black text-slate-950 sm:text-base">
              {formatPrice(displayPrice)}
            </span>
            {hasOffer ? (
              <span className="text-xs font-semibold text-slate-400 line-through sm:text-sm">
                {formatPrice(item.price)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-800 sm:text-sm">
            {distance}
          </p>
          {dealStatus.startsWith('Ends in') ? (
            <div className="mt-3 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#0759e6]">
                Deals Ends in
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {formatTimeLeft(item, nowMs)
                  .split(' : ')
                  .map((value, index) => (
                    <span
                      key={index}
                      className="min-w-[42px] rounded-2xl bg-white px-2 py-2 text-center text-sm font-black text-[#dc1633] shadow-sm ring-1 ring-[#f8d9dd]"
                    >
                      {value}
                    </span>
                  ))}
              </div>
              <Link
                to={`/listing/${item.id}`}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#0759e6] px-3 text-xs font-black text-white transition hover:bg-[#0448bd]"
              >
                Book Deal
              </Link>
            </div>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-rose-500 sm:text-sm">
              <Timer size={15} /> {dealStatus || 'Deal unavailable'}
            </p>
          )}
        </Link>
      </div>
    </article>
  );
}

export default function DealsPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [savedIds, setSavedIds] = useState<Set<string>>(() => readSavedIds());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const dealsQuery = useQuery({
    queryKey: ["deals-page-listings"],
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/listings?limit=200&dealsOnly=1&dealsPage=1&includeExpiredDeals=1`,
      );
      const payload = (await response.json()) as ListingsResponse;
      if (!response.ok || payload.success === false)
        throw new Error("Failed to load deals");
      return (payload.data || payload.results || []).filter((item) => {
        const status = String(item.status || "active").toLowerCase();
        const active = item.isActive ?? item.is_active ?? true;
        const visibleStatus = status === "active" || status === "expired";
        return Boolean(item.isDeal ?? item.is_deal) && visibleStatus && (Boolean(active) || status === "expired");
      });
    },
  });

  const toggleSaved = (id: string) => {
    const next = new Set(savedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSavedIds(next);
    localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next]));
  };

  const filteredDeals = useMemo(() => {
    const search = query.trim().toLowerCase();
    const deals = dealsQuery.data || [];
    if (!search) return deals;
    return deals.filter((item) =>
      [item.title, item.description, item.category, item.location]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(search),
    );
  }, [dealsQuery.data, query]);

  const activeDeals = filteredDeals.filter(
    (item) => !isExpiredDeal(item, nowMs) && !isUpcomingDeal(item, nowMs),
  );
  const upcomingDeals = filteredDeals.filter((item) => isUpcomingDeal(item, nowMs));
  const expiredDeals = filteredDeals.filter((item) => isExpiredDeal(item, nowMs));

  const allDeals = activeDeals.filter(
    (item) =>
      String(item.dealType || item.deal_type || "").toLowerCase() !== "combo",
  );
  const comboDeals = activeDeals.filter(
    (item) =>
      String(item.dealType || item.deal_type || "").toLowerCase() === "combo",
  );

  return (
    <div className="min-h-screen bg-[#f7faff] text-slate-950">
      <LandingHeader active="deals" />
      <main className="w-full px-3 pb-16 pt-28 sm:px-4 lg:px-5">
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          {/* Search is provided in the header */}
        </section>

        <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Deals</h1>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Great offers on top products
            </p>
          </div>
          <Link
            to="/create-listing?mode=deal"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0877ee] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#075fc1]"
          >
            <Sparkles size={18} /> Add your Customized deals
          </Link>
        </section>

        {dealsQuery.isLoading ? (
          <p className="mt-8 text-sm font-semibold text-slate-500">
            Loading deals...
          </p>
        ) : null}
        {dealsQuery.isError ? (
          <p className="mt-8 text-sm font-semibold text-rose-600">
            Could not load deals right now.
          </p>
        ) : null}

        <section className="mt-7">
          <h2 className="text-2xl font-black">All Deals</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allDeals.map((item) => (
              <DealCard
                key={item.id}
                item={item}
                saved={savedIds.has(item.id)}
                onToggleSaved={toggleSaved}
                nowMs={nowMs}
              />
            ))}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-2xl font-black">Combo Deals</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {comboDeals.map((item) => (
              <DealCard
                key={item.id}
                item={item}
                saved={savedIds.has(item.id)}
                onToggleSaved={toggleSaved}
                nowMs={nowMs}
                combo
              />
            ))}
          </div>
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Upcoming Deals</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Deals scheduled to open soon.
              </p>
            </div>
            {upcomingDeals.length ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-[#0759e6]">
                {upcomingDeals.length} upcoming
              </span>
            ) : null}
          </div>
          {upcomingDeals.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcomingDeals.map((item) => (
                <DealCard
                  key={`upcoming-${item.id}`}
                  item={item}
                  saved={savedIds.has(item.id)}
                  onToggleSaved={toggleSaved}
                  nowMs={nowMs}
                  combo={String(item.dealType || item.deal_type || "").toLowerCase() === "combo"}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              No upcoming deals yet.
            </div>
          )}
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Expired Deals</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Deals whose booking window has already closed.
              </p>
            </div>
            {expiredDeals.length ? (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-700">
                {expiredDeals.length} closed
              </span>
            ) : null}
          </div>
          {expiredDeals.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {expiredDeals.map((item) => (
                <DealCard
                  key={`expired-${item.id}`}
                  item={item}
                  saved={savedIds.has(item.id)}
                  onToggleSaved={toggleSaved}
                  nowMs={nowMs}
                  combo={String(item.dealType || item.deal_type || "").toLowerCase() === "combo"}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              No expired deals yet.
            </div>
          )}
        </section>

        {!dealsQuery.isLoading && filteredDeals.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
            No deals found. Add a deal listing or try another search.
          </div>
        ) : null}
      </main>

      <LandingFooter />
    </div>
  );
}
