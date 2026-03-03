/**
 * Push Notifications View - Admin Panel
 * Send push notifications to buyers, sellers, or all users
 */

import { useState, useEffect } from 'react';
import { Bell, Send, Users, ShoppingBag, TrendingUp, AlertCircle, Check } from 'lucide-react';
import { getApiUrl, getAdminToken } from '../constants/admin-constants';

interface PushStats {
  totalTokens: number;
  activeTokens: number;
  totalSent: number;
  buyers: number;
  sellers: number;
}

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  userType: string;
  notificationType: string;
  sentCount: number;
  status: string;
  sentAt: string;
  sentBy?: string;
}

interface NotificationTemplate {
  title: string;
  body: string;
  type: string;
  category: string;
  manual?: boolean;
  description?: string;
}

export default function PushNotificationsView() {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [userType, setUserType] = useState<'all' | 'buyer' | 'seller'>('all');
  const [notificationType, setNotificationType] = useState('admin_broadcast');

  // Success/error state
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchStats();
    fetchLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/push/stats`, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/api/admin/push/logs?limit=20`, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setLogs(result.data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      setErrorMessage('Title and message are required');
      return;
    }

    setSending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/push/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          title,
          body,
          userType,
          notificationType,
          adminId: 'admin', // You can get this from auth context
          data: {
            type: notificationType,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`✅ Sent to ${result.sentCount} devices!`);
        setTitle('');
        setBody('');
        fetchStats();
        fetchLogs();
      } else {
        // Show detailed error message
        const errorMsg = result.message || 'Failed to broadcast notification';
        if (errorMsg.includes('No active')) {
          setErrorMessage(`⚠️ No active devices found. Ensure users have installed the app and enabled push notifications.`);
        } else if (errorMsg.includes('Invalid Expo')) {
          setErrorMessage(`❌ Invalid push token configuration.`);
        } else {
          setErrorMessage(errorMsg);
        }
      }
    } catch (error) {
      setErrorMessage('Failed to send notification');
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  };

  const quickTemplates: NotificationTemplate[] = [
    // Manual - Admin Broadcast Templates
    {
      title: '🆕 New Listing Alert',
      body: 'Check out the latest items near you!',
      type: 'new_listing',
      category: 'Listing',
      manual: true,
    },
    {
      title: '💰 Price Drop Alert',
      body: "Don't miss out on great deals near you!",
      type: 'price_drop',
      category: 'Listing',
      manual: true,
    },
    {
      title: '🎟️ Special Coupon Available',
      body: 'Use code SAVE20 for 20% OFF. Valid for limited time!',
      type: 'coupon_available',
      category: 'Offer',
      manual: true,
    },
    {
      title: '⭐ Limited Time Offer',
      body: 'Get exclusive deals today. Don\'t miss out!',
      type: 'promotion',
      category: 'Offer',
      manual: true,
    },
    {
      title: '📢 Important Update',
      body: 'We have important updates for you. Check the app now!',
      type: 'admin_broadcast',
      category: 'Admin',
      manual: true,
    },
    // Auto-Triggered Notifications (System Events)
    {
      title: '✅ Listing Approved',
      body: 'Your listing has been approved and is now live!',
      type: 'listing_approved',
      category: 'Listing',
      manual: false,
      description: 'Sent automatically when listing is approved',
    },
    {
      title: '⏰ Listing Expiring Soon',
      body: 'Your listing will expire in 3 days. Renew now!',
      type: 'expiring_soon',
      category: 'Listing',
      manual: false,
      description: 'Sent automatically 3 days before expiry',
    },
    {
      title: '✅ Payment Successful',
      body: 'Your payment has been processed successfully!',
      type: 'payment_success',
      category: 'Payment',
      manual: false,
      description: 'Sent automatically after payment completes',
    },
    {
      title: '📄 Invoice Generated',
      body: 'Your invoice is ready. Tap to view.',
      type: 'invoice_generated',
      category: 'Payment',
      manual: false,
      description: 'Sent automatically when invoice is created',
    },
    {
      title: '📅 Subscription Renewal',
      body: 'Your subscription expires in 5 days. Renew now!',
      type: 'subscription_renewal',
      category: 'Subscription',
      manual: false,
      description: 'Sent automatically 5 days before renewal',
    },
    {
      title: '✅ Account Verified',
      body: 'Your account has been verified successfully!',
      type: 'account_update',
      category: 'Account',
    },
  ];

  const applyTemplate = (template: NotificationTemplate) => {
    setTitle(template.title);
    setBody(template.body);
    setNotificationType(template.type);
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Push Notifications</h1>
        <p className="text-slate-300">Send push notifications to your users</p>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Active Devices</p>
                <p className="text-3xl font-bold mt-1">{stats.activeTokens.toLocaleString()}</p>
              </div>
              <Bell size={32} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Buyers</p>
                <p className="text-3xl font-bold mt-1">{stats.buyers.toLocaleString()}</p>
              </div>
              <ShoppingBag size={32} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Sellers</p>
                <p className="text-3xl font-bold mt-1">{stats.sellers.toLocaleString()}</p>
              </div>
              <Users size={32} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Total Sent</p>
                <p className="text-3xl font-bold mt-1">{stats.totalSent.toLocaleString()}</p>
              </div>
              <TrendingUp size={32} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm font-medium">Total Devices</p>
                <p className="text-3xl font-bold mt-1">{stats.totalTokens.toLocaleString()}</p>
              </div>
              <Bell size={32} className="opacity-80" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Notification Form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Send size={24} className="text-blue-600" />
            Send Notification
          </h2>

          {/* Quick Templates */}
          <div className="mb-6 space-y-4">
            {/* Manual Templates */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                📤 Manual Templates
                <span className="ml-2 text-xs font-normal text-slate-500">
                  (You send these)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                {quickTemplates
                  .filter((template) => template.manual)
                  .map((template, index) => (
                    <button
                      key={index}
                      onClick={() => applyTemplate(template)}
                      className="text-left p-3 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 group-hover:text-blue-600">
                            {template.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 line-clamp-1">{template.body}</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full ml-2 flex-shrink-0 font-semibold">
                          {template.category}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Auto Templates */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                🤖 Auto-Triggered
                <span className="ml-2 text-xs font-normal text-slate-500">
                  (System sends automatically)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                {quickTemplates
                  .filter((template) => !template.manual)
                  .map((template, index) => (
                    <div
                      key={index}
                      className="text-left p-3 border-2 border-slate-300 rounded-lg bg-slate-50 text-sm opacity-75"
                      title={template.description}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-600">
                            {template.title}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 line-clamp-1">{template.body}</div>
                          {template.description && (
                            <div className="text-[10px] text-slate-500 mt-1 italic">
                              ℹ️ {template.description}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full ml-2 flex-shrink-0 font-semibold">
                          {template.category}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Target Audience */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Target Audience
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setUserType('all')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                  userType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => setUserType('buyer')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                  userType === 'buyer'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Buyers
              </button>
              <button
                onClick={() => setUserType('seller')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                  userType === 'seller'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sellers
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Title
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter notification title"
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
              maxLength={100}
            />
            <div className="text-xs text-slate-500 mt-1">{title.length}/100</div>
          </div>

          {/* Body */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Message
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter notification message"
              rows={4}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              maxLength={200}
            />
            <div className="text-xs text-slate-500 mt-1">{body.length}/200</div>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border-2 border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <Check size={20} />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={20} />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSendNotification}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={20} />
                Send Notification
              </>
            )}
          </button>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Bell size={24} className="text-purple-600" />
            Recent Notifications
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Bell size={48} className="mx-auto mb-3 opacity-30" />
              <p>No notifications sent yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border-2 border-slate-100 rounded-lg hover:border-slate-200 transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">{log.title}</div>
                      <div className="text-sm text-slate-600 mt-1">{log.body}</div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        log.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        👥 {log.userType === 'all' ? 'All Users' : log.userType}
                      </span>
                      <span>📤 {log.sentCount} sent</span>
                    </div>
                    <span>{new Date(log.sentAt).toLocaleString()}</span>
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
