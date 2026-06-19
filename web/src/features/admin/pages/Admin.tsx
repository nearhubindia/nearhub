import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronLeft,
  LogOut,
  Users,
  LayoutDashboard,
  FileText,
  CreditCard,
  AlertTriangle,
  Film,
  Tag,
  CircleDollarSign,
  BarChart3,
  Settings,
  Bell,
} from 'lucide-react';

// Import extracted components
import DashboardView from '../components/DashboardView';
import ListingsView from '../components/ListingsView';
import UsersView from '../components/UsersView';
import RevenueView from '../components/RevenueView';
import ReportsView from '../components/ReportsView';
import SettingsView from '../components/SettingsView';
import EditListingModal from '../components/EditListingModal';
import CreateListingModal from '../components/CreateListingModal';
import CouponsView from '../components/CouponsView';
import SubscriptionPlansView from '../components/SubscriptionPlansView';
import SpamDetectionView from '../components/SpamDetectionView';
import VideoManagementView from '../components/VideoManagementView';
import InAppNotificationsView from '../components/InAppNotificationsView';

// Import types and constants
import type { Listing, EditingListing } from '../types/admin-types';

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingListing, setEditingListing] = useState<EditingListing | null>(null);
  // Edit form state is now handled by EditListingModal component

  const navigate = useNavigate();

  const handleLogout = (): void => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  // Listings fetching is now handled by useListings hook in ListingsView component

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
    // Create form state is now handled by CreateListingModal component
  };

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView />;
      case 'listings':
        return <ListingsView onEditListing={openEditModal} onCreateListing={openCreateModal} />;
      case 'users':
        return <UsersView />;
      case 'plans':
        return <SubscriptionPlansView />;
      case 'spam':
        return <SpamDetectionView />;
      case 'videos':
        return <VideoManagementView />;
      case 'coupons':
        return <CouponsView />;
      case 'revenue':
        return <RevenueView />;
      case 'reports':
        return <ReportsView />;
      case 'notifications':
        return <InAppNotificationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
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
          {[
            { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'listings', name: 'Listings', icon: FileText },
            { id: 'users', name: 'Users', icon: Users },
            { id: 'plans', name: 'Subscriptions', icon: CreditCard },
            { id: 'spam', name: 'Spam Detection', icon: AlertTriangle },
            { id: 'videos', name: 'Video Management', icon: Film },
            { id: 'coupons', name: 'Coupons', icon: Tag },
            { id: 'notifications', name: 'Notifications', icon: Bell },
            { id: 'revenue', name: 'Revenue', icon: CircleDollarSign },
            { id: 'reports', name: 'Reports', icon: BarChart3 },
            { id: 'settings', name: 'Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition flex items-center gap-3 font-medium cursor-pointer ${
                  activePage === item.id
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-gradient-to-r hover:from-teal-500/30 hover:to-cyan-500/30 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded transition text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-red-500/30 hover:to-red-400/30 cursor-pointer"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{renderContent()}</div>

      {/* Edit Listing Modal */}
      {showEditModal && editingListing && (
        <EditListingModal listing={editingListing} onClose={closeEditModal} />
      )}

      {/* Create Listing Modal */}
      {showCreateModal && <CreateListingModal onClose={closeCreateModal} />}
    </div>
  );
}
