/**
 * Geo-based Ad Search Service
 * Filters listings by distance from user's location
 * Uses Haversine formula to calculate distances
 */

import { listingsStorage } from '../../listings/services/listings-storage';
import { getAdminSettings } from '../../admin/services/admin-settings';
import type { Listing } from '../../listings/services/listings-storage';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 User latitude
 * @param lon1 User longitude
 * @param lat2 Listing latitude
 * @param lon2 Listing longitude
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export interface GeoSearchOptions {
  userLatitude: number;
  userLongitude: number;
  radiusKm?: number;
  category?: string;
  sortBy?: 'distance' | 'date' | 'price';
  limit?: number;
}

export interface SearchResult extends Listing {
  distanceKm?: number;
}

/**
 * Search listings within a geographic radius
 * Returns listings that:
 * 1. Have valid coordinates (pincode detected)
 * 2. Are within the specified radius
 * 3. Match category filter (if provided)
 * Sorted by distance or date
 */
export async function searchListingsByGeo(options: GeoSearchOptions): Promise<SearchResult[]> {
  const { userLatitude, userLongitude, category, sortBy = 'distance', limit = 100 } = options;

  // Get admin settings for default radius
  const adminSettings = await getAdminSettings();
  const radiusKm = options.radiusKm || (adminSettings.geoRadiusKm ?? 50);

  // Validate user coordinates
  if (!userLatitude || !userLongitude) {
    console.error('[GeoSearch] Invalid user coordinates provided');
    return [];
  }

  console.log(
    `[GeoSearch] Searching listings within ${radiusKm}km of (${userLatitude}, ${userLongitude})`
  );

  // Get all active listings
  const allListings = listingsStorage.getAllListings().filter((listing) => listing.isActive);

  // Filter and calculate distances
  const resultsWithDistance: SearchResult[] = [];

  for (const listing of allListings) {
    // Skip listings without coordinates
    if (!listing.latitude || !listing.longitude) {
      console.log(`[GeoSearch] Skipping listing ${listing.id}: no coordinates`);
      continue;
    }

    // Calculate distance
    const distance = calculateDistance(
      userLatitude,
      userLongitude,
      listing.latitude,
      listing.longitude
    );

    // Filter by radius
    if (distance > radiusKm) {
      console.log(
        `[GeoSearch] Listing ${listing.id} is ${distance.toFixed(1)}km away (exceeds ${radiusKm}km)`
      );
      continue;
    }

    // Filter by category if provided
    if (category && listing.category !== category) {
      continue;
    }

    resultsWithDistance.push({
      ...listing,
      distanceKm: parseFloat(distance.toFixed(1)),
    });
  }

  console.log(`[GeoSearch] Found ${resultsWithDistance.length} listings within radius`);

  // Sort results
  if (sortBy === 'distance') {
    resultsWithDistance.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  } else if (sortBy === 'date') {
    resultsWithDistance.sort((a, b) => {
      const dateA = new Date(b.createdAt).getTime();
      const dateB = new Date(a.createdAt).getTime();
      return dateA - dateB; // Newest first
    });
  } else if (sortBy === 'price') {
    resultsWithDistance.sort((a, b) => a.price - b.price);
  }

  // Apply limit
  return resultsWithDistance.slice(0, limit);
}

/**
 * Search listings by category (for users without location/location disabled)
 * Falls back to showing all listings when geo-filtering not available
 */
export function searchListingsByCategory(category?: string, limit: number = 100): SearchResult[] {
  const allListings = listingsStorage.getAllListings().filter((listing) => listing.isActive);

  let results = allListings;

  if (category) {
    results = results.filter((listing) => listing.category === category);
  }

  return results.slice(0, limit) as SearchResult[];
}

/**
 * Get listings near a specific location (e.g., for seller's listings)
 */
export async function getListingsNearLocation(
  latitude: number,
  longitude: number,
  radiusKm?: number
): Promise<SearchResult[]> {
  const adminSettings = await getAdminSettings();
  const radius = radiusKm || (adminSettings.geoRadiusKm ?? 50);

  return searchListingsByGeo({
    userLatitude: latitude,
    userLongitude: longitude,
    radiusKm: radius,
  });
}
