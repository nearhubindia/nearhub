import { Suspense, lazy, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { CirclePercent, Home, MessageCircle, Plus, UserRound } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { queryClient, enableQueryPersistence } from '@/lib/query-client';
import './index.css';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { SeoManager } from './shared/components/SeoManager';
const UserHomePage = lazy(() => import('./features/landing/pages/UserHomePage'));
const Features = lazy(() => import('./features/landing/pages/Features'));
const Contact = lazy(() => import('./features/landing/pages/Contact'));
const BrowseListings = lazy(() => import('./features/landing/pages/BrowseListings'));
const DealsPage = lazy(() => import('./features/landing/pages/DealsPage'));
const AuthRegister = lazy(() => import('./features/landing/pages/AuthRegister'));
const AuthVerifyOtp = lazy(() => import('./features/landing/pages/AuthVerifyOtp'));
const ProfilePage = lazy(() => import('./features/landing/pages/ProfilePage'));
const MyListingsPage = lazy(() => import('./features/landing/pages/MyListingsPage'));
const CreateListingPage = lazy(() => import('./features/landing/pages/CreateListingPage'));
const SavedPage = lazy(() => import('./features/landing/pages/SavedPage'));
const MessagesPage = lazy(() => import('./features/landing/pages/MessagesPage'));
const NotificationsPage = lazy(() => import('./features/landing/pages/NotificationsPage'));
const DealInboxPage = lazy(() => import('./features/landing/pages/DealInboxPage'));
const MyOrdersPage = lazy(() => import('./features/landing/pages/MyOrdersPage'));
const UserSubscriptionsPage = lazy(() => import('./features/landing/pages/SubscriptionsPage'));
const InvoicesPage = lazy(() => import('./features/landing/pages/InvoicesPage'));
const UserSettingsPage = lazy(() => import('./features/landing/pages/SettingsPage'));
const ConversationPage = lazy(() => import('./features/landing/pages/ConversationPage'));
const FooterPage = lazy(() => import('./features/landing/pages/FooterPage'));
const CompliancePage = lazy(() => import('./features/landing/pages/CompliancePage'));
const ListingDetailsPage = lazy(() => import('./features/landing/pages/ListingDetailsPage'));
const OrderSummaryPage = lazy(() => import('./features/landing/pages/OrderSummaryPage'));
const ShortsDeepLink = lazy(() => import('./features/landing/pages/ShortsDeepLink'));
const NotFound = lazy(() => import('./features/landing/pages/NotFound'));
const EditListingPage = lazy(() => import('./features/landing/pages/EditListingPage'));

const AdminLayout = lazy(() => import('./features/admin/pages/AdminLayout'));
const DashboardPage = lazy(() => import('./features/admin/pages/DashboardPage'));
const ListingsPage = lazy(() => import('./features/admin/pages/ListingsPage'));
const PendingListingsPage = lazy(() => import('./features/admin/pages/PendingListingsPage'));
const UsersPage = lazy(() => import('./features/admin/pages/UsersPage'));
const SubscriptionsPage = lazy(() => import('./features/admin/pages/SubscriptionsPage'));
const SpamDetectionPage = lazy(() => import('./features/admin/pages/SpamDetectionPage'));
const VideoManagementPage = lazy(() => import('./features/admin/pages/VideoManagementPage'));
const CouponsPage = lazy(() => import('./features/admin/pages/CouponsPage'));
const BannersPage = lazy(() => import('./features/admin/pages/BannersPage'));
const PushNotificationsPage = lazy(() => import('./features/admin/pages/PushNotificationsPage'));
const InAppNotificationsPage = lazy(() => import('./features/admin/pages/InAppNotificationsPage'));
const RevenuePage = lazy(() => import('./features/admin/pages/RevenuePage'));
const ReportsPage = lazy(() => import('./features/admin/pages/ReportsPage'));
const TransactionsPage = lazy(() => import('./features/admin/pages/TransactionsPage'));
const SettingsPage = lazy(() => import('./features/admin/pages/SettingsPage'));
const MasterDataManagementPage = lazy(
  () => import('./features/admin/pages/MasterDataManagementPage')
);
const ContactSubmissionsPage = lazy(() => import('./features/admin/pages/ContactSubmissionsPage'));
const ErrorLogsPage = lazy(() => import('./features/admin/pages/ErrorLogsPage'));
const AdminLogin = lazy(() => import('./features/admin/pages/AdminLogin'));

function MobileBottomNav() {
  const location = useLocation();
  const pathname = location.pathname;
  const items = [
    { label: 'Home', to: '/', icon: Home, active: pathname === '/' },
    {
      label: 'Deals',
      to: '/deals',
      icon: CirclePercent,
      active: pathname === '/deals' || pathname === '/deal-inbox' || pathname === '/bookings',
    },
    {
      label: 'Post',
      to: '/create-listing',
      icon: Plus,
      active: pathname === '/create-listing',
      primary: true,
    },
    {
      label: 'Chat',
      to: '/messages',
      icon: MessageCircle,
      active: pathname === '/messages' || pathname.startsWith('/messages/'),
    },
    { label: 'Profile', to: '/profile', icon: UserRound, active: pathname === '/profile' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 shadow-[0_-14px_30px_-24px_rgba(15,23,42,0.7)] backdrop-blur-xl md:hidden">
      <div className="grid h-[76px] grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                item.active ? 'text-[#0759e6]' : 'text-slate-400'
              }`}
              aria-label={item.label}
            >
              <span
                className={`grid place-items-center ${
                  item.primary
                    ? 'h-11 w-11 rounded-full bg-[#0759e6] text-white shadow-[0_10px_24px_-12px_rgba(7,89,230,0.9)]'
                    : item.active
                      ? 'h-8 w-10 rounded-full bg-blue-50 text-[#0759e6]'
                      : 'h-8 w-10 text-slate-400'
                }`}
              >
                <Icon size={item.primary ? 24 : 22} strokeWidth={item.active ? 2.6 : 2.2} />
              </span>
              <span className="max-w-full truncate px-1 leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SplashScreen() {
  return (
    <div className="nearhub-splash min-h-screen bg-[#f8fbff] text-slate-950">
      <div className="nearhub-splash-panel">
        <div className="nearhub-splash-logo-wrap" aria-hidden="true">
          <img src="/nearhub.png" alt="" className="nearhub-splash-logo" />
        </div>
        <div className="nearhub-splash-copy">
          <p className="nearhub-splash-kicker">Hyperlocal Classifieds App</p>
          <h1>NearHub</h1>
          <p>Discover trusted listings and local deals around you.</p>
        </div>
        <div className="nearhub-splash-progress" aria-label="Loading NearHub">
          <span />
        </div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  return null;
}
function RouteTransitionShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = window.setTimeout(() => setIsTransitioning(false), 320);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  return (
    <div
      className={
        (isTransitioning ? 'route-transitioning' : 'route-transitioned') + ' pb-[76px] md:pb-0'
      }
    >
      {isTransitioning ? <div className="route-loading-bar" /> : null}
      {children}
    </div>
  );
}

function App() {
  // enable simple localStorage persistence for react-query cache
  enableQueryPersistence();
  const [showInitialSplash, setShowInitialSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowInitialSplash(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {showInitialSplash ? <SplashScreen /> : null}
        <SeoManager />
        <ScrollToTop />
        <Suspense
          fallback={<SplashScreen />}
        >
          <RouteTransitionShell>
            <Routes>
              <Route path="/" element={<UserHomePage />} />
              <Route path="/features" element={<Features />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/search" element={<BrowseListings />} />
              <Route path="/browse" element={<Navigate to="/search" replace />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/auth/register" element={<AuthRegister />} />
              <Route path="/auth/verify-otp" element={<AuthVerifyOtp />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/my-listings" element={<MyListingsPage />} />
              <Route path="/create-listing" element={<CreateListingPage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="/favourites" element={<SavedPage />} />
              <Route path="/favorites" element={<SavedPage />} />
              <Route path="/orders" element={<Navigate to="/bookings" replace />} />
              <Route path="/bookings" element={<MyOrdersPage />} />
              <Route path="/deal-inbox" element={<DealInboxPage />} />
              <Route path="/edit-listing/:id" element={<EditListingPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/messages/:conversationId" element={<ConversationPage />} />
              <Route path="/subscriptions" element={<UserSubscriptionsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/settings" element={<UserSettingsPage />} />
              <Route path="/privacy-policy" element={<CompliancePage pageKey="privacy-policy" />} />
              <Route path="/terms" element={<CompliancePage pageKey="terms" />} />
              <Route path="/refund-policy" element={<CompliancePage pageKey="refund-policy" />} />
              <Route path="/about" element={<CompliancePage pageKey="about" />} />
              <Route
                path="/payment-security"
                element={<CompliancePage pageKey="payment-security" />}
              />
              <Route path="/delete-account" element={<CompliancePage pageKey="delete-account" />} />
              <Route path="/listing/:id" element={<ListingDetailsPage />} />
              <Route path="/order-summary/:id" element={<OrderSummaryPage />} />
              <Route path="/shorts/:id" element={<ShortsDeepLink />} />
              <Route path="/short/:id" element={<ShortsDeepLink />} />
              <Route path="/footer/:pageKey" element={<FooterPage />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="listings" element={<ListingsPage />} />
                <Route path="listings/pending" element={<PendingListingsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="spam" element={<SpamDetectionPage />} />
                <Route path="videos" element={<VideoManagementPage />} />
                <Route path="coupons" element={<CouponsPage />} />
                <Route path="banners" element={<BannersPage />} />
                <Route path="push" element={<PushNotificationsPage />} />
                <Route path="in-app" element={<InAppNotificationsPage />} />
                <Route path="revenue" element={<RevenuePage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="master-data" element={<MasterDataManagementPage />} />
                <Route path="contact-submissions" element={<ContactSubmissionsPage />} />
                <Route path="error-logs" element={<ErrorLogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="/app" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RouteTransitionShell>
        </Suspense>
        <MobileBottomNav />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
