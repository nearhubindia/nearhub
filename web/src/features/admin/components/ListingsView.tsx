import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import type { Listing } from '@/features/admin/types/admin-types';
import { useListings, useDeleteListing } from '@/features/admin/hooks';
import AdminActionMenu from './AdminActionMenu';

interface ListingsViewProps {
  onEditListing?: (listing: Listing) => void;
  onCreateListing?: () => void;
}

export default function ListingsView({ onEditListing, onCreateListing }: ListingsViewProps) {
  const { data: listingsData, isLoading } = useListings();
  const deleteListing = useDeleteListing();
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');

  const handleSearch = (): void => {
    setAppliedSearchTerm(searchTerm.trim());
  };

  const handleClearSearch = (): void => {
    setSearchTerm('');
    setAppliedSearchTerm('');
  };

  const listings: Listing[] = Array.isArray(listingsData?.data)
    ? (listingsData.data as Listing[])
    : Array.isArray(listingsData?.listings)
      ? (listingsData.listings as Listing[])
      : [];

  const handleDelete = async (listingId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      await deleteListing.mutateAsync(listingId);
    } catch (error) {
      console.error('Failed to delete listing:', error);
      alert('Failed to delete listing');
    }
  };

  const formatPostedDate = (listing: Listing): string => {
    const raw = listing.createdAt || listing.date;
    if (!raw) return '-';

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return String(raw);

    return parsed.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns: ColumnDef<Listing>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      enableColumnFilter: true,
      meta: {
        filterPlaceholder: 'Filter title...',
        cellClassName: 'font-medium text-slate-900',
      },
      cell: ({ row }) => {
        const listing = row.original;
        return (
          <div className="flex items-center gap-2">
            <span>{listing.title}</span>
            {listing.featured && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                Featured
              </span>
            )}
            {listing.isDeal && (
              <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-800">
                Deal
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      enableColumnFilter: true,
      meta: {
        filterPlaceholder: 'Filter category...',
      },
      cell: ({ row }) => row.original.category || '-',
    },
    {
      id: 'price',
      header: 'Price',
      enableColumnFilter: true,
      accessorFn: (listing) => `${listing.price ?? ''} ${listing.offerPrice ?? ''}`,
      meta: {
        filterPlaceholder: 'Filter price...',
      },
      cell: ({ row }) => {
        const listing = row.original;
        return (
          <div className="flex flex-col gap-1">
            {listing.offerPrice && Number(listing.offerPrice) > 0 ? (
              <>
                <span className="text-slate-500 line-through">₹{listing.price}</span>
                <span className="font-bold text-red-600">₹{listing.offerPrice}</span>
              </>
            ) : (
              <span className="text-slate-600">₹{listing.price}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'location',
      header: 'Location',
      enableColumnFilter: true,
      meta: {
        filterPlaceholder: 'Filter location...',
      },
      cell: ({ row }) => row.original.location || 'N/A',
    },
    {
      id: 'displayName',
      header: 'Display Name',
      enableColumnFilter: true,
      accessorFn: (listing) => `${listing.displayName ?? ''} ${listing.userId ?? ''}`,
      meta: {
        filterPlaceholder: 'Filter user...',
      },
      cell: ({ row }) => {
        const listing = row.original;
        return (
          <div className="flex flex-col">
            <span>{listing.displayName || '-'}</span>
            <span className="text-xs text-slate-400">ID: {listing.userId || 'N/A'}</span>
          </div>
        );
      },
    },
    {
      id: 'mobileNumber',
      header: 'Mobile Number',
      enableColumnFilter: true,
      accessorFn: (listing) => `${listing.mobileNumber ?? ''} ${listing.contactPhone ?? ''}`,
      meta: {
        filterPlaceholder: 'Filter mobile...',
      },
      cell: ({ row }) => row.original.mobileNumber || row.original.contactPhone || '-',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableColumnFilter: true,
      meta: {
        filterPlaceholder: 'Filter status...',
      },
      cell: ({ row }) => {
        const listing = row.original;
        return (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              listing.status === 'active'
                ? 'bg-green-100 text-green-700'
                : listing.status === 'sold'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {listing.status}
          </span>
        );
      },
    },
    {
      id: 'posted',
      header: 'Posted',
      enableColumnFilter: true,
      accessorFn: (listing) => formatPostedDate(listing),
      meta: {
        filterPlaceholder: 'Filter date...',
      },
      cell: ({ row }) => formatPostedDate(row.original),
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
          label="Listing actions"
          items={[
            {
              label: 'Edit',
              icon: <Edit2 size={15} />,
              onSelect: () => onEditListing?.(row.original),
            },
            {
              label: 'Delete',
              icon: <Trash2 size={15} />,
              tone: 'danger',
              onSelect: () => void handleDelete(row.original.id),
              disabled: deleteListing.isPending,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white sm:p-6">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Listings Management</h1>
        <p className="text-slate-300">View and manage all listings</p>
      </div>

      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-teal-500" />
              <p className="text-slate-600">Loading listings...</p>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={listings}
            showSearch={false}
            searchValue={appliedSearchTerm}
            searchPlaceholder="Search by title, category, user ID, location, status, price..."
            toolbarLeft={
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[360px] md:w-[420px] lg:w-[500px]">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    aria-label="Search listings"
                    placeholder="Search by title, category, user ID, location..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white transition hover:bg-teal-700"
                >
                  <Search size={16} />
                  Search
                </button>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-300 sm:w-auto"
                >
                  Clear
                </button>
              </div>
            }
            toolbarRight={
              onCreateListing ? (
                <button
                  onClick={onCreateListing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 text-sm font-bold text-white transition hover:brightness-105 hover:shadow-lg"
                  type="button"
                >
                  <Plus size={18} />
                  New Listing
                </button>
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
}
