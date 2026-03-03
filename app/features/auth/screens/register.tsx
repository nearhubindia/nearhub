import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Logo } from '@/shared/components/Logo';
import { getApiUrl } from '@/lib/query-client';
import { createResponsiveStyles } from '@/lib/responsive';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [isSending, setIsSending] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const validatePhone = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\s/g, ''));
  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSendOTP = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!gender) {
      Alert.alert('Required', 'Please select your gender.');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!validatePhone(phone)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const baseUrl = getApiUrl();
      console.log('[Register] Starting OTP request...');
      console.log('[Register] API Base URL:', baseUrl);

      const phoneToSend = phone.replace(/\s/g, '');
      const url = new URL('/api/auth/send-otp', baseUrl);
      const fullUrl = url.toString();
      console.log('[Register] Full URL:', fullUrl);
      console.log('[Register] Phone:', phoneToSend);

      // Test fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[Register] Request timeout - aborting');
        controller.abort();
      }, 10000); // 10 second timeout

      console.log('[Register] Making POST request...');
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneToSend }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[Register] Response received');
      console.log('[Register] Response status:', res.status);
      console.log('[Register] Response headers:', {
        contentType: res.headers.get('content-type'),
        corsOrigin: res.headers.get('access-control-allow-origin'),
      });

      const responseText = await res.text();
      console.log('[Register] Response body:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[Register] Failed to parse JSON:', responseText);
        throw new Error('Invalid response from server: ' + responseText);
      }

      console.log('[Register] Parsed response:', data);

      if (data.success) {
        const otpMessage = data.otp
          ? `Your OTP is: ${data.otp}`
          : 'OTP sent to your mobile number.';
        Alert.alert('OTP Sent', otpMessage);
        router.push({
          pathname: '/auth/verify-otp',
          params: {
            phone: phoneToSend,
            name: name.trim(),
            email: email.trim(),
            gender,
          },
        });
      } else {
        Alert.alert('Error', data.message || 'Failed to send OTP. Try again.');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[Register] Full error object:', e);
      console.error('[Register] Error message:', errorMsg);

      // Show detailed error message
      const detailMsg = errorMsg.includes('abort')
        ? 'CONNECTION TIMEOUT\n\nBackend not responding within 10 seconds.\n\nMake sure backend is running:\nnpm run server:dev'
        : errorMsg.includes('Failed to fetch')
          ? 'NETWORK ERROR\n\nCannot reach backend at 192.168.29.58:5000\n\nChecklist:\n• Phone & computer on same Wi-Fi\n• Backend running on port 5000\n• No firewall blocking port'
          : errorMsg;

      Alert.alert(
        'Connection Failed',
        `${detailMsg}\n\n` + 'Debug URL: http://192.168.29.58:5000/api/health'
      );
    } finally {
      setIsSending(false);
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
        scrollEnabled={true}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>

        <View style={styles.brandSection}>
          <Logo size="md" />
          <Text style={styles.brandTagline}>Join the marketplace</Text>
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
                onChangeText={setName}
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
                  onPress={() => {
                    setGender(g.value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
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
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.inputRow}>
              <Text style={styles.countryCode}>+91</Text>
              <View style={styles.divider} />
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.textTertiary}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.sendButtonPressed,
            isSending && styles.sendButtonDisabled,
          ]}
          onPress={handleSendOTP}
          disabled={isSending}
        >
          <LinearGradient
            colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendGradient}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.sendText}>Get OTP</Text>
                <Feather name="arrow-right" size={20} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
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
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandName: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
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
  countryCode: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    paddingRight: 10,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginRight: 10,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  sendButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 0,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  sendText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
