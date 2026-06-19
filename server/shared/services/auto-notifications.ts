/**
 * Auto-Notification Service
 * Automatically sends push notifications for key events
 */

import { broadcastPushNotification, sendPushToUser, sendPushToUsers } from './push-notifications';
import { createInAppNotification } from './in-app-notifications';
import type { Listing } from '../../features/admin/models/admin-settings';

/**
 * Send notification when a new listing is created
 */
export async function notifyNewListing(listing: Listing): Promise<void> {
  try {
    const category = listing.category || 'item';
    const location = listing.location || 'your area';

    await broadcastPushNotification({
      title: `🆕 New ${category} listing`,
      body: `${listing.title} • ${location} • ₹${listing.price}`,
      data: {
        type: 'new_listing',
        listingId: listing.id,
        category,
      },
      userType: 'buyer',
      notificationType: 'new_listing',
      channelId: 'new_listing',
    });

    console.log(`[Auto-Notify] New listing notification sent for: ${listing.title}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send new listing notification:', error);
  }
}

/**
 * Create an in-app notification when a deal becomes visible to buyers.
 */
export async function notifyDealPublished(listing: Listing): Promise<void> {
  try {
    if (!listing.isDeal || !listing.id) return;

    const location = listing.location ? ` in ${listing.location}` : '';
    const price = listing.offerPrice || listing.price;

    await createInAppNotification({
      userId: null,
      userType: 'all',
      title: 'New Deal Available',
      message: `${listing.title}${location}${price ? ` - Rs. ${price}` : ''}`,
      type: 'success',
      category: 'deal',
      referenceId: listing.id,
      priority: 'high',
      actionLabel: 'View Deal',
      actionUrl: `/listing/${listing.id}`,
      createdBy: 'system',
    });

    console.log(`[Auto-Notify] Deal notification created for listing: ${listing.id}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to create deal notification:', error);
  }
}

/**
 * Send notification when listing price drops
 */
export async function notifyPriceDrop(
  listing: Listing,
  oldPrice: number,
  newPrice: number
): Promise<void> {
  try {
    const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    await broadcastPushNotification({
      title: `💰 Price Drop Alert - ${discount}% OFF`,
      body: `${listing.title} is now ₹${newPrice} (was ₹${oldPrice})`,
      data: {
        type: 'price_drop',
        listingId: listing.id,
        oldPrice,
        newPrice,
        discount,
      },
      userType: 'buyer',
      notificationType: 'price_drop',
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Price drop notification sent for: ${listing.title}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send price drop notification:', error);
  }
}

/**
 * Send notification when a listing is about to expire
 */
export async function notifyListingExpiringSoon(
  listing: Listing,
  userId: string,
  daysLeft: number,
  reminderDays?: number,
  reminderKey?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `⏰ Listing Expiring Soon`,
      body: `"${listing.title}" will expire in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}. Renew now!`,
      data: {
        type: 'expiring_soon',
        listingId: listing.id,
        daysLeft,
        reminderDays: reminderDays ?? daysLeft,
        expiresAt: listing.expiresAt ? new Date(listing.expiresAt).toISOString() : undefined,
        reminderKey,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Expiring soon notification sent for: ${listing.title}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send expiring soon notification:', error);
  }
}

/**
 * Send notification when a message is received
 */
export async function notifyNewMessage(
  recipientId: string,
  senderName: string,
  message: string,
  conversationId: string,
  senderId?: string,
  listingId?: string
): Promise<void> {
  try {
    const normalizedRecipient = String(recipientId || '').trim();
    const normalizedSender = String(senderId || '').trim();
    if (!normalizedRecipient) return;
    if (normalizedSender && normalizedRecipient === normalizedSender) {
      console.warn('[Auto-Notify] Skipping self-message push notification', {
        recipientId: normalizedRecipient,
        senderId: normalizedSender,
        conversationId,
      });
      return;
    }

    await sendPushToUser(recipientId, {
      title: `💬 New message from ${senderName}`,
      body: message.substring(0, 100),
      data: {
        type: 'message',
        conversationId,
        ...(listingId ? { listingId } : {}),
        sender: senderName,
        actionUrl: listingId
          ? `/chat/${encodeURIComponent(listingId)}?conversationId=${encodeURIComponent(conversationId)}`
          : `/chat/${encodeURIComponent(conversationId)}?conversationId=${encodeURIComponent(conversationId)}`,
      },
      channelId: 'messages',
      priority: 'high',
    });

    console.log(`[Auto-Notify] New message notification sent to user: ${recipientId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send message notification:', error);
  }
}

/**
 * Send notification when someone is interested in a seller's listing
 */
export async function notifyListingInterest(
  userId: string,
  listingTitle: string,
  buyerName: string,
  listingId: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `👀 Interest in your listing`,
      body: `${buyerName} is interested in "${listingTitle}"`,
      data: {
        type: 'listing_interest',
        listingId,
        buyer: buyerName,
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Interest notification sent for listing: ${listingTitle}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send interest notification:', error);
  }
}

/**
 * Send notification when a listing is sold
 */
export async function notifyListingSold(
  userId: string,
  listingTitle: string,
  price: number,
  listingId?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `🎉 Congratulations! Item Sold`,
      body: `"${listingTitle}" sold for ₹${price}`,
      data: {
        type: 'listing_sold',
        amount: price,
        ...(listingId ? { listingId } : {}),
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Sold notification sent for listing: ${listingTitle}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send sold notification:', error);
  }
}

/**
 * Send notification for subscription renewal reminder
 */
export async function notifySubscriptionRenewal(
  userId: string,
  planName: string,
  expiresAt: Date,
  reminderDays?: number,
  reminderKey?: string
): Promise<void> {
  try {
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await sendPushToUser(userId, {
      title: `📅 Subscription Renewal Reminder`,
      body: `Your ${planName} plan expires in ${daysLeft} days. Renew now to keep your listings active!`,
      data: {
        type: 'subscription_renewal',
        planName,
        expiresAt: expiresAt.toISOString(),
        daysLeft,
        reminderDays: reminderDays ?? daysLeft,
        reminderKey,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Renewal reminder sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send renewal reminder:', error);
  }
}

/**
 * Send notification for nearby listings based on user location
 */
export async function notifyNearbyListings(
  userId: string,
  category: string,
  count: number,
  location: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `📍 ${count} new ${category} near you`,
      body: `Check out ${count} new listings in ${location}`,
      data: {
        type: 'nearby_listings',
        category,
        count,
        location,
      },
      channelId: 'new_listing',
    });

    console.log(`[Auto-Notify] Nearby listings notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send nearby listings notification:', error);
  }
}

/**
 * Send daily digest of new listings
 */
export async function sendDailyDigest(
  userId: string,
  listingsCount: number,
  categories: string[]
): Promise<void> {
  try {
    const categoryText = categories.slice(0, 3).join(', ');

    await sendPushToUser(userId, {
      title: `📰 Daily Digest`,
      body: `${listingsCount} new listings today in ${categoryText} and more!`,
      data: {
        type: 'daily_digest',
        listingsCount,
        categories,
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Daily digest sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send daily digest:', error);
  }
}

// ============================================================================
// PAYMENT & INVOICE NOTIFICATIONS
// ============================================================================

/**
 * Send notification when payment is successful
 */
export async function notifyPaymentSuccess(
  userId: string,
  amount: number,
  paymentId: string,
  listingTitle?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `✅ Payment Successful`,
      body: listingTitle
        ? `Payment of ₹${amount} received for "${listingTitle}"`
        : `Payment of ₹${amount} processed successfully`,
      data: {
        type: 'payment_success',
        amount,
        paymentId,
        listingTitle,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Payment success notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send payment success notification:', error);
  }
}

/**
 * Send notification when payment fails
 */
export async function notifyPaymentFailed(
  userId: string,
  amount: number,
  reason?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `❌ Payment Failed`,
      body: reason
        ? `Payment of ₹${amount} failed: ${reason}`
        : `Payment of ₹${amount} could not be processed. Please try again.`,
      data: {
        type: 'payment_failed',
        amount,
        reason,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Payment failed notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send payment failed notification:', error);
  }
}

/**
 * Send notification when invoice is generated
 */
export async function notifyInvoiceGenerated(
  userId: string,
  invoiceNumber: string,
  amount: number,
  invoiceUrl?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `📄 Invoice Generated`,
      body: `Invoice #${invoiceNumber} for ₹${amount} is ready. Tap to view.`,
      data: {
        type: 'invoice_generated',
        invoiceNumber,
        amount,
        invoiceUrl,
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Invoice notification sent to user: ${userId} - ${invoiceNumber}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send invoice notification:', error);
  }
}

/**
 * Send notification when subscription expires
 */
export async function notifySubscriptionExpired(
  userId: string,
  planName: string,
  listingTitle?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `⚠️ Subscription Expired`,
      body: listingTitle
        ? `Your ${planName} subscription for "${listingTitle}" has expired. Renew to keep it active.`
        : `Your ${planName} subscription has expired. Renew now!`,
      data: {
        type: 'subscription_expired',
        planName,
        listingTitle,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Subscription expired notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send subscription expired notification:', error);
  }
}

// ============================================================================
// ACCOUNT & MODERATION NOTIFICATIONS
// ============================================================================

/**
 * Send notification when user account is suspended
 */
export async function notifyAccountSuspended(
  userId: string,
  reason: string,
  duration?: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `🚫 Account Suspended`,
      body: duration
        ? `Your account has been suspended for ${duration}. Reason: ${reason}`
        : `Your account has been suspended. Reason: ${reason}`,
      data: {
        type: 'account_suspended',
        reason,
        duration,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Account suspended notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send account suspended notification:', error);
  }
}

/**
 * Send notification when user account is unsuspended
 */
export async function notifyAccountUnsuspended(userId: string): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `✅ Account Restored`,
      body: `Your account has been unsuspended. You can now access all features.`,
      data: {
        type: 'account_unsuspended',
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Account unsuspended notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send account unsuspended notification:', error);
  }
}

// ============================================================================
// SPAM & REPORT NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a spam report is filed against user
 */
export async function notifySpamReportFiled(
  userId: string,
  reason: string,
  reportCount: number
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `⚠️ Report Received`,
      body: `Your account has been reported for ${reason}. Total reports: ${reportCount}. Please review our community guidelines.`,
      data: {
        type: 'spam_report_filed',
        reason,
        reportCount,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Spam report notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send spam report notification:', error);
  }
}

/**
 * Send notification when report is reviewed
 */
export async function notifyReportReviewed(
  reporterId: string,
  reportedUserId: string,
  status: 'approved' | 'dismissed',
  reason: string
): Promise<void> {
  try {
    // Notify reporter
    await sendPushToUser(reporterId, {
      title: status === 'approved' ? `✅ Report Confirmed` : `ℹ️ Report Reviewed`,
      body:
        status === 'approved'
          ? `Your report for ${reason} has been confirmed. Action has been taken.`
          : `Your report has been reviewed and dismissed. Thank you for helping keep our community safe.`,
      data: {
        type: 'report_reviewed',
        status,
        reason,
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Report review notification sent to reporter: ${reporterId}`);

    // Notify reported user if approved
    if (status === 'approved') {
      await sendPushToUser(reportedUserId, {
        title: `⚠️ Report Action Taken`,
        body: `A report against your account for ${reason} has been confirmed. Please review our guidelines.`,
        data: {
          type: 'report_action_taken',
          reason,
        },
        channelId: 'default',
        priority: 'high',
      });

      console.log(
        `[Auto-Notify] Report action notification sent to reported user: ${reportedUserId}`
      );
    }
  } catch (error) {
    console.error('[Auto-Notify] Failed to send report reviewed notification:', error);
  }
}

// ============================================================================
// COUPON NOTIFICATIONS
// ============================================================================

/**
 * Send notification about available coupon
 */
export async function notifyCouponAvailable(
  userId: string,
  couponCode: string,
  discountPercent: number,
  expiresAt: Date
): Promise<void> {
  try {
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await sendPushToUser(userId, {
      title: `🎟️ Special Coupon Available!`,
      body: `Use code ${couponCode} for ${discountPercent}% OFF. Valid for ${daysLeft} days!`,
      data: {
        type: 'coupon_available',
        couponCode,
        discountPercent,
        expiresAt: expiresAt.toISOString(),
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Coupon notification sent to user: ${userId} - ${couponCode}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send coupon notification:', error);
  }
}

/**
 * Send notification when coupon is applied successfully
 */
export async function notifyCouponApplied(
  userId: string,
  couponCode: string,
  discountAmount: number,
  listingTitle: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `✅ Coupon Applied!`,
      body: `${couponCode} applied! You saved ₹${discountAmount} on "${listingTitle}"`,
      data: {
        type: 'coupon_applied',
        couponCode,
        discountAmount,
        listingTitle,
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Coupon applied notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send coupon applied notification:', error);
  }
}

// ============================================================================
// LISTING LIFECYCLE NOTIFICATIONS
// ============================================================================

/**
 * Send notification when listing is approved by admin
 */
export async function notifyListingApproved(
  userId: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title: `✅ Listing Approved`,
      body: `"${listingTitle}" has been approved and is now live!`,
      data: {
        type: 'listing_approved',
        listingId,
        listingTitle,
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Listing approved notification sent to seller: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send listing approved notification:', error);
  }
}

/**
 * Send notification when listing is rejected by admin
 */
export async function notifyListingRejected(
  userId: string,
  listingTitle: string,
  reason: string
): Promise<void> {
  try {
    const targetIds = getUserNotificationTargets(userId);
    await sendPushToUsers(targetIds, {
      title: `❌ Listing Rejected`,
      body: `"${listingTitle}" was not approved. Reason: ${reason}`,
      data: {
        type: 'listing_rejected',
        listingTitle,
        reason,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Listing rejected notification sent to seller: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send listing rejected notification:', error);
  }
}

function getUserNotificationTargets(userId: string): string[] {
  const raw = String(userId || '').trim();
  if (!raw) return [];

  const targets = new Set<string>([raw]);
  const digits = raw.replace(/\D/g, '');
  if (digits) targets.add(digits);

  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (last10) {
    targets.add(last10);
    targets.add(`+91${last10}`);
  }

  return [...targets];
}

/**
 * Send notification when listing is renewed
 */
export async function notifyListingRenewed(
  userId: string,
  listingTitle: string,
  newExpiryDate: Date,
  listingId?: string
): Promise<void> {
  try {
    const expiryDateStr = newExpiryDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    await sendPushToUser(userId, {
      title: `🔄 Listing Renewed`,
      body: `"${listingTitle}" has been renewed! New expiry: ${expiryDateStr}`,
      data: {
        type: 'listing_renewed',
        listingTitle,
        expiresAt: newExpiryDate.toISOString(),
        ...(listingId ? { listingId } : {}),
      },
      channelId: 'default',
    });

    console.log(`[Auto-Notify] Listing renewed notification sent to seller: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send listing renewed notification:', error);
  }
}

/**
 * Send notification when saved listing has price drop
 */
export async function notifySavedListingPriceDrop(
  userId: string,
  listingTitle: string,
  oldPrice: number,
  newPrice: number,
  listingId: string
): Promise<void> {
  try {
    const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    await sendPushToUser(userId, {
      title: `💰 Price Drop on Saved Item!`,
      body: `"${listingTitle}" dropped from ₹${oldPrice} to ₹${newPrice} (${discount}% OFF)`,
      data: {
        type: 'saved_listing_price_drop',
        listingId,
        listingTitle,
        oldPrice,
        newPrice,
        discount,
      },
      channelId: 'default',
      priority: 'high',
    });

    console.log(`[Auto-Notify] Saved listing price drop notification sent to user: ${userId}`);
  } catch (error) {
    console.error('[Auto-Notify] Failed to send saved listing price drop notification:', error);
  }
}

/**
 * Send notification when listing reaches view milestone
 */
export async function notifyViewMilestone(
  userId: string,
  listingId: string,
  listingTitle: string,
  viewCount: number
): Promise<void> {
  try {
    const milestoneEmojis: Record<number, string> = {
      100: '🎯',
      500: '🔥',
      1000: '🚀',
      5000: '⭐',
      10000: '💎',
      50000: '🏆',
      100000: '👑',
    };

    const emoji = milestoneEmojis[viewCount] || '🎉';

    await sendPushToUser(userId, {
      title: `${emoji} Milestone Reached!`,
      body: `Your listing "${listingTitle}" has reached ${viewCount.toLocaleString()} views!`,
      data: {
        type: 'view_milestone',
        listingId,
        listingTitle,
        viewCount,
        milestone: viewCount,
      },
      channelId: 'default',
      priority: 'default',
    });

    console.log(
      `[Auto-Notify] View milestone (${viewCount}) notification sent to seller: ${userId}`
    );
  } catch (error) {
    console.error('[Auto-Notify] Failed to send view milestone notification:', error);
  }
}

/**
 * Send in-app notification to admins when a listing is submitted for approval
 */
export async function notifyAdminListingPendingReview({
  listingId,
  listingTitle,
  userId,
  location,
  category,
}: {
  listingId: string;
  listingTitle: string;
  userId: string;
  location?: string;
  category?: string;
}): Promise<void> {
  try {
    const details = [category, location].filter(Boolean).join(' | ');
    const detailSuffix = details ? ` (${details})` : '';

    await createInAppNotification({
      userId: null,
      userType: 'admin',
      title: 'Listing Needs Approval',
      message: `"${listingTitle}" by ${userId} is pending review${detailSuffix}.`,
      type: 'warning',
      category: 'listing',
      referenceId: listingId,
      priority: 'high',
      actionLabel: 'Review Listing',
      actionUrl: '/admin/listings/pending',
      createdBy: 'system',
    });

    console.log(
      `[Auto-Notify] Admin pending-review notification created for listing: ${listingId}`
    );
  } catch (error) {
    console.error('[Auto-Notify] Failed to create admin pending-review notification:', error);
  }
}
