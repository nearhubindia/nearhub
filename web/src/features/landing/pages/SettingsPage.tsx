import { useState, type ReactElement } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Bell, Mail, MapPinned, LogOut, User, FileText, CreditCard, Heart } from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import {
  clearStoredWebAuth,
  readStoredWebUser,
  writeStoredWebUser,
  type StoredWebUser,
} from '@/lib/web-auth-storage';

type StoredUser = StoredWebUser;

function readStoredUser(): StoredUser | null {
  return readStoredWebUser();
}

function writeStoredUser(user: StoredUser) {
  writeStoredWebUser(user);
}

function ToggleRow({
  icon,
  title,
  value,
  onChange,
}: {
  icon: ReactElement;
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {icon}
        {title}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`h-7 w-12 rounded-full p-1 transition ${value ? 'bg-[#1e5da8]' : 'bg-slate-300'}`}
      >
        <span className={`block h-5 w-5 rounded-full bg-white transition ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export default function SettingsPage(): ReactElement {
  const navigate = useNavigate();
  const user = readStoredUser();

  const [notifications, setNotifications] = useState(Boolean(user?.preferences?.notifications ?? true));
  const [emailNotifications, setEmailNotifications] = useState(Boolean(user?.preferences?.emailNotifications ?? true));
  const [autoLocalize, setAutoLocalize] = useState(Boolean(user?.preferences?.autoLocalizeListings ?? true));

  if (!user?.id) return <Navigate to="/auth/register" replace />;

  const persistPrefs = (next: Partial<StoredUser['preferences']>) => {
    const updated: StoredUser = {
      ...user,
      preferences: {
        notifications,
        emailNotifications,
        autoLocalizeListings: autoLocalize,
        ...(user.preferences || {}),
        ...next,
      },
    };
    writeStoredUser(updated);
  };

  const handleLogout = () => {
    clearStoredWebAuth();
    navigate('/auth/register');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="mx-auto max-w-3xl px-4 pb-14 pt-28 sm:px-6">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#113965]">Settings</h1>
            <Link to="/browse" className="text-sm font-semibold text-[#1e5da8] hover:underline">Back to Browse</Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">{user.name || 'User'} • +91 {user.phone || '-'}</p>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Account</h2>
          <div className="space-y-2">
            <Link to="/profile" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><User size={15} /> My Profile</Link>
            <Link to="/my-listings" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><MapPinned size={15} /> My Listings</Link>
            <Link to="/saved" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Heart size={15} /> Favourites</Link>
            <Link to="/subscriptions" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><CreditCard size={15} /> Subscriptions</Link>
            <Link to="/invoices" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileText size={15} /> Invoices</Link>
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Preferences</h2>
          <div className="space-y-2">
            <ToggleRow
              icon={<Bell size={16} />}
              title="Push Notifications"
              value={notifications}
              onChange={(value) => {
                setNotifications(value);
                persistPrefs({ notifications: value });
              }}
            />
            <ToggleRow
              icon={<Mail size={16} />}
              title="Email Notifications"
              value={emailNotifications}
              onChange={(value) => {
                setEmailNotifications(value);
                persistPrefs({ emailNotifications: value });
              }}
            />
            <ToggleRow
              icon={<MapPinned size={16} />}
              title="Auto Localize Listings"
              value={autoLocalize}
              onChange={(value) => {
                setAutoLocalize(value);
                persistPrefs({ autoLocalizeListings: value });
              }}
            />
          </div>
        </section>

        <section className="mt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700"
          >
            <LogOut size={16} /> Logout
          </button>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
