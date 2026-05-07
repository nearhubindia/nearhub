import { Alert, Share } from 'react-native';

import { getAppDownloadUrl, getWebBaseUrl } from '@/lib/config';

function buildAppShareMessage(downloadUrl: string): string {
  return `Download NearHub app:\n${downloadUrl}`;
}

function buildListingShareUrl(listingId: string): string {
  const baseUrl = getWebBaseUrl();
  const encodedListingId = encodeURIComponent(listingId.trim());
  return `${baseUrl}/listing/${encodedListingId}`;
}

function buildListingShareMessage(
  listingUrl: string,
  downloadUrl: string,
  listingTitle?: string
): string {
  const title = String(listingTitle || '').trim();
  const heading = title
    ? `Check out this listing on NearHub:\n${title}`
    : 'Check out this listing on NearHub:';

  return `${heading}\n${listingUrl}\n\nIf the app is not installed, download it here:\n${downloadUrl}`;
}

export async function shareAppDownloadLink(): Promise<void> {
  const downloadUrl = getAppDownloadUrl();

  try {
    await Share.share({
      title: 'NearHub',
      message: buildAppShareMessage(downloadUrl),
      url: downloadUrl,
    });
  } catch (error) {
    console.warn('[Share] Failed to open share sheet:', error);
    Alert.alert('Share unavailable', 'Unable to open share options right now. Please try again.');
  }
}

export async function shareListingLink({
  listingId,
  listingTitle,
}: {
  listingId: string;
  listingTitle?: string;
}): Promise<void> {
  const normalizedListingId = String(listingId || '').trim();
  if (!normalizedListingId) {
    Alert.alert('Share unavailable', 'Unable to share this listing right now.');
    return;
  }

  const listingUrl = buildListingShareUrl(normalizedListingId);
  const downloadUrl = getAppDownloadUrl();

  try {
    await Share.share({
      title: listingTitle ? `NearHub Listing: ${listingTitle}` : 'NearHub Listing',
      message: buildListingShareMessage(listingUrl, downloadUrl, listingTitle),
      url: listingUrl,
    });
  } catch (error) {
    console.warn('[Share] Failed to open share sheet for listing:', error);
    Alert.alert('Share unavailable', 'Unable to open share options right now. Please try again.');
  }
}
