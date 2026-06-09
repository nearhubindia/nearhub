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

function buildListingAppDeepLink(listingId: string): string {
  const encodedListingId = encodeURIComponent(listingId.trim());
  return `nearhub://listing/${encodedListingId}`;
}

function buildShortsShareUrl(listingId: string): string {
  const baseUrl = getWebBaseUrl();
  const encodedListingId = encodeURIComponent(listingId.trim());
  return `${baseUrl}/shorts/${encodedListingId}`;
}

function buildShortsAppDeepLink(listingId: string): string {
  const encodedListingId = encodeURIComponent(listingId.trim());
  return `nearhub://shorts/${encodedListingId}`;
}

function buildListingShareMessage(
  listingUrl: string,
  appDeepLink: string,
  downloadUrl: string,
  listingTitle?: string
): string {
  const title = String(listingTitle || '').trim();
  const heading = title
    ? `Check out this listing on NearHub:\n${title}`
    : 'Check out this listing on NearHub:';

  return `${heading}\nOpen directly in app:\n${appDeepLink}\n\nWeb link:\n${listingUrl}\n\nIf the app is not installed, download it here:\n${downloadUrl}`;
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
  const appDeepLink = buildListingAppDeepLink(normalizedListingId);
  const downloadUrl = getAppDownloadUrl();

  try {
    await Share.share({
      title: listingTitle ? `NearHub Listing: ${listingTitle}` : 'NearHub Listing',
      message: buildListingShareMessage(listingUrl, appDeepLink, downloadUrl, listingTitle),
      url: listingUrl,
    });
  } catch (error) {
    console.warn('[Share] Failed to open share sheet for listing:', error);
    Alert.alert('Share unavailable', 'Unable to open share options right now. Please try again.');
  }
}

export async function shareShortsLink({
  listingId,
  listingTitle,
}: {
  listingId: string;
  listingTitle?: string;
}): Promise<void> {
  const normalizedListingId = String(listingId || '').trim();
  if (!normalizedListingId) {
    Alert.alert('Share unavailable', 'Unable to share this short right now.');
    return;
  }

  const shortUrl = buildShortsShareUrl(normalizedListingId);
  const appDeepLink = buildShortsAppDeepLink(normalizedListingId);
  const downloadUrl = getAppDownloadUrl();
  const title = String(listingTitle || '').trim();
  const heading = title ? `Watch this NearHub short:\n${title}` : 'Watch this NearHub short:';
  const message = `${heading}\nOpen directly in app:\n${appDeepLink}\n\nWeb link:\n${shortUrl}\n\nIf the app is not installed, download it here:\n${downloadUrl}`;

  try {
    await Share.share({
      title: title ? `NearHub Short: ${title}` : 'NearHub Short',
      message,
      url: shortUrl,
    });
  } catch (error) {
    console.warn('[Share] Failed to open share sheet for short:', error);
    Alert.alert('Share unavailable', 'Unable to open share options right now. Please try again.');
  }
}
