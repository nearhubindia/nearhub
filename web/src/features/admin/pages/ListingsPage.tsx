import { useState } from 'react';
import ListingsView from '../components/ListingsView';
import EditListingModal from '../components/EditListingModal';
import CreateListingModal from '../components/CreateListingModal';
import type { Listing, EditingListing } from '../types/admin-types';

export default function ListingsPage() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingListing, setEditingListing] = useState<EditingListing | null>(null);

  const openEditModal = (listing: Listing): void => {
    setEditingListing({ ...listing, folderId: 1 } as EditingListing);
    setShowEditModal(true);
  };

  const closeEditModal = (): void => {
    setShowEditModal(false);
    setEditingListing(null);
  };

  const openCreateModal = (): void => {
    setShowCreateModal(true);
  };

  const closeCreateModal = (): void => {
    setShowCreateModal(false);
  };

  return (
    <>
      <ListingsView
        onEditListing={openEditModal}
        onCreateListing={openCreateModal}
      />
      {showEditModal && editingListing && (
        <EditListingModal
          listing={editingListing}
          onClose={closeEditModal}
        />
      )}
      {showCreateModal && (
        <CreateListingModal onClose={closeCreateModal} />
      )}
    </>
  );
}
