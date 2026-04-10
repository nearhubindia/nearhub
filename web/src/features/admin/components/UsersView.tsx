import { useEffect, useState } from 'react';
import { BadgeCheck, Edit2, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { useDeleteUser, useUsers } from '@/features/admin/hooks';
import UserFormModal from './UserFormModal';
import type { AdminUserRow } from '../types/admin-types';

function normalizePhoneLike(value: unknown): string {
  if (typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? digits : '';
}

function isSyntheticDisplayName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  const compact = trimmed.replace(/[\s._-]/g, '');
  return (
    normalized === 'user' ||
    normalized === 'buyer' ||
    normalized === 'seller' ||
    normalized === 'unknown' ||
    normalized === 'anonymous' ||
    normalized === 'nearhub user' ||
    /^\d{10,15}$/.test(trimmed) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed) ||
    /^user[\s_-]*[0-9a-z]+$/i.test(trimmed) ||
    /^nearhub(?:[\s_-]*user)?$/i.test(trimmed) ||
    (compact.length >= 8 && /\d/.test(compact) && /[a-z]/i.test(compact))
  );
}

function getUserMobile(user: Pick<AdminUserRow, 'mobile' | 'username'>): string {
  return normalizePhoneLike(user.mobile) || normalizePhoneLike(user.username);
}

function getUserLabel(user: Pick<AdminUserRow, 'displayName' | 'mobile' | 'username'>): string {
  const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  if (displayName && !isSyntheticDisplayName(displayName)) {
    return displayName;
  }

  const mobile = getUserMobile(user);
  if (mobile) {
    return mobile;
  }

  return '-';
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
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit' | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const allUsers: AdminUserRow[] = Array.isArray(usersData?.data)
    ? (usersData.data as AdminUserRow[])
    : [];
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

  const handleEditClick = (user: AdminUserRow): void => {
    setSelectedUser(user);
    setUserModalMode('edit');
  };

  const handleAddClick = (): void => {
    setSelectedUser(null);
    setUserModalMode('create');
  };

  const handleDeleteClick = (user: AdminUserRow): void => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
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

  const closeUserModal = () => {
    setUserModalMode(null);
    setSelectedUser(null);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-black sm:text-4xl">Users Management</h1>
            <p className="text-slate-300">
              Display name, auto-detected location, listing footprint, and trust controls.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
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
                            {getUserLabel(user)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {getUserMobile(user) || '-'}
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

      {userModalMode && (
        <UserFormModal
          mode={userModalMode}
          user={selectedUser}
          onClose={closeUserModal}
          onSaved={refetch}
        />
      )}

      {deleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-2 text-xl font-bold text-slate-900">Delete User</h2>
            <p className="mb-6 text-slate-600">
              Are you sure you want to delete user{' '}
              <span className="font-bold">{getUserLabel(selectedUser)}</span>? This action cannot be
              undone.
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
