import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/config';
import { getAdminToken } from '@/features/admin/constants/admin-constants';

export default function SettingsView() {
  const [verifiedBadgeEnabled, setVerifiedBadgeEnabled] = useState(true);
  const [priorityListingEnabled, setPriorityListingEnabled] = useState(true);
  const [featuredListingEnabled, setFeaturedListingEnabled] = useState(true);
  const [topSearchEnabled, setTopSearchEnabled] = useState(true);
  const [geoRadiusKm, setGeoRadiusKm] = useState(50);
  const [inactiveUserReviewDays, setInactiveUserReviewDays] = useState(90);
  const [starterCreditsEnabled, setStarterCreditsEnabled] = useState(true);
  const [starterListingsCount, setStarterListingsCount] = useState(2);
  const [starterBoostsCount, setStarterBoostsCount] = useState(2);
  const [forceUpdateEnabled, setForceUpdateEnabled] = useState(false);
  const [minSupportedVersion, setMinSupportedVersion] = useState('1.0.0');
  const [minSupportedAndroidBuildNumber, setMinSupportedAndroidBuildNumber] = useState(1);
  const [minSupportedIosBuildNumber, setMinSupportedIosBuildNumber] = useState(1);
  const [forceUpdateMessage, setForceUpdateMessage] = useState(
    'A new app version is required to continue. Please update now.'
  );
  const [playStoreUrl, setPlayStoreUrl] = useState(
    'https://play.google.com/store/apps/details?id=com.synvide.nearhub'
  );
  const [appStoreUrl, setAppStoreUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current settings on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/admin/settings`, {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (typeof data.settings?.geoRadiusKm === 'number') {
            setGeoRadiusKm(data.settings.geoRadiusKm);
          }
          if (typeof data.settings?.inactiveUserReviewDays === 'number') {
            setInactiveUserReviewDays(Math.max(1, data.settings.inactiveUserReviewDays));
          }
          if (typeof data.settings?.starterCreditsEnabled === 'boolean') {
            setStarterCreditsEnabled(data.settings.starterCreditsEnabled);
          }
          if (typeof data.settings?.starterListingsCount === 'number') {
            setStarterListingsCount(Math.max(0, data.settings.starterListingsCount));
          }
          if (typeof data.settings?.starterBoostsCount === 'number') {
            setStarterBoostsCount(Math.max(0, data.settings.starterBoostsCount));
          }
          if (typeof data.settings?.forceUpdateEnabled === 'boolean') {
            setForceUpdateEnabled(data.settings.forceUpdateEnabled);
          }
          if (typeof data.settings?.minSupportedVersion === 'string') {
            setMinSupportedVersion(data.settings.minSupportedVersion || '1.0.0');
          }
          if (typeof data.settings?.minSupportedAndroidBuildNumber === 'number') {
            setMinSupportedAndroidBuildNumber(
              Math.max(1, data.settings.minSupportedAndroidBuildNumber)
            );
          }
          if (typeof data.settings?.minSupportedIosBuildNumber === 'number') {
            setMinSupportedIosBuildNumber(Math.max(1, data.settings.minSupportedIosBuildNumber));
          }
          if (typeof data.settings?.forceUpdateMessage === 'string') {
            setForceUpdateMessage(
              data.settings.forceUpdateMessage ||
                'A new app version is required to continue. Please update now.'
            );
          }
          if (typeof data.settings?.playStoreUrl === 'string') {
            setPlayStoreUrl(
              data.settings.playStoreUrl ||
                'https://play.google.com/store/apps/details?id=com.synvide.nearhub'
            );
          }
          if (typeof data.settings?.appStoreUrl === 'string') {
            setAppStoreUrl(data.settings.appStoreUrl || '');
          }
        }
      } catch (error) {
        console.error('[SettingsView] Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async (): Promise<void> => {
    try {
      setIsSaving(true);
      setMessage(null);

      const apiUrl = getApiUrl();
      const token = getAdminToken();

      if (!token) {
        throw new Error('Not logged in. Please login first.');
      }

      const response = await fetch(`${apiUrl}/api/admin/settings/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          geoRadiusKm: geoRadiusKm,
          inactiveUserReviewDays,
          starterCreditsEnabled,
          starterListingsCount,
          starterBoostsCount,
          forceUpdateEnabled,
          minSupportedVersion,
          minSupportedAndroidBuildNumber,
          minSupportedIosBuildNumber,
          forceUpdateMessage,
          playStoreUrl,
          appStoreUrl,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setMessage({
        type: 'success',
        text: 'Settings saved successfully!',
      });

      // Reset message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('[SettingsView] Error saving settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Settings</h1>
        <p className="text-slate-300">Configure your platform and listing features</p>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl space-y-6">
        {isLoading && (
          <div className="text-center py-8">
            <p className="text-slate-600">Loading settings...</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Listing Features Settings */}
            <div className="bg-white border border-slate-200 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">📋</span> Listing Enhancement Features
              </h3>
              <p className="text-slate-600 mb-6">
                Enable/disable special listing features available to users
              </p>

              <div className="space-y-4">
                {/* Verified Badge */}
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <span>✓</span> Verified Listing Badge
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Allow sellers to mark their listings as verified
                    </p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verifiedBadgeEnabled}
                      onChange={(e) => setVerifiedBadgeEnabled(e.target.checked)}
                      className="w-6 h-6 accent-teal-500"
                    />
                  </label>
                </div>

                {/* Priority Listing */}
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <span>⬆️</span> Priority Listing Boost
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Allow listings to be boosted higher in search results
                    </p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={priorityListingEnabled}
                      onChange={(e) => setPriorityListingEnabled(e.target.checked)}
                      className="w-6 h-6 accent-teal-500"
                    />
                  </label>
                </div>

                {/* Featured Listing */}
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <span>⭐</span> Featured Listing
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Allow listings to appear as featured on homepage
                    </p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featuredListingEnabled}
                      onChange={(e) => setFeaturedListingEnabled(e.target.checked)}
                      className="w-6 h-6 accent-teal-500"
                    />
                  </label>
                </div>

                {/* Top Search Placement */}
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <span>🎯</span> Top Search Placement
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Allow listings to appear at top of category search
                    </p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={topSearchEnabled}
                      onChange={(e) => setTopSearchEnabled(e.target.checked)}
                      className="w-6 h-6 accent-teal-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* General Platform Settings */}
            <div className="bg-white border border-slate-200 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">⚙️</span> General Settings
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Platform Name
                  </label>
                  <input
                    type="text"
                    defaultValue="nearhub"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Support Email
                  </label>
                  <input
                    type="email"
                    defaultValue="support@nearhub.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Support Phone
                  </label>
                  <input
                    type="tel"
                    defaultValue="+91 98765 43210"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Default Search Radius (km)
                  </label>
                  <input
                    type="text"
                    value={geoRadiusKm || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setGeoRadiusKm(0); // Allow empty temporarily
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num)) {
                          setGeoRadiusKm(Math.max(1, Math.min(500, num)));
                        }
                      }
                    }}
                    placeholder="Enter radius (1-500 km)"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-sm text-slate-600 mt-1">
                    Set the default search radius for location-based listing searches (1-500 km)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Inactive User Review Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={inactiveUserReviewDays}
                    onChange={(e) =>
                      setInactiveUserReviewDays(
                        Math.max(1, Math.min(3650, Number(e.target.value) || 1))
                      )
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-sm text-slate-600 mt-1">
                    Users inactive for this many days move to admin deletion review queue
                  </p>
                </div>
              </div>
            </div>

            {/* Starter Credits Settings */}
            <div className="bg-white border border-slate-200 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">🎁</span> Starter Credits (New Users)
              </h3>
              <p className="text-slate-600 mb-6">
                Configure one-time free credits granted automatically on first registration
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-900">Enable Starter Credits</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      When enabled, every new account receives free listing and boost credits once
                    </p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={starterCreditsEnabled}
                      onChange={(e) => setStarterCreditsEnabled(e.target.checked)}
                      className="w-6 h-6 accent-teal-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Starter Listings
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={starterListingsCount}
                      onChange={(e) =>
                        setStarterListingsCount(
                          Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        )
                      }
                      disabled={!starterCreditsEnabled}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <p className="text-sm text-slate-600 mt-1">
                      Free listing credits given once to each new user
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Starter Boosts
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={starterBoostsCount}
                      onChange={(e) =>
                        setStarterBoostsCount(
                          Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        )
                      }
                      disabled={!starterCreditsEnabled}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <p className="text-sm text-slate-600 mt-1">
                      Free boost credits given once to each new user
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hard Update Settings */}
            <div className="bg-white border border-slate-200 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">🚨</span> App Hard Update
              </h3>
              <p className="text-slate-600 mb-6">
                Force older app versions to update before they can continue.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-900">Enable Force Update</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      When enabled, apps below the configured minimum version/build are blocked.
                    </p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceUpdateEnabled}
                      onChange={(e) => setForceUpdateEnabled(e.target.checked)}
                      className="w-6 h-6 accent-teal-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Min Supported Version
                    </label>
                    <input
                      type="text"
                      value={minSupportedVersion}
                      onChange={(e) => setMinSupportedVersion(e.target.value)}
                      placeholder="e.g. 1.0.0"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Min Android Build Code
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minSupportedAndroidBuildNumber}
                      onChange={(e) =>
                        setMinSupportedAndroidBuildNumber(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Min iOS Build Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minSupportedIosBuildNumber}
                      onChange={(e) =>
                        setMinSupportedIosBuildNumber(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Force Update Message
                  </label>
                  <textarea
                    value={forceUpdateMessage}
                    onChange={(e) => setForceUpdateMessage(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Play Store URL
                    </label>
                    <input
                      type="text"
                      value={playStoreUrl}
                      onChange={(e) => setPlayStoreUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      App Store URL
                    </label>
                    <input
                      type="text"
                      value={appStoreUrl}
                      onChange={(e) => setAppStoreUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            {message && (
              <div
                className={`p-4 rounded-lg text-white text-center font-bold ${
                  message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                {message.text}
              </div>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-8 py-4 rounded-lg font-bold hover:shadow-lg hover:scale-105 transition text-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save All Settings'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
