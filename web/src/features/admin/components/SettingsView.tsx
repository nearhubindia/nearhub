import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/config';
import { getAdminToken } from '@/features/admin/constants/admin-constants';

export default function SettingsView() {
  const [verifiedBadgeEnabled, setVerifiedBadgeEnabled] = useState(true);
  const [priorityListingEnabled, setPriorityListingEnabled] = useState(true);
  const [featuredListingEnabled, setFeaturedListingEnabled] = useState(true);
  const [topSearchEnabled, setTopSearchEnabled] = useState(true);
  const [geoRadiusKm, setGeoRadiusKm] = useState(50);
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
          if (data.settings?.geoRadiusKm) {
            setGeoRadiusKm(data.settings.geoRadiusKm);
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Settings</h1>
        <p className="text-slate-300">Configure your platform and listing features</p>
      </div>

      <div className="p-6 max-w-6xl space-y-6">
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
