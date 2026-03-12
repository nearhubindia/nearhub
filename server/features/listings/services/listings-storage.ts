/**
 * In-Memory Listings Storage
 * Stores listings until database is configured
 */

import { randomUUID } from 'crypto';
import seedListings from '../../../data/seed-listings.json' assert { type: 'json' };

export interface Listing {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  offerPrice?: number; // Discounted offer price (must be < price)
  priceUnit?: string;
  condition: string;
  location: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  isPaid: boolean;
  isActive: boolean;
  status: 'active' | 'sold' | 'pending';
  date: string;
  durationDays?: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListingInput {
  userId?: string;
  title: string;
  description?: string;
  category: string;
  price: number;
  offerPrice?: number; // Discounted offer price
  priceUnit?: string;
  condition: string;
  location: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  isPaid?: boolean;
  durationDays?: number;
}

class ListingsStorage {
  private listings: Map<string, Listing> = new Map();

  constructor() {}

  private seedSampleData() {
    // Load 1000+ sample listings from seed data JSON
    if (Array.isArray(seedListings)) {
      console.log(
        `[ListingsStorage] Loading ${seedListings.length} seed listings from seed-listings.json...`
      );

      seedListings.forEach((listing: any) => {
        try {
          this.createListing(listing);
        } catch (error) {
          console.error(`[ListingsStorage] Error seeding listing:`, error);
        }
      });

      console.log(
        `[ListingsStorage] ✅ Successfully seeded ${seedListings.length} sample listings`
      );
    } else {
      console.warn('[ListingsStorage] ⚠️  No seed listings data found');
    }
  }

  createListing(input: CreateListingInput): Listing {
    const id = randomUUID();
    const now = new Date().toISOString();

    const listing: Listing = {
      id,
      userId: input.userId || '',
      title: input.title,
      description: input.description || '',
      category: input.category,
      price: input.price,
      offerPrice: input.offerPrice,
      priceUnit: input.priceUnit,
      condition: input.condition,
      location: input.location,
      images: input.images || [],
      isPaid: input.isPaid || false,
      isActive: true,
      status: 'active',
      date: new Date().toISOString().split('T')[0],
      durationDays: input.durationDays,
      expiresAt: input.durationDays
        ? new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.listings.set(id, listing);
    console.log(`[ListingsStorage] Created listing: ${listing.title} (ID: ${id})`);
    return listing;
  }

  getListing(id: string): Listing | undefined {
    return this.listings.get(id);
  }

  getAllListings(): Listing[] {
    return Array.from(this.listings.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getListingsByCategory(category: string): Listing[] {
    return this.getAllListings().filter((listing) => listing.category === category);
  }

  getListingsByUser(userId: string): Listing[] {
    return this.getAllListings().filter((listing) => listing.userId === userId);
  }

  getListingsBySeller(sellerId: string): Listing[] {
    return this.getListingsByUser(sellerId);
  }

  updateListing(id: string, updates: Partial<Listing>): Listing | undefined {
    const listing = this.listings.get(id);
    if (!listing) {
      return undefined;
    }

    const updated: Listing = {
      ...listing,
      ...updates,
      id: listing.id, // Preserve ID
      updatedAt: new Date().toISOString(),
    };

    this.listings.set(id, updated);
    console.log(`[ListingsStorage] Updated listing: ${id}`);
    return updated;
  }

  deleteListing(id: string): boolean {
    const deleted = this.listings.delete(id);
    if (deleted) {
      console.log(`[ListingsStorage] Deleted listing: ${id}`);
    }
    return deleted;
  }

  getListingsGroupedByCategory(): Record<string, Listing[]> {
    const grouped: Record<string, Listing[]> = {};

    for (const listing of this.listings.values()) {
      if (!grouped[listing.category]) {
        grouped[listing.category] = [];
      }
      grouped[listing.category].push(listing);
    }

    // Sort listings within each category by date
    for (const category in grouped) {
      grouped[category].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return grouped;
  }

  getStats() {
    const listings = this.getAllListings();
    return {
      total: listings.length,
      active: listings.filter((l) => l.status === 'active').length,
      sold: listings.filter((l) => l.status === 'sold').length,
      pending: listings.filter((l) => l.status === 'pending').length,
      paid: listings.filter((l) => l.isPaid).length,
      free: listings.filter((l) => !l.isPaid).length,
    };
  }
}

export const listingsStorage = new ListingsStorage();
