import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import AppScreenBanners from '@/shared/components/AppScreenBanners';
import { useAuth } from '@/shared/contexts/auth-context';
import { useAppScreenBanners } from '@/shared/hooks/use-app-screen-banners';
import { getCityFromCoordinates } from '@/lib/location-data';
import { getApiUrl } from '@/lib/query-client';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser, setUserLocation } = useAuth();
  const { banners: profileBanners, isLoading: isProfileBannersLoading } =
    useAppScreenBanners('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.address || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gstin, setGstin] = useState(user?.gstin || '');
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSavedPayloadRef = useRef<string>('');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // Auto-detect location on mount if not already set
  useEffect(() => {
    if (!user?.location?.city && Platform.OS !== 'web') {
      handleAutoDetectLocation();
    }
  }, []);

  // Sync profile form when user changes (initial load / account switch)
  useEffect(() => {
    if (!user?.id || lastSyncedUserIdRef.current === user.id) {
      return;
    }

    setName(user.name || '');
    setEmail(user.email || '');
    setAddress(user.address || '');
    setBio(user.bio || '');
    setGstin(user.gstin || '');

    const initialPayload = {
      name: (user.name || '').trim(),
      email: (user.email || '').trim(),
      address: (user.address || '').trim(),
      bio: (user.bio || '').trim(),
      gstin: (user.gstin || '').trim(),
    };
    lastSavedPayloadRef.current = JSON.stringify(initialPayload);
    lastSyncedUserIdRef.current = user.id;
  }, [user]);

  // Auto-save profile changes with debounce
  useEffect(() => {
    if (!user?.id || lastSyncedUserIdRef.current !== user.id) {
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      bio: bio.trim(),
      gstin: gstin.trim(),
    };

    if (!payload.name) {
      return;
    }

    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastSavedPayloadRef.current) {
      return;
    }

    const saveTimer = setTimeout(async () => {
      setSaving(true);
      try {
        await updateUser(payload);
        lastSavedPayloadRef.current = serializedPayload;
      } catch (error) {
        Alert.alert('Error', 'Failed to auto-save profile');
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => clearTimeout(saveTimer);
  }, [user?.id, name, email, address, bio, gstin, updateUser]);

  const reverseGeocodeCoordinates = async (latitude: number, longitude: number) => {
    try {
      console.log('[Profile] Reverse geocoding coordinates:', { latitude, longitude });
      const baseUrl = getApiUrl();
      const url = new URL(
        `/api/location/reverse-geocode?latitude=${latitude}&longitude=${longitude}`,
        baseUrl
      );

      const response = await fetch(url.toString());
      const json = await response.json();

      if (!json.success || !json.data) {
        console.warn('[Profile] Reverse geocode failed, falling back to local data:', json.error);
        // Fallback to local function if API fails
        return getCityFromCoordinates(latitude, longitude);
      }

      console.log('[Profile] Reverse geocode successful:', {
        pincode: json.data.pincode,
        city: json.data.city,
        state: json.data.state,
        matchType: json.data.matchType,
      });

      return {
        city: json.data.city,
        state: json.data.state,
        pincode: json.data.pincode,
        matchType: json.data.matchType,
      };
    } catch (error) {
      console.error('[Profile] Reverse geocode error:', error);
      // Fallback to local function if network error
      return getCityFromCoordinates(latitude, longitude);
    }
  };

  const handleAutoDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[Profile] Location permission status:', status);

      if (status !== 'granted') {
        console.log('[Profile] Location permission not granted');
        setDetectingLocation(false);
        return;
      }

      console.log('[Profile] Requesting GPS location...');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[Profile] GPS location received:', currentLocation.coords);
      const { latitude, longitude } = currentLocation.coords;
      const location = await reverseGeocodeCoordinates(latitude, longitude);

      console.log('[Profile] Location resolved:', { city: location.city, state: location.state });
      await setUserLocation(latitude, longitude, location.city, location.state);
      console.log('[Profile] Location saved to user profile');
    } catch (error) {
      console.error('[Profile] Location auto-detection error:', error);
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (Platform.OS === 'web') {
        Alert.alert('Error', 'Location detection not available on web');
        setDetectingLocation(false);
        return;
      }

      console.log('[Profile] Manual location detection started');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[Profile] Permission status:', status);

      if (status !== 'granted') {
        Alert.alert('Error', 'Location permission denied. Please enable it in settings.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setDetectingLocation(false);
        return;
      }

      // Get current location
      console.log('[Profile] Getting device location...');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[Profile] Got coordinates:', currentLocation.coords);
      const { latitude, longitude } = currentLocation.coords;

      // Get city from coordinates using reverse geocoding API
      const location = await reverseGeocodeCoordinates(latitude, longitude);
      console.log('[Profile] Resolved location:', location);

      // Save location to user profile
      await setUserLocation(latitude, longitude, location.city, location.state);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Location set to ${location.city}, ${location.state}`);
    } catch (error: any) {
      console.error('[Profile] Location error:', error);
      const errorMsg = error?.message || String(error);
      Alert.alert('Error', `Failed to detect location: ${errorMsg}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setDetectingLocation(false);
    }
  };

  const handlePincodeChange = async () => {
    if (!pincode.trim() || pincode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    setPincodeLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('[Profile] Looking up pincode:', pincode);
      const baseUrl = getApiUrl();
      const url = new URL(`/api/location/pincode/${pincode}`, baseUrl);

      const response = await fetch(url.toString());
      const json = await response.json();

      console.log('[Profile] Pincode lookup response:', json);

      if (!json.success || !json.data) {
        Alert.alert('Not Found', json.error || 'Pincode not found in our database.');
        setPincodeLoading(false);
        return;
      }

      const locationData = json.data;
      // Save location to user profile
      await setUserLocation(
        locationData.latitude,
        locationData.longitude,
        locationData.city,
        locationData.state
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPincode('');
      setShowPincodeModal(false);
      Alert.alert('Success', `Location set to ${locationData.city}, ${locationData.state}`);
    } catch (error) {
      console.error('[Profile] Pincode lookup error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to lookup pincode';
      Alert.alert('Error', `${errorMsg}. Make sure backend is running.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setPincodeLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.saveIndicator}>
          {saving ? <Text style={styles.saveIndicatorText}>Saving...</Text> : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenBanners banners={profileBanners} isLoading={isProfileBannersLoading} />

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || user?.phone?.charAt(0) || 'U'}
            </Text>
          </View>
          <Pressable style={styles.changeAvatarButton}>
            <Feather name="camera" size={16} color={Colors.primary} />
            <Text style={styles.changeAvatarText}>Change Photo</Text>
          </Pressable>
        </View>

        {/* Phone (Read-only) */}
        <View style={styles.section}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Feather name="phone" size={18} color={Colors.textSecondary} />
            <Text style={styles.inputTextDisabled}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Name *</Text>
          <View style={styles.input}>
            <Feather name="user" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textTertiary}
              editable
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.input}>
            <Feather name="mail" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              editable
            />
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.label}>Address (For Invoices)</Text>
          <View style={styles.input}>
            <Feather name="map-pin" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your business address"
              placeholderTextColor={Colors.textTertiary}
              editable
            />
          </View>
        </View>

        {/* GSTIN */}
        <View style={styles.section}>
          <Text style={styles.label}>GSTIN (For Invoices)</Text>
          <View style={styles.input}>
            <Feather name="hash" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.inputText}
              value={gstin}
              onChangeText={setGstin}
              placeholder="15-digit GSTIN (optional)"
              placeholderTextColor={Colors.textTertiary}
              editable
              maxLength={15}
            />
          </View>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.label}>Bio</Text>
          <View style={[styles.input, styles.textAreaInput]}>
            <TextInput
              style={[styles.inputText, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <View style={styles.locationHeader}>
            <Text style={styles.label}>Location</Text>
            <Pressable onPress={() => setShowPincodeModal(true)} style={styles.changeButton}>
              <Feather name="edit-2" size={16} color={Colors.primary} />
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          </View>
          {detectingLocation ? (
            <View style={[styles.input, styles.inputDisabled, styles.loadingLocationContainer]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.detectingLocationText}>Detecting location...</Text>
            </View>
          ) : user?.location?.city ? (
            <View style={[styles.input, styles.inputDisabled, styles.locationContainer]}>
              <Feather name="map-pin" size={18} color={Colors.textSecondary} />
              <View style={styles.locationInfo}>
                <Text style={styles.inputTextDisabled}>
                  {user.location.city}
                  {user.location.state && `, ${user.location.state}`}
                </Text>
                {user.location.latitude && user.location.longitude && (
                  <Text style={styles.coordinatesText}>
                    {user.location.latitude.toFixed(4)}° N, {user.location.longitude.toFixed(4)}° E
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.input, styles.inputDisabled, styles.locationContainer]}>
              <Feather name="map-pin" size={18} color={Colors.textSecondary} />
              <Text style={styles.inputTextDisabled}>Detecting location...</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </ScrollView>

      {/* Pincode Modal */}
      <Modal
        visible={showPincodeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPincodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top + 12 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPincodeModal(false);
                }}
                style={styles.modalBackButton}
                hitSlop={8}
              >
                <Feather name="x" size={24} color={Colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>Change Location</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalDescription}>
                Enter your pincode to auto-fill location details
              </Text>

              <View style={styles.modalSection}>
                <Text style={styles.label}>Pincode</Text>
                <View style={styles.input}>
                  <Feather name="map-pin" size={18} color={Colors.textSecondary} />
                  <TextInput
                    style={styles.inputText}
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="Enter 6-digit pincode"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.submitButton, pincodeLoading && styles.submitButtonDisabled]}
                onPress={handlePincodeChange}
                disabled={pincodeLoading}
              >
                {pincodeLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Update Location</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.detectButton}
                onPress={() => {
                  setShowPincodeModal(false);
                  handleDetectLocation();
                }}
              >
                <Feather name="navigation" size={18} color={Colors.primary} />
                <Text style={styles.detectButtonText}>Use GPS Instead</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  saveIndicator: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  saveIndicatorText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  changeAvatarText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  locationContainer: {
    alignItems: 'flex-start',
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  detectLocationButton: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  detectLocationText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
    flex: 1,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  inputTextDisabled: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  textAreaInput: {
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 80,
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.primary + '15',
    borderRadius: 6,
  },
  changeButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  loadingLocationContainer: {
    justifyContent: 'center',
  },
  detectingLocationText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  detectButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
});
