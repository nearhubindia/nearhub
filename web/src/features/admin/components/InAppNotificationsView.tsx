/**
 * Notifications View - Admin Panel
 * Send and manage notifications from one place.
 */

import { useState, useEffect, type ChangeEvent } from 'react';
import { Send, Trash2, TrendingUp, AlertCircle, Upload, X } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { uploadListingImages } from '@/features/admin/utils/listing-media-upload';

function getAdminToken() {
  return localStorage.getItem('adminToken') || '';
}

interface InAppNotification {
  id: string;
  userId: string | null;
  userType: string;
  title: string;
  message: string;
  type: string;
  actionLabel: string | null;
  actionUrl: string | null;
  imageUrl: string | null;
  category: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: string | null;
  priority: string;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

interface InAppTemplate {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: string;
}

export default function InAppNotificationsView() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [userType, setUserType] = useState<'all' | 'buyer' | 'seller'>('all');
  const [notificationType, setNotificationType] = useState<
    'info' | 'success' | 'warning' | 'error'
  >('info');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [category, setCategory] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Success/error state
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchStats();
    fetchNotifications();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/notifications/stats`, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/notifications/all?limit=50`, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) return;

    try {
      setIsUploadingBanner(true);
      setErrorMessage('');
      const [publicUrl] = await uploadListingImages([selectedFile]);
      setBannerImageUrl(publicUrl || '');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload banner image');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      setErrorMessage('Title and message are required');
      return;
    }

    setSending(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/push/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          title,
          body: message,
          userType,
          notificationType: category.trim() || 'admin_broadcast',
          actionUrl: actionUrl || undefined,
          priority: priority === 'urgent' || priority === 'high' ? 'high' : 'normal',
          imageUrl: bannerImageUrl.trim() || undefined,
          data: {
            type: notificationType,
            category: category.trim() || 'system',
            actionLabel: actionLabel || undefined,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage('Notification sent successfully.');
        setTitle('');
        setMessage('');
        setCategory('');
        setActionLabel('');
        setActionUrl('');
        setBannerImageUrl('');
        fetchStats();
        fetchNotifications();
      } else {
        setErrorMessage(result.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setErrorMessage('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        fetchNotifications();
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleCleanupExpired = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/notifications/cleanup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`🗑️ Deleted ${result.deletedCount} expired notifications`);
        fetchNotifications();
        fetchStats();
      }
    } catch (error) {
      console.error('Error cleaning up:', error);
    }
  };

  const parseUserType = (value: string): 'all' | 'buyer' | 'seller' => {
    return value === 'buyer' || value === 'seller' ? value : 'all';
  };

  const parseNotificationType = (value: string): 'info' | 'success' | 'warning' | 'error' => {
    return value === 'success' || value === 'warning' || value === 'error' ? value : 'info';
  };

  const parsePriority = (value: string): 'urgent' | 'high' | 'normal' | 'low' => {
    return value === 'urgent' || value === 'high' || value === 'low' ? value : 'normal';
  };

  const applyTemplate = (templateType: string) => {
    const templates: Record<string, InAppTemplate> = {
      // Account & Welcome
      welcome: {
        title: 'Welcome to NearHub! 🎉',
        message: 'Start exploring listings near you and find great deals on local items.',
        type: 'success',
        priority: 'normal',
        category: 'account',
      },
      accountVerified: {
        title: 'Account Verified ✅',
        message: 'Your account has been successfully verified. Enjoy all features!',
        type: 'success',
        priority: 'high',
        category: 'account',
      },
      // Listings
      newListing: {
        title: 'New Listing Available! 🏷️',
        message: 'Check out the latest items added in your area.',
        type: 'info',
        priority: 'normal',
        category: 'listing',
      },
      priceUpdate: {
        title: 'Price Drop Alert! 💰',
        message: 'An item on your watchlist just got cheaper!',
        type: 'success',
        priority: 'high',
        category: 'listing',
      },
      listingApproved: {
        title: 'Listing Approved ✅',
        message: 'Your listing has been approved and is now visible to buyers!',
        type: 'success',
        priority: 'normal',
        category: 'listing',
      },
      listingExpiring: {
        title: 'Listing Expiring Soon ⏰',
        message: 'Your listing will expire in 3 days. Renew it to keep it active!',
        type: 'warning',
        priority: 'high',
        category: 'listing',
      },
      // Payment & Subscriptions
      paymentSuccess: {
        title: 'Payment Successful 💳',
        message: 'Your payment has been processed. Invoice has been sent to your email.',
        type: 'success',
        priority: 'high',
        category: 'payment',
      },
      invoiceReady: {
        title: 'Invoice Generated 📄',
        message: 'Your invoice is ready for download. Tap to view details.',
        type: 'info',
        priority: 'normal',
        category: 'payment',
      },
      subscriptionRenewal: {
        title: 'Subscription Renewal Reminder 📅',
        message:
          'Your premium subscription expires in 5 days. Renew now to continue enjoying benefits!',
        type: 'warning',
        priority: 'high',
        category: 'payment',
      },
      // Coupons & Offers
      couponAvailable: {
        title: 'Special Coupon Available! 🎟️',
        message: 'Use code SAVE20 for 20% OFF on your next listing. Valid for limited time!',
        type: 'success',
        priority: 'normal',
        category: 'system',
      },
      limitedOffer: {
        title: 'Limited Time Offer ⭐',
        message: 'Get 50% OFF on premium features. Offer ends tonight!',
        type: 'info',
        priority: 'high',
        category: 'system',
      },
      // System & Maintenance
      maintenance: {
        title: 'Scheduled Maintenance 🔧',
        message: 'NearHub will undergo maintenance tonight at 2 AM. Downtime expected: 30 minutes.',
        type: 'warning',
        priority: 'high',
        category: 'system',
      },
      featureUpdate: {
        title: 'New Feature Available! 🚀',
        message: "We've added video listings! Upload videos to showcase your items better.",
        type: 'info',
        priority: 'normal',
        category: 'system',
      },
    };

    const template = templates[templateType];
    if (template) {
      setTitle(template.title);
      setMessage(template.message);
      setNotificationType(template.type);
      setPriority(template.priority);
      setCategory(template.category);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };
    return colors[type] || colors.info;
  };

  const getPriorityColor = (priorityLevel: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      normal: 'bg-gray-500 text-white',
      low: 'bg-gray-300 text-gray-700',
    };
    return colors[priorityLevel] || colors.normal;
  };

  return (
    <div>
      <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.2),_transparent_36%),linear-gradient(135deg,_#0f172a,_#111827_58%,_#164e63)] px-4 py-6 text-white sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-200/80">
              Admin Center
            </p>
            <h1 className="mb-2 text-3xl font-black sm:text-4xl">Notifications</h1>
            <p className="text-sm text-slate-200 sm:text-base">
              Send notifications, track recent activity, and keep the app feed clean from one place.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">
              Live Sync
            </div>
            <div className="mt-1 text-sm text-white">
              Push delivery and app activity stay aligned.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Total
              </div>
              <div className="mt-3 text-3xl font-black text-slate-900">{stats.total}</div>
              <div className="mt-1 text-sm text-slate-600">All notifications in the feed</div>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Unread
              </div>
              <div className="mt-3 text-3xl font-black text-cyan-900">{stats.unread}</div>
              <div className="mt-1 text-sm text-cyan-800/80">
                Waiting in user notification trays
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Success
              </div>
              <div className="mt-3 text-3xl font-black text-emerald-900">
                {stats.byType.success || 0}
              </div>
              <div className="mt-1 text-sm text-emerald-800/80">
                Positive updates and confirmations
              </div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Warnings
              </div>
              <div className="mt-3 text-3xl font-black text-amber-900">
                {stats.byType.warning || 0}
              </div>
              <div className="mt-1 text-sm text-amber-800/80">
                Reminders, nudges, and expiring items
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Send size={20} className="text-teal-500" />
                Compose
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Push + Feed
              </span>
            </div>
            <p className="mb-5 text-sm text-slate-600">
              Every send reaches devices and is reflected in the app notification feed.
            </p>
            <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
              <span className="font-semibold">Default expiry:</span> in-app notifications expire
              after 1 day unless a different expiry is set by the backend.
            </div>
            <h2 className="sr-only">
              <Send size={20} className="text-teal-500" />
              Send Notification
            </h2>

            {/* Templates */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quick Templates
                <span className="ml-2 text-xs text-slate-500">(13 templates)</span>
              </label>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {[
                  // Account
                  { id: 'welcome', label: '👋 Welcome', color: 'bg-green-100 text-green-800' },
                  {
                    id: 'accountVerified',
                    label: '✅ Verified',
                    color: 'bg-green-100 text-green-800',
                  },
                  // Listings
                  { id: 'newListing', label: '🏷️ New Listing', color: 'bg-blue-100 text-blue-800' },
                  {
                    id: 'priceUpdate',
                    label: '💰 Price Drop',
                    color: 'bg-yellow-100 text-yellow-800',
                  },
                  {
                    id: 'listingApproved',
                    label: '✅ Approved',
                    color: 'bg-green-100 text-green-800',
                  },
                  {
                    id: 'listingExpiring',
                    label: '⏰ Expiring',
                    color: 'bg-orange-100 text-orange-800',
                  },
                  // Payment
                  {
                    id: 'paymentSuccess',
                    label: '💳 Payment',
                    color: 'bg-green-100 text-green-800',
                  },
                  { id: 'invoiceReady', label: '📄 Invoice', color: 'bg-blue-100 text-blue-800' },
                  {
                    id: 'subscriptionRenewal',
                    label: '📅 Renewal',
                    color: 'bg-orange-100 text-orange-800',
                  },
                  // Offers
                  {
                    id: 'couponAvailable',
                    label: '🎟️ Coupon',
                    color: 'bg-purple-100 text-purple-800',
                  },
                  { id: 'limitedOffer', label: '⭐ Offer', color: 'bg-purple-100 text-purple-800' },
                  // System
                  { id: 'maintenance', label: '🔧 Maintenance', color: 'bg-red-100 text-red-800' },
                  { id: 'featureUpdate', label: '🚀 Feature', color: 'bg-blue-100 text-blue-800' },
                ].map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition hover:opacity-80 ${template.color}`}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Target Audience
              </label>
              <select
                value={userType}
                onChange={(e) => setUserType(parseUserType(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="all">All Users</option>
                <option value="buyer">Buyers Only</option>
                <option value="seller">Sellers Only</option>
              </select>
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(parseNotificationType(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="info">ℹ️ Info</option>
                  <option value="success">✅ Success</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="error">❌ Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(parsePriority(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="normal">⚪ Normal</option>
                  <option value="low">⚫ Low</option>
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            {/* Message */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter notification message"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            {/* Banner Image */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Banner Image
              </label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                    {isUploadingBanner ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload banner
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                      disabled={isUploadingBanner}
                    />
                  </label>
                  <span className="text-xs font-medium leading-5 text-slate-500">
                    Optional. Uses the same image in push and the app notification feed.
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <input
                    type="url"
                    value={bannerImageUrl}
                    onChange={(e) => setBannerImageUrl(e.target.value)}
                    placeholder="Paste banner image URL or upload a file"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                  {bannerImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setBannerImageUrl('')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-100 transition hover:bg-rose-50"
                    >
                      <X size={16} />
                      Clear
                    </button>
                  ) : null}
                </div>

                {bannerImageUrl ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <img
                      src={bannerImageUrl}
                      alt="Notification banner preview"
                      className="h-44 w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = '/nearhub.png';
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., listing, payment, account, system"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            {/* Action Button (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Action Link</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="Button text"
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  type="text"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="Route or URL"
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                <AlertCircle size={16} />
                {errorMessage}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSendNotification}
              disabled={sending || isUploadingBanner || !title.trim() || !message.trim()}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold ${
                sending || isUploadingBanner || !title.trim() || !message.trim()
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600'
              }`}
            >
              {sending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : isUploadingBanner ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  Uploading banner...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send
                </>
              )}
            </button>
          </div>

          {/* Recent Notifications */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={20} className="text-teal-500" />
                Recent Activity
              </h2>
              <button
                onClick={handleCleanupExpired}
                className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Clear Expired
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No activity yet</div>
            ) : (
              <div className="max-h-[600px] space-y-3 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        {notification.imageUrl ? (
                          <div className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                            <img
                              src={notification.imageUrl}
                              alt={notification.title}
                              className="h-36 w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = '/nearhub.png';
                              }}
                            />
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTypeColor(notification.type)}`}
                          >
                            {notification.type}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(notification.priority)}`}
                          >
                            {notification.priority}
                          </span>
                          {notification.category && (
                            <span className="text-xs text-slate-500">#{notification.category}</span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {notification.title}
                        </div>
                        <div className="text-sm text-slate-600">{notification.message}</div>
                        {notification.actionLabel && (
                          <div className="text-xs text-teal-600 mt-1">
                            🔗 {notification.actionLabel}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Audience: {notification.userType || 'all'}</span>
                      <span>•</span>
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>
                        Expires:{' '}
                        {notification.expiresAt
                          ? new Date(notification.expiresAt).toLocaleString()
                          : '1 day from send'}
                      </span>
                      {notification.isRead && <span className="text-green-600">✓ Read</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
