import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { parseJsonSafely } from '@/lib/http-response';
import { getApiUrl } from '@/lib/query-client';
import { createResponsiveStyles } from '@/lib/responsive';

const OTP_LENGTH = 6;
type VerifyOtpResponse = {
  success?: boolean;
  message?: string;
  user?: any;
  isNewUser?: boolean;
  requiresProfileCompletion?: boolean;
};

export default function VerifyOTPScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{
    phone: string;
  }>();
  const { login } = useAuth();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '');
    if (digit.length > 1) {
      const digits = digit.split('').slice(0, OTP_LENGTH);
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const otpCode = otp.join('');

  const handleVerify = async () => {
    if (otpCode.length !== OTP_LENGTH) {
      Alert.alert('Incomplete', 'Please enter the full 6-digit OTP.');
      return;
    }

    setIsVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/auth/verify-otp', baseUrl);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          otp: otpCode,
        }),
      });
      const data = await parseJsonSafely<VerifyOtpResponse>(res, url.toString());

      if (data.success && data.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await login(data.user);
        if (data.isNewUser || data.requiresProfileCompletion) {
          router.replace({
            pathname: '/auth/complete-profile',
            params: { phone: data.user.phone || phone },
          });
        } else {
          router.dismissTo('/(tabs)');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Invalid OTP',
          data.message || 'The OTP you entered is incorrect. Please try again.'
        );
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Network error. Please try again.';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/auth/send-otp', baseUrl);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const data = await parseJsonSafely<VerifyOtpResponse>(res, url.toString());
      if (data.success) {
        Alert.alert('OTP Resent', 'New OTP sent.');
        setResendTimer(30);
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to resend OTP.';
      Alert.alert('Error', errorMsg);
    }
  };

  const phoneValue = typeof phone === 'string' ? phone : '';
  const maskedPhone = phoneValue ? `+91 ${phoneValue.slice(0, 3)}***${phoneValue.slice(-3)}` : '';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: (insets.top || webTopInset) + 20,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Feather name="shield" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
          </Text>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                selectTextOnFocus
                testID={`otp-input-${index}`}
              />
            ))}
          </View>

          <View style={styles.actionSection}>
            <Pressable
              style={({ pressed }) => [
                styles.verifyButton,
                pressed && styles.verifyButtonPressed,
                (isVerifying || otpCode.length !== OTP_LENGTH) && styles.verifyButtonDisabled,
              ]}
              onPress={handleVerify}
              disabled={isVerifying || otpCode.length !== OTP_LENGTH}
            >
              <LinearGradient
                colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.verifyGradient}
              >
                {isVerifying ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="check-circle" size={20} color="#fff" />
                    <Text style={styles.verifyText}>Verify & Continue</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn&apos;t receive the code? </Text>
              <Pressable onPress={handleResend} disabled={resendTimer > 0}>
                <Text style={[styles.resendLink, resendTimer > 0 && styles.resendLinkDisabled]}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
    width: '100%',
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(10, 102, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  phoneHighlight: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  otpInput: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(10, 102, 194, 0.05)',
  },
  actionSection: {
    width: '100%',
    alignSelf: 'stretch',
  },
  verifyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  verifyButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyGradient: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 14,
    gap: 10,
  },
  verifyText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resendLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  resendLinkDisabled: {
    color: Colors.textTertiary,
  },
});
