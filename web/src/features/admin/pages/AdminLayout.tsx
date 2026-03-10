import { useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  Menu,
  ChevronLeft,
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
  BarChart3,
  Settings,
  Bell,
  Inbox,
  Image,
  MessagesSquare,
} from 'lucide-react';
import { useListings } from '@/features/admin/hooks';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: pendingListingsData } = useListings({ status: 'pending', limit: 500 });

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
    { path: '/admin/push', name: 'Push Nfns', icon: Bell },
    { path: '/admin/in-app', name: 'In-App Nfns', icon: Inbox },
    { path: '/admin/contact-submissions', name: 'Enquries', icon: MessagesSquare },
    { path: '/admin/revenue', name: 'Revenue', icon: CircleDollarSign },
    { path: '/admin/reports', name: 'Reports', icon: BarChart3 },
    { path: '/admin/settings', name: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-slate-900 to-slate-950 text-white transition-all duration-300 flex flex-col shadow-2xl`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-700">
          {sidebarOpen && (
            <span className="text-xl font-black bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              nearhub Admin
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded transition cursor-pointer"
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-semibold cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.name}</span>
                    {item.path === '/admin/listings/pending' && pendingCount > 0 && (
                      <span className="ml-2 min-w-6 h-6 px-2 rounded-full bg-amber-500 text-slate-900 text-xs font-black inline-flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                )}
                {!sidebarOpen && item.path === '/admin/listings/pending' && pendingCount > 0 && (
                  <span className="absolute right-2 top-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black inline-flex items-center justify-center">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-700 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600/20 hover:text-red-400 transition font-semibold cursor-pointer"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
