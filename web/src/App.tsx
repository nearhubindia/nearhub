import { Suspense, lazy } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import './index.css';
import Landing from './features/landing/pages/Landing';
import Features from './features/landing/pages/Features';
import Contact from './features/landing/pages/Contact';
import FooterPage from './features/landing/pages/FooterPage';
import CompliancePage from './features/landing/pages/CompliancePage';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { SeoManager } from './shared/components/SeoManager';

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
const ContactSubmissionsPage = lazy(
  () => import('./features/admin/pages/ContactSubmissionsPage')
);
const ErrorLogsPage = lazy(() => import('./features/admin/pages/ErrorLogsPage'));
const AdminLogin = lazy(() => import('./features/admin/pages/AdminLogin'));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SeoManager />
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
              Loading...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<CompliancePage pageKey="privacy-policy" />} />
            <Route path="/terms" element={<CompliancePage pageKey="terms" />} />
            <Route path="/refund-policy" element={<CompliancePage pageKey="refund-policy" />} />
            <Route path="/about" element={<CompliancePage pageKey="about" />} />
            <Route path="/payment-security" element={<CompliancePage pageKey="payment-security" />} />
            <Route path="/delete-account" element={<CompliancePage pageKey="delete-account" />} />
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
              <Route path="contact-submissions" element={<ContactSubmissionsPage />} />
              <Route path="error-logs" element={<ErrorLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="/app" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
