import { Alert, Share } from 'react-native';

import { getAppDownloadUrl } from '@/lib/config';

function buildAppShareMessage(downloadUrl: string): string {
  return `Download NearHub app:\n${downloadUrl}`;
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
