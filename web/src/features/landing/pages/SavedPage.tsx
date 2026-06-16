import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Heart, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser } from '@/lib/web-auth-storage';
import {
  SAVED_LISTING_IDS_KEY,
  formatPriceInr,
  readStoredStringSet,
  writeStoredStringSet,
} from '@/features/landing/lib';

type StoredUser = { id?: string; phone?: string };
type SavedListing = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  price?: string | number;
  images?: string[];
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
};

type ListingsResponse = { success?: boolean; data?: SavedListing[]; results?: SavedListing[] };

const FALLBACK_IMAGE = '/nearhub.png';

export default function SavedPage(): ReactElement {
  const storedUser = readStoredWebUser() as StoredUser | null;
  const userId = String(storedUser?.id || '').trim();
  const [savedIds, setSavedIds] = useState<Set<string>>(() =>
    readStoredStringSet(SAVED_LISTING_IDS_KEY)
  );

  const listingsQuery = useQuery({
    queryKey: ['saved-listings-source'],
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/listings?limit=200`);
      if (!response.ok) throw new Error('Failed to load listings');
      const payload = (await response.json()) as ListingsResponse;
      return (payload.data || payload.results || []).filter((item) => {
        const status = String(item.status || 'active').toLowerCase();
        const active = item.isActive ?? item.is_active ?? true;
        return Boolean(active) && status === 'active';
      });
    },
  });

  const savedListings = useMemo(() => {
    const map = new Map((listingsQuery.data || []).map((item) => [item.id, item]));
    return [...savedIds].map((id) => map.get(id)).filter(Boolean) as SavedListing[];
  }, [listingsQuery.data, savedIds]);

  const removeSaved = (id: string) => {
    const next = new Set(savedIds);
    next.delete(id);
    setSavedIds(next);
    writeStoredStringSet(SAVED_LISTING_IDS_KEY, next);
  };

  if (!userId) return <Navigate to="/auth/register" replace />;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="w-full px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#113965]">Favourites</h1>
            <Link to="/browse" className="text-sm font-semibold text-[#1e5da8] hover:underline">
              Back to Browse
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">{savedListings.length} saved item(s)</p>
        </section>

        <section className="mt-5">
          {listingsQuery.isLoading ? <p className="text-slate-600">Loading favourites...</p> : null}
          {listingsQuery.isError ? (
            <p className="text-red-600">Failed to load favourites.</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {savedListings.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[1.22] bg-slate-100">
                  {item.images?.[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <img
                      src={FALLBACK_IMAGE}
                      alt="NearHub"
                      className="h-full w-full object-contain p-5 opacity-80"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {item.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {item.description || 'No description available'}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} /> {item.location || 'Nearby'}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#0f4b8a]">{formatPriceInr(item.price)}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        to={`/listing/${item.id}`}
                        className="text-xs font-semibold text-[#ff7b00] hover:underline"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeSaved(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                      >
                        <Heart size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!listingsQuery.isLoading && savedListings.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
              No saved listings yet. Save from browse page to see them here.
            </div>
          ) : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
