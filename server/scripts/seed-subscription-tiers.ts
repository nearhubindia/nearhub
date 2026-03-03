/**
 * Seed subscription tiers with pricing data
 * Run with: npx tsx server/scripts/seed-subscription-tiers.ts
 */

import '../data/env';

import { db } from '../data/db';
import { subscriptionTiers, type InsertSubscriptionTier } from '../features/admin/models/admin-settings';
import { eq } from 'drizzle-orm';

const TIERS: InsertSubscriptionTier[] = [
  // 30-Day Plans
  {
    name: 'Basic 30-Day',
    type: 'general',
    description: 'Perfect for trying out - 1 featured listing for 30 days',
    monthlyPrice: '99' as any,
    annualPrice: '999' as any,
    price: '99' as any,
    durationDays: 30,
    features: JSON.stringify(['featured']),
    maxListings: 10,
    featuredListingsPerMonth: 1,
    highlight: false,
    isActive: true,
  },
  {
    name: 'Standard 30-Day',
    type: 'general',
    description: 'Most popular - 5 featured listings with priority support for 30 days',
    monthlyPrice: '299' as any,
    annualPrice: '2999' as any,
    price: '299' as any,
    durationDays: 30,
    features: JSON.stringify(['featured', 'priority_support']),
    maxListings: 50,
    featuredListingsPerMonth: 5,
    highlight: true,
    isActive: true,
  },
  {
    name: 'Premium 30-Day',
    type: 'general',
    description: 'Unlimited power - Unlimited listings & verified badge for 30 days',
    monthlyPrice: '699' as any,
    annualPrice: '6999' as any,
    price: '699' as any,
    durationDays: 30,
    features: JSON.stringify(['featured', 'priority_support', 'verified_badge', 'advanced_analytics']),
    maxListings: -1,
    featuredListingsPerMonth: 999,
    highlight: false,
    isActive: true,
  },
  
  // 90-Day Plans (Quarterly)
  {
    name: 'Basic 90-Day',
    type: 'general',
    description: 'Quarterly plan - 3 featured listings for 90 days',
    monthlyPrice: '249' as any,
    annualPrice: '2499' as any,
    price: '249' as any,
    durationDays: 90,
    features: JSON.stringify(['featured']),
    maxListings: 30,
    featuredListingsPerMonth: 3,
    highlight: false,
    isActive: true,
  },
  {
    name: 'Standard 90-Day',
    type: 'general',
    description: 'Best value - 15 featured listings with priority support for 90 days',
    monthlyPrice: '799' as any,
    annualPrice: '7999' as any,
    price: '799' as any,
    durationDays: 90,
    features: JSON.stringify(['featured', 'priority_support']),
    maxListings: 150,
    featuredListingsPerMonth: 15,
    highlight: false,
    isActive: true,
  },
  {
    name: 'Premium 90-Day',
    type: 'general',
    description: 'Pro seller - Unlimited everything with analytics for 90 days',
    monthlyPrice: '1999' as any,
    annualPrice: '19999' as any,
    price: '1999' as any,
    durationDays: 90,
    features: JSON.stringify(['featured', 'priority_support', 'verified_badge', 'advanced_analytics']),
    maxListings: -1,
    featuredListingsPerMonth: 999,
    highlight: false,
    isActive: true,
  },
  
  // 180-Day Plans (Semi-Annual)
  {
    name: 'Basic 180-Day',
    type: 'general',
    description: 'Half-year plan - 6 featured listings for 180 days',
    monthlyPrice: '449' as any,
    annualPrice: '4499' as any,
    price: '449' as any,
    durationDays: 180,
    features: JSON.stringify(['featured']),
    maxListings: 60,
    featuredListingsPerMonth: 6,
    highlight: false,
    isActive: true,
  },
  {
    name: 'Standard 180-Day',
    type: 'general',
    description: 'Power seller - 30 featured listings with full support for 180 days',
    monthlyPrice: '1499' as any,
    annualPrice: '14999' as any,
    price: '1499' as any,
    durationDays: 180,
    features: JSON.stringify(['featured', 'priority_support', 'verified_badge']),
    maxListings: 300,
    featuredListingsPerMonth: 30,
    highlight: false,
    isActive: true,
  },
  {
    name: 'Ultra Premium 180-Day',
    type: 'general',
    description: 'Business tier - Unlimited everything, verified badge & analytics for 180 days',
    monthlyPrice: '3999' as any,
    annualPrice: '39999' as any,
    price: '3999' as any,
    durationDays: 180,
    features: JSON.stringify(['featured', 'priority_support', 'verified_badge', 'advanced_analytics', 'custom_branding']),
    maxListings: -1,
    featuredListingsPerMonth: 999,
    highlight: false,
    isActive: true,
  },
];

async function seedSubscriptionTiers() {
  try {
    console.log('[Seed] Starting subscription tiers seeding...');
    console.log(`[Seed] Found ${TIERS.length} tiers to seed\n`);

    let insertedCount = 0;

    console.log('[Seed] Clearing old tiers...');
    await db.delete(subscriptionTiers);
    console.log('[Seed] Old tiers cleared\n');

    for (const tier of TIERS) {
      const result = await db
        .insert(subscriptionTiers)
        .values(tier as any)
        .returning();

      if (result && result.length > 0) {
        const inserted = result[0];
        console.log(`[Seed] ✓ Created ${tier.name}`);
        console.log(`       ID: ${inserted.id}`);
        console.log(`       Price: $${tier.monthlyPrice}/mo or $${tier.annualPrice}/year`);
        console.log(`       Featured/month: ${tier.featuredListingsPerMonth}`);
        insertedCount++;
      }
    }

    console.log(`\n[Seed] Complete!`);
    console.log(`[Seed] Inserted: ${insertedCount}`);
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding subscription tiers:', error);
    process.exit(1);
  }
}

seedSubscriptionTiers();
