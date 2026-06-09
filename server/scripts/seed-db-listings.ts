#!/usr/bin/env tsx
/**
 * Database Listings Seeding Script
 * Seeds realistic sample listings into the database
 *
 * Usage: npm run seed:listings
 */

import '../data/env';
import { closeDatabasePool, db } from '../data/db';
import { listings } from '../features/admin/models/admin-settings';
import { users } from '../features/users/models/users';
import { desc, sql } from 'drizzle-orm';

const CATEGORIES = ['Electronics', 'Vehicles', 'Furniture', 'Clothing', 'Sports', 'Books'];
const CONDITIONS = ['New', 'Like New', 'Good Condition', 'Used', 'Fair'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata'];

const PRODUCTS: Record<string, string[]> = {
  Electronics: [
    'iPhone',
    'Samsung Galaxy',
    'iPad',
    'MacBook',
    'Dell Laptop',
    'Sony TV',
    'Gaming Laptop',
  ],
  Vehicles: ['Honda City', 'Maruti Swift', 'Toyota Fortuner', 'Hyundai Creta', 'Royal Enfield'],
  Furniture: ['Sofa Set', 'Bed Frame', 'Dining Table', 'Bookshelf', 'Office Chair'],
  Clothing: ['Designer T-Shirt', 'Jeans', 'Formal Shirt', 'Saree', 'Winter Jacket'],
  Sports: ['Yoga Mat', 'Dumbbells', 'Cricket Bat', 'Badminton Racket', 'Tennis Racket'],
  Books: ['Self-Help Book', 'Fiction Novel', 'Technical Manual', 'History Book', 'Biography'],
};

async function seedListings() {
  console.log('[Seed] Starting listings seeding...');

  try {
    const sellers = await db
      .select({ id: users.id, mobile: users.mobile })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(20);

    if (sellers.length === 0) {
      console.log('[Seed] No users found. Run `npm run seed:users` first.');
      return;
    }

    // Check existing listings
    const existingListings = await db.select({ count: sql<number>`count(*)` }).from(listings);
    const existingSampleListings = await db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(sql`${listings.id} LIKE 'sample-discount-%'`);

    const existingListingsCount = Number(existingListings[0]?.count || 0);
    const existingSampleCount = Number(existingSampleListings[0]?.count || 0);
    console.log(`[Seed] Found ${existingListingsCount} existing listings`);

    if (existingSampleCount >= 24) {
      console.log(
        '[Seed] Database already has 24+ sample discounted listings. Skipping listings seed.'
      );
      return;
    }

    const totalListings = 24 - existingSampleCount;
    console.log(
      `[Seed] Found ${existingListingsCount} total listings and ${existingSampleCount} sample discounted listings.`
    );
    console.log(`[Seed] Inserting ${totalListings} sample discounted listings...`);

    let insertedCount = 0;
    const batchSize = 12;

    for (let i = 0; i < totalListings; i += batchSize) {
      const batch = [];
      for (let j = 0; j < Math.min(batchSize, totalListings - i); j++) {
        const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        const product = PRODUCTS[category][Math.floor(Math.random() * PRODUCTS[category].length)];
        const title = `${product} - ${CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)]}`;
        const price = Math.floor(Math.random() * 500000) + 500;
        const discountPercent = Math.floor(Math.random() * 26) + 10;
        const offerPrice = Math.max(1, Math.round(price * (1 - discountPercent / 100)));
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const seller = sellers[Math.floor(Math.random() * sellers.length)];

        batch.push({
          id: `sample-discount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}-${j}`,
          title,
          description: `${title} in excellent condition. ${discountPercent}% sample discount active. Available in ${city}. Contact for more details.`,
          category,
          price: price.toString(),
          offerPrice: offerPrice.toString(),
          condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
          location: `${city}, India`,
          contactPhone: seller.mobile || undefined,
          images: JSON.stringify([
            `https://via.placeholder.com/400?text=${encodeURIComponent(title)}+1`,
            `https://via.placeholder.com/400?text=${encodeURIComponent(title)}+2`,
            `https://via.placeholder.com/400?text=${encodeURIComponent(title)}+3`,
          ]),
          videos: JSON.stringify([]),
          status: 'active',
          isActive: true,
          sellerId: seller.id,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      if (batch.length > 0) {
        await db.insert(listings).values(batch as any);
        insertedCount += batch.length;
        console.log(`[Seed] ✓ Inserted ${insertedCount}/${totalListings} listings`);
      }
    }

    console.log(`[Seed] ✅ Listings seeding completed successfully`);
    console.log(`[Seed] Total inserted: ${insertedCount}`);
  } catch (error) {
    console.error('[Seed] Error:', error);
    process.exit(1);
  } finally {
    await closeDatabasePool();
  }
}

seedListings();
