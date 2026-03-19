/**
 * Elasticsearch Service
 * Handles full-text search and indexing for listings
 */

import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { db } from '../../../data/db';
import { listings } from '../../subscriptions/models/subscription';

const INDEX_NAME = 'listings';

let esClient: ElasticsearchClient | null = null;
let isHealthy = false;

/**
 * Initialize Elasticsearch client
 */
export async function initializeElasticsearch(): Promise<void> {
  try {
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

    esClient = new ElasticsearchClient({
      node: elasticsearchUrl,
      auth:
        process.env.ELASTICSEARCH_USER && process.env.ELASTICSEARCH_PASSWORD
          ? {
              username: process.env.ELASTICSEARCH_USER,
              password: process.env.ELASTICSEARCH_PASSWORD,
            }
          : undefined,
      requestTimeout: 30000,
    });

    // Test connection
    const healthCheck = await esClient.cluster.health();
    console.log('[Elasticsearch] Connected - Status:', healthCheck.status);
    isHealthy = true;

    // Create or update index mapping
    await createOrUpdateIndexMapping();
  } catch {
    console.warn(
      '[Elasticsearch] Connection failed - Search will be disabled.',
      process.env.ELASTICSEARCH_URL
        ? `Check that ${process.env.ELASTICSEARCH_URL} is running.`
        : 'Configure ELASTICSEARCH_URL environment variable.'
    );
    isHealthy = false;
  }
}

/**
 * Create or update index mapping
 */
async function createOrUpdateIndexMapping(): Promise<void> {
  if (!esClient) return;

  try {
    // Check if index exists
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      // Create new index with mapping
      await esClient.indices.create({
        index: INDEX_NAME,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              default: {
                type: 'standard',
                stopwords: '_english_',
              },
              custom_analyzer: {
                type: 'standard',
                stopwords: '_english_',
                filter: ['lowercase'],
              },
            },
          },
        } as any,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'custom_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            description: {
              type: 'text',
              analyzer: 'custom_analyzer',
            },
            category: { type: 'keyword' },
            price: { type: 'float' },
            condition: { type: 'keyword' },
            location: { type: 'text' },
            sellerId: { type: 'keyword' },
            listingType: { type: 'keyword' },
            isActive: { type: 'boolean' },
            isPaid: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            images: { type: 'keyword' },
            videoUrl: { type: 'keyword' },
          },
        } as any,
      });

      console.log(`[Elasticsearch] Index "${INDEX_NAME}" created`);
    } else {
      console.log(`[Elasticsearch] Index "${INDEX_NAME}" already exists`);
    }
  } catch (error: any) {
    // Ignore if index already exists
    if (error.meta?.body?.error?.type !== 'resource_already_exists_exception') {
      console.error('[Elasticsearch] Failed to create/update index:', error);
    }
  }
}

/**
 * Index a single listing
 */
export async function indexListing(listingId: string, listingData: any): Promise<void> {
  if (!esClient || !isHealthy) return;

  try {
    await esClient.index({
      index: INDEX_NAME,
      id: listingId,
      body: {
        id: listingData.id,
        title: listingData.title,
        description: listingData.description,
        category: listingData.category,
        price: parseFloat(listingData.price),
        condition: listingData.condition,
        location: listingData.location,
        sellerId: listingData.sellerId,
        listingType: listingData.listingType,
        isActive: listingData.isActive,
        isPaid: listingData.isPaid,
        createdAt: listingData.createdAt,
        updatedAt: listingData.updatedAt,
        images: listingData.images || [],
        videoUrl: listingData.videoUrl,
      },
    });

    console.log(`[Elasticsearch] Indexed listing: ${listingId}`);
  } catch (error) {
    console.error(`[Elasticsearch] Failed to index listing ${listingId}:`, error);
  }
}

/**
 * Index multiple listings in bulk
 */
export async function bulkIndexListings(listingsData: any[]): Promise<void> {
  if (!esClient || !isHealthy || listingsData.length === 0) return;

  try {
    const operations = listingsData.flatMap((doc) => [
      { index: { _index: INDEX_NAME, _id: doc.id } },
      {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        price: parseFloat(doc.price),
        condition: doc.condition,
        location: doc.location,
        sellerId: doc.sellerId,
        listingType: doc.listingType,
        isActive: doc.isActive,
        isPaid: doc.isPaid,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        images: doc.images || [],
        videoUrl: doc.videoUrl,
      },
    ]);

    const result = await esClient.bulk({ body: operations });

    if (result.errors) {
      console.error('[Elasticsearch] Bulk indexing had errors:', result);
    } else {
      console.log(`[Elasticsearch] Bulk indexed ${listingsData.length} listings`);
    }
  } catch (error) {
    console.error('[Elasticsearch] Failed to bulk index listings:', error);
  }
}

/**
 * Delete a listing from index
 */
export async function deleteListing(listingId: string): Promise<void> {
  if (!esClient || !isHealthy) return;

  try {
    await esClient.delete({
      index: INDEX_NAME,
      id: listingId,
    });

    console.log(`[Elasticsearch] Deleted listing: ${listingId}`);
  } catch (error: any) {
    // Ignore if document not found
    if (error.meta?.body?.result !== 'not_found') {
      console.error(`[Elasticsearch] Failed to delete listing ${listingId}:`, error);
    }
  }
}

/**
 * Sync all listings to Elasticsearch
 */
export async function syncAllListings(): Promise<{ synced: number; failed: number }> {
  if (!esClient || !isHealthy) {
    console.warn('[Elasticsearch] Elasticsearch not available, skipping sync');
    return { synced: 0, failed: 0 };
  }

  try {
    // First, clear the index
    try {
      await esClient.indices.delete({ index: INDEX_NAME });
    } catch (error: any) {
      if (error.meta?.body?.error?.type !== 'index_not_found_exception') {
        throw error;
      }
    }

    // Recreate index with mapping
    await createOrUpdateIndexMapping();

    // Fetch all listings
    const allListings = await db.select().from(listings).execute();

    console.log(`[Elasticsearch] Starting sync of ${allListings.length} listings...`);

    // Bulk index in batches of 1000
    const batchSize = 1000;
    let synced = 0;
    let failed = 0;

    for (let i = 0; i < allListings.length; i += batchSize) {
      const batch = allListings.slice(i, i + batchSize);

      try {
        await bulkIndexListings(batch);
        synced += batch.length;
      } catch (error) {
        console.error(`[Elasticsearch] Failed to sync batch ${i / batchSize + 1}:`, error);
        failed += batch.length;
      }
    }

    console.log(`[Elasticsearch] Sync complete - Synced: ${synced}, Failed: ${failed}`);
    return { synced, failed };
  } catch (error) {
    console.error('[Elasticsearch] Sync failed:', error);
    return { synced: 0, failed: 0 };
  }
}

/**
 * Full-text search across listings
 */
export interface SearchResults {
  success: boolean;
  data: {
    listings: any[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function searchListings(
  query: string,
  filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    listingType?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  },
  limit: number = 50,
  offset: number = 0
): Promise<SearchResults> {
  if (!esClient || !isHealthy) {
    return {
      success: false,
      data: {
        listings: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      },
    };
  }

  try {
    const must: any[] = [];
    const filter: any[] = [];

    // Add text search if query provided
    if (query && query.trim()) {
      must.push({
        multi_match: {
          query: query.trim(),
          fields: ['title^3', 'description^2', 'category', 'location'],
          fuzziness: 'AUTO',
          operator: 'or',
        },
      });
    }

    // Add active filter
    filter.push({ term: { isActive: true } });

    // Add optional filters
    if (filters?.category) {
      filter.push({ term: { category: filters.category } });
    }
    if (filters?.condition) {
      filter.push({ term: { condition: filters.condition } });
    }
    if (filters?.listingType) {
      filter.push({ term: { listingType: filters.listingType } });
    }

    // Add price range filter
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceRange: any = {};
      if (filters?.minPrice !== undefined) {
        priceRange.gte = filters.minPrice;
      }
      if (filters?.maxPrice !== undefined) {
        priceRange.lte = filters.maxPrice;
      }
      if (Object.keys(priceRange).length > 0) {
        filter.push({ range: { price: priceRange } });
      }
    }

    const response = await esClient.search({
      index: INDEX_NAME,
      query: {
        bool: {
          must: must.length > 0 ? must : undefined,
          filter: filter.length > 0 ? filter : undefined,
        },
      } as any,
      from: offset,
      size: limit,
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }] as any,
    });

    const hits = response.hits.hits || [];
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

    let searchListings = hits.map((hit: any) => hit._source);

    // Apply geo-filtering if coordinates provided
    if (filters?.latitude !== undefined && filters?.longitude !== undefined && filters?.radiusKm) {
      const latitude = filters.latitude;
      const longitude = filters.longitude;
      const radiusKm = filters.radiusKm;

      searchListings = searchListings.filter((listing: any) => {
        if (!listing.latitude || !listing.longitude) return false;
        const lat1 = parseFloat(listing.latitude);
        const lon1 = parseFloat(listing.longitude);

        // Haversine formula in JavaScript
        const R = 6371; // Earth's radius in km
        const dLat = ((latitude - lat1) * Math.PI) / 180;
        const dLon = ((longitude - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance <= radiusKm;
      });
    }

    return {
      success: true,
      data: {
        listings: searchListings,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  } catch (error) {
    console.error('[Elasticsearch] Search failed:', error);
    return {
      success: false,
      data: {
        listings: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      },
    };
  }
}

/**
 * Auto-complete suggestions
 */
export async function getSearchSuggestions(query: string, limit: number = 10): Promise<string[]> {
  if (!esClient || !isHealthy || !query.trim()) {
    return [];
  }

  try {
    const response = await esClient.search({
      index: INDEX_NAME,
      query: {
        match: {
          title: {
            query: query.trim(),
            fuzziness: 'AUTO',
          },
        },
      } as any,
      _source: ['title'],
      size: limit,
    });

    const hits = response.hits.hits || [];
    const suggestions = new Set<string>();

    hits.forEach((hit: any) => {
      const title = hit._source?.title;
      if (title) {
        suggestions.add(title);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  } catch (error) {
    console.error('[Elasticsearch] Failed to get suggestions:', error);
    return [];
  }
}

/**
 * Get index stats
 */
export async function getIndexStats(): Promise<{
  status: string;
  totalListings: number;
  indexSize?: string;
}> {
  if (!esClient || !isHealthy) {
    return {
      status: 'unavailable',
      totalListings: 0,
    };
  }

  try {
    const stats = await esClient.indices.stats({ index: INDEX_NAME });
    const countResult = await esClient.count({ index: INDEX_NAME });

    return {
      status: 'healthy',
      totalListings: countResult.count,
      indexSize: stats.indices?.[INDEX_NAME]?.primaries?.store?.size_in_bytes
        ? `${Math.round(stats.indices[INDEX_NAME].primaries.store.size_in_bytes / 1024 / 1024)}MB`
        : undefined,
    };
  } catch (error) {
    console.error('[Elasticsearch] Failed to get stats:', error);
    return {
      status: 'error',
      totalListings: 0,
    };
  }
}

/**
 * Check if Elasticsearch is healthy
 */
export function isElasticsearchHealthy(): boolean {
  return isHealthy;
}

/**
 * Get Elasticsearch client (for advanced queries)
 */
export function getElasticsearchClient(): ElasticsearchClient | null {
  return esClient;
}
