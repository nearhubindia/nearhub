import { useState } from 'react';
import { Video, Play, XCircle, MoreHorizontal } from 'lucide-react';
import { useVideos, useDeleteVideo, useToggleVideoStatus } from '@/features/admin/hooks';

interface VideoRow {
  id: string;
  title: string;
  sellerId?: string;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            Error loading videos. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">
          <Video className="inline-block mr-2 h-8 w-8" />
          Video Management
        </h1>
        <p className="text-slate-300">Manage and monitor all videos on the platform.</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="flex gap-4 mb-6">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-6 py-2 rounded-lg font-bold transition ${
                filter === tab
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                  : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({filteredVideos.length})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Seller</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredVideos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-slate-500">
                    No videos found
                  </td>
                </tr>
              ) : (
                filteredVideos.map((video, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {video.title as string}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {((video.sellerId as string) || 'N/A').slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {(video.durationDays as number) || 'N/A'} days
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          video.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {video.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {video.createdAt
                        ? new Date(video.createdAt as string).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(video.id)}
                          disabled={toggleVideoStatus.isPending}
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium transition ${
                            video.isActive
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {video.isActive ? (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Activate
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setVideoToDelete(video);
                            setShowDeleteModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-xs"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-mx">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Delete Video</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete "{videoToDelete?.title}"? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setVideoToDelete(null);
                }}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVideo}
                disabled={deleteVideo.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {deleteVideo.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
