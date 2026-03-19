import { useMemo, useState } from 'react';
import { Search, RefreshCcw, Mail, Clock, Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { ContactSubmission } from '@/features/admin/api';
import {
  useAddContactSubmissionComment,
  useContactSubmissions,
  useDeleteContactSubmissionComment,
  useUpdateContactSubmission,
  useUpdateContactSubmissionComment,
} from '@/features/admin/hooks';

const EMPTY_SUBMISSIONS: ContactSubmission[] = [];

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function ContactSubmissionsView() {
  const [search, setSearch] = useState('');
  const [contactedDrafts, setContactedDrafts] = useState<Record<string, boolean>>({});
  const [newCommentDrafts, setNewCommentDrafts] = useState<Record<string, string>>({});
  const [editingCommentIds, setEditingCommentIds] = useState<Record<string, boolean>>({});
  const [editingCommentDrafts, setEditingCommentDrafts] = useState<Record<string, string>>({});
  const { data, isLoading, refetch, isRefetching } = useContactSubmissions(200);
  const updateContactSubmission = useUpdateContactSubmission();
  const addComment = useAddContactSubmissionComment();
  const updateComment = useUpdateContactSubmissionComment();
  const deleteComment = useDeleteContactSubmissionComment();

  const submissions = data?.submissions ?? EMPTY_SUBMISSIONS;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return submissions;

    return submissions.filter((item) => {
      const allComments = (item.comments || [])
        .map((c) => c.comment)
        .join(' ')
        .toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query) ||
        allComments.includes(query)
      );
    });
  }, [search, submissions]);

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Enquries</h1>
        <p className="text-slate-300">View and manage enquiries submitted from the web form</p>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, subject, or message..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition font-semibold text-slate-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <RefreshCcw size={16} className={isRefetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-600">Loading enquries...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-600">No enquries found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      Message
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      Admin Comments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const comments = item.comments || [];

                    return (
                      <tr key={item.id} className="border-b border-slate-200 align-top">
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900">{item.subject}</p>
                          <p className="mt-1 text-xs uppercase font-semibold text-slate-500">
                            {item.source || 'web'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1 text-sm text-slate-700">
                            <p className="inline-flex items-center gap-1">
                              <Mail size={14} />
                              {item.name}
                            </p>
                            <p>{item.email}</p>
                            <p>{item.phone || '-'}</p>
                            <p className="inline-flex items-center gap-1 text-slate-500">
                              <Clock size={14} />
                              {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">
                            {item.message}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <input
                              type="checkbox"
                              checked={contactedDrafts[item.id] ?? item.contacted}
                              onChange={(e) =>
                                setContactedDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 accent-teal-600"
                            />
                            Contacted
                          </label>
                          <div>
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                                (contactedDrafts[item.id] ?? item.contacted)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {(contactedDrafts[item.id] ?? item.contacted)
                                ? 'Contacted'
                                : 'Pending'}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {item.contactedAt
                              ? `At: ${formatDateTime(item.contactedAt)}`
                              : 'Not contacted yet'}
                          </p>
                          <button
                            onClick={() =>
                              updateContactSubmission.mutate({
                                id: item.id,
                                data: {
                                  contacted: contactedDrafts[item.id] ?? false,
                                },
                              })
                            }
                            disabled={updateContactSubmission.isPending}
                            className="mt-3 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {updateContactSubmission.isPending ? 'Saving...' : 'Save Status'}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[200px] space-y-3 sm:min-w-[280px]">
                            {comments.map((commentItem) => {
                              const isEditing = editingCommentIds[commentItem.id] || false;
                              return (
                                <div
                                  key={commentItem.id}
                                  className="border border-slate-200 rounded-md p-2 bg-slate-50"
                                >
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={
                                          editingCommentDrafts[commentItem.id] ??
                                          commentItem.comment
                                        }
                                        onChange={(e) =>
                                          setEditingCommentDrafts((prev) => ({
                                            ...prev,
                                            [commentItem.id]: e.target.value,
                                          }))
                                        }
                                        rows={3}
                                        className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() =>
                                            updateComment.mutate(
                                              {
                                                submissionId: item.id,
                                                commentId: commentItem.id,
                                                comment: (
                                                  editingCommentDrafts[commentItem.id] ??
                                                  commentItem.comment
                                                ).trim(),
                                              },
                                              {
                                                onSuccess: () => {
                                                  setEditingCommentIds((prev) => ({
                                                    ...prev,
                                                    [commentItem.id]: false,
                                                  }));
                                                },
                                              }
                                            )
                                          }
                                          className="p-1.5 rounded text-white bg-teal-600 hover:bg-teal-700"
                                          title="Save"
                                        >
                                          <Check size={14} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setEditingCommentIds((prev) => ({
                                              ...prev,
                                              [commentItem.id]: false,
                                            }))
                                          }
                                          className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                                          title="Cancel"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                        {commentItem.comment}
                                      </p>
                                      <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xs text-slate-500">
                                          {formatDateTime(commentItem.createdAt)}
                                        </span>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => {
                                              setEditingCommentDrafts((prev) => ({
                                                ...prev,
                                                [commentItem.id]: commentItem.comment,
                                              }));
                                              setEditingCommentIds((prev) => ({
                                                ...prev,
                                                [commentItem.id]: true,
                                              }));
                                            }}
                                            className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                                            title="Edit comment"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              deleteComment.mutate({
                                                submissionId: item.id,
                                                commentId: commentItem.id,
                                              })
                                            }
                                            className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                            title="Delete comment"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newCommentDrafts[item.id] ?? ''}
                                onChange={(e) =>
                                  setNewCommentDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="Add a comment..."
                                className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                              <button
                                onClick={() =>
                                  addComment.mutate(
                                    {
                                      submissionId: item.id,
                                      comment: (newCommentDrafts[item.id] ?? '').trim(),
                                    },
                                    {
                                      onSuccess: () => {
                                        setNewCommentDrafts((prev) => ({ ...prev, [item.id]: '' }));
                                      },
                                    }
                                  )
                                }
                                disabled={!(newCommentDrafts[item.id] ?? '').trim()}
                                className="p-2 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                                title="Add comment"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
