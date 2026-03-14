/**
 * In-App Notifications View - Admin Panel
 * Manage persistent notification feed visible within the app
 */

import { useState, useEffect } from 'react';
import { Send, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

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

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      setErrorMessage('Title and message are required');
      return;
    }

    setSending(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          userType,
          title,
          message,
          type: notificationType,
          priority,
          category: category || null,
          actionLabel: actionLabel || null,
          actionUrl: actionUrl || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`✅ Notification sent successfully!`);
        setTitle('');
        setMessage('');
        setCategory('');
        setActionLabel('');
        setActionUrl('');
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">In-App Notifications</h1>
        <p className="text-slate-300">Manage persistent notification feed visible in the app</p>
      </div>

      <div className="p-4 sm:p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-sm text-slate-600">Total Notifications</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{stats.unread}</div>
              <div className="text-sm text-slate-600">Unread</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{stats.byType.success || 0}</div>
              <div className="text-sm text-slate-600">Success</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600">{stats.byType.warning || 0}</div>
              <div className="text-sm text-slate-600">Warnings</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Send size={20} className="text-teal-500" />
              Send Notification
            </h2>

            {/* Templates */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quick Templates
                <span className="ml-2 text-xs text-slate-500">(14 templates)</span>
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
                    className={`px-3 py-1 rounded text-sm font-medium ${template.color} hover:opacity-80 transition`}
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category (Optional)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., listing, payment, account, system"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            {/* Action Button (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Action Button (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="Button text"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="Route or URL"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg flex items-center gap-2">
                <AlertCircle size={16} />
                {errorMessage}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSendNotification}
              disabled={sending || !title.trim() || !message.trim()}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                sending || !title.trim() || !message.trim()
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600'
              }`}
            >
              {sending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send Notification
                </>
              )}
            </button>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={20} className="text-teal-500" />
                Recent Notifications
              </h2>
              <button
                onClick={handleCleanupExpired}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Clean Expired
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No notifications yet</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(notification.type)}`}
                          >
                            {notification.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(notification.priority)}`}
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
                      <span>Target: {notification.userType || 'all'}</span>
                      <span>•</span>
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
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
