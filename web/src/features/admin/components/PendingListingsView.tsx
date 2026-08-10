import { useState } from 'react';
import { CheckCircle2, Eye, Search, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import type { Listing } from '@/features/admin/types/admin-types';
import { useListingById, useListings, useReviewListing } from '@/features/admin/hooks';
import { getApiUrl } from '@/lib/config';
import AdminDrawer from '@/features/admin/components/AdminDrawer';
import AdminActionMenu from './AdminActionMenu';

export default function PendingListingsView() {
  const apiBaseUrl = getApiUrl();
  const { data: listingsData, isLoading } = useListings({ status: 'pending', limit: 500 });
  const reviewListing = useReviewListing();
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'ai-flagged'>('all');
  const [detailsListingId, setDetailsListingId] = useState<string | null>(null);
  const { data: listingDetailsData, isLoading: isDetailsLoading } = useListingById(
    detailsListingId || ''
  );

  const listings: Listing[] = Array.isArray(listingsData?.data)
    ? (listingsData.data as Listing[])
    : Array.isArray(listingsData?.listings)
      ? (listingsData.listings as Listing[])
      : [];
  const detailsListingResponse = listingDetailsData as { data?: Listing } | undefined;
  const detailsListing = detailsListingResponse?.data ?? null;
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
    const matchesSearch =
      !query ||
      listing.title.toLowerCase().includes(query) ||
      String(listing.category || '')
        .toLowerCase()
        .includes(query) ||
      String(listing.location || '')
        .toLowerCase()
        .includes(query) ||
      String(listing.userId || '')
        .toLowerCase()
        .includes(query) ||
      String(listing.contactPhone || '')
        .toLowerCase()
        .includes(query);
    if (!matchesSearch) return false;
    if (reviewFilter === 'all') return true;
    return isLikelyAiFlagged(listing);
  });

  const aiFlaggedCount = listings.filter((listing) => isLikelyAiFlagged(listing)).length;

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

  const columns: ColumnDef<Listing>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter title...' },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter category...' },
    },
    {
      id: 'price',
      header: 'Price',
      accessorFn: (listing) => String(listing.price ?? ''),
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter price...' },
      cell: ({ row }) => `₹${row.original.price}`,
    },
    {
      accessorKey: 'location',
      header: 'Location',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter location...' },
      cell: ({ row }) => row.original.location || '-',
    },
    {
      accessorKey: 'userId',
      header: 'User ID',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter user...' },
      cell: ({ row }) => row.original.userId || '-',
    },
    {
      id: 'contactPhone',
      header: 'Phone',
      enableColumnFilter: true,
      accessorFn: (listing) => listing.contactPhone || '',
      meta: { filterPlaceholder: 'Filter phone...' },
      cell: ({ row }) => row.original.contactPhone || '-',
    },
    {
      id: 'risk',
      header: 'Risk',
      enableSorting: false,
      enableColumnFilter: false,
      accessorFn: (listing) => (isLikelyAiFlagged(listing) ? 'AI-flagged' : 'Normal'),
      cell: ({ row }) =>
        isLikelyAiFlagged(row.original) ? (
          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
            AI-flagged
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            Normal
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
        <AdminActionMenu
          label="Pending listing actions"
          items={[
            {
              label: 'View Details',
              icon: <Eye size={15} />,
              onSelect: () => setDetailsListingId(row.original.id),
            },
            {
              label: 'Approve',
              icon: <CheckCircle2 size={15} />,
              onSelect: () => void handleReview(row.original.id, 'approve'),
              disabled: reviewListing.isPending,
            },
            {
              label: 'Reject',
              icon: <XCircle size={15} />,
              tone: 'danger',
              onSelect: () => void handleReview(row.original.id, 'reject'),
              disabled: reviewListing.isPending,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="admin-page-header border-b border-amber-800 bg-gradient-to-r from-amber-700 to-orange-700 px-4 py-3 text-white sm:px-6 sm:py-3">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Approval Pending</h1>
        <p className="text-amber-100">Review and approve/reject new listings</p>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by title, category, user ID, location, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setReviewFilter('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                reviewFilter === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Pending
            </button>
            <button
              type="button"
              onClick={() => setReviewFilter('ai-flagged')}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                reviewFilter === 'ai-flagged'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              AI-Flagged
            </button>
          </div>
          <div className="shrink-0 rounded-lg bg-amber-100 px-4 py-2 font-bold text-amber-800">
            {filteredListings.length} pending
          </div>
          <div className="shrink-0 rounded-lg bg-red-100 px-4 py-2 font-bold text-red-700">
            {aiFlaggedCount} AI-flagged
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-amber-500" />
              <p className="text-slate-600">Loading pending listings...</p>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredListings}
            showSearch={false}
            searchPlaceholder="Search pending listings..."
          />
        )}
      </div>

      {detailsListingId && (
        <AdminDrawer
          onClose={() => setDetailsListingId(null)}
          ariaLabel="Listing details"
          panelClassName="sm:w-[min(94vw,72rem)] lg:w-[min(82vw,80rem)]"
          bodyClassName="p-5 sm:p-7"
          header={
            <div className="border-b border-slate-200 bg-white px-5 py-4 pr-16 sm:px-6 sm:py-5 sm:pr-20">
              <div>
                <h2 className="text-xl font-black text-slate-900">Listing Details</h2>
                <p className="text-sm text-slate-500">Review the listing before approving it</p>
              </div>
            </div>
          }
        >
          <div>
            {isDetailsLoading ? (
              <div className="py-16 text-center text-slate-500">Loading details...</div>
            ) : detailsListing ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Title</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{detailsListing.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Price</p>
                      <p className="mt-1 font-semibold text-slate-900">₹{detailsListing.price}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Category</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {detailsListing.category || '-'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Location</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {detailsListing.location || '-'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Phone</p>
                      <p className="mt-1 font-semibold text-slate-900">{detailsPhone}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Description</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {detailsListing.description || 'No description available.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">Images</p>
                    {detailImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {detailImages.map((image) => (
                          <img
                            key={image}
                            src={image}
                            alt={detailsListing.title}
                            className="h-40 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No images available.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">Videos</p>
                    {detailVideos.length > 0 ? (
                      <div className="space-y-3">
                        {detailVideos.map((video) => (
                          <video key={video} controls className="w-full rounded-lg">
                            <source src={video} />
                          </video>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No videos available.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">User ID</p>
                      <p className="mt-1 break-all font-semibold text-slate-900">
                        {detailsListing.userId || '-'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Posted</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatDateTime(detailsListing.createdAt || detailsListing.date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">Listing details not available.</div>
            )}
          </div>
        </AdminDrawer>
      )}
    </div>
  );
}

function isLikelyAiFlagged(listing: Listing): boolean {
  const title = String(listing.title || '').toLowerCase();
  const description = String(listing.description || '').toLowerCase();
  const category = String(listing.category || '').toLowerCase();
  const text = `${title} ${description} ${category}`;

  const riskyPatterns = [
    /\bnude\b/,
    /\bnudity\b/,
    /\bsex\b/,
    /\bxxx\b/,
    /\bcannabis\b/,
    /\bganja\b/,
    /\bweed\b/,
    /\bdrug\b/,
    /\bcocaine\b/,
    /\bheroin\b/,
    /\bgun\b/,
    /\bpistol\b/,
    /\brifle\b/,
    /\bfirearm\b/,
    /\bknife\b/,
    /\bdagger\b/,
    /\bsword\b/,
    /\bweapon\b/,
  ];

  const hasRiskyText = riskyPatterns.some((pattern) => pattern.test(text));
  const hasVideo = Array.isArray(listing.videos) && listing.videos.length > 0;
  return hasRiskyText || hasVideo;
}
