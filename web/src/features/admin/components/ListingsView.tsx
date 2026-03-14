import { useState } from 'react';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import type { Listing } from '@/features/admin/types/admin-types';
import { useListings, useDeleteListing } from '@/features/admin/hooks';

interface ListingsViewProps {
  onEditListing?: (listing: Listing) => void;
  onCreateListing?: () => void;
}

export default function ListingsView({ onEditListing, onCreateListing }: ListingsViewProps) {
  const { data: listingsData, isLoading } = useListings();
  const deleteListing = useDeleteListing();

  const [searchTerm, setSearchTerm] = useState('');

  // Handle both new API response structure (data array) and old structure (listings object)
  const listings: Listing[] = Array.isArray(listingsData?.data)
    ? (listingsData.data as Listing[])
    : Array.isArray(listingsData?.listings)
      ? (listingsData.listings as Listing[])
      : [];

  const filteredListings = listings.filter((listing: Listing) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      listing.title.toLowerCase().includes(query) ||
      String(listing.price).toLowerCase().includes(query) ||
      String(listing.offerPrice ?? '')
        .toLowerCase()
        .includes(query) ||
      listing.status.toLowerCase().includes(query) ||
      String(listing.category || '')
        .toLowerCase()
        .includes(query) ||
      String(listing.location || '')
        .toLowerCase()
        .includes(query) ||
      String(listing.contactPhone || '')
        .toLowerCase()
        .includes(query) ||
      String(listing.userId || '')
        .toLowerCase()
        .includes(query)
    );
  });

  const handleDelete = async (listingId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      await deleteListing.mutateAsync(listingId);
    } catch (error) {
      console.error('Failed to delete listing:', error);
      alert('Failed to delete listing');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Listings Management</h1>
        <p className="text-slate-300">View and manage all listings</p>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by title, category, user ID, location, status, price..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={onCreateListing}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:scale-105 transition cursor-pointer sm:w-auto"
          >
            <Plus size={20} /> New Listing
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading listings...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {filteredListings.length === 0 && searchTerm ? (
                <div className="text-center py-12">
                  <Search size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-600 font-medium">
                    No listings found matching "{searchTerm}"
                  </p>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-teal-600 hover:text-teal-700 font-semibold mt-2 cursor-pointer"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                    Showing {filteredListings.length} of {listings.length} listings
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px]">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Title
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            User ID
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Posted
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredListings.map((listing: Listing) => (
                          <tr
                            key={listing.id}
                            className="border-b border-slate-200 hover:bg-slate-50 transition"
                          >
                            <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{listing.title}</span>
                                {listing.sponsored && (
                                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">
                                    Sponsored
                                  </span>
                                )}
                                {listing.featured && (
                                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">
                                    Featured
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {listing.category || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex flex-col gap-1">
                                {listing.offerPrice && Number(listing.offerPrice) > 0 ? (
                                  <>
                                    <span className="line-through text-slate-500">
                                      ₹{listing.price}
                                    </span>
                                    <span className="text-red-600 font-bold">
                                      ₹{listing.offerPrice}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-600">₹{listing.price}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {listing.location || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {listing.userId || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {listing.contactPhone || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  listing.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : listing.status === 'sold'
                                      ? 'bg-slate-100 text-slate-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {listing.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{listing.date}</td>
                            <td className="px-6 py-4 text-sm flex gap-2">
                              <button
                                onClick={() => onEditListing && onEditListing(listing)}
                                className="p-2 hover:bg-teal-100 rounded transition cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 size={16} className="text-slate-600" />
                              </button>
                              <button
                                onClick={() => handleDelete(listing.id)}
                                disabled={deleteListing.isPending}
                                className="p-2 hover:bg-red-100 rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete"
                              >
                                <Trash2 size={16} className="text-red-600" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
