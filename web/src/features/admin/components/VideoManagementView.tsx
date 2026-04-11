import { useState } from 'react';
import { Video, Play, XCircle, MoreHorizontal } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { useVideos, useDeleteVideo, useToggleVideoStatus } from '@/features/admin/hooks';

interface VideoRow {
  id: string;
  title: string;
  userId?: string;
  durationDays?: number;
  isActive: boolean;
  createdAt?: string;
}

export default function VideoManagementView() {
  const { data: videosData, isLoading, error } = useVideos();
  const deleteVideo = useDeleteVideo();
  const toggleVideoStatus = useToggleVideoStatus();
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoRow | null>(null);

  const videos: VideoRow[] = Array.isArray(videosData?.videos)
    ? (videosData.videos as VideoRow[])
    : [];

  const filteredVideos =
    filter === 'all'
      ? videos
      : videos.filter((video) => (filter === 'active' ? video.isActive : !video.isActive));

  const filterTabs: Array<'all' | 'active' | 'expired'> = ['all', 'active', 'expired'];

  const handleDeleteVideo = async (): Promise<void> => {
    if (!videoToDelete) return;
    try {
      await deleteVideo.mutateAsync(videoToDelete.id);
      setShowDeleteModal(false);
      setVideoToDelete(null);
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('Failed to delete video');
    }
  };

  const handleToggleStatus = async (videoId: string): Promise<void> => {
    try {
      await toggleVideoStatus.mutateAsync(videoId);
    } catch (error) {
      console.error('Failed to toggle video status:', error);
      alert('Failed to update video status');
    }
  };

  const columns: ColumnDef<VideoRow>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter title...' },
    },
    {
      accessorKey: 'userId',
      header: 'Seller',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter seller...' },
      cell: ({ row }) => <span>{String(row.original.userId || 'N/A').slice(0, 8)}...</span>,
    },
    {
      accessorKey: 'durationDays',
      header: 'Duration',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter duration...' },
      cell: ({ row }) => `${row.original.durationDays || 'N/A'} days`,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter status...' },
      cell: ({ row }) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            row.original.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {row.original.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter date...' },
      cell: ({ row }) =>
        row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : 'N/A',
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      accessorFn: () => '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleStatus(row.original.id)}
            disabled={toggleVideoStatus.isPending}
            className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium transition ${
              row.original.isActive
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            type="button"
          >
            {row.original.isActive ? (
              <>
                <XCircle className="mr-1 h-3 w-3" />
                Deactivate
              </>
            ) : (
              <>
                <Play className="mr-1 h-3 w-3" />
                Activate
              </>
            )}
          </button>
          <button
            onClick={() => {
              setVideoToDelete(row.original);
              setShowDeleteModal(true);
            }}
            className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-200"
            type="button"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-center">
            <XCircle className="mr-2 h-5 w-5" />
            Error loading videos. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white sm:p-6">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">
          <Video className="mr-2 inline-block h-8 w-8" />
          Video Management
        </h1>
        <p className="text-slate-300">Manage and monitor all videos on the platform.</p>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap gap-2 sm:gap-4">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition sm:px-6 ${
                filter === tab
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                  : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
              }`}
              type="button"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({filteredVideos.length})
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={filteredVideos}
          searchPlaceholder="Search title, seller, duration, status..."
        />
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Delete Video</h3>
            <p className="mb-6 text-slate-600">
              Are you sure you want to delete "{videoToDelete?.title}"? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setVideoToDelete(null);
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-slate-600 transition hover:bg-slate-200"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVideo}
                disabled={deleteVideo.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
