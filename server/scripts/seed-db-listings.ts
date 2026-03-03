#!/usr/bin/env tsx
/**
 * Database Listings Seeding Script
 * Seeds realistic sample listings into the database
 * 
 * Usage: npm run seed:listings
 */

import '../data/env';
import { db } from '../data/db';
import { listings } from '../features/admin/models/admin-settings';

const CATEGORIES = ['Electronics', 'Vehicles', 'Furniture', 'Clothing', 'Sports', 'Books'];
const CONDITIONS = ['New', 'Like New', 'Good Condition', 'Used', 'Fair'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata'];

const PRODUCTS: Record<string, string[]> = {
  Electronics: ['iPhone', 'Samsung Galaxy', 'iPad', 'MacBook', 'Dell Laptop', 'Sony TV', 'Gaming Laptop'],
  Vehicles: ['Honda City', 'Maruti Swift', 'Toyota Fortuner', 'Hyundai Creta', 'Royal Enfield'],
  Furniture: ['Sofa Set', 'Bed Frame', 'Dining Table', 'Bookshelf', 'Office Chair'],
  Clothing: ['Designer T-Shirt', 'Jeans', 'Formal Shirt', 'Saree', 'Winter Jacket'],
  Sports: ['Yoga Mat', 'Dumbbells', 'Cricket Bat', 'Badminton Racket', 'Tennis Racket'],
  Books: ['Self-Help Book', 'Fiction Novel', 'Technical Manual', 'History Book', 'Biography'],
};

const SELLERS = ['seller001', 'seller002', 'seller003', 'seller004', 'seller005', 'seller006', 'seller007', 'seller008', 'seller009', 'seller010'];

async function seedListings() {
  console.log('[Seed] Starting listings seeding...');

  try {
    // Check existing listings
    const existingListings = await db.select().from(listings);
    console.log(`[Seed] Found ${existingListings.length} existing listings`);

    if (existingListings.length > 100) {
      console.log('[Seed] Database already has 100+ listings. Skipping listings seed.');
      return;
    }

    console.log('[Seed] Inserting 500 sample listings...');

    let insertedCount = 0;
    const batchSize = 50;
    const totalListings = 500;

    for (let i = 0; i < totalListings; i += batchSize) {
      const batch = [];
      for (let j = 0; j < Math.min(batchSize, totalListings - i); j++) {
        const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        const product = PRODUCTS[category][Math.floor(Math.random() * PRODUCTS[category].length)];
        const title = `${product} - ${CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)]}`;
        const price = Math.floor(Math.random() * 500000) + 500;
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const seller = SELLERS[Math.floor(Math.random() * SELLERS.length)];

        batch.push({
          id: `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}-${j}`,
          title,
          description: `${title} in excellent condition. Available in ${city}. Contact for more details.`,
          category,
          price: price.toString(),
          condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
          location: `${city}, India`,
          images: JSON.stringify([
            `https://via.placeholder.com/400?text=${encodeURIComponent(title)}+1`,
            `https://via.placeholder.com/400?text=${encodeURIComponent(title)}+2`,
            `https://via.placeholder.com/400?text=${encodeURIComponent(title)}+3`,
          ]),
          videos: JSON.stringify([]),
          status: 'active',
          isActive: true,
          sellerId: seller,
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
  }
}

seedListings();
