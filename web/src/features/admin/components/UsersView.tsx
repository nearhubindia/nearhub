import { useEffect, useState } from 'react';
import { BadgeCheck, CreditCard, Edit2, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { useDeleteUser, useUsers } from '@/features/admin/hooks';
import GrantSubscriptionModal from './GrantSubscriptionModal';
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
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const offset = page * pageSize;
  const {
    data: usersData,
    isLoading,
    isFetching,
    refetch,
  } = useUsers({
    limit: pageSize,
    offset,
    search: debouncedSearchTerm || undefined,
  });
  const deleteUser = useDeleteUser();
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit' | null>(null);
  const [grantSubscriptionUser, setGrantSubscriptionUser] = useState<AdminUserRow | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const allUsers: AdminUserRow[] = Array.isArray(usersData?.data)
    ? (usersData.data as AdminUserRow[])
    : [];
  const totalUsers = Number(usersData?.total || 0);

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

  const handleGrantSubscriptionClick = (user: AdminUserRow): void => {
    setGrantSubscriptionUser(user);
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

  const closeGrantSubscriptionModal = () => {
    setGrantSubscriptionUser(null);
  };

  const columns: ColumnDef<AdminUserRow>[] = [
    {
      id: 'displayName',
      header: 'Display Name',
      enableColumnFilter: true,
      accessorFn: (user) => `${getUserLabel(user)} ${getUserMobile(user)}`,
      meta: { filterPlaceholder: 'Filter name...' },
      cell: ({ row }) => (
        <div className="text-sm font-semibold text-slate-900">{getUserLabel(row.original)}</div>
      ),
    },
    {
      accessorKey: 'mobile',
      header: 'Mobile',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter mobile...' },
      cell: ({ row }) => (
        <span className="text-sm text-slate-700">{getUserMobile(row.original) || '-'}</span>
      ),
    },
    {
      id: 'location',
      header: 'Auto Location',
      enableColumnFilter: true,
      accessorFn: (user) => `${user.autoDetectedLocation || ''} ${user.location || ''}`,
      meta: { filterPlaceholder: 'Filter location...' },
      cell: ({ row }) => (
        <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
          <MapPin size={12} />
          {row.original.autoDetectedLocation || row.original.location || '-'}
        </div>
      ),
    },
    {
      id: 'listings',
      header: 'Listings',
      enableColumnFilter: true,
      accessorFn: (user) => String(Number(user.listingsCount ?? user.listings ?? 0)),
      meta: { filterPlaceholder: 'Filter listings...' },
      cell: ({ row }) => {
        const listingCount = Number(row.original.listingsCount ?? row.original.listings ?? 0);
        return (
          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
            {listingCount}
          </span>
        );
      },
    },
    {
      id: 'listingLocations',
      header: 'Listings Location',
      enableColumnFilter: true,
      accessorFn: (user) => (user.listingLocations || []).join(' '),
      meta: { filterPlaceholder: 'Filter listing locations...' },
      cell: ({ row }) => {
        const listingLocations = Array.isArray(row.original.listingLocations)
          ? row.original.listingLocations
          : [];
        return listingLocations.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {listingLocations.slice(0, 3).map((loc) => (
              <span
                key={`${row.original.id}-${loc}`}
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
        );
      },
    },
    {
      accessorKey: 'isVerified',
      header: 'Verified',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter verified...' },
      cell: ({ row }) =>
        row.original.isVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck size={12} />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            Unverified
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
        <div className="flex gap-2">
          <button
            onClick={() => handleEditClick(row.original)}
            className="cursor-pointer rounded-lg p-2 transition hover:bg-teal-100"
            title="Edit User"
            type="button"
          >
            <Edit2 size={16} className="text-teal-600" />
          </button>
          <button
            onClick={() => handleGrantSubscriptionClick(row.original)}
            className="cursor-pointer rounded-lg p-2 transition hover:bg-cyan-100"
            title="Grant Subscription"
            type="button"
          >
            <CreditCard size={16} className="text-cyan-600" />
          </button>
          <button
            onClick={() => handleDeleteClick(row.original)}
            className="cursor-pointer rounded-lg p-2 transition hover:bg-red-100"
            title="Delete User"
            disabled={deleteUser.isPending}
            type="button"
          >
            <Trash2
              size={16}
              className={deleteUser.isPending ? 'text-slate-400' : 'text-red-600'}
            />
          </button>
        </div>
      ),
    },
  ];

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

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-600">
            Loading users...
          </div>
        ) : allUsers.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-600">
            {debouncedSearchTerm ? 'No users match your search' : 'No users found'}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={allUsers}
            showSearch={false}
            manualPagination
            pageIndex={page}
            onPageIndexChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(nextPageSize) => {
              setPage(0);
              setPageSize(nextPageSize);
            }}
            pageCount={Math.max(1, Math.ceil(totalUsers / pageSize))}
            rowCount={totalUsers}
            toolbarRight={
              isFetching ? (
                <span className="text-xs font-medium text-slate-500">Updating...</span>
              ) : null
            }
          />
        )}
      </div>

      {userModalMode && (
        <UserFormModal
          key={`${userModalMode}-${selectedUser?.id || 'new'}`}
          mode={userModalMode}
          user={selectedUser}
          onClose={closeUserModal}
          onSaved={refetch}
        />
      )}

      {grantSubscriptionUser && (
        <GrantSubscriptionModal
          key={`grant-${grantSubscriptionUser.id}`}
          user={grantSubscriptionUser}
          onClose={closeGrantSubscriptionModal}
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
