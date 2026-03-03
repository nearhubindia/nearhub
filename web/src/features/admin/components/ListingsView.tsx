import { useState } from 'react';
import { Search, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import type { Listing } from '@/features/admin/types/admin-types';
import { useListings, useDeleteListing } from '@/features/admin/hooks';

interface ListingsViewProps {
  onEditListing?: (listing: Listing) => void;
  onCreateListing?: () => void;
}

interface ListingFolder {
  id: number;
  name: string;
  icon: string;
  category: string;
  listings: Listing[];
  listingsCount: number;
}

export default function ListingsView({ onEditListing, onCreateListing }: ListingsViewProps) {
  const { data: listingsData, isLoading } = useListings();
  const deleteListing = useDeleteListing();

  const [expandedFolder, setExpandedFolder] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Handle both new API response structure (data array) and old structure (listings object)
  const listings: Listing[] = Array.isArray(listingsData?.data)
    ? (listingsData.data as Listing[])
    : Array.isArray(listingsData?.listings)
      ? (listingsData.listings as Listing[])
      : [];

  // Group listings by category as pseudo-folders
  const folderStructure: ListingFolder[] = [
    { id: 1, name: 'Electronics', icon: '📱', category: 'Electronics' },
    { id: 2, name: 'Vehicles', icon: '🚗', category: 'Vehicles' },
    { id: 3, name: 'Real Estate', icon: '🏠', category: 'Real Estate' },
    { id: 4, name: 'Services', icon: '🛠️', category: 'Services' },
    { id: 5, name: 'Jobs', icon: '💼', category: 'Jobs' },
  ].map((folder) => ({
    ...folder,
    listings: listings.filter((listing: Listing) => listing.category === folder.category),
    listingsCount: listings.filter((listing: Listing) => listing.category === folder.category)
      .length,
  }));

  // Filter folders and listings based on search term
  const filteredFolders = folderStructure
    .map((folder) => ({
      ...folder,
      listings: folder.listings.filter(
        (listing: Listing) =>
          listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.price.toString().includes(searchTerm) ||
          listing.status.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((folder) => folder.listings.length > 0 || searchTerm === '');

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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Listings Management</h1>
        <p className="text-slate-300">Organize and manage listings by category</p>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={onCreateListing}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:shadow-lg hover:scale-105 transition cursor-pointer"
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
              {filteredFolders.length === 0 && searchTerm ? (
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
                filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition"
                  >
                    <button
                      onClick={() =>
                        setExpandedFolder(expandedFolder === folder.id ? null : folder.id)
                      }
                      className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition"
                    >
                      <div className="text-3xl">{folder.icon}</div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-bold text-slate-900">{folder.name}</h3>
                        <p className="text-sm text-slate-600">
                          {folder.listingsCount.toLocaleString()} listings
                        </p>
                      </div>
                      <ChevronRight
                        size={20}
                        className={`text-slate-400 transition transform ${expandedFolder === folder.id ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {expandedFolder === folder.id && (
                      <div className="border-t border-slate-200 bg-slate-50">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200">
                              <tr>
                                <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                                  Title
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                                  Price
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                                  Location
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-bold text-slate-900">
                                  Posted By
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
                              {folder.listings.map((listing: Listing) => (
                                <tr
                                  key={listing.id}
                                  className="border-b border-slate-200 hover:bg-white transition"
                                >
                                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                                    {listing.title}
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
                                    {listing.sellerId || 'N/A'}
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
                                  <td className="px-6 py-4 text-sm text-slate-600">
                                    {listing.date}
                                  </td>
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
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
