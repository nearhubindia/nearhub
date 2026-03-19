/**
 * Backfill missing transactions rows from paid user subscriptions.
 *
 * Usage:
 *   npm run backfill:transactions
 *   npm run backfill:transactions -- --dry-run
 */

import { sql } from 'drizzle-orm';

interface BackfillCandidateSummary {
  count: number;
}

interface BackfillPreviewRow {
  subscription_id: string;
  user_id: string;
  payment_id: string;
  order_id: string;
  amount: string;
}

interface BackfillInsertRow {
  id: string;
  subscription_id: string;
  payment_id: string;
  amount: string;
}

interface SqlExecutor {
  execute: (query: any) => unknown;
}

interface BackfillOptions {
  dryRun: boolean;
  executor: SqlExecutor;
}

interface BackfillResult {
  candidateCount: number;
  insertedCount: number;
}

export function parseArgs(argv: string[]): { dryRun: boolean } {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillResult> {
  const { dryRun, executor } = options;
  console.log(`[Backfill] Starting transactions backfill${dryRun ? ' (dry-run)' : ''}...`);

  const candidatePredicate = sql`
    us.status = 'active'
    AND COALESCE(NULLIF(btrim(us.payment_id), ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(btrim(us.order_id), ''), NULL) IS NOT NULL
    AND us.order_id <> 'FREE_SUBSCRIPTION'
    AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      WHERE (t.payment_id IS NOT NULL AND t.payment_id = us.payment_id)
         OR (t.subscription_id = us.id AND t.order_id = us.order_id)
    )
  `;

  const summaryResult = (await executor.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM user_subscriptions us
    WHERE ${candidatePredicate}
  `)) as unknown as { rows: BackfillCandidateSummary[] };

  const candidateCount = Number(summaryResult.rows?.[0]?.count || 0);
  console.log(`[Backfill] Eligible subscriptions missing transactions: ${candidateCount}`);

  if (candidateCount === 0) {
    console.log('[Backfill] Nothing to backfill. Exiting.');
    return { candidateCount: 0, insertedCount: 0 };
  }

  const previewResult = (await executor.execute(sql`
    SELECT
      us.id AS subscription_id,
      us.user_id,
      us.payment_id,
      us.order_id,
      COALESCE(
        (
          SELECT i.subtotal::text
          FROM invoices i
          WHERE i.subscription_id = us.id
          ORDER BY i.created_at DESC
          LIMIT 1
        ),
        COALESCE(st.offer_price, st.price, 0)::text
      ) AS amount
    FROM user_subscriptions us
    LEFT JOIN subscription_tiers st ON st.id = us.subscription_tier_id
    WHERE ${candidatePredicate}
    ORDER BY us.updated_at DESC
    LIMIT 10
  `)) as unknown as { rows: BackfillPreviewRow[] };

  console.log('[Backfill] Preview (up to 10 rows):');
  previewResult.rows.forEach((row, index) => {
    console.log(
      `  ${index + 1}. subscription=${row.subscription_id} user=${row.user_id} payment=${row.payment_id} amount=${row.amount}`
    );
  });

  if (dryRun) {
    console.log('[Backfill] Dry-run complete. No rows inserted.');
    return { candidateCount, insertedCount: 0 };
  }

  const insertResult = (await executor.execute(sql`
    INSERT INTO transactions (
      subscription_id,
      seller_id,
      amount,
      payment_status,
      payment_id,
      order_id,
      razorpay_data,
      created_at,
      completed_at
    )
    SELECT
      us.id AS subscription_id,
      us.user_id AS seller_id,
      COALESCE(
        (
          SELECT i.subtotal
          FROM invoices i
          WHERE i.subscription_id = us.id
          ORDER BY i.created_at DESC
          LIMIT 1
        ),
        COALESCE(st.offer_price, st.price, 0)
      ) AS amount,
      'completed' AS payment_status,
      us.payment_id,
      us.order_id,
      json_build_object(
        'source',
        'backfill-user-subscriptions',
        'subscriptionId',
        us.id,
        'backfilledAt',
        CURRENT_TIMESTAMP
      )::text AS razorpay_data,
      COALESCE(us.subscribed_at, CURRENT_TIMESTAMP) AS created_at,
      COALESCE(us.updated_at, CURRENT_TIMESTAMP) AS completed_at
    FROM user_subscriptions us
    LEFT JOIN subscription_tiers st ON st.id = us.subscription_tier_id
    WHERE ${candidatePredicate}
    RETURNING id, subscription_id, payment_id, amount::text
  `)) as unknown as { rows: BackfillInsertRow[] };

  console.log(`[Backfill] Inserted transactions: ${insertResult.rows.length}`);
  if (insertResult.rows.length > 0) {
    console.log('[Backfill] Sample inserted rows:');
    insertResult.rows.slice(0, 10).forEach((row, index) => {
      console.log(
        `  ${index + 1}. tx=${row.id} subscription=${row.subscription_id} payment=${row.payment_id} amount=${row.amount}`
      );
    });
  }

  return { candidateCount, insertedCount: insertResult.rows.length };
}

async function runCli(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const { db, closeDatabasePool } = await import('../data/db');

  try {
    await runBackfill({
      dryRun,
      executor: db,
    });
  } catch (error) {
    console.error('[Backfill] Failed:', error);
    process.exitCode = 1;
  } finally {
    await closeDatabasePool();
  }
}

const invokedAsScript =
  typeof process.argv[1] === 'string' &&
  process.argv[1].includes('backfill-transactions') &&
  !process.env.JEST_WORKER_ID;

if (invokedAsScript) {
  void runCli();
}
