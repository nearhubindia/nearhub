import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatRecordingTime, getRecordingTimeRemaining } from '@/lib/video-recorder';

interface VideoRecorderModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (uri: string) => void;
  maxDuration?: number;
}

/**
 * Video Recorder Modal Component
 * Provides in-app video recording with live preview and controls
 */
export const VideoRecorderModal: React.FC<VideoRecorderModalProps> = ({
  visible,
  onClose,
  onVideoRecorded,
  maxDuration = 30,
}) => {
  const cameraRef = useRef<CameraView>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [cameraPermission, requestCameraPermission, getCameraPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState<any>(null);
  const [mediaLibraryPermission, setMediaLibraryPermission] = useState<any>(null);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [recordedVideoUri, setRecordedVideoUri] = useState<string>('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingPromiseRef = useRef<Promise<any> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Check both camera and audio permissions
  const hasCameraPermission = cameraPermission?.granted ?? false;
  const hasAudioPermission = audioPermission?.granted ?? false;
  const hasMediaLibraryPermission = mediaLibraryPermission?.granted ?? false;
  const hasAllPermissions = permissionsChecked && hasCameraPermission && hasAudioPermission;

  const canAskCameraPermission = cameraPermission?.canAskAgain ?? true;
  const canAskAudioPermission = audioPermission?.canAskAgain ?? true;
  const canAskMediaLibraryPermission = mediaLibraryPermission?.canAskAgain ?? true;

  // Request permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      console.log('[VideoRecorderModal] Checking permissions...');
      setPermissionsChecked(false);

      // Check camera permission using live value from permission API
      const cameraStatus = await getCameraPermission();
      console.log('[VideoRecorderModal] Camera permission:', cameraStatus.granted);

      // Check audio permission
      const audioStatus = await Audio.getPermissionsAsync();
      setAudioPermission(audioStatus);
      console.log('[VideoRecorderModal] Audio permission:', audioStatus.granted);

      // Check media library permission
      const mediaStatus = await MediaLibrary.getPermissionsAsync();
      setMediaLibraryPermission(mediaStatus);
      console.log('[VideoRecorderModal] MediaLibrary permission:', mediaStatus.granted);

      setPermissionsChecked(true);
    };

    if (visible) {
      checkPermissions();
    } else {
      // Reset state when modal closes
      setIsRecording(false);
      setRecordingTime(0);
      setRecordedVideoUri('');
      setIsCameraReady(false);
      setPermissionsChecked(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [visible, getCameraPermission]);

  const handleRequestPermissions = async () => {
    try {
      console.log('[VideoRecorderModal] Requesting permissions...');
      console.log('[VideoRecorderModal] Current permissions:', {
        camera: hasCameraPermission,
        audio: hasAudioPermission,
        mediaLibrary: hasMediaLibraryPermission,
        canAskCamera: canAskCameraPermission,
        canAskAudio: canAskAudioPermission,
        canAskMediaLibrary: canAskMediaLibraryPermission,
      });

      const latestCamera = await getCameraPermission();
      const latestAudio = await Audio.getPermissionsAsync();
      const latestMedia = await MediaLibrary.getPermissionsAsync();

      setAudioPermission(latestAudio);
      setMediaLibraryPermission(latestMedia);

      let cameraGranted = latestCamera.granted;
      let audioGranted = latestAudio.granted;
      let mediaLibraryGranted = latestMedia.granted;

      // Request camera permission if needed
      if (!cameraGranted && latestCamera.canAskAgain) {
        console.log('[VideoRecorderModal] Requesting camera permission...');
        const cameraResult = await requestCameraPermission();
        cameraGranted = cameraResult.granted;
        console.log('[VideoRecorderModal] Camera permission result:', cameraGranted);
      }

      // Request audio permission if needed
      if (!audioGranted && latestAudio.canAskAgain) {
        console.log('[VideoRecorderModal] Requesting audio permission...');
        const audioResult = await Audio.requestPermissionsAsync();
        setAudioPermission(audioResult);
        audioGranted = audioResult.granted;
        console.log('[VideoRecorderModal] Audio permission result:', audioGranted);
      }

      // Request media library permission if needed
      if (!mediaLibraryGranted && latestMedia.canAskAgain) {
        console.log('[VideoRecorderModal] Requesting media library permission...');
        const mediaResult = await MediaLibrary.requestPermissionsAsync();
        setMediaLibraryPermission(mediaResult);
        mediaLibraryGranted = mediaResult.granted;
        console.log('[VideoRecorderModal] MediaLibrary permission result:', mediaLibraryGranted);
      }

      // Check if all required permissions are granted (camera and audio are required, media library is optional)
      if (!cameraGranted || !audioGranted) {
        const missingPermissions = [];
        if (!cameraGranted) missingPermissions.push('Camera');
        if (!audioGranted) missingPermissions.push('Microphone');

        console.log('[VideoRecorderModal] Missing permissions:', missingPermissions);

        Alert.alert(
          'Permission Required',
          `${missingPermissions.join(' and ')} access is needed to record videos. Please grant permission in your device settings.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        console.log('[VideoRecorderModal] All required permissions granted!');
        setPermissionsChecked(true);
        // Note: media library permission is optional - we'll handle save errors gracefully
      }
    } catch (error) {
      console.error('[VideoRecorderModal] Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
    }
  };

  // Cleanup recording interval
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Update recording time
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev: number) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording, maxDuration]);

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    if (!isCameraReady) {
      console.log('[VideoRecorderModal] Camera not ready yet, cannot start recording');
      return;
    }

    try {
      console.log('[VideoRecorderModal] Starting recording...');
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedVideoUri('');
      recordingStartTimeRef.current = Date.now();

      // Start recording - this promise resolves when recording stops
      const video = await cameraRef.current.recordAsync({
        maxDuration: maxDuration,
      });

      console.log('[VideoRecorderModal] Recording completed, video:', video);

      // Recording finished successfully
      if (video && video.uri) {
        console.log('[VideoRecorderModal] Video URI received:', video.uri);
        setRecordedVideoUri(video.uri);
        setIsRecording(false);
      } else {
        console.log('[VideoRecorderModal] No video URI in result:', video);
        setIsRecording(false);
        setRecordingTime(0);
      }
    } catch (error: any) {
      console.error('[VideoRecorderModal] Recording error:', error?.message || error);

      setIsRecording(false);
      setRecordingTime(0);
      setRecordedVideoUri('');

      // "stopped before any data" means it was cancelled - not a real error
      const errorMsg = (error?.message || '').toLowerCase();
      const isCancellation =
        errorMsg.includes('stopped') ||
        errorMsg.includes('cancelled') ||
        errorMsg.includes('cancel') ||
        errorMsg.includes('abort');

      if (!isCancellation) {
        Alert.alert(
          'Recording Error',
          `Failed to record video: ${error?.message || 'Unknown error'}`
        );
      }
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !isRecording) {
      console.log('[VideoRecorderModal] Stop recording called but not recording');
      return;
    }

    const actualDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
    console.log('[VideoRecorderModal] Stopping recording at', actualDuration, 'seconds...');

    // stopRecording() is synchronous (returns void)
    // It triggers recordAsync() promise to resolve with the video URI
    cameraRef.current.stopRecording();
    console.log('[VideoRecorderModal] Stop command sent');
  };

  const handleRecordingComplete = async (uri: string) => {
    try {
      console.log('[VideoRecorderModal] Processing recorded video:', uri);

      // If camera successfully recorded and returned a URI, accept it
      // Camera URIs may not be immediately accessible via FileSystem
      if (!uri || uri.trim() === '') {
        console.error('[VideoRecorderModal] Invalid URI received');
        Alert.alert('Invalid Video', 'No video was recorded.');
        return;
      }

      console.log('[VideoRecorderModal] Video URI is valid, proceeding...');

      // Save to media library (optional - user can review)
      try {
        await MediaLibrary.saveToLibraryAsync(uri);
        console.log('[VideoRecorderModal] Video saved to library');
      } catch (e) {
        console.log('[VideoRecorderModal] Could not save to library:', e);
        // Non-fatal, continue anyway
      }

      // Return video URI
      onVideoRecorded(uri);
      onClose();
    } catch (error) {
      console.error('[VideoRecorderModal] Error handling recording:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
    }
  };

  const toggleCameraType = () => {
    setCameraType((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  if (!permissionsChecked) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.centerContainer}>
          <View style={styles.permissionContainer}>
            <MaterialCommunityIcons name="shield-sync" size={64} color="#3B82F6" />
            <Text style={styles.permissionTitle}>Checking Permissions...</Text>
            <Text style={styles.permissionText}>Verifying camera and microphone access.</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (!hasAllPermissions) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.centerContainer}>
          <View style={styles.permissionContainer}>
            <MaterialCommunityIcons name="video-plus-outline" size={80} color="#3B82F6" />
            <Text style={styles.permissionTitle}>
              {!hasCameraPermission && !hasAudioPermission
                ? 'Camera & Microphone Access'
                : !hasCameraPermission
                  ? 'Camera Access Required'
                  : 'Microphone Access Required'}
            </Text>
            <Text style={styles.permissionText}>
              To record videos, we need permission to access your camera
              {!hasAudioPermission && ' and microphone'}.
            </Text>

            <View style={styles.permissionFeatures}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="video" size={24} color="#10B981" />
                <Text style={styles.featureText}>Record product videos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="microphone" size={24} color="#10B981" />
                <Text style={styles.featureText}>Capture audio with video</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="shield-check" size={24} color="#10B981" />
                <Text style={styles.featureText}>Your privacy is protected</Text>
              </View>
            </View>

            {canAskCameraPermission || canAskAudioPermission ? (
              <TouchableOpacity style={styles.grantButton} onPress={handleRequestPermissions}>
                <MaterialCommunityIcons name="check-circle" size={20} color="white" />
                <Text style={styles.grantButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.settingsHint}>
                  Permission was denied. Please enable it in Settings.
                </Text>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => Linking.openSettings()}
                >
                  <MaterialCommunityIcons name="cog" size={20} color="white" />
                  <Text style={styles.settingsButtonText}>Open Settings</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  const timeRemaining = getRecordingTimeRemaining(recordingTime, maxDuration);
  const isTimeAlmostUp = timeRemaining < 5 && recordingTime > 0;

  // Compute disabled states explicitly as booleans
  const hasRecordedVideo = recordedVideoUri.length > 0;
  const isDiscardDisabled = recordingTime === 0 && !hasRecordedVideo;
  const isRecordDisabled = (recordingTime > 0 || hasRecordedVideo) && !isRecording;
  const isUseDisabled = !hasRecordedVideo;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraType}
          mode="video"
          onCameraReady={() => {
            console.log('[VideoRecorderModal] Camera is ready!');
            setIsCameraReady(true);
          }}
          onMountError={(event) => {
            console.error(
              '[VideoRecorderModal] Camera mount error:',
              event.message || String(event)
            );
            Alert.alert('Camera Error', 'Failed to start camera. Please try again.');
          }}
        >
          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={28} color="white" />
            </TouchableOpacity>

            {/* Recording Time and Status */}
            <View style={styles.timeDisplay}>
              {isRecording && (
                <>
                  <View
                    style={[
                      styles.recordingDot,
                      { backgroundColor: isTimeAlmostUp ? '#FF6B6B' : '#FF4444' },
                    ]}
                  />
                  <Text style={[styles.timeText, { color: isTimeAlmostUp ? '#FF6B6B' : 'white' }]}>
                    {formatRecordingTime(recordingTime)} / {maxDuration}s
                  </Text>
                </>
              )}
              {!isRecording && recordingTime > 0 && (
                <Text style={styles.timeText}>Ready: {formatRecordingTime(recordingTime)}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.headerButton} onPress={toggleCameraType}>
              <MaterialCommunityIcons name="camera-flip" size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <View style={styles.controlRow}>
              {/* Discard Button */}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => {
                  console.log('[VideoRecorderModal] Discarding recording');
                  setRecordingTime(0);
                  setRecordedVideoUri('');
                  if (isRecording) {
                    stopRecording();
                  }
                }}
                disabled={isDiscardDisabled}
              >
                <MaterialCommunityIcons
                  name="delete"
                  size={28}
                  color={isDiscardDisabled ? '#ccc' : '#FF6B6B'}
                />
                <Text style={styles.controlLabel}>Discard</Text>
              </TouchableOpacity>

              {/* Record Button - Hold to Record */}
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  {
                    borderColor: isRecording ? '#FF4444' : '#4CAF50',
                    backgroundColor: isRecording ? '#FF4444' : 'transparent',
                  },
                ]}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                activeOpacity={0.8}
                disabled={isRecordDisabled}
              >
                <View
                  style={[
                    styles.recordButtonInner,
                    { backgroundColor: isRecording ? '#FF4444' : '#4CAF50' },
                  ]}
                />
              </TouchableOpacity>

              {/* Use Button (when recording complete) */}
              <TouchableOpacity
                style={[styles.controlButton, { opacity: isUseDisabled ? 0.5 : 1 }]}
                onPress={() => {
                  if (recordedVideoUri) {
                    console.log('[VideoRecorderModal] Using recorded video:', recordedVideoUri);
                    handleRecordingComplete(recordedVideoUri);
                  }
                }}
                disabled={isUseDisabled}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={28}
                  color={isUseDisabled ? '#ccc' : '#4CAF50'}
                />
                <Text style={styles.controlLabel}>Use</Text>
              </TouchableOpacity>
            </View>

            {/* Hints */}
            <Text style={styles.hint}>
              {isRecording
                ? isTimeAlmostUp
                  ? `${timeRemaining}s remaining - releasing soon`
                  : `Recording... ${timeRemaining}s left (release to stop)`
                : recordingTime > 0
                  ? 'Tap ✓ to use or ✗ to discard'
                  : '🔴 Hold button to record (max 30s)'}
            </Text>
          </View>
        </CameraView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  permissionContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionFeatures: {
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#ddd',
    fontWeight: '500',
  },
  grantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  grantButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsHint: {
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  cancelButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '500',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerButton: {
    padding: 8,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  timeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bottomControls: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  hint: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
