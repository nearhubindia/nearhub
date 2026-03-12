import { sql } from 'drizzle-orm';

import { db } from '../../../data/db';
import { listingViews, notificationLogs } from '../../admin/models/admin-settings';

export async function runDataRetentionCleanupJob(options?: {
  listingViewsDays?: number;
  notificationLogsDays?: number;
}): Promise<{
  listingViewsDeleted: number;
  notificationLogsDeleted: number;
}> {
  const listingViewsDays = Math.max(1, Number(options?.listingViewsDays || 90));
  const notificationLogsDays = Math.max(1, Number(options?.notificationLogsDays || 30));

  const listingResult = await db.execute(sql`
    WITH deleted AS (
      DELETE FROM ${listingViews}
      WHERE viewed_at < NOW() - (${String(listingViewsDays)} || ' days')::interval
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM deleted
  `);

  const notificationResult = await db.execute(sql`
    WITH deleted AS (
      DELETE FROM ${notificationLogs}
      WHERE sent_at < NOW() - (${String(notificationLogsDays)} || ' days')::interval
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM deleted
  `);

  const listingViewsDeleted = Number((listingResult as any).rows?.[0]?.count || 0);
  const notificationLogsDeleted = Number((notificationResult as any).rows?.[0]?.count || 0);

  return {
    listingViewsDeleted,
    notificationLogsDeleted,
  };
}
