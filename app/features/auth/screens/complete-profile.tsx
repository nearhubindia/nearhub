import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { getApiUrl } from '@/lib/query-client';
import { createResponsiveStyles } from '@/lib/responsive';
import { uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';
import { isValidEmailAddress } from '@/lib/email-utils';
import { sanitizeAlphabeticName } from '@/lib/name-utils';

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [localAvatarUri, setLocalAvatarUri] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const phoneValue = typeof phone === 'string' ? phone : '';

  const handleNameChange = (value: string) => {
    setName(sanitizeAlphabeticName(value));
  };
  const handleEmailChange = (value: string) => {
    setEmail(value);
  };

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow photo access to set profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets.length > 0) {
      setLocalAvatarUri(result.assets[0].uri);
    }
  };

  const handleComplete = async () => {
    const sanitizedName = sanitizeAlphabeticName(name).trim();
    if (!sanitizedName) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!gender) {
      Alert.alert('Required', 'Please select your gender.');
      return;
    }
    if (!isValidEmailAddress(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let uploadedAvatarUrl = avatarUrl;
      if (localAvatarUri) {
        const uploaded = await uploadMediaToCloudflare({
          uri: localAvatarUri,
          mediaType: 'image',
          userId: phoneValue || undefined,
        });
        uploadedAvatarUrl = uploaded.url;
        setAvatarUrl(uploaded.url);
      }

      const baseUrl = getApiUrl();
      const url = new URL('/api/auth/complete-profile', baseUrl);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneValue,
          name: sanitizedName,
          email: email.trim(),
          gender,
          avatarUrl: uploadedAvatarUrl,
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        await login(data.user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', data.message || 'Failed to complete profile.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const genders = [
    { value: 'male' as const, label: 'Male', icon: 'user' as const },
    { value: 'female' as const, label: 'Female', icon: 'user' as const },
    { value: 'other' as const, label: 'Other', icon: 'users' as const },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || webTopInset) + 20,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBlock}>
          <Pressable style={styles.avatarButton} onPress={pickProfilePhoto}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : localAvatarUri ? (
              <Image source={{ uri: localAvatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="camera" size={22} color={Colors.primary} />
              </View>
            )}
            <Text style={styles.avatarLabel}>Add Profile Photo</Text>
          </Pressable>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>One quick step before entering NearHub</Text>
          {phoneValue ? <Text style={styles.phoneText}>+91 {phoneValue}</Text> : null}
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputRow}>
              <Feather name="user" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={handleNameChange}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {genders.map((g) => (
                <Pressable
                  key={g.value}
                  style={[styles.genderChip, gender === g.value && styles.genderChipActive]}
                  onPress={() => setGender(g.value)}
                >
                  <Feather
                    name={g.icon}
                    size={16}
                    color={gender === g.value ? '#fff' : Colors.textSecondary}
                  />
                  <Text style={[styles.genderText, gender === g.value && styles.genderTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Feather name="mail" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.submitText}>Continue to Home</Text>
                <Feather name="arrow-right" size={20} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerBlock: {
    marginBottom: 22,
    alignItems: 'center',
  },
  avatarButton: {
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  avatarLabel: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  phoneText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 18,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    paddingVertical: 12,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderChip: {
    flex: 1,
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    gap: 6,
  },
  genderChipActive: {
    backgroundColor: Colors.primary,
  },
  genderText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  genderTextActive: {
    color: '#fff',
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 10,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 15,
    gap: 10,
  },
  submitText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
