import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Users,
  LayoutDashboard,
  FileText,
  CreditCard,
  AlertTriangle,
  Clock3,
  Film,
  Tag,
  CircleDollarSign,
  HandCoins,
  BarChart3,
  Settings,
  Bell,
  Image,
  MessagesSquare,
  Bug,
  X,
} from 'lucide-react';
import { useListings } from '@/features/admin/hooks';

const MOBILE_QUERY = '(max-width: 1023px)';

export default function AdminLayout() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia(MOBILE_QUERY).matches
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { data: pendingListingsData } = useListings({ status: 'pending', limit: 500 });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);

    const handleViewportChange = (event: MediaQueryListEvent): void => {
      setIsMobile(event.matches);
      setSidebarOpen(!event.matches);
    };

    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = sidebarOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, sidebarOpen]);

  const pendingCount = Array.isArray(pendingListingsData?.data)
    ? pendingListingsData.data.length
    : Array.isArray(pendingListingsData?.listings)
      ? pendingListingsData.listings.length
      : 0;

  const handleLogout = (): void => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/listings', name: 'Listings', icon: FileText },
    { path: '/admin/listings/pending', name: 'Approvals', icon: Clock3 },
    { path: '/admin/users', name: 'Users', icon: Users },
    { path: '/admin/subscriptions', name: 'Subscriptions', icon: CreditCard },
    { path: '/admin/spam', name: 'Spam Detection', icon: AlertTriangle },
    { path: '/admin/videos', name: 'Video Mgt', icon: Film },
    { path: '/admin/coupons', name: 'Coupons', icon: Tag },
    { path: '/admin/banners', name: 'Banners', icon: Image },
    { path: '/admin/notifications', name: 'Notifications', icon: Bell },
    { path: '/admin/contact-submissions', name: 'Enquries', icon: MessagesSquare },
    { path: '/admin/error-logs', name: 'Error Logs', icon: Bug },
    { path: '/admin/revenue', name: 'Revenue', icon: CircleDollarSign },
    { path: '/admin/transactions', name: 'Transactions', icon: HandCoins },
    { path: '/admin/reports', name: 'Reports', icon: BarChart3 },
    { path: '/admin/settings', name: 'Settings', icon: Settings },
    { path: '/admin/master-data', name: 'Master Data', icon: Tag },
  ];

  const isExpanded = isMobile || sidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {isMobile && sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45"
        />
      )}

      {/* Sidebar */}
        <div
          className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-[min(84vw,18rem)] transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : sidebarOpen
              ? 'w-64'
              : 'w-20'
        } bg-gradient-to-b from-slate-900 to-slate-950 text-white transition-all duration-300 flex flex-col shadow-2xl overflow-hidden`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-700">
          {isExpanded && (
            <span className="text-xl font-black bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              nearhub Admin
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 text-slate-200 shadow-[0_8px_18px_-12px_rgba(2,132,199,0.8)] backdrop-blur transition hover:border-cyan-400/45 hover:bg-slate-800 hover:text-white"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
          >
            {isMobile ? (
              <X size={18} strokeWidth={2.2} />
            ) : sidebarOpen ? (
              <PanelLeftClose size={18} strokeWidth={2.2} />
            ) : (
              <PanelLeftOpen size={18} strokeWidth={2.2} />
            )}
          </button>
        </div>

        <nav
          className={`admin-sidebar-scrollbar flex-1 overflow-y-auto py-6 space-y-2 ${
            isExpanded ? 'px-4' : 'px-2'
          }`}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) {
                    setSidebarOpen(false);
                  }
                }}
                className={`relative w-full flex items-center rounded-lg transition font-semibold cursor-pointer ${
                  isExpanded ? 'gap-3 px-4 py-3 justify-start' : 'justify-center px-2 py-3'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={22} strokeWidth={2.2} />
                {isExpanded && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.name}</span>
                    {item.path === '/admin/listings/pending' && pendingCount > 0 && (
                      <span className="ml-2 min-w-6 h-6 px-2 rounded-full bg-amber-500 text-slate-900 text-xs font-black inline-flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                )}
                {!isExpanded && item.path === '/admin/listings/pending' && pendingCount > 0 && (
                  <span className="absolute right-2 top-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black inline-flex items-center justify-center">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-700 p-4">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center rounded-lg transition font-semibold cursor-pointer ${
              isExpanded
                ? 'gap-3 px-4 py-3 justify-start text-slate-300 hover:bg-red-600/20 hover:text-red-400'
                : 'justify-center px-2 py-3 text-slate-200 hover:bg-red-600/20 hover:text-red-400'
            }`}
          >
            <LogOut size={22} strokeWidth={2.2} />
            {isExpanded && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {isMobile && (
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <span className="truncate text-sm font-bold text-slate-800">nearhub Admin</span>
          </div>
        )}

        <div className="admin-typography min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
