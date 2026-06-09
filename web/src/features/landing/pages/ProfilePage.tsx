import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { ArrowLeft, Box, Camera, CheckCircle, Hash, Mail, MapPin, Phone, Save, Star, User } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser, writeStoredWebUser, type StoredWebUser } from '@/lib/web-auth-storage';

type StoredUser = StoredWebUser;

type ProfileResponse = {
  success?: boolean;
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  address?: string;
  gstin?: string;
  latitude?: number | null;
  longitude?: number | null;
  error?: string;
  preferences?: {
    searchRadiusKm?: number;
  };
};

type StatsResponse = {
  stats?: {
    totalListings?: number;
    soldListings?: number;
  };
};

function readStoredUser(): StoredUser | null {
  return readStoredWebUser();
}

function completionPercent(values: { name: string; email: string; phone: string; address: string; gstin: string; bio: string; avatarUrl: string }): number {
  const checks = [
    values.name.trim(),
    values.email.trim(),
    values.phone.trim(),
    values.address.trim(),
    values.gstin.trim(),
    values.bio.trim(),
    values.avatarUrl.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: ReactElement;
  children: React.ReactNode;
}): ReactElement {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-normal text-[#113965]">
        {label} {required ? <span className="text-orange-500">*</span> : null}
      </span>
      <span className="flex h-14 items-center gap-3 rounded-[18px] border border-[#d9e6f4] bg-white px-4 text-slate-900 shadow-sm transition focus-within:border-[#1f63b2] focus-within:ring-4 focus-within:ring-[#1f63b2]/10">
        <span className="shrink-0 text-[#8eb2db]">{icon}</span>
        {children}
      </span>
    </label>
  );
}

export default function ProfilePage(): ReactElement {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(() => readStoredUser());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [searchRadiusKm, setSearchRadiusKm] = useState(50);
  const [listingCount, setListingCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const userId = String(storedUser?.id || '').trim();
  const userPhone = String(storedUser?.phone || '').trim();
  const isLoggedIn = Boolean(userId);
  const profileCompletion = completionPercent({ name, email, phone: userPhone, address, gstin, bio, avatarUrl });
  const completionHint = profileCompletion < 100 ? 'Add a bio to reach 100%' : 'Profile is complete';
  const displayName = name.trim() || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-phone': userPhone,
    }),
    [userId, userPhone]
  );

  useEffect(() => {
    const user = readStoredUser();
    setStoredUser(user);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setMessage('');
      try {
        const [profileResponse, statsResponse] = await Promise.all([
          fetch(`${getApiUrl()}/api/users/profile`, { headers: authHeaders }),
          fetch(`${getApiUrl()}/api/users/${encodeURIComponent(userId)}/stats`, { headers: authHeaders }),
        ]);

        const profile = (await profileResponse.json().catch(() => ({}))) as ProfileResponse;
        if (!profileResponse.ok) {
          setMessage(profile.error || 'Failed to load profile');
        } else {
          setName(String(profile.name || storedUser?.name || 'User'));
          setEmail(String(profile.email || storedUser?.email || ''));
          setAddress(String(profile.address || storedUser?.address || ''));
          setGstin(String(profile.gstin || storedUser?.gstin || ''));
          setBio(String(profile.bio || storedUser?.bio || ''));
          setAvatarUrl(String(profile.avatarUrl || storedUser?.avatarUrl || ''));
          setLatitude(
            typeof profile.latitude === 'number'
              ? profile.latitude
              : typeof storedUser?.latitude === 'number'
                ? storedUser.latitude
                : null
          );
          setLongitude(
            typeof profile.longitude === 'number'
              ? profile.longitude
              : typeof storedUser?.longitude === 'number'
                ? storedUser.longitude
                : null
          );
          const preferredRadius = Number(
            profile.preferences?.searchRadiusKm ?? storedUser?.preferences?.searchRadiusKm ?? 50
          );
          setSearchRadiusKm(Number.isFinite(preferredRadius) && preferredRadius > 0 ? preferredRadius : 50);
        }

        if (statsResponse.ok) {
          const stats = (await statsResponse.json().catch(() => ({}))) as StatsResponse;
          setListingCount(Number(stats.stats?.totalListings || 0));
          setSoldCount(Number(stats.stats?.soldListings || 0));
        }
      } catch {
        setMessage('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [authHeaders, storedUser?.address, storedUser?.avatarUrl, storedUser?.bio, storedUser?.email, storedUser?.gstin, storedUser?.name, userId]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image file.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result || ''));
      setMessage('Avatar selected. Save changes to update your profile.');
    };
    reader.onerror = () => setMessage('Failed to read image.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const saveProfile = async () => {
    if (!userId) return;
    if (!name.trim()) {
      setMessage('Name is required');
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage('Please enter a valid email address');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${getApiUrl()}/api/users/${encodeURIComponent(userId)}/profile`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          bio: bio.trim(),
          address: address.trim(),
          gstin: gstin.trim(),
          avatarUrl: avatarUrl.trim(),
          latitude,
          longitude,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string; user?: StoredUser };
      if (!response.ok || !data.success) {
        setMessage(data.error || 'Failed to save profile');
        return;
      }

      const merged = {
        ...(storedUser || {}),
        ...(data.user || {}),
        name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        avatarUrl: avatarUrl.trim(),
        latitude,
        longitude,
        preferences: {
          ...(storedUser?.preferences || {}),
          searchRadiusKm,
        },
      };
      await fetch(`${getApiUrl()}/api/users/${encodeURIComponent(userId)}/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          searchRadiusKm,
          latitude,
          longitude,
          notifications: storedUser?.preferences?.notifications,
          emailNotifications: storedUser?.preferences?.emailNotifications,
          autoLocalize: storedUser?.preferences?.autoLocalizeListings,
        }),
      }).catch(() => null);
      writeStoredWebUser(merged);
      setStoredUser(merged);
      setMessage('Profile updated successfully');
    } catch {
      setMessage('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Location services are not available in this browser');
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setMessage('Location coordinates captured. Save changes to persist them.');
        setIsDetectingLocation(false);
      },
      () => {
        setMessage('Unable to detect current location');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  };

  if (!isLoggedIn) {
    return <Navigate to="/auth/register" replace />;
  }

  return (
    <div className="min-h-screen bg-[#eef4fb] text-slate-950">
      <LandingHeader active="browse" />
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-14 pt-24 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-normal tracking-tight text-slate-950 sm:text-3xl">My Profile</h1>
          <Link
            to="/browse"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#d9e6f4] bg-white px-5 text-sm font-normal text-[#1f63b2] shadow-sm transition hover:border-[#1f63b2]/40"
          >
            <ArrowLeft size={18} /> Back to Browse
          </Link>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-[#d7e4f2] bg-white shadow-[0_26px_70px_-52px_rgba(17,57,101,0.85)]">
          <div className="relative h-28 bg-[#1E5DA8] sm:h-32">
            <div className="absolute inset-y-0 right-0 w-48 bg-[#1f5fa8] opacity-60 sm:w-72" />
            <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-right text-white sm:block">
              <p className="text-sm font-normal uppercase tracking-wide text-blue-100">Welcome Back</p>
              <p className="mt-1 text-lg font-normal">Manage your seller profile</p>
            </div>
            <span className="absolute left-0 top-0 h-full w-2 bg-[#ff850f]" />
          </div>

          <div className="grid gap-8 px-5 pb-8 sm:px-8 lg:grid-cols-[330px_minmax(0,1fr)] lg:px-12">
            <aside className="-mt-16 lg:-mt-20">
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <div className="relative mx-auto h-32 w-32 sm:mx-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-32 w-32 rounded-full border-4 border-white bg-[#113965] object-cover shadow-lg" />
                ) : (
                  <div className="grid h-32 w-32 place-items-center rounded-full border-4 border-white bg-[#113965] text-4xl font-normal text-white shadow-lg">
                    {initial}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1 rounded-full bg-[#ff850f] px-4 text-xs font-normal text-white shadow-md"
                >
                  <Camera size={14} /> Change
                </button>
              </div>

              <h2 className="mt-8 text-center text-2xl font-normal text-slate-950 sm:text-left">{displayName}</h2>

              <div className="mt-7 rounded-[20px] bg-[#e7f0fa] p-5 shadow-inner">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-normal uppercase tracking-wide text-[#113965]">Profile Completion</p>
                  <p className="text-sm font-normal text-[#113965]">{profileCompletion}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#1f63b2_0%,#ff850f_100%)] transition-all"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#113965]">{completionHint}</p>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="flex items-center justify-between rounded-[20px] border border-[#d9e6f4] bg-white p-5 shadow-sm">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e7f0fa] text-[#1f63b2]">
                    <Box size={22} />
                  </span>
                  <span className="flex-1 px-5 text-base font-normal text-[#113965]">Listings</span>
                  <span className="text-2xl font-normal text-slate-950">{listingCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-[20px] border border-[#d9e6f4] bg-white p-5 shadow-sm">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e7f0fa] text-[#113965]">
                    <CheckCircle size={22} />
                  </span>
                  <span className="flex-1 px-5 text-base font-normal text-[#113965]">Sold</span>
                  <span className="text-2xl font-normal text-slate-950">{soldCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-[20px] border border-[#d9e6f4] bg-white p-5 shadow-sm">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-[#ff850f]">
                    <Star size={22} />
                  </span>
                  <span className="flex-1 px-5 text-base font-normal text-[#113965]">Rating</span>
                  <span className="text-2xl font-normal text-slate-950">0.0</span>
                </div>
              </div>
            </aside>

            <section className="pt-2 lg:pt-16">
              <h2 className="text-xl font-normal text-slate-950">Account details</h2>
              {isLoading ? <p className="mt-4 text-sm font-semibold text-slate-500">Loading profile...</p> : null}

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <Field label="Name" required icon={<User size={20} />}>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value.slice(0, 80))}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-400"
                    placeholder="User"
                  />
                </Field>
                <Field label="Email"  icon={<Mail size={20} />}>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value.slice(0, 120))}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-400"
                    placeholder="user@example.com"
                    inputMode="email"
                  />
                </Field>
                <Field label="Phone Number" required icon={<Phone size={20} />}>
                  <input value={userPhone} readOnly className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none" />
                </Field>
                <Field label="GSTIN (For Invoices)" icon={<Hash size={20} />}>
                  <input
                    value={gstin}
                    onChange={(event) => setGstin(event.target.value.toUpperCase().slice(0, 15))}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-400"
                    placeholder="GSTIN"
                  />
                </Field>
                <Field label="Address (For Invoices)" icon={<MapPin size={20} />}>
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value.slice(0, 180))}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-400"
                    placeholder="Address"
                  />
                </Field>
              </div>

              <label className="mt-7 block">
                <span className="mb-2 block text-sm font-normal text-[#113965]">Bio</span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value.slice(0, 500))}
                  placeholder="Tell us about yourself..."
                  rows={5}
                  className="w-full resize-none rounded-[18px] border border-[#d9e6f4] bg-white px-5 py-4 text-sm font-semibold leading-6 outline-none shadow-sm transition focus:border-[#1f63b2] focus:ring-4 focus:ring-[#1f63b2]/10"
                />
              </label>

              <div className="mt-7 rounded-[20px] border border-[#d9e6f4] bg-[#f8fbff] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-normal text-[#113965]">Current Location Coordinates</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Used for radius-based targeting and nearby notifications.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={detectCurrentLocation}
                    disabled={isDetectingLocation}
                    className="rounded-full bg-[#1f63b2] px-4 py-2 text-xs font-normal text-white disabled:opacity-60"
                  >
                    {isDetectingLocation ? 'Detecting...' : 'Detect Current Location'}
                  </button>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs text-[#113965]">Latitude</span>
                    <input
                      value={latitude ?? ''}
                      onChange={(e) => setLatitude(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-xl border border-[#d9e6f4] bg-white px-4 py-2 text-sm outline-none"
                      placeholder="Latitude"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs text-[#113965]">Longitude</span>
                    <input
                      value={longitude ?? ''}
                      onChange={(e) => setLongitude(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-xl border border-[#d9e6f4] bg-white px-4 py-2 text-sm outline-none"
                      placeholder="Longitude"
                    />
                  </label>
                </div>
              </div>

              <Field label="Listing Radius (km)" icon={<MapPin size={20} />}>
                <div className="flex w-full items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={500}
                    step={5}
                    value={searchRadiusKm}
                    onChange={(event) => setSearchRadiusKm(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer accent-[#1f63b2]"
                  />
                  <span className="min-w-16 text-right text-sm font-normal text-[#113965]">
                    {searchRadiusKm} km
                  </span>
                </div>
              </Field>

              {message ? (
                <p className={`mt-4 text-sm font-normal ${message.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {message}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={isSaving || isLoading}
                className="mt-8 mx-auto flex h-10 w-150 items-center justify-center gap-3 rounded-[18px] bg-[#2368b4] text-base font-normal text-white shadow-[0_20px_34px_-22px_rgba(17,57,101,0.95)] transition hover:bg-[#1f5fa8] disabled:opacity-60"
              >
                <Save size={20} /> {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </section>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
