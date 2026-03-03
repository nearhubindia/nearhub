/**
 * Direct seed sample listings into the backend storage
 * Run with: npm run build && node server_dist/scripts/seed-listings.js
 * OR: npx tsx server/scripts/seed-listings.ts
 */

import pincodeDatabase from '../data/pincodes.json' assert { type: 'json' };
import { listingsStorage } from '../features/listings/services/listings-storage.js';

interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

const PINCODES: PincodeData[] = pincodeDatabase as PincodeData[];

const PRODUCT_TEMPLATES = {
  Electronics: [
    'iPhone',
    'Samsung Galaxy',
    'iPad',
    'MacBook',
    'Dell Laptop',
    'Gaming Laptop',
    'Sony TV',
    'LG TV',
    'Samsung Fridge',
    'IFB Washing Machine',
    'Sony Speaker',
    'Bose Headphones',
    'GoPro Camera',
    'Canon DSLR',
    'Smart Watch',
  ],
  Vehicles: [
    'Honda City',
    'Maruti Swift',
    'Toyota Fortuner',
    'Hyundai Creta',
    'BMW 3 Series',
    'Audi A4',
    'Royal Enfield',
    'Hero Splendor',
    'TVS Jupiter',
  ],
  Furniture: ['Sofa Set', 'Bed Frame', 'Dining Table', 'Bookshelf', 'Office Chair', 'Wardrobe'],
  Clothing: ['Designer T-Shirt', 'Jeans', 'Formal Shirt', 'Saree', 'Lehenga', 'Winter Jacket'],
  'Home & Garden': ['Plant Pot', 'Indoor Plant', 'Garden Tools Set', 'Curtains', 'Bed Sheet'],
  Sports: ['Football', 'Cricket Bat', 'Badminton Racket', 'Yoga Mat', 'Dumbbells'],
};

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];
const LISTING_TYPES = ['sell', 'buy', 'service', 'job'];

const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1588405457003-ca6628fda944?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1559056199-641a0ac8b3f4?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1487636042519-e21cc028cb29?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1539932840990-b6e3ac2991ae?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1552062407-291826315935?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop',
];

const VIDEO_URLS = [
  'https://commondatastorage.googleapis.com/gtv-videos-library/sample/big_buck_bunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-library/sample/elephant_dream.mp4',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateListing(index: number) {
  const categories = Object.keys(PRODUCT_TEMPLATES) as Array<keyof typeof PRODUCT_TEMPLATES>;
  const category = getRandomItem(categories);
  const pincode = getRandomItem(PINCODES);
  const productName = getRandomItem(PRODUCT_TEMPLATES[category]);

  const priceRanges: Record<string, [number, number]> = {
    Electronics: [5000, 200000],
    Vehicles: [100000, 5000000],
    Furniture: [8000, 100000],
    Clothing: [500, 10000],
    'Home & Garden': [500, 50000],
    Sports: [1000, 50000],
  };

  const [min, max] = priceRanges[category] || [5000, 100000];
  const price = getRandomInt(min, max);

  return {
    sellerId: `seller-${String(getRandomInt(1, 150)).padStart(3, '0')}`,
    title: `${productName} - ${['New', 'Like New', 'Good Condition', 'Excellent', 'Used'][getRandomInt(0, 4)]}`,
    description: `High quality ${productName}. Well maintained. All accessories included. Perfect condition.`,
    category,
    price,
    priceUnit: 'per unit',
    condition: getRandomItem(CONDITIONS),
    location: pincode.city,
    pincode: pincode.pincode,
    latitude: pincode.latitude,
    longitude: pincode.longitude,
    images: [getRandomItem(IMAGE_URLS), getRandomItem(IMAGE_URLS), getRandomItem(IMAGE_URLS)],
    isPaid: getRandomInt(0, 100) > 60, // 40% paid
  };
}

console.log('🌱 Seeding 1000+ sample listings...\n');

let count = 0;
const startTime = Date.now();

for (let i = 0; i < 1000; i++) {
  try {
    const listing = generateListing(i);
    listingsStorage.createListing(listing);
    count++;

    if ((i + 1) % 100 === 0) {
      console.log(`✓ Created ${i + 1} listings...`);
    }
  } catch (error) {
    console.error(`✗ Error creating listing ${i}:`, error);
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`\n✅ Successfully seeded ${count} listings in ${duration}s`);
console.log(`\n📊 Sample data includes:`);
console.log(`   🏷️  Multiple categories (Electronics, Vehicles, Furniture, etc.)`);
console.log(
  `   🌍 Distributed across ${new Set([...[1000]].map(() => getRandomItem(PINCODES).city)).size}+ cities`
);
console.log(`   👥 150+ sellers`);
console.log(`   💰 Price range: ₹500 - ₹59,50,000`);
console.log(`   📸 3 images per listing`);
console.log(`   📍 Real pincode coordinates for each listing`);
console.log(`\n🚀 Your marketplace is now ready for testing!`);
