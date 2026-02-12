import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_USER_KEY = '@adli_auth_user';

export type SubscriptionPlan = 'basic' | 'standard' | 'premium';

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number;
  period: string;
  features: string[];
  listingLimit: number;
  highlight: boolean;
}

export const PLANS: PlanDetails[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 99,
    period: 'month',
    features: ['5 active listings', 'Standard support', 'Basic analytics'],
    listingLimit: 5,
    highlight: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 199,
    period: 'month',
    features: ['25 active listings', 'Priority support', 'Advanced analytics', 'Featured badge'],
    listingLimit: 25,
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 399,
    period: 'month',
    features: ['Unlimited listings', '24/7 support', 'Full analytics', 'Featured badge', 'Top search placement'],
    listingLimit: -1,
    highlight: false,
  },
];

export interface User {
  id: string;
  phone: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  email: string;
  createdAt: string;
  plan?: SubscriptionPlan;
  planExpiresAt?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasActivePlan: boolean;
  currentPlan: PlanDetails | null;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  subscribeToPlan: (plan: SubscriptionPlan) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData: User) => {
    setUser(userData);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
  };

  const subscribeToPlan = async (planId: SubscriptionPlan) => {
    if (!user) return;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const updated = { ...user, plan: planId, planExpiresAt: expiresAt.toISOString() };
    setUser(updated);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
  };

  const hasActivePlan = !!(user?.plan && user?.planExpiresAt && new Date(user.planExpiresAt) > new Date());
  const currentPlan = hasActivePlan ? PLANS.find((p) => p.id === user?.plan) || null : null;

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      hasActivePlan,
      currentPlan,
      login,
      logout,
      updateUser,
      subscribeToPlan,
    }),
    [user, isLoading, hasActivePlan, currentPlan],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
