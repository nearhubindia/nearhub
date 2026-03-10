import { db } from '../data/db';
import { listings } from '../features/admin/models/admin-settings';
import { and, desc, eq } from 'drizzle-orm';

interface ScriptOptions {
  sellerId: string;
  listingId?: string;
}

function parseArgs(argv: string[]): ScriptOptions {
  const defaults: ScriptOptions = {
    sellerId: '9704569280',
  };

  for (const arg of argv) {
    if (arg.startsWith('--seller=')) {
      defaults.sellerId = arg.split('=')[1] || defaults.sellerId;
    }
    if (arg.startsWith('--listingId=')) {
      defaults.listingId = arg.split('=')[1] || undefined;
    }
  }

  return defaults;
}

async function expireExistingListing(listingId: string) {
  const now = new Date();
  const expiredAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const updated = await db
    .update(listings)
    .set({
      status: 'active',
      isActive: true,
      isPaid: true,
      durationDays: 45,
      expiresAt: expiredAt,
      updatedAt: now,
    })
    .where(eq(listings.id, listingId))
    .returning();

  return updated[0] || null;
}

async function createExpiredListingForSeller(sellerId: string) {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const expiredAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const inserted = await db
    .insert(listings)
    .values({
      sellerId,
      title: 'DEV TEST - Expired Listing for Renew Flow',
      description: 'Backend-seeded expired listing for payment renew testing.',
      category: 'Electronics',
      listingType: 'image',
      price: '42000',
      condition: 'good',
      location: 'Hyderabad',
      pincode: '500001',
      latitude: '17.385',
      longitude: '78.4867',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600',
      ]),
      videos: JSON.stringify([]),
      status: 'active',
      isActive: true,
      isPaid: true,
      durationDays: 45,
      expiresAt: expiredAt,
      createdAt,
      updatedAt: now,
    } as any)
    .returning();

  return inserted[0] || null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sellerId = options.sellerId.replace(/[\s+-]/g, '');

  if (options.listingId) {
    const updated = await expireExistingListing(options.listingId);
    if (!updated) {
      console.error(
        `[SeedExpiredListing] Listing not found for listingId=${options.listingId}. Nothing updated.`
      );
      process.exit(1);
    }

    console.log('[SeedExpiredListing] Expired specific listing successfully.');
    console.log(
      JSON.stringify(
        {
          mode: 'expire-specific',
          sellerId,
          listingId: updated.id,
          expiresAt: updated.expiresAt,
          status: updated.status,
          isActive: updated.isActive,
          isPaid: updated.isPaid,
        },
        null,
        2
      )
    );
    return;
  }

  const existing = await db
    .select()
    .from(listings)
    .where(and(eq(listings.sellerId, sellerId), eq(listings.isPaid, true)))
    .orderBy(desc(listings.createdAt))
    .limit(1);

  if (existing.length > 0) {
    const updated = await expireExistingListing(existing[0].id);
    if (updated) {
      console.log('[SeedExpiredListing] Expired latest paid listing for seller.');
      console.log(
        JSON.stringify(
          {
            mode: 'expire-latest',
            sellerId,
            listingId: updated.id,
            title: updated.title,
            expiresAt: updated.expiresAt,
            status: updated.status,
            isActive: updated.isActive,
            isPaid: updated.isPaid,
          },
          null,
          2
        )
      );
      return;
    }
  }

  const created = await createExpiredListingForSeller(sellerId);
  if (!created) {
    console.error('[SeedExpiredListing] Failed to create expired listing.');
    process.exit(1);
  }

  console.log('[SeedExpiredListing] Created expired listing for seller.');
  console.log(
    JSON.stringify(
      {
        mode: 'create-expired',
        sellerId,
        listingId: created.id,
        title: created.title,
        expiresAt: created.expiresAt,
        status: created.status,
        isActive: created.isActive,
        isPaid: created.isPaid,
      },
      null,
      2
    )
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SeedExpiredListing] Script failed:', error);
    process.exit(1);
  });
