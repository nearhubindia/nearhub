/**
 * AI-Powered Personalization Engine
 * Ranks listings and shorts based on user interests, behavior, and context
 *
 * Scoring factors:
 * - Category match (40 points)
 * - Location proximity (25 points)
 * - Engagement prediction (20 points)
 * - Freshness (10 points)
 * - Trending factor (5 points)
 */

import { calculateDistance } from '@/lib/location-data';
import type { UserInterests, CategoryInterest } from '@/shared/contexts/user-interests-context';
import type { Listing } from '@/lib/types';

export interface PersonalizationScore {
  listingId: string;
  totalScore: number;
  categoryScore: number;
  locationScore: number;
  engagementScore: number;
  freshnessScore: number;
  trendingScore: number;
  explanation: string;
}

/**
 * Calculate category match score (0-40 points)
 * Based on user's historical engagement with this category
 */
function calculateCategoryScore(
  listingCategory: string,
  userInterests: UserInterests
): { score: number; explanation: string } {
  const categoryInterest = userInterests.categories[listingCategory];

  if (!categoryInterest) {
    // New category - give baseline score
    return { score: 10, explanation: 'New category' };
  }

  // High engagement = higher score
  const engagementScore = categoryInterest.engagementScore;
  const normalizedScore = Math.min((engagementScore / 100) * 40, 40);

  const isFavorite = userInterests.favoriteCategories.includes(listingCategory);
  const explanation = isFavorite
    ? `⭐ Favorite category (${Math.round(normalizedScore)} pts)`
    : `Category match (${Math.round(normalizedScore)} pts)`;

  return { score: normalizedScore, explanation };
}

/**
 * Calculate location proximity score (0-25 points)
 * Closer = higher score
 */
function calculateLocationScore(
  listingLat: number,
  listingLon: number,
  userLat?: number,
  userLon?: number
): { score: number; explanation: string } {
  if (!userLat || !userLon) {
    return { score: 12.5, explanation: 'Location unknown' };
  }

  const distance = calculateDistance(userLat, userLon, listingLat, listingLon);

  // Score inversely proportional to distance
  // 0-5km: 25 points
  // 5-20km: 20 points
  // 20-50km: 15 points
  // 50-100km: 10 points
  // 100+km: 5 points

  let score = 25;
  let explanation = '';

  if (distance <= 5) {
    score = 25;
    explanation = `📍 Very close (${distance.toFixed(1)}km)`;
  } else if (distance <= 20) {
    score = 20;
    explanation = `📍 Nearby (${distance.toFixed(1)}km)`;
  } else if (distance <= 50) {
    score = 15;
    explanation = `📍 Within region (${distance.toFixed(1)}km)`;
  } else if (distance <= 100) {
    score = 10;
    explanation = `📍 Same state (${distance.toFixed(1)}km)`;
  } else {
    score = 5;
    explanation = `📍 Far (${distance.toFixed(1)}km)`;
  }

  return { score, explanation };
}

/**
 * Calculate engagement prediction score (0-20 points)
 * Predicts likelihood of user engaging with this listing
 */
function calculateEngagementScore(
  listing: Listing,
  userInterests: UserInterests
): { score: number; explanation: string } {
  let score = 10; // baseline
  let factors: string[] = [];

  // Check if user has engaged with similar price range
  const userInteractions = userInterests.interactions.filter(
    (i) => i.category === listing.category
  );

  if (userInteractions.length > 0) {
    // User has history with this category
    score += 5;
    factors.push('Category history');
  }

  // Check condition preference (if user frequently views certain conditions)
  const conditionInteractions = userInterests.interactions.filter(
    (i) => i.action === 'view' || i.action === 'save'
  );

  if (conditionInteractions.length > 5) {
    score += 3;
    factors.push('Active user');
  }

  // Recent activity bonus
  const recentInteractions = userInterests.interactions.filter(
    (i) => Date.now() - i.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
  );

  if (recentInteractions.length > 0) {
    score += 2;
    factors.push('Recently active');
  }

  const explanation =
    factors.length > 0
      ? `🎯 ${factors.join(', ')} (${score} pts)`
      : `🎯 Baseline engagement (${score} pts)`;

  return { score: Math.min(score, 20), explanation };
}

/**
 * Calculate freshness score (0-10 points)
 * Newer listings get higher scores
 */
function calculateFreshnessScore(createdAt: string): { score: number; explanation: string } {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const ageInHours = (now - created) / (1000 * 60 * 60);

  // Score decays over time
  // 0-24 hours: 10 points
  // 24-72 hours: 7 points
  // 72-168 hours (1 week): 5 points
  // 1+ week: 2 points

  let score = 10;
  let explanation = '';

  if (ageInHours <= 24) {
    score = 10;
    explanation = '🆕 Brand new';
  } else if (ageInHours <= 72) {
    score = 7;
    explanation = '🆕 Recent';
  } else if (ageInHours <= 168) {
    score = 5;
    explanation = 'This week';
  } else {
    score = 2;
    explanation = 'Older listing';
  }

  return { score, explanation };
}

/**
 * Calculate trending score (0-5 points)
 * Based on how many times this category appears in recent searches
 */
function calculateTrendingScore(
  listingCategory: string,
  userInterests: UserInterests
): { score: number; explanation: string } {
  const recentSearches = userInterests.interactions
    .filter((i) => i.action === 'search' && Date.now() - i.timestamp < 7 * 24 * 60 * 60 * 1000)
    .filter((i) => i.category === listingCategory);

  const searchCount = recentSearches.length;
  const score = Math.min(searchCount, 5);

  const explanation = searchCount > 0 ? `🔥 Trending (${searchCount} searches)` : 'Standard';

  return { score, explanation };
}

/**
 * Calculate comprehensive personalization score for a listing
 */
export function calculatePersonalizationScore(
  listing: Listing,
  userInterests: UserInterests,
  userLat?: number,
  userLon?: number
): PersonalizationScore {
  const categoryResult = calculateCategoryScore(listing.category, userInterests);
  const locationResult = calculateLocationScore(
    listing.location.latitude,
    listing.location.longitude,
    userLat,
    userLon
  );
  const engagementResult = calculateEngagementScore(listing, userInterests);
  const freshnessResult = calculateFreshnessScore(listing.createdAt);
  const trendingResult = calculateTrendingScore(listing.category, userInterests);

  const totalScore =
    categoryResult.score +
    locationResult.score +
    engagementResult.score +
    freshnessResult.score +
    trendingResult.score;

  const explanation = [
    categoryResult.explanation,
    locationResult.explanation,
    engagementResult.explanation,
    freshnessResult.explanation,
    trendingResult.explanation,
  ].join(' • ');

  return {
    listingId: listing.id,
    totalScore,
    categoryScore: categoryResult.score,
    locationScore: locationResult.score,
    engagementScore: engagementResult.score,
    freshnessScore: freshnessResult.score,
    trendingScore: trendingResult.score,
    explanation,
  };
}

/**
 * Rank listings by personalization score
 */
export function rankListingsByPersonalization(
  listings: Listing[],
  userInterests: UserInterests,
  userLat?: number,
  userLon?: number
): Array<{ listing: Listing; score: PersonalizationScore }> {
  return listings
    .map((listing) => ({
      listing,
      score: calculatePersonalizationScore(listing, userInterests, userLat, userLon),
    }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore);
}

/**
 * Get personalized recommendations for user
 * Returns top N listings with highest personalization scores
 */
export function getPersonalizedRecommendations(
  listings: Listing[],
  userInterests: UserInterests,
  userLat?: number,
  userLon?: number,
  limit: number = 10
): Array<{ listing: Listing; score: PersonalizationScore }> {
  const ranked = rankListingsByPersonalization(listings, userInterests, userLat, userLon);
  return ranked.slice(0, limit);
}

/**
 * Get personalized shorts feed
 * Prioritizes video listings with highest engagement potential
 */
export function getPersonalizedShortsFeed(
  listings: Listing[],
  userInterests: UserInterests,
  userLat?: number,
  userLon?: number
): Array<{ listing: Listing; score: PersonalizationScore }> {
  // Filter only video listings
  const videoListings = listings.filter((l) => l.videos && l.videos.length > 0);

  // Rank by personalization
  const ranked = rankListingsByPersonalization(videoListings, userInterests, userLat, userLon);

  // Boost score for favorite categories
  return ranked
    .map((item) => {
      if (userInterests.favoriteCategories.includes(item.listing.category)) {
        return {
          ...item,
          score: {
            ...item.score,
            totalScore: item.score.totalScore * 1.1, // 10% boost for favorites
          },
        };
      }
      return item;
    })
    .sort((a, b) => b.score.totalScore - a.score.totalScore);
}

/**
 * Check if user has sufficient interest data for personalization
 */
export function hasEnoughDataForPersonalization(userInterests: UserInterests): boolean {
  const totalInteractions = userInterests.interactions.length;
  const categoriesWithData = Object.keys(userInterests.categories).length;

  return totalInteractions >= 5 || categoriesWithData >= 2;
}

/**
 * Get explanation for why a listing was recommended
 */
export function getRecommendationExplanation(score: PersonalizationScore): string {
  const reasons: string[] = [];

  if (score.categoryScore >= 30) {
    reasons.push('Matches your interests');
  }
  if (score.locationScore >= 20) {
    reasons.push('Close to you');
  }
  if (score.freshnessScore >= 8) {
    reasons.push('Brand new');
  }
  if (score.trendingScore >= 3) {
    reasons.push('Trending');
  }

  return reasons.length > 0 ? reasons.join(' • ') : 'Recommended for you';
}
