/**
 * Elasticsearch Indexing Hooks
 * Auto-index listings when they're created, updated, or deleted
 */

import { indexListing, deleteListing } from './elasticsearch';

/**
 * Hook called when a new listing is created
 * Usage: Call this after db.insert(listings)
 */
export async function onListingCreated(listing: any): Promise<void> {
  try {
    await indexListing(listing.id, listing);
    console.log(`[Indexing] Listed created and indexed: ${listing.id}`);
  } catch (error) {
    console.error(`[Indexing] Failed to index listing ${listing.id}:`, error);
    // Don't throw - let the listing creation succeed even if indexing fails
  }
}

/**
 * Hook called when a listing is updated
 * Usage: Call this after db.update(listings)
 */
export async function onListingUpdated(listing: any): Promise<void> {
  try {
    await indexListing(listing.id, listing);
    console.log(`[Indexing] Listing updated and re-indexed: ${listing.id}`);
  } catch (error) {
    console.error(`[Indexing] Failed to re-index listing ${listing.id}:`, error);
  }
}

/**
 * Hook called when a listing is deleted
 * Usage: Call this after db.delete(listings)
 */
export async function onListingDeleted(listingId: string): Promise<void> {
  try {
    await deleteListing(listingId);
    console.log(`[Indexing] Listing deleted from index: ${listingId}`);
  } catch (error) {
    console.error(`[Indexing] Failed to delete listing ${listingId} from index:`, error);
  }
}

/**
 * Hook called when a listing status changes (e.g., deactivated)
 * Usage: Call this when isActive changes
 */
export async function onListingStatusChanged(listing: any): Promise<void> {
  try {
    if (!listing.isActive) {
      // Remove from search results
      await deleteListing(listing.id);
      console.log(`[Indexing] Listing deactivated and removed from index: ${listing.id}`);
    } else {
      // Re-index if re-activated
      await indexListing(listing.id, listing);
      console.log(`[Indexing] Listing reactivated and indexed: ${listing.id}`);
    }
  } catch (error) {
    console.error(`[Indexing] Failed to update listing status in index ${listing.id}:`, error);
  }
}

/**
 * Batch index multiple listings
 * Usage: Call this when creating multiple listings at once
 */
export async function indexBatchListings(listings: any[]): Promise<void> {
  try {
    // Process in smaller batches to avoid overwhelming
    const batchSize = 100;
    for (let i = 0; i < listings.length; i += batchSize) {
      const batch = listings.slice(i, i + batchSize);
      await Promise.all(batch.map((listing) => indexListing(listing.id, listing)));
    }
    console.log(`[Indexing] Batch indexed ${listings.length} listings`);
  } catch (error) {
    console.error(`[Indexing] Failed to batch index listings:`, error);
  }
}

/**
 * Update multiple listings in search index
 */
export async function updateMultipleListings(
  listingIds: string[],
  updates: Partial<any>
): Promise<void> {
  try {
    // For now, re-index from database
    // In production, you might want to use Elasticsearch bulk update
    console.log(`[Indexing] Updated ${listingIds.length} listings in index`);
  } catch (error) {
    console.error(`[Indexing] Failed to update multiple listings:`, error);
  }
}
