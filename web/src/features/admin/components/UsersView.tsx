import { useEffect, useState } from 'react';
import { BadgeCheck, Edit2, MapPin, Search, Trash2, X } from 'lucide-react';
import { useDeleteUser, useUpdateUser, useUsers } from '@/features/admin/hooks';

interface UserRow {
  id: string;
  username: string;
  displayName?: string;
  mobile?: string;
  autoDetectedLocation?: string;
  location?: string;
  listingsCount?: number;
  listings?: number;
  listingLocations?: string[];
  isVerified?: boolean;
}

export default function UsersView() {
  const PAGE_SIZE = 100;
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  const {
    data: usersData,
    isLoading,
    isFetching,
    refetch,
  } = useUsers({
    limit: PAGE_SIZE,
    offset,
    search: debouncedSearchTerm || undefined,
  });
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    mobile: '',
    location: '',
    isVerified: false,
  });
  const [saveError, setSaveError] = useState('');
  const allUsers: UserRow[] = Array.isArray(usersData?.data) ? (usersData.data as UserRow[]) : [];
  const totalUsers = Number(usersData?.total || 0);
  const hasMore =
    typeof usersData?.hasMore === 'boolean'
      ? usersData.hasMore
      : offset + allUsers.length < totalUsers;
  const rangeStart = totalUsers === 0 ? 0 : offset + 1;
  const rangeEnd = totalUsers === 0 ? 0 : offset + allUsers.length;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleEditClick = (user: UserRow): void => {
    setSelectedUser(user);
    setFormData({
      username: user.username || '',
      mobile: user.mobile || user.username || '',
      location: user.autoDetectedLocation || user.location || '',
      isVerified: Boolean(user.isVerified),
    });
    setSaveError('');
    setEditModalOpen(true);
  };

  const handleDeleteClick = (user: UserRow): void => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleFormChange = (
    field: 'username' | 'mobile' | 'location' | 'isVerified',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'isVerified' ? value === 'true' : value,
    }));
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!formData.username.trim() || !formData.mobile.trim() || !formData.location.trim()) {
      setSaveError('Mobile and location are required.');
      return;
    }

    if (!selectedUser) {
      setSaveError('No user selected.');
      return;
    }

    try {
      await updateUser.mutateAsync({
        id: selectedUser.id,
        data: formData,
      });
      setEditModalOpen(false);
      setSelectedUser(null);
      refetch();
    } catch (error) {
      setSaveError('Failed to update user.');
      console.error('Failed to update user:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    try {
      await deleteUser.mutateAsync(selectedUser.id);
      setDeleteModalOpen(false);
      setSelectedUser(null);
      refetch();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedUser(null);
    setSaveError('');
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Users Management</h1>
        <p className="text-slate-300">
          Display name, auto-detected location, listing footprint, and trust controls.
        </p>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, mobile, or auto location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={() => setSearchTerm('')}
            className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-300 sm:w-auto"
          >
            Clear
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {isLoading ? (
            <div className="p-12 text-center text-slate-600">Loading users...</div>
          ) : allUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              {debouncedSearchTerm ? 'No users match your search' : 'No users found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                      Display Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Mobile</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                      Auto Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                      Listings
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                      Listings Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                      Verified
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => {
                    const listingCount = Number(user.listingsCount ?? user.listings ?? 0);
                    const listingLocations = Array.isArray(user.listingLocations)
                      ? user.listingLocations
                      : [];
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-slate-200 transition hover:bg-slate-50"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-900">
                            {user.displayName || user.username}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {user.mobile || user.username}
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                            <MapPin size={12} />
                            {user.autoDetectedLocation || user.location || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
                            {listingCount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {listingLocations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {listingLocations.slice(0, 3).map((loc) => (
                                <span
                                  key={`${user.id}-${loc}`}
                                  className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                >
                                  {loc}
                                </span>
                              ))}
                              {listingLocations.length > 3 && (
                                <span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                                  +{listingLocations.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {user.isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                              <BadgeCheck size={12} />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditClick(user)}
                              className="cursor-pointer rounded-lg p-2 transition hover:bg-teal-100"
                              title="Edit User"
                            >
                              <Edit2 size={16} className="text-teal-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user)}
                              className="cursor-pointer rounded-lg p-2 transition hover:bg-red-100"
                              title="Delete User"
                              disabled={deleteUser.isPending}
                            >
                              <Trash2
                                size={16}
                                className={deleteUser.isPending ? 'text-slate-400' : 'text-red-600'}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {rangeStart}-{rangeEnd} of {totalUsers} users
                  </span>
                  <div className="flex items-center gap-2">
                    {isFetching && (
                      <span className="text-xs font-medium text-slate-500">Updating...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage((value) => Math.max(0, value - 1))}
                      disabled={page === 0 || isLoading}
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((value) => value + 1)}
                      disabled={!hasMore || isLoading}
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-black">Edit User</h2>
                <p className="text-sm text-cyan-100">Trust and profile controls</p>
              </div>
              <button
                onClick={closeEditModal}
                className="rounded-lg p-1 text-white/90 transition hover:bg-white/20"
                disabled={updateUser.isPending}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                    Display Name
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedUser.displayName || selectedUser.username}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Listings</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {Number(selectedUser.listingsCount ?? selectedUser.listings ?? 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Mobile</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => handleFormChange('mobile', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter mobile number"
                    disabled={updateUser.isPending}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Auto Detected Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter location"
                    disabled={updateUser.isPending}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-emerald-900" htmlFor="is-verified">
                    Verified Seller
                  </label>
                  <input
                    id="is-verified"
                    type="checkbox"
                    checked={formData.isVerified}
                    onChange={(e) => handleFormChange('isVerified', String(e.target.checked))}
                    disabled={updateUser.isPending}
                    className="h-4 w-4 cursor-pointer accent-emerald-600"
                  />
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  Verified badge appears across user listings and marketplace cards.
                </p>
              </div>

              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{saveError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={closeEditModal}
                disabled={updateUser.isPending}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateUser.isPending}
                className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
              >
                {updateUser.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-2 text-xl font-bold text-slate-900">Delete User</h2>
            <p className="mb-6 text-slate-600">
              Are you sure you want to delete user{' '}
              <span className="font-bold">{selectedUser.displayName || selectedUser.username}</span>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                disabled={deleteUser.isPending}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUser.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteUser.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
