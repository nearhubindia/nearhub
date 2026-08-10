import { lazy } from 'react';

// Public feature API: routes consume lazy page modules from this barrel.
export const UserHomePage = lazy(() => import('./pages/UserHomePage'));
export const Features = lazy(() => import('./pages/Features'));
export const AiMobileValuatorPage = lazy(() => import('./pages/AiMobileValuatorPage'));
export const Contact = lazy(() => import('./pages/Contact'));
export const BrowseListings = lazy(() => import('./pages/BrowseListings'));
export const DealsPage = lazy(() => import('./pages/DealsPage'));
export const AuthRegister = lazy(() => import('./pages/AuthRegister'));
export const AuthVerifyOtp = lazy(() => import('./pages/AuthVerifyOtp'));
export const ProfilePage = lazy(() => import('./pages/ProfilePage'));
export const MyListingsPage = lazy(() => import('./pages/MyListingsPage'));
export const CreateListingPage = lazy(() => import('./pages/CreateListingPage'));
export const SavedPage = lazy(() => import('./pages/SavedPage'));
export const MessagesPage = lazy(() => import('./pages/MessagesPage'));
export const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
export const DealInboxPage = lazy(() => import('./pages/DealInboxPage'));
export const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));
export const UserSubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
export const SubscriptionsDeepLink = lazy(() => import('./pages/SubscriptionsDeepLink'));
export const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
export const UserSettingsPage = lazy(() => import('./pages/SettingsPage'));
export const ConversationPage = lazy(() => import('./pages/ConversationPage'));
export const FooterPage = lazy(() => import('./pages/FooterPage'));
export const CompliancePage = lazy(() => import('./pages/CompliancePage'));
export const ListingDetailsPage = lazy(() => import('./pages/ListingDetailsPage'));
export const OrderSummaryPage = lazy(() => import('./pages/OrderSummaryPage'));
export const NotFound = lazy(() => import('./pages/NotFound'));
export const EditListingPage = lazy(() => import('./pages/EditListingPage'));

export * from './components';
export * from './lib';
export * from './pages/Landing';
