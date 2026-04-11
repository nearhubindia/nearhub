import { useMemo, useState } from 'react';
import { Search, RefreshCcw, Mail, Clock, Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ContactSubmission } from '@/features/admin/api';
import { DataTable } from '@/components/data-table';
import {
  useAddContactSubmissionComment,
  useContactSubmissions,
  useDeleteContactSubmissionComment,
  useUpdateContactSubmission,
  useUpdateContactSubmissionComment,
} from '@/features/admin/hooks';

type ContactSubmissionComment = {
  id: string;
  comment: string;
  createdAt?: string | null;
};

type ContactSubmissionRow = ContactSubmission & {
  comments?: ContactSubmissionComment[];
};

const EMPTY_SUBMISSIONS: ContactSubmissionRow[] = [];

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

  const submissions =
    (data?.submissions as ContactSubmissionRow[] | undefined) ?? EMPTY_SUBMISSIONS;

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

  const columns = useMemo<ColumnDef<ContactSubmissionRow>[]>(
    () => [
      {
        accessorKey: 'subject',
        header: 'Subject',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter subject...' },
        cell: ({ row }) => (
          <div>
            <p className="font-bold text-slate-900">{row.original.subject}</p>
            <p className="mt-1 text-xs uppercase font-semibold text-slate-500">
              {row.original.source || 'web'}
            </p>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        enableColumnFilter: true,
        accessorFn: (item) => `${item.name} ${item.email} ${item.phone || ''}`,
        meta: { filterPlaceholder: 'Filter contact...' },
        cell: ({ row }) => (
          <div className="space-y-1 text-sm text-slate-700">
            <p className="inline-flex items-center gap-1">
              <Mail size={14} />
              {row.original.name}
            </p>
            <p>{row.original.email}</p>
            <p>{row.original.phone || '-'}</p>
            <p className="inline-flex items-center gap-1 text-slate-500">
              <Clock size={14} />
              {formatDateTime(row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'message',
        header: 'Message',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter message...' },
        cell: ({ row }) => (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{row.original.message}</p>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableColumnFilter: true,
        accessorFn: (item) => `${contactedDrafts[item.id] ?? item.contacted}`,
        meta: { filterPlaceholder: 'Filter status...' },
        cell: ({ row }) => {
          const item = row.original;
          const isContacted = contactedDrafts[item.id] ?? item.contacted;

          return (
            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isContacted}
                  onChange={(e) =>
                    setContactedDrafts((prev) => ({
                      ...prev,
                      [item.id]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-teal-600"
                />
                Contacted
              </label>
              <div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                    isContacted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isContacted ? 'Contacted' : 'Pending'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {item.contactedAt ? `At: ${formatDateTime(item.contactedAt)}` : 'Not contacted yet'}
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
                className="mt-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                type="button"
              >
                {updateContactSubmission.isPending ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          );
        },
      },
      {
        id: 'comments',
        header: 'Admin Comments',
        enableSorting: false,
        enableColumnFilter: false,
        accessorFn: (item) => (item.comments || []).map((comment) => comment.comment).join(' '),
        meta: { filterPlaceholder: 'Filter comments...' },
        cell: ({ row }) => {
          const item = row.original;
          const comments = item.comments || [];

          return (
            <div className="min-w-[200px] space-y-3 sm:min-w-[280px]">
              {comments.map((commentItem) => {
                const isEditing = editingCommentIds[commentItem.id] || false;
                return (
                  <div
                    key={commentItem.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-2"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingCommentDrafts[commentItem.id] ?? commentItem.comment}
                          onChange={(e) =>
                            setEditingCommentDrafts((prev) => ({
                              ...prev,
                              [commentItem.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          className="w-full rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateComment.mutate(
                                {
                                  submissionId: item.id,
                                  commentId: commentItem.id,
                                  comment: (
                                    editingCommentDrafts[commentItem.id] ?? commentItem.comment
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
                            className="rounded bg-teal-600 p-1.5 text-white hover:bg-teal-700"
                            title="Save"
                            type="button"
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
                            className="rounded border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                            title="Cancel"
                            type="button"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {commentItem.comment}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {formatDateTime(commentItem.createdAt || null)}
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
                              className="rounded border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                              title="Edit comment"
                              type="button"
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
                              className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                              title="Delete comment"
                              type="button"
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
                  className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                  className="rounded bg-teal-600 p-2 text-white hover:bg-teal-700 disabled:opacity-50"
                  title="Add comment"
                  type="button"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        },
      },
    ],
    [
      addComment,
      contactedDrafts,
      deleteComment,
      editingCommentDrafts,
      editingCommentIds,
      updateComment,
      updateContactSubmission,
      newCommentDrafts,
    ]
  );

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

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-600">
            Loading enquiries...
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            showSearch={false}
            searchPlaceholder="Search by name, email, phone, subject, or message..."
          />
        )}
      </div>
    </div>
  );
}
