/**
 * Seed subscription tiers with pricing data
 * Run with:
 *   npx tsx server/scripts/seed-subscription-tiers.ts
 *   npx tsx server/scripts/seed-subscription-tiers.ts --launch
 */

import '../data/env';

import { db } from '../data/db';
import {
  subscriptionTiers,
  type InsertSubscriptionTier,
} from '../features/admin/models/admin-settings';
import { sql } from 'drizzle-orm';

interface PhaseSeedOptions {
  launchMode: boolean;
}

function getPhaseOneTiers(opts: PhaseSeedOptions): InsertSubscriptionTier[] {
  const isLaunch = opts.launchMode;
  const freeMaxListings = isLaunch ? 7 : 5;
  const premium30 = isLaunch ? 49 : 99;
  const premium90 = isLaunch ? 149 : 249;
  const premium180 = isLaunch ? 249 : 399;

  const freeFeatures = [
    'free_plan',
    'browse_local',
    'chat',
    'basic_visibility',
    'images_up_to_5',
    'listing_duration_30_days',
  ];

  const premiumFeatures = [
    'premium_seller',
    'priority_search',
    'seller_badge',
    'basic_analytics',
    'auto_renew_listings',
    'listing_duration_45_days',
  ];

  if (isLaunch) {
    premiumFeatures.push('launch_offer_50_percent');
    premiumFeatures.push('free_plan_one_boost');
  }

  return [
    {
      name: isLaunch ? 'Free Plan (Launch)' : 'Free Plan',
      type: 'general',
      description: isLaunch
        ? 'Launch mode: free sellers can keep up to 7 active listings for 30 days.'
        : 'Basic free plan for casual sellers with up to 5 active listings for 30 days.',
      monthlyPrice: '0' as any,
      annualPrice: '0' as any,
      price: '0' as any,
      durationDays: 30,
      features: JSON.stringify(freeFeatures),
      maxListings: freeMaxListings,
      featuredListingsPerMonth: isLaunch ? 1 : 0,
      highlight: false,
      isActive: true,
    },
    {
      name: isLaunch ? 'Premium Seller 30 Days (Launch)' : 'Premium Seller 30 Days',
      type: 'general',
      description: 'Premium seller plan with 25 active listings and 3 boosts per month.',
      monthlyPrice: String(premium30) as any,
      annualPrice: String(premium30 * 12) as any,
      price: String(premium30) as any,
      durationDays: 30,
      features: JSON.stringify(premiumFeatures),
      maxListings: 25,
      featuredListingsPerMonth: 3,
      highlight: true,
      isActive: true,
    },
    {
      name: isLaunch ? 'Premium Seller 90 Days (Launch)' : 'Premium Seller 90 Days',
      type: 'general',
      description: 'Best value quarterly premium plan with priority placement and analytics.',
      monthlyPrice: String(isLaunch ? 50 : 83) as any,
      annualPrice: String((isLaunch ? 149 : 249) * 4) as any,
      price: String(premium90) as any,
      durationDays: 90,
      features: JSON.stringify(premiumFeatures),
      maxListings: 25,
      featuredListingsPerMonth: 3,
      highlight: false,
      isActive: true,
    },
    {
      name: isLaunch ? 'Premium Seller 180 Days (Launch)' : 'Premium Seller 180 Days',
      type: 'general',
      description: 'Long-term premium plan with lowest effective monthly price.',
      monthlyPrice: String(isLaunch ? 42 : 66) as any,
      annualPrice: String((isLaunch ? 249 : 399) * 2) as any,
      price: String(premium180) as any,
      durationDays: 180,
      features: JSON.stringify(premiumFeatures),
      maxListings: 25,
      featuredListingsPerMonth: 3,
      highlight: false,
      isActive: true,
    },
  ];
}

function parseArgs(argv: string[]): PhaseSeedOptions {
  const launchMode = argv.includes('--launch');
  return { launchMode };
}

async function seedSubscriptionTiers() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const TIERS = getPhaseOneTiers(options);

    console.log('[Seed] Starting subscription tiers seeding...');
    console.log(`[Seed] Mode: ${options.launchMode ? 'LAUNCH' : 'STANDARD'}`);
    console.log(`[Seed] Found ${TIERS.length} tiers to seed\n`);

    let insertedCount = 0;

    console.log('[Seed] Clearing old tiers...');
    // Remove dependent subscriptions first to avoid FK constraint failures in non-empty DBs.
    await db.execute(sql`DELETE FROM user_subscriptions`);
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
        console.log(`       Price: ₹${tier.price} (${tier.durationDays} days)`);
        console.log(`       Max listings: ${tier.maxListings}`);
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
