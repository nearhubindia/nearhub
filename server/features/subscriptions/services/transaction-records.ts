import { and, eq, or } from 'drizzle-orm';
import { db } from '../../../data/db';
import { subscriptions, transactions } from '../models/subscription';

export interface CompletedTransactionInput {
  subscriptionId: string;
  userId: string;
  amount: number;
  paymentId: string;
  orderId: string;
  razorpayData?: unknown;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

async function resolveTransactionSubscriptionId(
  subscriptionId: string,
  paymentId: string,
  orderId: string
): Promise<string | null> {
  const matchingSubscription = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      or(
        eq(subscriptions.id, subscriptionId),
        eq(subscriptions.razorpayPaymentId, paymentId),
        eq(subscriptions.razorpayOrderId, orderId)
      )
    )
    .limit(1);

  return matchingSubscription[0]?.id ?? null;
}

export async function upsertCompletedTransaction(
  params: CompletedTransactionInput
): Promise<void> {
  const { subscriptionId, userId, amount, paymentId, orderId, razorpayData } = params;
  const amountString = roundToTwo(amount).toFixed(2);
  const now = new Date();
  const serializedGatewayData =
    razorpayData !== undefined ? JSON.stringify(razorpayData) : JSON.stringify({});

  const transactionSubscriptionId = await resolveTransactionSubscriptionId(
    subscriptionId,
    paymentId,
    orderId
  );

  const existing = await db
    .select({
      id: transactions.id,
    })
    .from(transactions)
    .where(
      or(
        eq(transactions.paymentId, paymentId),
        and(eq(transactions.subscriptionId, subscriptionId), eq(transactions.orderId, orderId))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(transactions)
      .set({
        subscriptionId: transactionSubscriptionId,
        sellerId: userId,
        amount: amountString,
        paymentStatus: 'completed',
        paymentId,
        orderId,
        razorpayData: serializedGatewayData,
        completedAt: now,
      })
      .where(eq(transactions.id, existing[0].id));
    return;
  }

  await db.insert(transactions).values({
    subscriptionId: transactionSubscriptionId,
    sellerId: userId,
    amount: amountString,
    paymentStatus: 'completed',
    paymentId,
    orderId,
    razorpayData: serializedGatewayData,
    completedAt: now,
  });
}

