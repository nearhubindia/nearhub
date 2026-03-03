/**
 * User Interests & Engagement Tracking Context
 * Automatically captures user behavior for AI-powered personalization
 *
 * Tracks:
 * - View counts per category
 * - Time spent on listings/shorts
 * - Saved item patterns
 * - Search query patterns
 * - Interaction history
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_INTERESTS_KEY = '@nearhub_user_interests';
const MAX_HISTORY = 100;

export interface CategoryInterest {
  category: string;
  viewCount: number;
  totalTimeSpent: number; // in seconds
  saveCount: number;
  searchCount: number;
  lastInteraction: number; // timestamp
  engagementScore: number; // 0-100
}

export interface ListingInteraction {
  listingId: string;
  category: string;
  viewDuration: number; // seconds
  timestamp: number;
  action: 'view' | 'save' | 'contact' | 'search';
}

export interface UserInterests {
  categories: Record<string, CategoryInterest>;
  interactions: ListingInteraction[];
  favoriteCategories: string[]; // Top 3 categories by score
  locationPreference: string | null;
  lastUpdated: number;
}

interface UserInterestsContextValue {
  interests: UserInterests;
  trackView: (listingId: string, category: string, duration: number) => Promise<void>;
  trackSave: (listingId: string, category: string) => Promise<void>;
  trackSearch: (category: string) => Promise<void>;
  trackContact: (listingId: string, category: string) => Promise<void>;
  getCategoryScore: (category: string) => number;
  getTopCategories: (limit?: number) => string[];
  getEngagementScore: (category: string) => number;
  clearInterests: () => Promise<void>;
}

const UserInterestsContext = createContext<UserInterestsContextValue | null>(null);

const DEFAULT_INTERESTS: UserInterests = {
  categories: {},
  interactions: [],
  favoriteCategories: [],
  locationPreference: null,
  lastUpdated: Date.now(),
};

export function UserInterestsProvider({ children }: { children: ReactNode }) {
  const [interests, setInterests] = useState<UserInterests>(DEFAULT_INTERESTS);

  useEffect(() => {
    loadInterests();
  }, []);

  const loadInterests = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_INTERESTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserInterests;
        setInterests(parsed);
      }
    } catch (e) {
      console.error('Failed to load user interests:', e);
    }
  };

  const saveInterests = async (updated: UserInterests) => {
    try {
      await AsyncStorage.setItem(USER_INTERESTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save user interests:', e);
    }
  };

  const calculateEngagementScore = (interest: CategoryInterest): number => {
    // Weighted scoring algorithm
    const viewScore = Math.min(interest.viewCount * 2, 40); // Max 40 points
    const timeScore = Math.min((interest.totalTimeSpent / 60) * 5, 30); // Max 30 points
    const saveScore = Math.min(interest.saveCount * 10, 20); // Max 20 points
    const searchScore = Math.min(interest.searchCount * 5, 10); // Max 10 points

    // Recency bonus: decay by 20% over 7 days
    const daysSinceInteraction = (Date.now() - interest.lastInteraction) / (1000 * 60 * 60 * 24);
    const recencyMultiplier = Math.max(0.5, 1 - daysSinceInteraction * 0.02);

    return Math.round((viewScore + timeScore + saveScore + searchScore) * recencyMultiplier);
  };

  const updateCategoryInterest = (
    category: string,
    updates: Partial<CategoryInterest>
  ): CategoryInterest => {
    const current = interests.categories[category] || {
      category,
      viewCount: 0,
      totalTimeSpent: 0,
      saveCount: 0,
      searchCount: 0,
      lastInteraction: Date.now(),
      engagementScore: 0,
    };

    const updated = { ...current, ...updates, lastInteraction: Date.now() };
    updated.engagementScore = calculateEngagementScore(updated);

    return updated;
  };

  const trackView = useCallback(async (listingId: string, category: string, duration: number) => {
    setInterests((prev) => {
      const categoryInterest = updateCategoryInterest(category, {
        viewCount: (prev.categories[category]?.viewCount || 0) + 1,
        totalTimeSpent: (prev.categories[category]?.totalTimeSpent || 0) + duration,
      });

      const newInteraction: ListingInteraction = {
        listingId,
        category,
        viewDuration: duration,
        timestamp: Date.now(),
        action: 'view',
      };

      const updatedInteractions = [newInteraction, ...prev.interactions].slice(0, MAX_HISTORY);

      const updatedCategories = {
        ...prev.categories,
        [category]: categoryInterest,
      };

      // Calculate top 3 categories
      const favoriteCategories = Object.values(updatedCategories)
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 3)
        .map((c) => c.category);

      const updated: UserInterests = {
        ...prev,
        categories: updatedCategories,
        interactions: updatedInteractions,
        favoriteCategories,
        lastUpdated: Date.now(),
      };

      saveInterests(updated);
      return updated;
    });
  }, []);

  const trackSave = useCallback(async (listingId: string, category: string) => {
    setInterests((prev) => {
      const categoryInterest = updateCategoryInterest(category, {
        saveCount: (prev.categories[category]?.saveCount || 0) + 1,
      });

      const newInteraction: ListingInteraction = {
        listingId,
        category,
        viewDuration: 0,
        timestamp: Date.now(),
        action: 'save',
      };

      const updatedInteractions = [newInteraction, ...prev.interactions].slice(0, MAX_HISTORY);

      const updatedCategories = {
        ...prev.categories,
        [category]: categoryInterest,
      };

      const favoriteCategories = Object.values(updatedCategories)
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 3)
        .map((c) => c.category);

      const updated: UserInterests = {
        ...prev,
        categories: updatedCategories,
        interactions: updatedInteractions,
        favoriteCategories,
        lastUpdated: Date.now(),
      };

      saveInterests(updated);
      return updated;
    });
  }, []);

  const trackSearch = useCallback(async (category: string) => {
    setInterests((prev) => {
      const categoryInterest = updateCategoryInterest(category, {
        searchCount: (prev.categories[category]?.searchCount || 0) + 1,
      });

      const updatedCategories = {
        ...prev.categories,
        [category]: categoryInterest,
      };

      const favoriteCategories = Object.values(updatedCategories)
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 3)
        .map((c) => c.category);

      const updated: UserInterests = {
        ...prev,
        categories: updatedCategories,
        favoriteCategories,
        lastUpdated: Date.now(),
      };

      saveInterests(updated);
      return updated;
    });
  }, []);

  const trackContact = useCallback(async (listingId: string, category: string) => {
    setInterests((prev) => {
      const categoryInterest = updateCategoryInterest(category, {
        viewCount: (prev.categories[category]?.viewCount || 0) + 1,
      });

      const newInteraction: ListingInteraction = {
        listingId,
        category,
        viewDuration: 0,
        timestamp: Date.now(),
        action: 'contact',
      };

      const updatedInteractions = [newInteraction, ...prev.interactions].slice(0, MAX_HISTORY);

      const updatedCategories = {
        ...prev.categories,
        [category]: categoryInterest,
      };

      const favoriteCategories = Object.values(updatedCategories)
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 3)
        .map((c) => c.category);

      const updated: UserInterests = {
        ...prev,
        categories: updatedCategories,
        interactions: updatedInteractions,
        favoriteCategories,
        lastUpdated: Date.now(),
      };

      saveInterests(updated);
      return updated;
    });
  }, []);

  const getCategoryScore = useCallback(
    (category: string): number => {
      return interests.categories[category]?.engagementScore || 0;
    },
    [interests]
  );

  const getTopCategories = useCallback(
    (limit: number = 3): string[] => {
      return interests.favoriteCategories.slice(0, limit);
    },
    [interests]
  );

  const getEngagementScore = useCallback(
    (category: string): number => {
      return interests.categories[category]?.engagementScore || 0;
    },
    [interests]
  );

  const clearInterests = useCallback(async () => {
    setInterests(DEFAULT_INTERESTS);
    await AsyncStorage.removeItem(USER_INTERESTS_KEY);
  }, []);

  const value: UserInterestsContextValue = {
    interests,
    trackView,
    trackSave,
    trackSearch,
    trackContact,
    getCategoryScore,
    getTopCategories,
    getEngagementScore,
    clearInterests,
  };

  return <UserInterestsContext.Provider value={value}>{children}</UserInterestsContext.Provider>;
}

export function useUserInterests() {
  const context = useContext(UserInterestsContext);
  if (!context) {
    throw new Error('useUserInterests must be used within a UserInterestsProvider');
  }
  return context;
}
