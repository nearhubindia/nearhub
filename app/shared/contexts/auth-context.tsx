import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDemandMultiplier } from '@/lib/location-data';
import {
  loadCachedLocation,
  saveCachedLocation,
  type CachedLocation,
} from '@/lib/location-cache';

const AUTH_USER_KEY = '@nearhub_auth_user';

export type SubscriptionPlan = 'basic' | 'standard' | 'premium';

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number;
  period: string;
  features: string[];
  listingLimit: number;
  highlight: boolean;
  originalPrice?: number; // Price before demand adjustment
  demandMultiplier?: number; // 0.8-1.2 based on city demand
  city?: string; // City where pricing applies
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
    features: [
      'Unlimited listings',
      '24/7 support',
      'Full analytics',
      'Featured badge',
      'Top search placement',
    ],
    listingLimit: -1,
    highlight: false,
  },
];

export interface User {
  id: string;
  phone: string;
  name: string;
  token?: string;
  gender: 'male' | 'female' | 'other';
  email: string;
  avatarUrl?: string;
  bio?: string;
  address?: string; // Seller's address for invoices
  gstin?: string; // GSTIN for invoices
  createdAt: string;
  plan?: SubscriptionPlan;
  planExpiresAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  };
  preferences?: {
    notifications?: boolean;
    emailNotifications?: boolean;
    autoLocalizeListings: boolean; // Show listings from user's city first
    storeSearchHistory: boolean;
    searchRadiusKm?: number;
  };
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasActivePlan: boolean;
  currentPlan: PlanDetails | null;
  userCity: string | null;
  cachedLocation: CachedLocation | null;
  plans: PlanDetails[];
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  subscribeToPlan: (plan: SubscriptionPlan) => Promise<void>;
  setUserLocation: (
    latitude: number,
    longitude: number,
    city: string,
    state: string
  ) => Promise<void>;
  setUserSearchRadius: (searchRadiusKm: number) => Promise<void>;
  getDynamicPlans: () => PlanDetails[];
}

/**
 * Helper function to check if seller profile is complete
 * Required fields: name, phone, address
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;
  return !!(user.name?.trim() && user.phone?.trim() && user.address?.trim());
}

/**
 * Helper function to get missing profile fields
 */
export function getMissingProfileFields(user: User | null): string[] {
  if (!user) return ['name', 'phone', 'address'];
  const missing: string[] = [];
  if (!user.name?.trim()) missing.push('name');
  if (!user.phone?.trim()) missing.push('phone');
  if (!user.address?.trim()) missing.push('address');
  return missing;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [cachedLocation, setCachedLocation] = useState<CachedLocation | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const [stored, storedLocation] = await Promise.all([
        AsyncStorage.getItem(AUTH_USER_KEY),
        loadCachedLocation(),
      ]);
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        if (userData.location?.city) {
          setUserCity(userData.location.city);
        }
        if (
          userData.location &&
          typeof userData.location.latitude === 'number' &&
          typeof userData.location.longitude === 'number'
        ) {
          const nextCachedLocation = {
            latitude: userData.location.latitude,
            longitude: userData.location.longitude,
            city: userData.location.city,
            state: userData.location.state,
          };
          setCachedLocation({ ...nextCachedLocation, updatedAt: new Date().toISOString() });
          await saveCachedLocation(nextCachedLocation);
          return;
        }
      }
      setCachedLocation(storedLocation);
    } catch (e) {
      console.error('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData: User) => {
    const nextUser = {
      ...userData,
      token: userData.token || user?.token,
    };
    setUser(nextUser);
    if (userData.location?.city) {
      setUserCity(userData.location.city);
    }
    if (userData.location) {
      const nextCachedLocation = {
        latitude: userData.location.latitude,
        longitude: userData.location.longitude,
        city: userData.location.city,
        state: userData.location.state,
      };
      setCachedLocation({ ...nextCachedLocation, updatedAt: new Date().toISOString() });
      await saveCachedLocation(nextCachedLocation);
    }
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
  };

  const logout = async () => {
    setUser(null);
    setUserCity(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    if (updated.location?.city) {
      setUserCity(updated.location.city);
    }
    if (updated.location) {
      const nextCachedLocation = {
        latitude: updated.location.latitude,
        longitude: updated.location.longitude,
        city: updated.location.city,
        state: updated.location.state,
      };
      setCachedLocation({ ...nextCachedLocation, updatedAt: new Date().toISOString() });
      await saveCachedLocation(nextCachedLocation);
    }
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

  const setUserLocation = async (
    latitude: number,
    longitude: number,
    city: string,
    state: string
  ) => {
    const nextLocation = { latitude, longitude, city, state };
    setCachedLocation({ ...nextLocation, updatedAt: new Date().toISOString() });
    await saveCachedLocation(nextLocation);

    if (!user) return;

    const updated = {
      ...user,
      location: nextLocation,
      preferences: {
        ...user.preferences,
        autoLocalizeListings: true,
        storeSearchHistory: user.preferences?.storeSearchHistory ?? true,
      },
    };
    setUser(updated);
    setUserCity(city);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
  };

  const setUserSearchRadius = async (searchRadiusKm: number) => {
    if (!user) return;
    const updated = {
      ...user,
      preferences: {
        notifications: user.preferences?.notifications ?? true,
        emailNotifications: user.preferences?.emailNotifications ?? true,
        autoLocalizeListings: user.preferences?.autoLocalizeListings ?? true,
        storeSearchHistory: user.preferences?.storeSearchHistory ?? true,
        searchRadiusKm,
      },
    };
    setUser(updated);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
  };

  const getDynamicPlans = (): PlanDetails[] => {
    const userCityForPricing = userCity || 'Hyderabad'; // Default to Hyderabad
    const multiplier = getDemandMultiplier(
      userCityForPricing,
      user?.location?.state || 'Telangana'
    );

    return PLANS.map((plan) => ({
      ...plan,
      originalPrice: plan.price,
      demandMultiplier: multiplier,
      price: Math.round(plan.price * multiplier),
      city: userCityForPricing,
      features: [
        ...plan.features,
        multiplier > 1.0
          ? `📈 High demand in ${userCityForPricing}`
          : multiplier < 1.0
            ? `📉 Lower pricing in ${userCityForPricing}`
            : `📊 Standard pricing in ${userCityForPricing}`,
      ],
    }));
  };

  const hasActivePlan = !!(
    user?.plan &&
    user?.planExpiresAt &&
    new Date(user.planExpiresAt) > new Date()
  );
  const currentPlan = hasActivePlan ? PLANS.find((p) => p.id === user?.plan) || null : null;
  const dynamicPlans = getDynamicPlans();

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      hasActivePlan,
      currentPlan,
      userCity,
      cachedLocation,
      plans: dynamicPlans,
      login,
      logout,
      updateUser,
      subscribeToPlan,
      setUserLocation,
      setUserSearchRadius,
      getDynamicPlans,
    }),
    [user, isLoading, hasActivePlan, currentPlan, userCity, cachedLocation, dynamicPlans]
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
