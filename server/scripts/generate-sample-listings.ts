/**
 * Generate 1000+ sample listings with images, videos, and multiple locations
 * Run with: npx tsx server/scripts/generate-sample-listings.ts
 */

import fetch from 'node-fetch';
import pincodeDatabase from '../data/pincodes.json' assert { type: 'json' };

interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

const PINCODES: PincodeData[] = pincodeDatabase as PincodeData[];

// Sample product templates by category
const PRODUCT_TEMPLATES = {
  Electronics: [
    { base: 'iPhone', prices: [35000, 45000, 55000, 75000, 115000] },
    { base: 'Samsung Galaxy', prices: [28000, 38000, 48000, 68000] },
    { base: 'iPad', prices: [35000, 55000, 85000] },
    { base: 'MacBook', prices: [95000, 135000, 165000, 195000] },
    { base: 'Dell Laptop', prices: [45000, 65000, 85000, 125000] },
    { base: 'Gaming Laptop', prices: [85000, 115000, 155000] },
    { base: 'Sony TV', prices: [45000, 65000, 95000, 145000] },
    { base: 'LG TV', prices: [42000, 62000, 92000, 142000] },
    { base: 'Samsung Fridge', prices: [35000, 55000, 75000] },
    { base: 'IFB Washing Machine', prices: [28000, 45000, 62000] },
    { base: 'Sony Speaker', prices: [8000, 15000, 25000, 45000] },
    { base: 'Bose Headphones', prices: [18000, 28000, 38000] },
    { base: 'GoPro Camera', prices: [35000, 45000, 55000] },
    { base: 'Canon DSLR', prices: [45000, 65000, 95000] },
    { base: 'Smart Watch', prices: [12000, 18000, 28000, 45000] },
  ],
  Vehicles: [
    { base: 'Honda City', prices: [850000, 950000, 1050000, 1150000] },
    { base: 'Maruti Swift', prices: [650000, 750000, 850000] },
    { base: 'Toyota Fortuner', prices: [2800000, 3200000, 3600000] },
    { base: 'Hyundai Creta', prices: [950000, 1150000, 1350000] },
    { base: 'BMW 3 Series', prices: [3500000, 4200000, 5000000] },
    { base: 'Audi A4', prices: [3200000, 3900000, 4500000] },
    { base: 'Royal Enfield', prices: [150000, 185000, 220000] },
    { base: 'Hero Splendor', prices: [65000, 75000, 85000] },
    { base: 'TVS Jupiter', prices: [75000, 85000, 95000] },
  ],
  Furniture: [
    { base: 'Sofa Set', prices: [25000, 35000, 45000, 65000] },
    { base: 'Bed Frame', prices: [15000, 25000, 35000, 55000] },
    { base: 'Dining Table', prices: [18000, 28000, 38000, 55000] },
    { base: 'Bookshelf', prices: [8000, 12000, 18000] },
    { base: 'Office Chair', prices: [8000, 12000, 18000, 28000] },
    { base: 'Wardrobe', prices: [18000, 28000, 38000, 55000] },
  ],
  Clothing: [
    { base: 'Designer T-Shirt', prices: [800, 1200, 1800] },
    { base: 'Jeans', prices: [1200, 1800, 2500] },
    { base: 'Formal Shirt', prices: [1500, 2200, 3200] },
    { base: 'Saree', prices: [2000, 3500, 5000, 8000] },
    { base: 'Lehenga', prices: [5000, 8000, 12000] },
    { base: 'Winter Jacket', prices: [2500, 3800, 5500] },
  ],
  'Home & Garden': [
    { base: 'Plant Pot', prices: [500, 800, 1200] },
    { base: 'Indoor Plant', prices: [800, 1500, 2500] },
    { base: 'Garden Tools Set', prices: [2000, 3500, 5000] },
    { base: 'Curtains', prices: [1500, 2500, 4000] },
    { base: 'Bed Sheet', prices: [1000, 1500, 2500] },
  ],
  Sports: [
    { base: 'Football', prices: [1200, 1800, 2500] },
    { base: 'Cricket Bat', prices: [2500, 4000, 6000] },
    { base: 'Badminton Racket', prices: [1500, 2500, 4000] },
    { base: 'Yoga Mat', prices: [800, 1200, 1800] },
    { base: 'Dumbbells', prices: [5000, 8000, 12000] },
  ],
};

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];
const LISTING_TYPES = ['sell', 'buy', 'service', 'job'];

// Image URLs from Unsplash (public, free)
const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=400&h=400&fit=crop', // iPhone
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', // Watches
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop', // Camera
  'https://images.unsplash.com/photo-1588405457003-ca6628fda944?w=400&h=400&fit=crop', // Laptop
  'https://images.unsplash.com/photo-1559056199-641a0ac8b3f4?w=400&h=400&fit=crop', // TV
  'https://images.unsplash.com/photo-1487636042519-e21cc028cb29?w=400&h=400&fit=crop', // Smartphone
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop', // Headphones
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop', // Shoes
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', // Watch
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop', // Car
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop', // Sofa
  'https://images.unsplash.com/photo-1539932840990-b6e3ac2991ae?w=400&h=400&fit=crop', // Furniture
  'https://images.unsplash.com/photo-1552062407-291826315935?w=400&h=400&fit=crop', // Fashion
  'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop', // Plant
  'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop', // Sports
];

// Video URLs (short, public)
const VIDEO_URLS = [
  'https://commondatastorage.googleapis.com/gtv-videos-library/sample/big_buck_bunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-library/sample/elephant_dream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-library/sample/for_bigger_blazes.mp4',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomPincode(): PincodeData {
  return getRandomItem(PINCODES);
}

function generateProductTitle(category: keyof typeof PRODUCT_TEMPLATES): string {
  const templates = PRODUCT_TEMPLATES[category];
  if (!templates) return `Product in ${category}`;

  const template = getRandomItem(templates);
  const variants = ['', 'Pro', 'Max', 'Plus', 'Ultra', '2024', 'Latest'];
  const sizes = ['128GB', '256GB', '512GB', '1TB', '32"', '43"', '55"', '65"', '2L', '3L', '5L'];
  const variant = getRandomItem(variants);
  const size = getRandomItem(sizes);

  return [template.base, variant, size].filter(Boolean).join(' ');
}

function generateDescription(title: string): string {
  const descriptors = [
    'Brand new, unused, sealed in original packaging',
    'Like new condition, barely used, perfect condition',
    'Good condition, minor wear, works perfectly',
    'Gently used, well maintained, everything functional',
    'Used, some signs of use, still works great',
  ];

  const features = [
    'Excellent performance and reliability',
    'Premium build quality',
    'Latest technology features',
    'Perfect for everyday use',
    'Ideal for professionals',
    'Great value for money',
  ];

  return `${getRandomItem(descriptors)}. ${title} - ${getRandomItem(features)}. All accessories included.`;
}

function generateListingPrice(category: keyof typeof PRODUCT_TEMPLATES): number {
  const templates = PRODUCT_TEMPLATES[category];
  if (!templates || templates.length === 0) {
    return getRandomInt(5000, 500000);
  }

  const template = getRandomItem(templates);
  const basePrice = getRandomItem(template.prices);
  const variance = getRandomInt(-20, 20); // ±20% variance
  return Math.round(basePrice * (1 + variance / 100));
}

async function generateSampleListings(): Promise<void> {
  const listings = [];
  const categories = Object.keys(PRODUCT_TEMPLATES) as Array<keyof typeof PRODUCT_TEMPLATES>;
  const totalListings = 1000;
  const sellerCount = 150; // Create variety of sellers

  console.log(
    `🚀 Generating ${totalListings} sample listings across ${categories.length} categories...`
  );
  console.log(`📍 Using ${PINCODES.length} different pincodes for geographic distribution...\n`);

  for (let i = 0; i < totalListings; i++) {
    const category = getRandomItem(categories);
    const pincode = getRandomPincode();
    const sellerId = `seller-${String(getRandomInt(1, sellerCount)).padStart(3, '0')}`;
    const title = generateProductTitle(category);
    const listingType = getRandomItem(LISTING_TYPES);

    const listing = {
      sellerId,
      title,
      description: generateDescription(title),
      category,
      price: generateListingPrice(category),
      priceUnit: 'per unit',
      condition: getRandomItem(CONDITIONS),
      location: pincode.city,
      pincode: pincode.pincode,
      latitude: pincode.latitude,
      longitude: pincode.longitude,
      images: [getRandomItem(IMAGE_URLS), getRandomItem(IMAGE_URLS), getRandomItem(IMAGE_URLS)],
      videoUrl: getRandomInt(0, 10) > 6 ? getRandomItem(VIDEO_URLS) : undefined, // 30% have videos
      listingType: listingType,
      isPaid: getRandomInt(0, 10) > 3, // 60% are paid listings
      durationDays: getRandomInt(0, 10) > 6 ? getRandomInt(7, 90) : undefined,
    };

    listings.push(listing);

    if ((i + 1) % 100 === 0) {
      console.log(`✓ Generated ${i + 1}/${totalListings} listings...`);
    }
  }

  console.log(`\n✅ Generated ${totalListings} listings successfully!\n`);

  // Send to backend
  console.log('📤 Uploading listings to backend...');

  let successCount = 0;
  let errorCount = 0;
  const API_URL = 'http://localhost:5000';

  for (let i = 0; i < listings.length; i++) {
    try {
      const listing = listings[i];

      const response = await fetch(`${API_URL}/api/subscriptions/create-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: listing.sellerId,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: listing.price,
          priceUnit: listing.priceUnit,
          condition: listing.condition,
          location: listing.location,
          pincode: listing.pincode,
          latitude: listing.latitude,
          longitude: listing.longitude,
          images: listing.images,
          listingType: listing.listingType,
        }),
      });

      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
      }

      if ((i + 1) % 100 === 0 || i === listings.length - 1) {
        console.log(
          `📊 Progress: ${i + 1}/${listings.length} (Success: ${successCount}, Errors: ${errorCount})`
        );
      }
    } catch (error) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`❌ Error uploading listing ${i}:`, error);
      }
    }
  }

  console.log(`\n✅ Upload complete!`);
  console.log(`   📈 Successful: ${successCount}/${listings.length}`);
  console.log(`   ❌ Failed: ${errorCount}/${listings.length}`);
  console.log(`\n📍 Listings distributed across:`);
  console.log(`   🏙️  ${categories.length} categories`);
  console.log(`   🌍 ${new Set(listings.map((l) => l.location)).size} unique cities`);
  console.log(`   👥 ~${sellerCount} sellers`);
  console.log(
    `   🎥 ~${Math.round((listings.filter((l) => l.videoUrl).length / listings.length) * 100)}% with videos`
  );
  console.log(
    `   💰 Prices: ₹${Math.min(...listings.map((l) => l.price as number)).toLocaleString('en-IN')} - ₹${Math.max(...listings.map((l) => l.price as number)).toLocaleString('en-IN')}`
  );
}

// Run the generator
generateSampleListings().catch(console.error);
