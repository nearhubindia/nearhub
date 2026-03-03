/**
 * Seed FREE30 promotional coupon for 30-day free subscriptions
 * Run with: npx tsx server/scripts/seed-free30-coupon.ts
 */

import '../data/env';

import { db } from '../data/db';
import { coupons } from '../features/admin/models/admin-settings';
import { eq } from 'drizzle-orm';

const FREE30_COUPON = {
  code: 'FREE30',
  discountPercentage: 100, // 100% discount = completely free
  maxUsageCount: 999999, // Unlimited uses
  usageCount: 0,
  isActive: true,
  expiresAt: null, // No expiration
  createdBy: 'system', // System-generated promotional coupon
};

async function seedFree30Coupon(): Promise<void> {
  try {
    console.log('[Seed] Starting FREE30 coupon seeding...\n');

    // Check if FREE30 already exists
    const existing = await db.query.coupons.findFirst({
      where: eq(coupons.code, 'FREE30'),
    });

    if (existing) {
      console.log('[Seed] ⚠️  FREE30 coupon already exists');
      console.log(`       ID: ${existing.id}`);
      console.log(`       Discount: ${existing.discountPercentage}%`);
      console.log(`       Usage: ${existing.usageCount}/${existing.maxUsageCount}`);
      console.log(`       Active: ${existing.isActive}`);
      console.log('\n[Seed] Skipping creation. Use admin panel to modify.');
      process.exit(0);
    }

    // Create FREE30 coupon
    const result = await db
      .insert(coupons)
      .values(FREE30_COUPON as any)
      .returning();

    if (result && result.length > 0) {
      const inserted = result[0];
      console.log('[Seed] ✅ Successfully created FREE30 coupon!');
      console.log(`       ID: ${inserted.id}`);
      console.log(`       Code: ${inserted.code}`);
      console.log(`       Discount: ${inserted.discountPercentage}% (COMPLETELY FREE)`);
      console.log(`       Max Usage: ${inserted.maxUsageCount} (Unlimited)`);
      console.log(`       Expires: ${inserted.expiresAt ? inserted.expiresAt : 'Never'}`);
      console.log(`       Active: ${inserted.isActive}`);
      console.log(
        '\n[Seed] 🎉 Sellers can now use code "FREE30" to get 30 days free subscription!'
      );
    }

    console.log(`\n[Seed] Complete!`);
    process.exit(0);
  } catch (error) {
    console.error('[Seed] ❌ Error seeding FREE30 coupon:', error);
    process.exit(1);
  }
}

seedFree30Coupon();
