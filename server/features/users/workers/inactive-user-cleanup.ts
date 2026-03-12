import {
  processApprovedUserDeletions,
  queueInactiveUsersForReview,
} from '../services/user-lifecycle';

export async function runInactiveUserCleanupJob(options?: {
  inactivityDays?: number;
  scanLimit?: number;
  cleanupLimit?: number;
  dryRun?: boolean;
}): Promise<{
  scan: Awaited<ReturnType<typeof queueInactiveUsersForReview>>;
  cleanup: Awaited<ReturnType<typeof processApprovedUserDeletions>>;
}> {
  const scan = await queueInactiveUsersForReview({
    inactivityDays:
      options?.inactivityDays !== undefined ? Number(options.inactivityDays) : undefined,
    limit: Number(options?.scanLimit || 1000),
  });

  const cleanup = await processApprovedUserDeletions({
    limit: Number(options?.cleanupLimit || 200),
    dryRun: Boolean(options?.dryRun),
  });

  return { scan, cleanup };
}
