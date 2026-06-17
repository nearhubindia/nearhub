import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { createResponsiveStyles } from '@/lib/responsive';

export default function AuthRequiredState({
  title = 'Sign In Required',
  message = 'Please sign in to continue.',
}: {
  title?: string;
  message?: string;
}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const authRedirect = pathname && pathname !== '/auth/register' ? pathname : '';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
      <View style={styles.content}>
        <Feather name="log-in" size={48} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          style={styles.button}
          onPress={() =>
            router.push({
              pathname: '/auth/register',
              params: authRedirect ? { redirect: authRedirect } : undefined,
            })
          }
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    marginTop: 16,
    fontSize: 18,
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
