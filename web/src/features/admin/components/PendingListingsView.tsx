import { useState } from 'react';
import { CheckCircle2, Eye, Search, X, XCircle } from 'lucide-react';
import type { Listing } from '@/features/admin/types/admin-types';
import { useListingById, useListings, useReviewListing } from '@/features/admin/hooks';
import { getApiUrl } from '@/lib/config';

export default function PendingListingsView() {
  const apiBaseUrl = getApiUrl();
  const { data: listingsData, isLoading } = useListings({ status: 'pending', limit: 500 });
  const reviewListing = useReviewListing();
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsListingId, setDetailsListingId] = useState<string | null>(null);
  const { data: listingDetailsData, isLoading: isDetailsLoading } = useListingById(detailsListingId || '');

  const listings: Listing[] = Array.isArray(listingsData?.data)
    ? (listingsData.data as Listing[])
    : Array.isArray(listingsData?.listings)
      ? (listingsData.listings as Listing[])
      : [];
  const detailsListing = ((listingDetailsData as any)?.data || null) as Listing | null;
  const selectedListing = listings.find((listing) => listing.id === detailsListingId) || null;
  const detailsPhone = detailsListing?.contactPhone || selectedListing?.contactPhone || '-';
  const normalizeMediaUrl = (url: unknown): string => {
    if (typeof url !== 'string') return '';
    const value = url.trim();
    if (!value) return '';

    if (value.startsWith('/')) {
      return `${apiBaseUrl}${value}`;
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const parsed = new URL(value);
        if (
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === '0.0.0.0'
        ) {
          const apiBase = new URL(apiBaseUrl);
          parsed.protocol = apiBase.protocol;
          parsed.host = apiBase.host;
          return parsed.toString();
        }
      } catch {
        return value;
      }
    }

    return value;
  };
  const detailImages = (Array.isArray(detailsListing?.images) ? detailsListing.images : [])
    .map(normalizeMediaUrl)
    .filter(Boolean);
  const detailVideos = (Array.isArray(detailsListing?.videos) ? detailsListing.videos : [])
    .map(normalizeMediaUrl)
    .filter(Boolean);
  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const filteredListings = listings.filter((listing) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      listing.title.toLowerCase().includes(query) ||
      String(listing.category || '').toLowerCase().includes(query) ||
      String(listing.location || '').toLowerCase().includes(query) ||
      String(listing.userId || '').toLowerCase().includes(query) ||
      String(listing.contactPhone || '').toLowerCase().includes(query)
    );
  });

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    try {
      let reason: string | undefined;
      if (action === 'reject') {
        const value = window.prompt('Enter rejection reason (required):', '');
        if (value === null) return;
        const trimmed = value.trim();
        if (!trimmed) {
          alert('Rejection reason is required.');
          return;
        }
        reason = trimmed;
      }

      await reviewListing.mutateAsync({ id, action, reason });
    } catch (error) {
      console.error('Failed to review listing:', error);
      alert(`Failed to ${action} listing`);
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-amber-700 to-orange-700 text-white p-6 border-b border-amber-800">
        <h1 className="text-4xl font-black mb-2">Approval Pending</h1>
        <p className="text-amber-100">Review and approve/reject new listings</p>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by title, category, user ID, location, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold">
            {filteredListings.length} pending
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading pending listings...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
              Showing {filteredListings.length} pending listings
            </div>

            {filteredListings.length === 0 ? (
              <div className="py-12 text-center text-slate-600">No pending listings found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Title</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Price</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                        User ID
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((listing) => (
                      <tr
                        key={listing.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition"
                      >
                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                          {listing.title}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{listing.category || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">₹{listing.price}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{listing.location || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {listing.userId || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {listing.contactPhone || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDetailsListingId(listing.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Eye size={14} />
                              View Details
                            </button>
                            <button
                              onClick={() => handleReview(listing.id, 'approve')}
                              disabled={reviewListing.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <CheckCircle2 size={14} />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReview(listing.id, 'reject')}
                              disabled={reviewListing.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {detailsListingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Listing Details</h2>
                <p className="text-sm text-slate-600">Compact review with complete listing information</p>
              </div>
              <button
                onClick={() => setDetailsListingId(null)}
                className="rounded p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {isDetailsLoading ? (
              <div className="p-8 text-center text-slate-600">Loading listing details...</div>
            ) : !detailsListing ? (
              <div className="p-8 text-center text-red-600">Failed to load listing details.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900">{detailsListing.title}</h3>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        {String(detailsListing.status || 'pending').toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <p className="text-slate-500">Listing ID</p>
                      <p className="font-medium text-slate-900 break-all">{detailsListing.id}</p>
                      <p className="text-slate-500">User ID</p>
                      <p className="font-medium text-slate-900 break-all">{detailsListing.userId || '-'}</p>
                      <p className="text-slate-500">Phone</p>
                      <p className="font-medium text-slate-900">{detailsPhone}</p>
                      <p className="text-slate-500">Category</p>
                      <p className="font-medium text-slate-900">{detailsListing.category || '-'}</p>
                      <p className="text-slate-500">Condition</p>
                      <p className="font-medium text-slate-900">{detailsListing.condition || '-'}</p>
                      <p className="text-slate-500">Location</p>
                      <p className="font-medium text-slate-900">{detailsListing.location || '-'}</p>
                      <p className="text-slate-500">Price</p>
                      <p className="font-semibold text-slate-900">₹{detailsListing.price}</p>
                      <p className="text-slate-500">Offer Price</p>
                      <p className="font-medium text-slate-900">
                        {detailsListing.offerPrice ? `₹${detailsListing.offerPrice}` : '-'}
                      </p>
                      <p className="text-slate-500">Created</p>
                      <p className="font-medium text-slate-900">{formatDateTime(detailsListing.createdAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Description
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {detailsListing.description || '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 lg:col-span-7">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Images ({detailImages.length})
                    </p>
                    {detailImages.length === 0 ? (
                      <p className="text-sm text-slate-500">No images uploaded.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                        {detailImages.map((src, idx) => (
                          <img
                            key={`${src}-${idx}`}
                            src={src}
                            alt={`Listing image ${idx + 1}`}
                            className="h-32 w-full rounded-md border border-slate-200 object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Videos ({detailVideos.length})
                    </p>
                    {detailVideos.length === 0 ? (
                      <p className="text-sm text-slate-500">No videos uploaded.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {detailVideos.map((src, idx) => (
                          <video
                            key={`${src}-${idx}`}
                            controls
                            playsInline
                            preload="metadata"
                            src={src}
                            className="h-40 w-full rounded-md border border-slate-200 bg-black object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
