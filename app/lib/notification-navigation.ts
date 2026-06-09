type NotificationTargetData = {
  type?: string;
  listingId?: string;
  conversationId?: string;
  url?: string;
  dealUrl?: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  sellerName?: string;
  listingTitle?: string;
  listingImage?: string;
};

export async function openNotificationTarget(data?: NotificationTargetData): Promise<void> {
  if (!data) return;

  const { router } = await import('expo-router');

  if (data.type === 'message' || data.conversationId) {
    const targetListingId = data.listingId || data.conversationId;
    if (!targetListingId) return;

    router.push({
      pathname: '/chat/[listingId]',
      params: {
        listingId: targetListingId,
        conversationId: data.conversationId || targetListingId,
        otherUserId: data.otherUserId || '',
        otherUserAvatar: data.otherUserAvatar || '',
        sellerName: data.sellerName || '',
        listingTitle: data.listingTitle || '',
        listingImage: data.listingImage || '',
      },
    });
    return;
  }

  if (data.type === 'new_listing' && data.listingId) {
    router.push({
      pathname: '/listing/[id]',
      params: { id: data.listingId },
    });
    return;
  }

  if (data.url) {
    router.push(data.url);
    return;
  }

  if (data.dealUrl) {
    router.push(data.dealUrl);
  }
}
