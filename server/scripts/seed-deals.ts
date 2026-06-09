#!/usr/bin/env tsx
/**
 * Seed sample deal listings for web/mobile deal testing.
 *
 * Usage:
 *   npx tsx server/scripts/seed-deals.ts
 *   npm run seed:deals
 */

import '../data/env';
import { db } from '../data/db';
import { listings } from '../features/admin/models/admin-settings';
import { users } from '../features/users/models/users';
import { desc, eq, sql } from 'drizzle-orm';

type DealTemplate = {
  title: string;
  description: string;
  category: string;
  mainCategory: string;
  subCategory: string;
  price: number;
  offerPrice: number;
  location: string;
  condition?: string;
  dealType: 'normal' | 'combo';
  maxDealBookings: number;
  comboItems?: string[];
  dealTerms: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
};

const now = new Date();

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const DEALS: DealTemplate[] = [
  {
    title: 'Flash Deal: iPhone 15 Pro',
    description: 'Limited-time flash deal for in-store pickup only.',
    category: 'Mobiles',
    mainCategory: 'Electronics & Appliances',
    subCategory: 'Mobiles',
    price: 125000,
    offerPrice: 109999,
    location: 'Kurnool',
    condition: 'New',
    dealType: 'normal',
    maxDealBookings: 10,
    dealTerms: 'Valid today only. First come first serve.',
    startOffsetMinutes: -20,
    endOffsetMinutes: 70,
  },
  {
    title: 'Morning Deal: Breakfast Combo for 2',
    description: 'Restaurant combo deal with dine-in redemption.',
    category: 'Food',
    mainCategory: 'Food, Travel & Events',
    subCategory: 'Food',
    price: 799,
    offerPrice: 499,
    location: 'Kurnool',
    condition: 'New',
    dealType: 'combo',
    maxDealBookings: 25,
    comboItems: ['2x South Indian Breakfast', '2x Fresh Juice'],
    dealTerms: 'Redeem between 7 AM and 11 AM at counter.',
    startOffsetMinutes: -60,
    endOffsetMinutes: 180,
  },
  {
    title: 'Weekly Deal: Gym Membership Starter Pack',
    description: 'Special weekly package with trainer consultation.',
    category: 'Services',
    mainCategory: 'Jobs & Services',
    subCategory: 'Services',
    price: 4999,
    offerPrice: 2999,
    location: 'Nandyal',
    condition: 'New',
    dealType: 'normal',
    maxDealBookings: 40,
    dealTerms: 'Redeem within current week. ID proof required.',
    startOffsetMinutes: -12 * 60,
    endOffsetMinutes: 7 * 24 * 60,
  },
  {
    title: 'Combo Deal: Laptop + Backpack + Wireless Mouse',
    description: 'Back-to-college combo bundle with accessories.',
    category: 'Computers',
    mainCategory: 'Electronics & Appliances',
    subCategory: 'Computers',
    price: 72000,
    offerPrice: 64999,
    location: 'Hyderabad',
    condition: 'New',
    dealType: 'combo',
    maxDealBookings: 8,
    comboItems: ['Laptop Sleeve', 'Backpack', 'Wireless Mouse'],
    dealTerms: 'Only first 8 confirmed bookings eligible for combo gifts.',
    startOffsetMinutes: -15,
    endOffsetMinutes: 24 * 60,
  },
  {
    title: 'Upcoming Deal: Weekend Smart TV Drop',
    description: 'Preview deal for the upcoming electronics sale window.',
    category: 'Appliances',
    mainCategory: 'Electronics & Appliances',
    subCategory: 'Appliances',
    price: 45999,
    offerPrice: 38999,
    location: 'Kurnool',
    condition: 'New',
    dealType: 'normal',
    maxDealBookings: 15,
    dealTerms: 'Booking opens soon. Offer valid only during the deal window.',
    startOffsetMinutes: 90,
    endOffsetMinutes: 6 * 60,
  },
  {
    title: 'Closed Deal Sample: Salon Makeover Package',
    description: 'This deal is intentionally closed for UI testing.',
    category: 'Services',
    mainCategory: 'Jobs & Services',
    subCategory: 'Services',
    price: 2999,
    offerPrice: 1499,
    location: 'Bangalore',
    condition: 'New',
    dealType: 'normal',
    maxDealBookings: 12,
    dealTerms: 'Expired deal test entry.',
    startOffsetMinutes: -6 * 60,
    endOffsetMinutes: -2 * 60,
  },
];

async function seedDeals() {
  console.log('[Seed Deals] Preparing sample deals...');

  // Backfill deal-related columns for environments where migrations
  // have not yet been applied.
  await db.execute(
    sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_deal boolean NOT NULL DEFAULT false`
  );
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_type varchar(20)`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_start_at timestamp`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_end_at timestamp`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS max_deal_bookings integer`);
  await db.execute(
    sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_bookings_used integer NOT NULL DEFAULT 0`
  );
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS combo_items text`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_terms text`);
  await db.execute(
    sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS voucher_enabled boolean NOT NULL DEFAULT true`
  );

  const sellers = await db
    .select({ id: users.id, mobile: users.mobile, name: users.displayName })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(20);

  if (sellers.length === 0) {
    console.log('[Seed Deals] No users found. Run `npm run seed:users` first.');
    process.exit(1);
  }

  let inserted = 0;

  for (let i = 0; i < DEALS.length; i += 1) {
    const template = DEALS[i];
    const seller = sellers[i % sellers.length];
    const dealStartAt = minutesFromNow(template.startOffsetMinutes);
    const dealEndAt = minutesFromNow(template.endOffsetMinutes);
    const comboItemsJson = JSON.stringify(template.comboItems || []);

    const id = `deal-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `${template.title} ${now.getFullYear()}`;

    const values = {
      id,
      sellerId: seller.id,
      title,
      description: template.description,
      mainCategory: template.mainCategory,
      subCategory: template.subCategory,
      category: template.subCategory,
      listingType: 'mixed',
      price: template.price.toString(),
      offerPrice: template.offerPrice.toString(),
      condition: template.condition || 'New',
      location: template.location,
      images: JSON.stringify([
        `https://picsum.photos/seed/${encodeURIComponent(id)}-1/800/600`,
        `https://picsum.photos/seed/${encodeURIComponent(id)}-2/800/600`,
      ]),
      videos: JSON.stringify([]),
      status: 'active',
      isActive: true,
      isPaid: false,
      featured: true,
      sponsored: false,
      durationDays: 30,
      expiresAt: daysFromNow(30),
      contactPhone: seller.mobile || undefined,
      isDeal: true,
      dealType: template.dealType,
      dealStartAt,
      dealEndAt,
      maxDealBookings: template.maxDealBookings,
      dealBookingsUsed: 0,
      comboItems: comboItemsJson,
      dealTerms: template.dealTerms,
      voucherEnabled: true,
      createdAt: new Date(Date.now() - i * 3600_000),
      updatedAt: new Date(),
    };

    await db.insert(listings).values(values as any);
    inserted += 1;
  }

  const activeDeals = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(eq(listings.isDeal, true));

  console.log(`[Seed Deals] ✅ Inserted ${inserted} sample deal listings`);
  console.log(`[Seed Deals] Total deal listings in DB: ${activeDeals[0]?.count || 0}`);
}

seedDeals()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Seed Deals] Failed:', error);
    process.exit(1);
  });
