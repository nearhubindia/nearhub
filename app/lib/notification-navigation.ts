type NotificationTargetData = {
  type?: string;
  listingId?: string;
  conversationId?: string;
  actionUrl?: string;
  url?: string;
  dealUrl?: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  sellerName?: string;
  listingTitle?: string;
  listingImage?: string;
  category?: string;
  invoiceUrl?: string;
  paymentId?: string;
};

async function openTargetUrl(targetUrl: string): Promise<void> {
  const normalizedUrl = String(targetUrl || '').trim();
  if (!normalizedUrl) return;

  if (normalizedUrl.startsWith('/')) {
    const { router } = await import('expo-router');
    router.push(normalizedUrl as never);
    return;
  }

  const { Linking } = await import('react-native');
  await Linking.openURL(normalizedUrl);
}

export async function openNotificationTarget(data?: NotificationTargetData): Promise<void> {
  if (!data) return;

  const explicitTarget = String(data.actionUrl || data.url || data.dealUrl || '').trim();
  if (explicitTarget) {
    await openTargetUrl(explicitTarget);
    return;
  }

  if (data.type === 'message' || data.conversationId) {
    const targetListingId = data.listingId || data.conversationId;
    if (!targetListingId) return;

    const query = new URLSearchParams({
      conversationId: data.conversationId || targetListingId,
      ...(data.otherUserId ? { otherUserId: data.otherUserId } : {}),
      ...(data.otherUserAvatar ? { otherUserAvatar: data.otherUserAvatar } : {}),
      ...(data.sellerName ? { sellerName: data.sellerName } : {}),
      ...(data.listingTitle ? { listingTitle: data.listingTitle } : {}),
      ...(data.listingImage ? { listingImage: data.listingImage } : {}),
    }).toString();
    const conversationTarget = `/chat/${encodeURIComponent(targetListingId)}${query ? `?${query}` : ''}`;
    await openTargetUrl(conversationTarget);
    return;
  }

  if (
    data.type === 'new_listing' ||
    data.type === 'price_drop' ||
    data.type === 'listing_interest' ||
    data.type === 'listing_sold' ||
    data.type === 'expiring_soon' ||
    data.type === 'listing_approved' ||
    data.type === 'listing_renewed' ||
    data.type === 'saved_listing_price_drop' ||
    data.type === 'view_milestone'
  ) {
    if (!data.listingId) return;

    await openTargetUrl(`/listing/${encodeURIComponent(data.listingId)}`);
    return;
  }

  if (data.type === 'subscription_renewal' || data.type === 'subscription_expired') {
    await openTargetUrl('/subscriptions');
    return;
  }

  if (
    data.type === 'payment_success' ||
    data.type === 'payment_failed' ||
    data.type === 'invoice_generated'
  ) {
    await openTargetUrl(data.invoiceUrl || '/invoices');
    return;
  }

  if (data.type === 'nearby_listings' || data.type === 'daily_digest') {
    await openTargetUrl('/search');
    return;
  }

  if (data.listingId) {
    await openTargetUrl(`/listing/${encodeURIComponent(data.listingId)}`);
    return;
  }

  if (data.url) {
    await openTargetUrl(data.url);
    return;
  }

  if (data.dealUrl) {
    await openTargetUrl(data.dealUrl);
    return;
  }
}
