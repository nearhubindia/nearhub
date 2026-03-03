/**
 * Generate sample seed data JSON file for listings
 * Run with: npx tsx server/scripts/generate-seed-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import pincodeDatabase from '../data/pincodes.json' assert { type: 'json' };

interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

const PINCODES: PincodeData[] = pincodeDatabase as PincodeData[];

const PRODUCTS = {
  Electronics: [
    { name: 'iPhone 15', prices: [80000, 95000, 110000, 125000] },
    { name: 'Samsung Galaxy', prices: [50000, 65000, 85000] },
    { name: 'iPad', prices: [45000, 65000, 85000] },
    { name: 'MacBook', prices: [125000, 165000, 195000] },
    { name: 'Dell Laptop', prices: [55000, 75000, 95000] },
    { name: 'Gaming Laptop', prices: [95000, 135000, 165000] },
    { name: '4K TV', prices: [55000, 75000, 95000] },
    { name: 'Washing Machine', prices: [35000, 48000, 65000] },
    { name: 'Refrigerator', prices: [45000, 65000, 95000] },
    { name: 'Speaker', prices: [8000, 15000, 25000] },
    { name: 'Headphones', prices: [5000, 12000, 28000] },
    { name: 'Smartwatch', prices: [12000, 20000, 35000] },
  ],
  Vehicles: [
    { name: 'Honda City', prices: [850000, 950000, 1050000] },
    { name: 'Maruti Swift', prices: [650000, 750000, 850000] },
    { name: 'Toyota Fortuner', prices: [2800000, 3200000, 3600000] },
    { name: 'Hyundai Creta', prices: [950000, 1150000, 1350000] },
    { name: 'Motorcycle', prices: [150000, 200000, 280000] },
    { name: 'Scooter', prices: [60000, 80000, 95000] },
  ],
  Furniture: [
    { name: 'Sofa Set', prices: [25000, 35000, 55000] },
    { name: 'Bed Frame', prices: [15000, 25000, 40000] },
    { name: 'Dining Table', prices: [18000, 28000, 45000] },
    { name: 'Wardrobe', prices: [18000, 28000, 45000] },
    { name: 'Office Desk', prices: [12000, 20000, 35000] },
  ],
  Clothing: [
    { name: 'T-Shirt', prices: [400, 800, 1200] },
    { name: 'Jeans', prices: [1200, 1800, 2500] },
    { name: 'Formal Shirt', prices: [1500, 2200, 3200] },
    { name: 'Saree', prices: [2000, 3500, 5500] },
    { name: 'Winter Jacket', prices: [2500, 3800, 5500] },
  ],
  'Real Estate': [
    { name: '1 BHK Apartment', prices: [3500000, 4500000, 5500000] },
    { name: '2 BHK Apartment', prices: [6500000, 8500000, 10500000] },
    { name: '3 BHK Apartment', prices: [10500000, 13500000, 16500000] },
    { name: 'Commercial Space', prices: [25000000, 35000000, 50000000] },
  ],
  Sports: [
    { name: 'Cricket Equipment', prices: [2500, 4000, 6000] },
    { name: 'Badminton Racket', prices: [1500, 2500, 4000] },
    { name: 'Gym Dumbbells', prices: [5000, 8000, 12000] },
    { name: 'Yoga Mat', prices: [800, 1200, 1800] },
  ],
};

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1588405457003-ca6628fda944?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1559056199-641a0ac8b3f4?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1487636042519-e21cc028cb29?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1539932840990-b6e3ac2991ae?w=400&h=400&fit=crop',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateListings(count: number) {
  const listings: any[] = [];
  const categories = Object.keys(PRODUCTS) as Array<keyof typeof PRODUCTS>;
  const listingTypes = ['image', 'image', 'image', 'mixed', 'mixed', 'video']; // Most have images, some mixed, few video-only
  const statuses = ['active', 'active', 'active', 'sold', 'pending']; // Most are active
  const durationOptions = [15, 45, 90, 180]; // Days options

  for (let i = 0; i < count; i++) {
    const category = getRandomItem(categories);
    const product = getRandomItem(PRODUCTS[category]);
    const pincode = getRandomItem(PINCODES);
    const price = getRandomItem(product.prices);
    const listingType = getRandomItem(listingTypes);
    const status = getRandomItem(statuses);
    const durationDays = getRandomItem(durationOptions);

    // Calculate expiry date based on duration and current time
    const createdDate = new Date(Date.now() - getRandomInt(0, 180) * 24 * 60 * 60 * 1000); // 0-180 days ago
    const expiryDate = new Date(createdDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Generate 5 images for all listings
    const images = [
      getRandomItem(IMAGE_URLS),
      getRandomItem(IMAGE_URLS),
      getRandomItem(IMAGE_URLS),
      getRandomItem(IMAGE_URLS),
      getRandomItem(IMAGE_URLS),
    ];

    // Generate 0-2 videos (less common than images)
    const videoCount =
      listingType === 'video' ? 1 : listingType === 'mixed' ? getRandomInt(1, 2) : 0;
    const videos =
      videoCount > 0
        ? Array.from(
            { length: videoCount },
            () => `https://example.com/videos/product-${getRandomInt(1000, 9999)}.mp4`
          )
        : undefined;

    listings.push({
      sellerId: `seller-${String(getRandomInt(1, 150)).padStart(3, '0')}`,
      title: `${product.name} - ${['', 'Pro', 'Plus', 'Max', 'Ultra'][getRandomInt(0, 4)]}`.trim(),
      description: `${product.name}. Excellent condition. Well maintained. All accessories. Perfect for everyday use.`,
      category,
      listingType,
      price,
      priceUnit: 'per unit',
      condition: getRandomItem(CONDITIONS),
      location: pincode.city,
      pincode: pincode.pincode,
      latitude: pincode.latitude,
      longitude: pincode.longitude,
      images,
      videos,
      status,
      isActive: status === 'active',
      isPaid: getRandomInt(0, 100) > 60,
      featured: getRandomInt(0, 100) > 90,
      durationDays,
      expiresAt: expiryDate.toISOString(),
    });
  }

  return listings;
}

console.log('🌱 Generating 1000+ sample listings...');
const listings = generateListings(1000);

const outputPath = './data/seed-listings.json';
fs.writeFileSync(outputPath, JSON.stringify(listings, null, 2));

console.log(`✅ Generated ${listings.length} listings`);
console.log(`📄 Saved to: ${outputPath}`);
console.log(`\n📊 Data includes:`);
console.log(`   🏷️  ${Object.keys(PRODUCTS).length} categories`);
console.log(`   🌍 ${new Set(listings.map((l) => l.location)).size} unique cities`);
console.log(`   👥 150+ sellers`);
console.log(
  `   💰 Price range: ₹${Math.min(...listings.map((l) => l.price)).toLocaleString('en-IN')} - ₹${Math.max(...listings.map((l) => l.price)).toLocaleString('en-IN')}`
);
