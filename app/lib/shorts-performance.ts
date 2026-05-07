import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export function getShortsPreloadAheadCount(): number {
  // Keep decoder/network pressure lower on Android, especially older devices.
  if (Platform.OS !== 'android') return 3;
  const androidApi = Number(Platform.Version);
  if (Number.isFinite(androidApi) && androidApi <= 30) return 1;
  return 2;
}

export function getShortsPrefetchConcurrency(): number {
  if (Platform.OS !== 'android') return 2;
  const androidApi = Number(Platform.Version);
  if (Number.isFinite(androidApi) && androidApi <= 30) return 1;
  return 2;
}

export async function configureShortsAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
  });
}
