import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { userStarterCredits } from '../../admin/models/admin-settings';
import { getAdminSettings } from '../../admin/services/admin-settings';

export interface StarterCreditsSummary {
  isActive: boolean;
  listingsTotal: number;
  listingsUsed: number;
  listingsRemaining: number;
  boostsTotal: number;
  boostsUsed: number;
  boostsRemaining: number;
}

function toSummary(row?: {
  isActive: boolean;
  listingsTotal: number;
  listingsUsed: number;
  boostsTotal: number;
  boostsUsed: number;
} | null): StarterCreditsSummary {
  const listingsTotal = Number(row?.listingsTotal || 0);
  const listingsUsed = Number(row?.listingsUsed || 0);
  const boostsTotal = Number(row?.boostsTotal || 0);
  const boostsUsed = Number(row?.boostsUsed || 0);
  const isActive = Boolean(row?.isActive ?? true);

  return {
    isActive,
    listingsTotal,
    listingsUsed,
    listingsRemaining: Math.max(0, listingsTotal - listingsUsed),
    boostsTotal,
    boostsUsed,
    boostsRemaining: Math.max(0, boostsTotal - boostsUsed),
  };
}

export async function grantStarterCreditsIfEligible(
  userId: string,
  options?: { grantedBy?: string; listingsCount?: number; boostsCount?: number }
): Promise<StarterCreditsSummary> {
  const existing = await db
    .select()
    .from(userStarterCredits)
    .where(eq(userStarterCredits.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return toSummary(existing[0] as any);
  }

  const settings = await getAdminSettings();
  const starterEnabled = Boolean(settings.starterCreditsEnabled ?? true);
  const listingsCount = Math.max(
    0,
    Number(options?.listingsCount ?? settings.starterListingsCount ?? 2)
  );
  const boostsCount = Math.max(0, Number(options?.boostsCount ?? settings.starterBoostsCount ?? 2));

  const inserted = await db
    .insert(userStarterCredits)
    .values({
      userId,
      isActive: starterEnabled,
      listingsTotal: starterEnabled ? listingsCount : 0,
      boostsTotal: starterEnabled ? boostsCount : 0,
      grantedBy: options?.grantedBy || 'system',
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    return toSummary(inserted[0] as any);
  }

  // Race-safe fallback after onConflictDoNothing
  const row = await db
    .select()
    .from(userStarterCredits)
    .where(eq(userStarterCredits.userId, userId))
    .limit(1);
  return toSummary((row[0] as any) || null);
}

export async function getStarterCreditsSummary(userId: string): Promise<StarterCreditsSummary> {
  const row = await db
    .select()
    .from(userStarterCredits)
    .where(eq(userStarterCredits.userId, userId))
    .limit(1);
  return toSummary((row[0] as any) || null);
}

export async function consumeStarterListingCredit(
  userId: string
): Promise<{ listingsRemaining: number } | null> {
  const updated = await db
    .update(userStarterCredits)
    .set({
      listingsUsed: sql`${userStarterCredits.listingsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userStarterCredits.userId, userId),
        eq(userStarterCredits.isActive, true),
        sql`${userStarterCredits.listingsUsed} < ${userStarterCredits.listingsTotal}`
      )
    )
    .returning({
      listingsTotal: userStarterCredits.listingsTotal,
      listingsUsed: userStarterCredits.listingsUsed,
    });

  if (updated.length === 0) return null;
  const row = updated[0];
  return {
    listingsRemaining: Math.max(0, Number(row.listingsTotal || 0) - Number(row.listingsUsed || 0)),
  };
}

export async function releaseStarterListingCredit(userId: string): Promise<void> {
  await db
    .update(userStarterCredits)
    .set({
      listingsUsed: sql`GREATEST(${userStarterCredits.listingsUsed} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(userStarterCredits.userId, userId));
}

export async function consumeStarterBoostCredit(
  userId: string
): Promise<{ boostsRemaining: number } | null> {
  const updated = await db
    .update(userStarterCredits)
    .set({
      boostsUsed: sql`${userStarterCredits.boostsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userStarterCredits.userId, userId),
        eq(userStarterCredits.isActive, true),
        sql`${userStarterCredits.boostsUsed} < ${userStarterCredits.boostsTotal}`
      )
    )
    .returning({
      boostsTotal: userStarterCredits.boostsTotal,
      boostsUsed: userStarterCredits.boostsUsed,
    });

  if (updated.length === 0) return null;
  const row = updated[0];
  return {
    boostsRemaining: Math.max(0, Number(row.boostsTotal || 0) - Number(row.boostsUsed || 0)),
  };
}
