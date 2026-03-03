import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import './index.css';
import Landing from './features/landing/pages/Landing';
import Features from './features/landing/pages/Features';
import Contact from './features/landing/pages/Contact';
import AdminLayout from './features/admin/pages/AdminLayout';
import DashboardPage from './features/admin/pages/DashboardPage';
import ListingsPage from './features/admin/pages/ListingsPage';
import UsersPage from './features/admin/pages/UsersPage';
import SubscriptionsPage from './features/admin/pages/SubscriptionsPage';
import SpamDetectionPage from './features/admin/pages/SpamDetectionPage';
import VideoManagementPage from './features/admin/pages/VideoManagementPage';
import CouponsPage from './features/admin/pages/CouponsPage';
import BannersPage from './features/admin/pages/BannersPage';
import PushNotificationsPage from './features/admin/pages/PushNotificationsPage';
import InAppNotificationsPage from './features/admin/pages/InAppNotificationsPage';
import RevenuePage from './features/admin/pages/RevenuePage';
import ReportsPage from './features/admin/pages/ReportsPage';
import SettingsPage from './features/admin/pages/SettingsPage';
import AdminLogin from './features/admin/pages/AdminLogin';
import { ProtectedRoute } from './shared/components/ProtectedRoute';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/features" element={<Features />} />
          <Route path="/contact" element={<Contact />} />
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
            <Route path="users" element={<UsersPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="spam" element={<SpamDetectionPage />} />
            <Route path="videos" element={<VideoManagementPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="push" element={<PushNotificationsPage />} />
            <Route path="in-app" element={<InAppNotificationsPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
