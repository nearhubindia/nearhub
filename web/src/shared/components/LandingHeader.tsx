import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Search,
  Pin,
  MapPin,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  FileText,
  Heart,
  Inbox,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Settings,
  UserRoundPen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import {
  clearStoredWebAuth,
  getMeaningfulWebUserName,
  readStoredWebUser,
  WEB_AUTH_CHANGED_EVENT,
  writeStoredWebUser,
  type StoredWebUser,
} from '@/lib/web-auth-storage';
import { Logo } from './Logo';
import { Container } from './Container';

type NavKey = 'home' | 'features' | 'browse' | 'deals' | 'contact';

interface LandingHeaderProps {
  active: NavKey;
}

type InAppNotification = {
  id: string;
  title: string;
  message: string;
  category?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  isRead?: boolean;
  createdAt?: string;
};

function isTransientLocationValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'detecting location...' ||
    normalized === 'location unavailable' ||
    normalized === 'allow location access' ||
    normalized === 'current location lookup failed'
  );
}

function readPersistedHeaderState(key: string): {
  query?: string;
  location?: string;
  geo?: { latitude: number; longitude: number } | null;
} | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      query?: string;
      location?: string;
      geo?: { latitude: number; longitude: number } | null;
    } | null;
    if (!parsed) return null;
    return parsed;
  } catch {
    return null;
  }
}

function navLinkClass(isActive: boolean): string {
  return isActive
    ? 'relative text-[#0759e6] after:absolute after:-bottom-3 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[#0759e6]'
    : 'text-slate-700 transition hover:text-[#0759e6]';
}

function formatNotificationTime(timestamp?: string): string {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LandingHeader({ active }: LandingHeaderProps): ReactElement {
  const queryClient = useQueryClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [user, setUser] = useState<StoredWebUser | null>(null);
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const HEADER_PERSIST_KEY = 'nearhub:header:inputs:v1';
  const hydratedRef = useRef(false);
  const appendSearch = (path: string) => `${path}${routerLocation.search || ''}`;
  const persistedHeaderStateRef = useRef(readPersistedHeaderState(HEADER_PERSIST_KEY));
  const persistedHeaderState = persistedHeaderStateRef.current;

  // Search & location (moved from pages)
  const [query, setQuery] = useState(() => {
    const restored = persistedHeaderState?.query || '';
    return restored;
  });
  const [location, setLocation] = useState(() => {
    const restored = persistedHeaderState?.location || '';
    return isTransientLocationValue(restored) ? '' : restored;
  });
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(() => {
    const geo = persistedHeaderState?.geo;
    return geo && typeof geo.latitude === 'number' && typeof geo.longitude === 'number'
      ? { latitude: geo.latitude, longitude: geo.longitude }
      : null;
  });
  const [isLocating, setIsLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ display: string; lat?: number; lon?: number }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationQuery, setLocationQuery] = useState(() => {
    const restored = persistedHeaderState?.location || '';
    return isTransientLocationValue(restored) ? '' : restored;
  });
  const suggestionRequestRef = useRef(0);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const persistHeaderState = (next: {
    query?: string;
    location?: string;
    geo?: { latitude: number; longitude: number } | null;
  }) => {
    try {
      localStorage.setItem(
        HEADER_PERSIST_KEY,
        JSON.stringify({
          query: next.query || '',
          location: next.location || '',
          geo: next.geo || null,
        })
      );
    } catch {
      // ignore quota/security errors
    }
  };

  useEffect(() => {
    const refreshUser = () => {
      setUser(readStoredWebUser());
    };

    refreshUser();
    window.addEventListener('storage', refreshUser);
    window.addEventListener(WEB_AUTH_CHANGED_EVENT, refreshUser);
    return () => {
      window.removeEventListener('storage', refreshUser);
      window.removeEventListener(WEB_AUTH_CHANGED_EVENT, refreshUser);
    };
  }, []);

  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const userName = getMeaningfulWebUserName(user?.name);
  const isLoggedIn = useMemo(() => Boolean(userId || userPhone), [userId, userPhone]);
  const userLabel = userName || userPhone || 'User';
  const userAvatarUrl = String(user?.avatarUrl || '').trim();
  const userInitial = userLabel.charAt(0).toUpperCase();
  const notificationHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(userPhone ? { 'x-user-phone': userPhone } : {}),
    }),
    [userId, userPhone]
  );

  const notificationsQuery = useQuery({
    queryKey: ['header-push-notifications', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/notifications?userId=${encodeURIComponent(userId)}&limit=50`,
        { headers: notificationHeaders }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || payload.error || 'Failed to load notifications');
      }
      return (payload.data || []) as InAppNotification[];
    },
    refetchInterval: 30_000,
  });

  const profileQuery = useQuery({
    queryKey: ['header-user-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/users/profile`, {
        headers: notificationHeaders,
      });
      const payload = (await response.json().catch(() => ({}))) as StoredWebUser & {
        success?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load profile');
      }
      return payload;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile || !user) return;
    const nextName = getMeaningfulWebUserName(profile.name);
    if (!nextName || nextName === userName) return;
    writeStoredWebUser({ ...user, ...profile, name: nextName });
  }, [profileQuery.data, user, userName]);

  const submitSearch = (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (location.trim()) params.set('location', location.trim());
    if (geoCoords) {
      params.set('latitude', String(geoCoords.latitude));
      params.set('longitude', String(geoCoords.longitude));
      params.set('radius', '50');
    }
    persistHeaderState({ query, location, geo: geoCoords });
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Keep header inputs in sync with URL params so values persist after navigation
  useEffect(() => {
    try {
      const params = new URLSearchParams(routerLocation.search);
      const hasQ = params.has('q');
      const hasLocationParam = params.has('location');
      const hasLat = params.has('latitude');
      const hasLon = params.has('longitude');

      if (hasQ || hasLocationParam || hasLat || hasLon) {
        if (hasQ) {
          setQuery(params.get('q') || '');
        }
        if (hasLocationParam) {
          const loc = params.get('location') || '';
          if (isTransientLocationValue(loc)) {
            setLocation('');
            setLocationQuery('');
          } else {
            setLocation(loc);
            setLocationQuery(loc);
          }
          setShowSuggestions(false);
        }
        // Only set geo coords if both latitude and longitude present
        if (hasLat && hasLon) {
          const lat = params.get('latitude');
          const lon = params.get('longitude');
          if (lat && lon) setGeoCoords({ latitude: Number(lat), longitude: Number(lon) });
        }
        return;
      }

      // No URL params — try restoring from localStorage
      const raw = localStorage.getItem(HEADER_PERSIST_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            query?: string;
            location?: string;
            geo?: { latitude: number; longitude: number } | null;
          } | null;
          if (parsed) {
            if (typeof parsed.query === 'string') setQuery(parsed.query);
            if (typeof parsed.location === 'string') {
              if (isTransientLocationValue(parsed.location)) {
                setLocation('');
                setLocationQuery('');
              } else {
                setLocation(parsed.location);
                setLocationQuery(parsed.location);
              }
              setShowSuggestions(false);
            }
            if (
              parsed.geo &&
              typeof parsed.geo.latitude === 'number' &&
              typeof parsed.geo.longitude === 'number'
            ) {
              setGeoCoords({ latitude: parsed.geo.latitude, longitude: parsed.geo.longitude });
            } else {
              setGeoCoords(null);
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch {
      // ignore
    }

    // Allow the persistence effect to start writing after the initial restore pass.
    hydratedRef.current = true;
  }, [routerLocation.search]);

  // Keep the URL in sync with the current header state so a full refresh restores it reliably.
  useEffect(() => {
    if (!hydratedRef.current) return;

    const params = new URLSearchParams(routerLocation.search);
    const nextQ = query.trim();
    const nextLocation = isTransientLocationValue(location) ? '' : location.trim();

    if (nextQ) params.set('q', nextQ);
    else params.delete('q');

    if (nextLocation) params.set('location', nextLocation);
    else params.delete('location');

    if (geoCoords) {
      params.set('latitude', String(geoCoords.latitude));
      params.set('longitude', String(geoCoords.longitude));
      params.set('radius', '50');
    } else {
      params.delete('latitude');
      params.delete('longitude');
      params.delete('radius');
    }

    const nextSearch = params.toString();
    const currentSearch = routerLocation.search.replace(/^\?/, '');
    if (nextSearch === currentSearch) return;

    navigate(
      { pathname: routerLocation.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true }
    );
  }, [geoCoords, location, navigate, query, routerLocation.pathname, routerLocation.search]);

  // Persist header inputs to localStorage so they survive full page reloads
  useEffect(() => {
    if (!hydratedRef.current) return;
    const toSave = { query: query || '', location: location || '', geo: geoCoords || null };
    try {
      localStorage.setItem(HEADER_PERSIST_KEY, JSON.stringify(toSave));
    } catch {
      // ignore quota errors
    }
  }, [query, location, geoCoords]);

  // Location autocomplete using internal city search API
  useEffect(() => {
    const q = locationQuery.trim();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const id = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = id;

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${getApiUrl()}/api/location/cities/search?q=${encodeURIComponent(q)}&limit=6`
        );
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        if (suggestionRequestRef.current !== id) return;
        const data = Array.isArray(payload.data) ? payload.data : [];
        setSuggestions(
          data.map((entry: any) => ({
            display: `${entry.locationName}${entry.city ? `, ${entry.city}` : ''}${entry.state ? `, ${entry.state}` : ''}${entry.pincode ? ` - ${entry.pincode}` : ''}`,
            lat: Number(entry.latitude) || undefined,
            lon: Number(entry.longitude) || undefined,
          }))
        );
      } catch {
        // ignore
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!suggestionsRef.current) return;
      if (!suggestionsRef.current.contains(ev.target as Node)) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener('click', onDocClick);
    return () => window.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    setShowSuggestions(false);
  }, [routerLocation.pathname]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoCoords(null);
      setIsLocating(false);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setGeoCoords({ latitude, longitude });

        try {
          const response = await fetch(
            `${getApiUrl()}/api/location/reverse-geocode?latitude=${encodeURIComponent(
              String(latitude)
            )}&longitude=${encodeURIComponent(String(longitude))}`
          );
          const payload = (await response.json().catch(() => ({}))) as {
            success?: boolean;
            data?: {
              locationName?: string;
              locality?: string;
              city?: string;
              state?: string;
              pincode?: string;
            };
          };
          const resolvedLocation = payload.data
            ? `${payload.data.locationName || payload.data.locality || payload.data.city || ''}`
            : '';

          const nextLocation = resolvedLocation || 'Current location';
          setLocation(nextLocation);
          persistHeaderState({
            query,
            location: nextLocation,
            geo: { latitude, longitude },
          });
        } catch {
          // Keep the existing selection if reverse geocoding fails.
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setGeoCoords(null);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  };

  const pushNotifications = useMemo(
    () =>
      [...(notificationsQuery.data || [])]
        .filter((item) => item.category !== 'message' && item.category !== 'deal_purchase')
        .sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        ),
    [notificationsQuery.data]
  );
  const unreadNotificationCount = pushNotifications.filter((item) => !item.isRead).length;

  const handleLogout = () => {
    clearStoredWebAuth();
    setUser(null);
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!userId) return;
    setNotificationMessage('');
    try {
      const response = await fetch(
        `${getApiUrl()}/api/notifications/${encodeURIComponent(notificationId)}/read`,
        {
          method: 'POST',
          headers: notificationHeaders,
          body: JSON.stringify({ userId }),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setNotificationMessage(
          payload.message || payload.error || 'Failed to mark notification read'
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['header-push-notifications', userId] });
    } catch {
      setNotificationMessage('Failed to mark notification read');
    }
  };

  const menuItems: Array<{ label: string; to: string; icon: LucideIcon }> = [
    { label: 'My Profile', to: '/profile', icon: UserRoundPen },
    { label: 'My Listings', to: '/my-listings', icon: ListChecks },
    { label: 'Bookings', to: '/bookings', icon: Package },
    { label: 'Favourites', to: '/saved', icon: Heart },
    { label: 'Messages', to: '/messages', icon: MessageCircle },
    { label: 'Deals Purchased', to: '/deal-inbox', icon: Inbox },
    { label: 'Subscriptions', to: '/subscriptions', icon: CreditCard },
    { label: 'Invoices', to: '/invoices', icon: FileText },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <Container className="flex h-[82px] items-center justify-between gap-4">
        <Link to="/" onClick={() => setIsMenuOpen(false)} className="shrink-0">
          <Logo size="md" />
        </Link>

        <form onSubmit={submitSearch} className="hidden flex-1 items-center gap-4 md:flex">
          <div className="relative flex items-center">
            <MapPin
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#08295e]"
            />
            <input
              ref={locationInputRef}
              value={location}
              onChange={(e) => {
                const nextValue = e.target.value;
                setLocation(nextValue);
                setLocationQuery(nextValue);
                setShowSuggestions(Boolean(nextValue.trim()));
              }}
              onFocus={() => {
                if (locationQuery.trim()) setShowSuggestions(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitSearch();
                }
              }}
              placeholder="Location (city, area)"
              className="h-12 w-60 rounded-full border border-slate-200 bg-white px-10 text-sm font-normal text-slate-800 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] outline-none transition focus:border-[#0759e6] focus:ring-2 focus:ring-[#0759e6]/15"
            />
            <button
              type="button"
              onClick={detectLocation}
              disabled={isLocating}
              className="ml-2 inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-950 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] transition hover:border-[#0759e6] hover:text-[#0759e6] disabled:opacity-60"
              aria-label="Detect location"
            >
              <Pin size={14} className="text-[#0759e6]" />
            </button>
            {showSuggestions && suggestions.length > 0 ? (
              <div
                ref={suggestionsRef}
                className="absolute left-0 top-[110%] z-50 w-56 rounded-md border border-slate-200 bg-white shadow-lg"
              >
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setLocation(s.display);
                      setLocationQuery(s.display);
                      setShowSuggestions(false);
                      const nextGeo =
                        s.lat && s.lon
                          ? { latitude: Number(s.lat), longitude: Number(s.lon) }
                          : null;
                      setGeoCoords(nextGeo);
                      persistHeaderState({ query, location: s.display, geo: nextGeo });
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {s.display}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#08295e]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitSearch();
                }
              }}
              placeholder="Search listings, brands, products near you..."
              className="h-12 w-full rounded-full border border-slate-200 bg-white px-10 text-sm font-normal text-slate-800 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] outline-none transition focus:border-[#0759e6] focus:ring-2 focus:ring-[#0759e6]/15"
            />
          </div>
        </form>

        <nav className="hidden items-center gap-8 text-[15px] font-semibold md:flex">
          <Link to={appendSearch('/')} className={navLinkClass(active === 'home')}>
            Home
          </Link>
          <Link to={appendSearch('/search')} className={navLinkClass(active === 'browse')}>
            Search
          </Link>
          <Link to={appendSearch('/deals')} className={navLinkClass(active === 'deals')}>
            Deals
          </Link>
          <Link to={appendSearch('/contact')} className={navLinkClass(active === 'contact')}>
            Contact
          </Link>
          <Link
            to="/create-listing"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f74ff_0%,#1d4ed8_100%)] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_-16px_rgba(29,78,216,0.8)] transition hover:brightness-105"
          >
            <span className="text-lg leading-none">+</span>
            Create Listing
          </Link>
          {isLoggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen((prev) => !prev);
                  setIsUserMenuOpen(false);
                }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] transition hover:border-[#0759e6] hover:text-[#0759e6]"
                aria-label="Notifications"
              >
                <Bell size={19} />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                ) : null}
              </button>
              {isNotificationsOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">Notifications</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                      {unreadNotificationCount} unread
                    </span>
                  </div>
                  {notificationMessage ? (
                    <p className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {notificationMessage}
                    </p>
                  ) : null}
                  {notificationsQuery.isLoading ? (
                    <p className="rounded-md bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-600">
                      Loading notifications...
                    </p>
                  ) : null}
                  {notificationsQuery.isError ? (
                    <p className="rounded-md bg-rose-50 px-3 py-4 text-sm font-semibold text-rose-700">
                      Failed to load notifications.
                    </p>
                  ) : null}
                  {!notificationsQuery.isLoading && pushNotifications.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm font-semibold text-slate-600">
                      No notifications yet.
                    </p>
                  ) : null}
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {pushNotifications.map((notification) => {
                      const content = (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-black text-slate-950">
                              {notification.title}
                            </p>
                            {!notification.isRead ? (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0759e6]" />
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-[11px] font-semibold text-slate-400">
                            {formatNotificationTime(notification.createdAt)}
                          </p>
                        </div>
                      );

                      return (
                        <article
                          key={notification.id}
                          className={`rounded-md border p-3 ${
                            notification.isRead
                              ? 'border-slate-200 bg-white'
                              : 'border-[#0759e6]/25 bg-blue-50/45'
                          }`}
                        >
                          {notification.actionUrl ? (
                            <Link
                              to={notification.actionUrl}
                              onClick={() => setIsNotificationsOpen(false)}
                              className="block"
                            >
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                          {!notification.isRead ? (
                            <button
                              type="button"
                              onClick={() => void markNotificationRead(notification.id)}
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#0759e6] hover:underline"
                            >
                              <CheckCircle2 size={13} /> Mark read
                            </button>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsUserMenuOpen((prev) => !prev);
                setIsNotificationsOpen(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-950 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] transition hover:border-[#0759e6] hover:shadow-md"
            >
              <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-[#0759e6] ring-1 ring-slate-200">
                {isLoggedIn && userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userLabel} className="h-full w-full object-cover" />
                ) : (
                  <CircleUserRound size={18} />
                )}
                {isLoggedIn ? (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                ) : null}
              </span>
              {isLoggedIn ? userLabel : 'User'}
            </button>
            {isUserMenuOpen ? (
              <div className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_22px_50px_-26px_rgba(15,23,42,0.55)]">
                {isLoggedIn ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-sm font-black text-[#0759e6] ring-1 ring-slate-200">
                        {userAvatarUrl ? (
                          <img
                            src={userAvatarUrl}
                            alt={userLabel}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          userInitial
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{userLabel}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {userPhone ? `+91 ${userPhone}` : 'NearHub account'}
                        </p>
                      </div>
                    </div>
                    <div className="mx-4 h-px bg-slate-200" />
                    <div className="px-3 py-2">
                      {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.label}
                            to={item.to}
                            onClick={() => setIsUserMenuOpen(false)}
                            className="group flex h-11 items-center gap-3 rounded-md px-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-[#0759e6]">
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <ChevronRight
                              size={17}
                              className="text-slate-400 transition group-hover:text-[#0759e6]"
                            />
                          </Link>
                        );
                      })}
                    </div>
                    <div className="mx-4 h-px bg-slate-200" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="group m-3 flex h-11 w-[calc(100%-1.5rem)] items-center gap-3 rounded-md px-2 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                        <LogOut size={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">Logout</span>
                      <ChevronRight
                        size={17}
                        className="text-red-300 transition group-hover:text-red-600"
                      />
                    </button>
                  </>
                ) : (
                  <Link
                    to="/auth/register"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="m-3 flex h-11 items-center gap-3 rounded-md px-2 text-sm font-bold text-[#0759e6] transition hover:bg-blue-50"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50">
                      <LogIn size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">Sign In / Register</span>
                    <ChevronRight size={17} />
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-800 md:hidden"
          aria-label="Toggle navigation menu"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          {isMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </Container>

      {isMenuOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <Container className="flex flex-col gap-2 text-sm font-semibold">
            <Link
              to={appendSearch('/')}
              className="rounded-md px-3 py-2 text-slate-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to={appendSearch('/search')}
              className="rounded-md px-3 py-2 text-slate-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Search
            </Link>
            <Link
              to={appendSearch('/deals')}
              className="rounded-md px-3 py-2 text-slate-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Deals
            </Link>
            <Link
              to={appendSearch('/contact')}
              className="rounded-md px-3 py-2 text-slate-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            <Link
              to="/create-listing"
              className="rounded-md bg-[#0759e6] px-3 py-2 text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              Create Listing
            </Link>
            <Link
              to={isLoggedIn ? '/bookings' : '/auth/register'}
              className="rounded-md px-3 py-2 text-slate-800"
              onClick={() => setIsMenuOpen(false)}
            >
              {isLoggedIn ? 'Bookings & Notifications' : 'Sign In'}
            </Link>
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  className="flex items-center justify-between rounded-md px-3 py-2 text-left text-slate-800"
                  onClick={() => setIsNotificationsOpen((prev) => !prev)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Bell size={16} /> Notifications
                  </span>
                  {unreadNotificationCount > 0 ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  ) : null}
                </button>
                {isNotificationsOpen ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    {notificationsQuery.isLoading ? (
                      <p className="text-sm font-semibold text-slate-600">
                        Loading notifications...
                      </p>
                    ) : null}
                    {!notificationsQuery.isLoading && pushNotifications.length === 0 ? (
                      <p className="text-sm font-semibold text-slate-600">No notifications yet.</p>
                    ) : null}
                    <div className="space-y-2">
                      {pushNotifications.slice(0, 5).map((notification) => (
                        <div
                          key={`mobile-${notification.id}`}
                          className="rounded-md bg-white p-3 text-sm shadow-sm"
                        >
                          <p className="font-black text-slate-950">{notification.title}</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                            {notification.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            {isLoggedIn
              ? menuItems
                  .filter((item) => item.to !== '/bookings')
                  .map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="rounded-md px-3 py-2 text-slate-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))
              : null}
          </Container>
        </div>
      ) : null}
    </header>
  );
}
