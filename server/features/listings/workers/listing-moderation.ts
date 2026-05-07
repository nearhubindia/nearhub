import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings } from '../../admin/models/admin-settings';
import { moderateListingWithGemini } from '../../../shared/ai/gemini-moderation';
import { notifyAdminListingPendingReview } from '../../../shared/services/auto-notifications';

type ModerationQueueRow = {
  id: string;
  listing_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
};

function parseMediaField(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean);
    return [String(parsed)];
  } catch {
    return [raw];
  }
}

function serializeReasons(reasons: string[]): string {
  return reasons
    .map((reason) => reason.trim())
    .filter(Boolean)
    .join('; ');
}

export async function enqueueListingModeration(listingId: string): Promise<void> {
  const id = String(listingId || '').trim();
  if (!id) return;
  await db.execute(sql`
    INSERT INTO listing_moderation_queue (listing_id, status, attempts, updated_at, processed_at)
    VALUES (${id}, 'pending', 0, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT (listing_id) DO UPDATE
    SET status = 'pending',
        attempts = 0,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP,
        processed_at = NULL
  `);
}

async function claimNextJob(): Promise<ModerationQueueRow | null> {
  const result = await db.execute(sql`
    UPDATE listing_moderation_queue q
    SET status = 'processing',
        attempts = q.attempts + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE q.id = (
      SELECT id
      FROM listing_moderation_queue
      WHERE status = 'pending'
        AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING q.id, q.listing_id, q.status, q.attempts, q.max_attempts
  `);

  const rows = Array.isArray((result as any).rows)
    ? ((result as any).rows as ModerationQueueRow[])
    : [];
  return rows[0] || null;
}

export async function processListingModerationQueue(batchSize = 10): Promise<{
  processed: number;
  autoApproved: number;
  manualReview: number;
  failed: number;
}> {
  let processed = 0;
  let autoApproved = 0;
  let manualReview = 0;
  let failed = 0;

  for (let i = 0; i < batchSize; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;

    try {
      const listing = await db.query.listings.findFirst({
        where: eq(listings.id, job.listing_id),
      });

      if (!listing) {
        await db.execute(sql`
          UPDATE listing_moderation_queue
          SET status = 'failed',
              last_error = 'Listing not found',
              updated_at = CURRENT_TIMESTAMP,
              processed_at = CURRENT_TIMESTAMP
          WHERE id = ${job.id}
        `);
        failed++;
        continue;
      }

      if (String(listing.status || '').toLowerCase() !== 'pending') {
        await db.execute(sql`
          UPDATE listing_moderation_queue
          SET status = 'completed',
              last_error = NULL,
              updated_at = CURRENT_TIMESTAMP,
              processed_at = CURRENT_TIMESTAMP
          WHERE id = ${job.id}
        `);
        continue;
      }

      const imageUrls = parseMediaField(listing.images);
      const videoUrls = parseMediaField(listing.videos);
      const decision = await moderateListingWithGemini({
        title: String(listing.title || ''),
        description: String(listing.description || ''),
        category: String(listing.category || ''),
        imageUrls,
        videoUrls,
      });

      if (decision.shouldAutoApprove) {
        await db
          .update(listings)
          .set({ status: 'active', isActive: true, updatedAt: new Date() } as any)
          .where(and(eq(listings.id, listing.id), eq(listings.status, 'pending')));
        autoApproved++;
      } else {
        manualReview++;
        notifyAdminListingPendingReview({
          listingId: listing.id,
          listingTitle: listing.title,
          userId: String(listing.sellerId || ''),
          location: String(listing.location || ''),
          category: String(listing.category || ''),
        }).catch((error) => {
          console.error('[ListingModerationWorker] Failed admin notification:', error);
        });
      }

      await db.execute(sql`
        UPDATE listing_moderation_queue
        SET status = 'completed',
            confidence = ${decision.confidence},
            reasons = ${serializeReasons(decision.reasons)},
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ${job.id}
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown moderation error';
      const reachedMax = job.attempts >= job.max_attempts;
      await db.execute(sql`
        UPDATE listing_moderation_queue
        SET status = ${reachedMax ? 'failed' : 'pending'},
            last_error = ${message},
            updated_at = CURRENT_TIMESTAMP,
            processed_at = ${reachedMax ? sql`CURRENT_TIMESTAMP` : null}
        WHERE id = ${job.id}
      `);
      failed++;
    }
  }

  return { processed, autoApproved, manualReview, failed };
}
