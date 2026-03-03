import { useState } from 'react';
import { Edit2, Trash2, Search, X } from 'lucide-react';
import { useUsers, useDeleteUser, useUpdateUser } from '@/features/admin/hooks';

interface UserRow {
  id: string;
  username: string;
  mobile?: string;
  location?: string;
}

export default function UsersView() {
  const { data: usersData, isLoading, refetch } = useUsers();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [formData, setFormData] = useState({ username: '', mobile: '', location: '' });
  const [saveError, setSaveError] = useState('');

  // Handle the API response structure: { success, data, total }
  const allUsers: UserRow[] = Array.isArray(usersData?.data)
    ? (usersData.data as UserRow[])
    : [];

  // Filter users based on search term
  const filteredUsers = allUsers.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.mobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (user: UserRow): void => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      mobile: user.mobile || '',
      location: user.location || '',
    });
    setSaveError('');
    setEditModalOpen(true);
  };

  const handleDeleteClick = (user: UserRow): void => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!formData.username.trim() || !formData.mobile.trim() || !formData.location.trim()) {
      setSaveError('All fields are required');
      return;
    }

    if (!selectedUser) {
      setSaveError('No user selected');
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
      setSaveError('Failed to update user');
      console.error('Failed to update user:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedUser) {
      try {
        await deleteUser.mutateAsync(selectedUser.id);
        setDeleteModalOpen(false);
        setSelectedUser(null);
        refetch();
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Users Management</h1>
        <p className="text-slate-300">Manage platform users and permissions</p>
      </div>

      <div className="p-6">
        {/* Search Section */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by username, mobile, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setSearchTerm('')}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition"
          >
            Clear
          </button>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-600">Loading users...</div>
          ) : allUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-600">No users found</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-600">No users match your search</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Username</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Mobile</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Location</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.username}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.mobile || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.location || '-'}</td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="p-2 hover:bg-teal-100 rounded transition cursor-pointer"
                          title="Edit User"
                        >
                          <Edit2 size={16} className="text-teal-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="p-2 hover:bg-red-100 rounded transition cursor-pointer"
                          title="Delete User"
                          disabled={deleteUser.isPending}
                        >
                          <Trash2 size={16} className={deleteUser.isPending ? 'text-slate-400' : 'text-red-600'} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
                Showing {filteredUsers.length} of {allUsers.length} users
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Edit User</h2>
              <button
                onClick={closeEditModal}
                className="p-1 hover:bg-slate-100 rounded transition"
                disabled={updateUser.isPending}
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleFormChange('username', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter username"
                  disabled={updateUser.isPending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleFormChange('mobile', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter mobile number"
                  disabled={updateUser.isPending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleFormChange('location', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter location"
                  disabled={updateUser.isPending}
                />
              </div>

              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{saveError}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeEditModal}
                disabled={updateUser.isPending}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateUser.isPending}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition font-medium disabled:opacity-50"
              >
                {updateUser.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Delete User</h2>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete user <span className="font-bold">{selectedUser.username}</span>? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                disabled={deleteUser.isPending}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUser.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:opacity-50"
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

