import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import Colors from '@/constants/colors';
import { useAuth } from '@/shared/contexts/auth-context';
import { uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';
import { getApiUrl } from '@/lib/query-client';
import { VideoRecorderModal } from '@/shared/components/VideoRecorderModal';
import UploadProgressBar from '@/shared/components/UploadProgressBar';

type VoiceLanguage = 'telugu' | 'hindi' | 'english' | 'kannada';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

type VoiceoverJob = {
  id: string;
  status: JobStatus;
  source_video_url: string;
  output_video_url?: string | null;
  language: VoiceLanguage;
  title_text?: string | null;
  script_text?: string | null;
  error_message?: string | null;
  created_at?: string;
};

function formatJobDate(value?: string): string {
  if (!value) return '';
  const raw = String(value).trim();
  // Postgres `timestamp` values may arrive without timezone; treat those as UTC.
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return (
    date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

function getJobTitle(job: VoiceoverJob): string {
  const explicitTitle = String(job.title_text || '').trim();
  if (explicitTitle) return explicitTitle;
  const script = String(job.script_text || '').trim();
  const legacyMatch = script.match(/(?:^|\n)\s*Product:\s*(.+?)(?:\n|$)/i);
  const legacyTitle = String(legacyMatch?.[1] || '').trim();
  if (legacyTitle) return legacyTitle;
  return 'Untitled Listing';
}

function PreviewVideo({
  uri,
  style,
  nativeControls = true,
  showOverlayControl = true,
}: {
  uri: string;
  style: any;
  nativeControls?: boolean;
  showOverlayControl?: boolean;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const sub = (player as any).addListener?.('statusChange', (event: any) => {
      const status = event?.status ?? event;
      const isEnded =
        status?.status === 'ended' ||
        status?.didJustFinish === true ||
        (typeof status?.currentTime === 'number' &&
          typeof status?.duration === 'number' &&
          status.duration > 0 &&
          status.currentTime >= status.duration);

      if (isEnded) {
        setIsPlaying(false);
        return;
      }

      if (status?.status === 'playing' || status?.isPlaying === true) {
        setIsPlaying(true);
        return;
      }

      if (status?.status === 'paused' || status?.isPlaying === false) {
        setIsPlaying(false);
      }
    });

    return () => {
      sub?.remove?.();
    };
  }, [player]);

  return (
    <View style={[style, { position: 'relative' }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={nativeControls}
        contentFit="contain"
      />
      {!nativeControls && showOverlayControl ? (
        <Pressable
          style={isPlaying ? styles.previewPlayButton : styles.previewReplayButton}
          onPress={() => {
            if (isPlaying) {
              player.pause();
              setIsPlaying(false);
            } else {
              try {
                (player as any).currentTime = 0;
              } catch {
                // no-op if currentTime isn't writable on this runtime
              }
              player.play();
              setIsPlaying(true);
            }
          }}
        >
          {isPlaying ? (
            <Feather name="pause" size={20} color="#FFFFFF" />
          ) : (
            <Feather name="rotate-ccw" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const LANGUAGE_OPTIONS: Array<{ key: VoiceLanguage; label: string }> = [
  { key: 'telugu', label: 'Telugu' },
  { key: 'hindi', label: 'Hindi' },
  { key: 'english', label: 'English' },
];
const LAST_JOB_KEY_PREFIX = 'ai_studio_last_job_id:';
const LOCAL_VIDEO_MAP_KEY_PREFIX = 'ai_studio_local_video_map:';
const GENERIC_PROCESSING_ERROR = 'Error in processing. Please retry.';

export default function AiStudio() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [language, setLanguage] = useState<VoiceLanguage>('telugu');
  const [sourceLocalUri, setSourceLocalUri] = useState<string | null>(null);
  const [sourceMimeType, setSourceMimeType] = useState<string | null>(null);
  const [sourceRemoteUrl, setSourceRemoteUrl] = useState<string | null>(null);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [job, setJob] = useState<VoiceoverJob | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isRefreshingJob, setIsRefreshingJob] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [readyPromptShownForJob, setReadyPromptShownForJob] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [productTitle, setProductTitle] = useState('');
  const [highlights, setHighlights] = useState('');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'videos'>('generate');
  const [jobs, setJobs] = useState<VoiceoverJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [localVideoMap, setLocalVideoMap] = useState<Record<string, string>>({});
  const [previewJob, setPreviewJob] = useState<VoiceoverJob | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startUploadProgress = () => {
    setUploadProgress(5);
    if (uploadProgressTimerRef.current) clearInterval(uploadProgressTimerRef.current);
    uploadProgressTimerRef.current = setInterval(() => {
      setUploadProgress((prev) => (prev >= 92 ? prev : prev + 3));
    }, 350);
  };

  const completeUploadProgress = () => {
    if (uploadProgressTimerRef.current) {
      clearInterval(uploadProgressTimerRef.current);
      uploadProgressTimerRef.current = null;
    }
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(0), 450);
  };

  const canStart = useMemo(
    () => Boolean(user?.id && sourceLocalUri && !isCreatingJob && !isUploadingSource),
    [user?.id, sourceLocalUri, isCreatingJob, isUploadingSource]
  );

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to select videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      allowsEditing: false,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    setSourceLocalUri(uri);
    setSourceMimeType(typeof asset.mimeType === 'string' ? asset.mimeType : null);
    setSourceRemoteUrl(null);
    setJob(null);
    setReadyPromptShownForJob(null);
  };

  const recordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to record videos.');
      return;
    }
    setShowRecorder(true);
  };

  const uploadSourceVideo = async () => {
    if (!sourceLocalUri || !user?.id) return;
    setIsUploadingSource(true);
    startUploadProgress();
    try {
      const uploaded = await uploadMediaToCloudflare({
        uri: sourceLocalUri,
        mediaType: 'video',
        fileName: `ai_studio_source_${Date.now()}.mp4`,
        mimeType: sourceMimeType || undefined,
        userId: user.id,
      });
      setSourceRemoteUrl(uploaded.url);
      completeUploadProgress();
      Alert.alert('Uploaded', 'Source video uploaded. You can generate voice-over now.');
    } catch (error) {
      if (uploadProgressTimerRef.current) {
        clearInterval(uploadProgressTimerRef.current);
        uploadProgressTimerRef.current = null;
      }
      setUploadProgress(0);
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploadingSource(false);
    }
  };

  const createJob = async () => {
    if (!canStart || !user?.id || !sourceLocalUri) return;
    if (!productTitle.trim() || !highlights.trim() || !description.trim()) {
      Alert.alert('Required', 'Please add product title, highlights, and description.');
      return;
    }
    const scriptText = `Product: ${productTitle.trim()}\nHighlights: ${highlights.trim()}\nDescription: ${description.trim()}`;
    setIsCreatingJob(true);
    try {
      let finalSourceVideoUrl = sourceRemoteUrl;
      if (!finalSourceVideoUrl) {
        setIsUploadingSource(true);
        Alert.alert('Uploading', 'Uploading source video. Please wait...');
        startUploadProgress();
        const uploaded = await uploadMediaToCloudflare({
          uri: sourceLocalUri,
          mediaType: 'video',
          fileName: `ai_studio_source_${Date.now()}.mp4`,
          mimeType: sourceMimeType || undefined,
          userId: user.id,
        });
        finalSourceVideoUrl = uploaded.url;
        setSourceRemoteUrl(uploaded.url);
        completeUploadProgress();
      }

      const response = await fetch(`${getApiUrl()}/api/media/ai-voiceover/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sourceVideoUrl: finalSourceVideoUrl,
          language,
          scriptText,
          title: productTitle.trim(),
          highlights: highlights.trim(),
          description: description.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.job) {
        throw new Error(payload?.error || 'Failed to create job');
      }
      const createdJob = payload.job as VoiceoverJob;
      setJob(createdJob);
      await AsyncStorage.setItem(`${LAST_JOB_KEY_PREFIX}${user.id}`, createdJob.id);
      setSourceLocalUri(null);
      setSourceMimeType(null);
      setSourceRemoteUrl(null);
      setProductTitle('');
      setHighlights('');
      setDescription('');
      setActiveTab('videos');
      Alert.alert('Queued', 'AI voice-over job queued. We will notify you once ready.');
    } catch (error) {
      if (uploadProgressTimerRef.current) {
        clearInterval(uploadProgressTimerRef.current);
        uploadProgressTimerRef.current = null;
      }
      setUploadProgress(0);
      Alert.alert('Failed', error instanceof Error ? error.message : 'Failed to create job');
    } finally {
      setIsUploadingSource(false);
      setIsCreatingJob(false);
    }
  };

  const fetchJobStatus = async (jobId: string, silent = true) => {
    if (!user?.id) return;
    if (!silent) setIsRefreshingJob(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/media/ai-voiceover/jobs/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(user.id)}`
      );
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.job) {
        throw new Error(payload?.error || 'Failed to fetch job');
      }
      const nextJob = payload.job as VoiceoverJob;
      setJob(nextJob);

      if (nextJob.status === 'completed' && readyPromptShownForJob !== nextJob.id) {
        setReadyPromptShownForJob(nextJob.id);
        Alert.alert('Video Ready', 'Your AI voice-over video is ready to preview and share.');
      }
      if (nextJob.status === 'failed') {
        Alert.alert('Generation failed', nextJob.error_message || 'Please try regenerate.');
      }
    } catch (error) {
      if (!silent) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to fetch job');
      }
    } finally {
      if (!silent) setIsRefreshingJob(false);
    }
  };

  const loadJobs = async () => {
    if (!user?.id) return;
    setIsLoadingJobs(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/media/ai-voiceover/jobs?userId=${encodeURIComponent(user.id)}`
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !Array.isArray(payload?.jobs)) {
        throw new Error(payload?.error || 'Failed to load videos');
      }
      setJobs(payload.jobs as VoiceoverJob[]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load videos');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const loadLocalVideoMap = async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(`${LOCAL_VIDEO_MAP_KEY_PREFIX}${userId}`);
      if (!raw) {
        setLocalVideoMap({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      setLocalVideoMap(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setLocalVideoMap({});
    }
  };

  const persistLocalVideoMap = async (userId: string, next: Record<string, string>) => {
    setLocalVideoMap(next);
    await AsyncStorage.setItem(`${LOCAL_VIDEO_MAP_KEY_PREFIX}${userId}`, JSON.stringify(next));
  };

  const removeLocalVideoByJobId = async (jobId: string) => {
    if (!user?.id) return;
    const uri = localVideoMap[jobId];
    if (uri) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    const next = { ...localVideoMap };
    delete next[jobId];
    await persistLocalVideoMap(user.id, next);
  };

  useEffect(() => {
    if (!user?.id || job?.id) return;
    let cancelled = false;

    const hydrateLastJob = async () => {
      try {
        const lastJobId = await AsyncStorage.getItem(`${LAST_JOB_KEY_PREFIX}${user.id}`);
        if (!lastJobId) return;
        const response = await fetch(
          `${getApiUrl()}/api/media/ai-voiceover/jobs/${encodeURIComponent(lastJobId)}?userId=${encodeURIComponent(user.id)}`
        );
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && payload?.success && payload?.job) {
          setJob(payload.job as VoiceoverJob);
          return;
        }
        await AsyncStorage.removeItem(`${LAST_JOB_KEY_PREFIX}${user.id}`);
      } catch {
        // best-effort hydrate
      }
    };

    void hydrateLastJob();
    return () => {
      cancelled = true;
    };
  }, [user?.id, job?.id]);

  useEffect(() => {
    if (!job?.id || (job.status !== 'pending' && job.status !== 'processing')) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(() => {
      void fetchJobStatus(job.id, true);
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [job?.id, job?.status, user?.id]);

  useEffect(() => {
    if (activeTab !== 'videos') return;
    void loadJobs();
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLocalVideoMap({});
      return;
    }
    void loadLocalVideoMap(user.id);
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (uploadProgressTimerRef.current) {
        clearInterval(uploadProgressTimerRef.current);
      }
    };
  }, []);

  const regenerate = async () => {
    if (!job?.id || !user?.id) return;
    setIsRegenerating(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/media/ai-voiceover/jobs/${encodeURIComponent(job.id)}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify({ userId: user.id }),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.job) {
        throw new Error(payload?.error || 'Failed to regenerate');
      }
      const nextJob = payload.job as VoiceoverJob;
      setJob(nextJob);
      await AsyncStorage.setItem(`${LAST_JOB_KEY_PREFIX}${user.id}`, nextJob.id);
      setReadyPromptShownForJob(null);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  const retryVideoJobById = async (jobId: string) => {
    if (!user?.id) return;
    setIsRegenerating(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/media/ai-voiceover/jobs/${encodeURIComponent(jobId)}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify({ userId: user.id }),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.job) {
        throw new Error(payload?.error || 'Failed to retry');
      }
      await loadJobs();
      Alert.alert('Retry started', 'Voice-over generation has been queued again.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to retry');
    } finally {
      setIsRegenerating(false);
    }
  };

  const deleteJob = async () => {
    if (!job?.id || !user?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/media/ai-voiceover/jobs/${encodeURIComponent(job.id)}?userId=${encodeURIComponent(user.id)}`,
        {
          method: 'DELETE',
          headers: { 'x-user-id': user.id },
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to delete');
      }
      setJob(null);
      setSourceRemoteUrl(null);
      setSourceLocalUri(null);
      setSourceMimeType(null);
      setReadyPromptShownForJob(null);
      await AsyncStorage.removeItem(`${LAST_JOB_KEY_PREFIX}${user.id}`);
      await removeLocalVideoByJobId(job.id);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadVideo = async (jobId: string, url?: string | null) => {
    if (!url || !user?.id) return;
    try {
      const mediaPermission = await MediaLibrary.requestPermissionsAsync();
      if (!mediaPermission.granted) {
        throw new Error('Media library permission is required to save videos.');
      }

      const existingLocal = localVideoMap[jobId];
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) throw new Error('No writable local directory available');
      const targetUri = existingLocal || `${baseDir}ai_studio_${jobId}.mp4`;

      if (!existingLocal) {
        await FileSystem.downloadAsync(url, targetUri);
      }

      const asset = await MediaLibrary.createAssetAsync(targetUri);
      const album = await MediaLibrary.getAlbumAsync('NearHub');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('NearHub', asset, false);
      }

      const next = { ...localVideoMap, [jobId]: targetUri };
      await persistLocalVideoMap(user.id, next);

      Alert.alert('Downloaded', 'Video saved to your device gallery in the NearHub album.');
    } catch (error) {
      Alert.alert(
        'Download failed',
        error instanceof Error ? error.message : 'Failed to download video'
      );
    }
  };

  const deleteVideoJobById = async (jobId: string) => {
    if (!user?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${getApiUrl()}/api/media/ai-voiceover/jobs/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(user.id)}`,
        {
          method: 'DELETE',
          headers: { 'x-user-id': user.id },
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to delete');
      }
      await removeLocalVideoByJobId(jobId);
      setJobs((prev) => prev.filter((item) => item.id !== jobId));
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const openPreview = (item: VoiceoverJob) => {
    if (!item.output_video_url) return;
    setPreviewJob(item);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingBottom: Math.max(insets.bottom + 28, 120),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI Studio</Text>
          <Text style={styles.subtitle}>Create, dub, preview, and share AI voice-over videos.</Text>
        </View>
        {!user ? (
          <View style={styles.authCard}>
            <View style={styles.authIconWrap}>
              <Feather name="user-plus" size={18} color="#1D4ED8" />
            </View>
            <Text style={styles.authTitle}>Sign in to use AI Studio</Text>
            <Text style={styles.authSubtitle}>
              Register with your mobile number to create AI voice-over videos and manage your
              generated clips.
            </Text>
            <Pressable style={styles.authButton} onPress={() => router.push('/auth/register')}>
              <LinearGradient
                colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.authButtonGradient}
              >
                <Feather name="smartphone" size={18} color="#fff" />
                <Text style={styles.authButtonText}>Register with Mobile</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}
        {!user ? null : (
          <>
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabButton, activeTab === 'generate' && styles.tabButtonActive]}
                onPress={() => setActiveTab('generate')}
              >
                <Text style={[styles.tabText, activeTab === 'generate' && styles.tabTextActive]}>
                  Generate
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabButton, activeTab === 'videos' && styles.tabButtonActive]}
                onPress={() => setActiveTab('videos')}
              >
                <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>
                  Videos
                </Text>
              </Pressable>
            </View>
            {activeTab === 'generate' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>1. Source Video</Text>
                  <Text style={styles.sectionHint}>
                    Record a fresh clip or pick one from gallery to start voice-over generation.
                  </Text>
                  <View style={styles.sourceActionGrid}>
                    <Pressable style={styles.sourceActionCard} onPress={recordVideo}>
                      <View style={styles.sourceActionIconWrap}>
                        <Feather name="camera" size={18} color="#1D4ED8" />
                      </View>
                      <Text style={styles.sourceActionTitle}>Record Video</Text>
                      <Text style={styles.sourceActionSubtext}>Capture now</Text>
                    </Pressable>
                    <Pressable style={styles.sourceActionCard} onPress={pickVideo}>
                      <View style={styles.sourceActionIconWrap}>
                        <Feather name="video" size={18} color="#1D4ED8" />
                      </View>
                      <Text style={styles.sourceActionTitle}>Select Video</Text>
                      <Text style={styles.sourceActionSubtext}>From gallery</Text>
                    </Pressable>
                  </View>
                  {sourceLocalUri ? (
                    <View style={styles.sourceVideoWithActionsWrap}>
                      <PreviewVideo uri={sourceLocalUri} style={styles.video} />
                      <View style={styles.sourceVideoActionRail}>
                        <Pressable
                          style={[styles.iconButton, styles.iconDangerButton]}
                          onPress={() => {
                            setSourceLocalUri(null);
                            setSourceMimeType(null);
                            setSourceRemoteUrl(null);
                          }}
                        >
                          <Feather name="trash-2" size={18} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {sourceLocalUri ? (
                    <Pressable
                      style={[
                        styles.primaryButton,
                        styles.uploadButton,
                        isUploadingSource && styles.disabledButton,
                      ]}
                      onPress={uploadSourceVideo}
                      disabled={isUploadingSource}
                    >
                      {isUploadingSource ? <ActivityIndicator color={Colors.primary} /> : null}
                      <Text style={styles.primaryButtonText}>
                        {isUploadingSource ? 'Uploading...' : 'Upload Source Video'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {isUploadingSource ? (
                    <View style={styles.uploadingRow}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.uploadingText}>
                        Uploading source video... {uploadProgress}%
                      </Text>
                    </View>
                  ) : null}
                  {isUploadingSource && uploadProgress > 0 ? (
                    <View style={styles.uploadProgressWrap}>
                      <UploadProgressBar progress={uploadProgress} />
                    </View>
                  ) : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>2. Product Content</Text>
                  <Text style={styles.sectionHint}>
                    Add product title, highlights, and description for voice-over generation.
                  </Text>
                  <TextInput
                    style={styles.contextInput}
                    placeholder="Product Title"
                    placeholderTextColor="#94A3B8"
                    value={productTitle}
                    onChangeText={setProductTitle}
                    maxLength={100}
                  />
                  <TextInput
                    style={[styles.contextInput, styles.contextInputMultiline]}
                    multiline
                    placeholder="Key highlights (RAM, storage, condition, battery, accessories, price)"
                    placeholderTextColor="#94A3B8"
                    value={highlights}
                    onChangeText={setHighlights}
                    maxLength={300}
                  />
                  <TextInput
                    style={styles.scriptInput}
                    multiline
                    placeholder="Description for voice-over..."
                    placeholderTextColor="#94A3B8"
                    value={description}
                    onChangeText={setDescription}
                    maxLength={500}
                  />
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>3. Select Language</Text>
                  <View style={styles.languageRow}>
                    {LANGUAGE_OPTIONS.map((item) => (
                      <Pressable
                        key={item.key}
                        onPress={() => setLanguage(item.key)}
                        style={[styles.langChip, language === item.key && styles.langChipActive]}
                      >
                        <Text
                          style={[
                            styles.langChipText,
                            language === item.key && styles.langChipTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>4. Generate Voice-over</Text>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      (!canStart ||
                        !productTitle.trim() ||
                        !highlights.trim() ||
                        !description.trim()) &&
                        styles.disabledButton,
                    ]}
                    disabled={
                      !canStart || !productTitle.trim() || !highlights.trim() || !description.trim()
                    }
                    onPress={createJob}
                  >
                    {isCreatingJob ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={styles.primaryButtonText}>
                      {isUploadingSource
                        ? 'Uploading Source Video...'
                        : isCreatingJob
                          ? 'Queueing...'
                          : 'Generate Voice-over'}
                    </Text>
                  </Pressable>
                </View>

                <VideoRecorderModal
                  visible={showRecorder}
                  onClose={() => setShowRecorder(false)}
                  onVideoRecorded={(recordedUri) => {
                    setShowRecorder(false);
                    setSourceLocalUri(recordedUri);
                    setSourceMimeType('video/mp4');
                    setSourceRemoteUrl(null);
                    setJob(null);
                    setReadyPromptShownForJob(null);
                  }}
                />
              </>
            ) : (
              <View style={styles.card}>
                <View style={styles.videosHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Generated Videos</Text>
                    <Text style={styles.sectionHintTight}>
                      Tap expand on any thumbnail for enlarged view.
                    </Text>
                  </View>
                  <Pressable
                    style={styles.refreshIconButton}
                    onPress={loadJobs}
                    disabled={isLoadingJobs}
                  >
                    {isLoadingJobs ? (
                      <ActivityIndicator size="small" color="#0F172A" />
                    ) : (
                      <Feather name="refresh-cw" size={16} color="#0F172A" />
                    )}
                  </Pressable>
                </View>
                {jobs.length === 0 ? (
                  <Text style={styles.sectionHint}>
                    No AI videos yet. Generate one from the Generate tab.
                  </Text>
                ) : (
                  jobs.map((item) => (
                    <View key={item.id} style={styles.videoGridCard}>
                      <View style={styles.videoGridTopRow}>
                        <View style={styles.videoThumbWrap}>
                          {item.output_video_url ? (
                            <PreviewVideo
                              uri={localVideoMap[item.id] || item.output_video_url}
                              style={styles.videoThumb}
                              nativeControls={false}
                              showOverlayControl={false}
                            />
                          ) : (
                            <View style={styles.videoThumbPlaceholder}>
                              <Feather name="video-off" size={18} color="#94A3B8" />
                              <Text style={styles.videoThumbPlaceholderText}>Processing video</Text>
                            </View>
                          )}
                          {item.output_video_url ? (
                            <Pressable
                              style={styles.expandButtonCenter}
                              onPress={() => openPreview(item)}
                            >
                              <Feather name="maximize-2" size={18} color="#FFFFFF" />
                            </Pressable>
                          ) : null}
                        </View>
                        <View style={styles.videoMetaSection}>
                          <Text style={styles.videoTitleText} numberOfLines={2}>
                            {getJobTitle(item)}
                          </Text>
                          <Text style={styles.videoMetaText}>
                            {formatJobDate(item.created_at)} • {item.language.toUpperCase()}
                          </Text>
                          <View
                            style={[
                              styles.statusChip,
                              item.status === 'completed'
                                ? styles.statusChipCompleted
                                : item.status === 'failed'
                                  ? styles.statusChipFailed
                                  : styles.statusChipPending,
                            ]}
                          >
                            <Text style={styles.statusChipText}>{item.status.toUpperCase()}</Text>
                          </View>
                          {!item.output_video_url && item.error_message ? (
                            <Text style={styles.errorText}>{GENERIC_PROCESSING_ERROR}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.videoMetaActionsRow}>
                        {item.output_video_url ? (
                          <Pressable
                            style={styles.metaActionButton}
                            onPress={() => downloadVideo(item.id, item.output_video_url)}
                            accessibilityRole="button"
                            accessibilityLabel="Download video"
                          >
                            <Feather name="download" size={14} color="#0F172A" />
                          </Pressable>
                        ) : null}
                        {item.status === 'failed' ? (
                          <Pressable
                            style={[
                              styles.metaActionButton,
                              isRegenerating && styles.disabledButton,
                            ]}
                            onPress={() => retryVideoJobById(item.id)}
                            disabled={isRegenerating}
                            accessibilityRole="button"
                            accessibilityLabel="Retry generation"
                          >
                            <Feather name="refresh-cw" size={14} color="#0F172A" />
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[
                              styles.metaActionButton,
                              isLoadingJobs && styles.disabledButton,
                            ]}
                            onPress={loadJobs}
                            disabled={isLoadingJobs}
                            accessibilityRole="button"
                            accessibilityLabel="Refresh videos"
                          >
                            <Feather name="refresh-cw" size={14} color="#0F172A" />
                          </Pressable>
                        )}
                        <Pressable
                          style={[
                            styles.metaActionButton,
                            styles.metaActionDangerButton,
                            isDeleting && styles.disabledButton,
                          ]}
                          onPress={() => deleteVideoJobById(item.id)}
                          disabled={isDeleting}
                          accessibilityRole="button"
                          accessibilityLabel="Delete video"
                        >
                          <Feather name="trash-2" size={14} color="#B91C1C" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <Modal visible={Boolean(previewJob)} animationType="fade" transparent>
        <View style={styles.previewModalBackdrop}>
          <Pressable style={styles.previewModalClose} onPress={() => setPreviewJob(null)}>
            <Feather name="x" size={18} color="#FFFFFF" />
          </Pressable>
          {previewJob?.output_video_url ? (
            <PreviewVideo
              uri={localVideoMap[previewJob.id] || previewJob.output_video_url}
              style={styles.previewModalVideo}
              nativeControls
            />
          ) : null}
          <View style={styles.previewMetaBar}>
            <Text style={styles.previewModalTitle} numberOfLines={2}>
              {previewJob ? getJobTitle(previewJob) : ''}
            </Text>
            <Text style={styles.previewModalMeta}>
              {previewJob ? formatJobDate(previewJob.created_at) : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    color: '#475569',
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  tabText: {
    color: '#334155',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#1E3A8A',
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  authIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0ECFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  authSubtitle: {
    marginTop: 6,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  authButton: {
    marginTop: 14,
    borderRadius: 10,
    minHeight: 48,
    minWidth: 140,
    overflow: 'hidden',
  },
  authButtonGradient: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  videosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHintTight: {
    color: '#64748B',
    fontSize: 12,
  },
  refreshIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  videoJobCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#FCFDFF',
  },
  videoGridCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    backgroundColor: '#FCFDFF',
    gap: 4,
  },
  videoGridTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  videoThumbWrap: {
    width: 154,
    position: 'relative',
  },
  videoThumb: {
    width: 154,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  videoThumbPlaceholder: {
    width: 154,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  videoThumbPlaceholderText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  expandButtonCenter: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  videoMetaSection: {
    flex: 1,
    minWidth: 0,
  },
  videoTitleText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  videoMetaText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  videoMetaActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: -2,
  },
  metaActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaActionDangerButton: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  previewModalBackdrop: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  previewModalTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  previewModalClose: {
    position: 'absolute',
    right: 14,
    top: 54,
    zIndex: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  previewModalVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A',
  },
  previewMetaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  previewModalMeta: {
    marginTop: 4,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  videoCardHeader: {
    marginBottom: 8,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageText: {
    color: '#0F172A',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dateText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusChipFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusChipPending: {
    backgroundColor: '#DBEAFE',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  errorText: {
    color: '#B91C1C',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 12,
  },
  contextInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 10,
  },
  contextInputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadButton: {
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  rightActionMenu: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconDangerButton: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  videoWithActionsWrap: {
    marginTop: 4,
    alignSelf: 'stretch',
    position: 'relative',
    paddingRight: 52,
    minHeight: 0,
  },
  videoActionRail: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 8,
  },
  videoActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sourceVideoActionRail: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    gap: 8,
    paddingBottom: 18,
  },
  sourceVideoWithActionsWrap: {
    marginTop: 4,
    alignSelf: 'center',
    width: '76%',
    position: 'relative',
    paddingRight: 52,
  },
  dangerButton: {
    borderRadius: 10,
    minHeight: 40,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  sourceActionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceActionCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#F8FBFF',
    minHeight: 82,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0ECFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sourceActionTitle: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  previewPlayButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewReplayButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    minHeight: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sourceActionSubtext: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  uploadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: '#1D4ED8',
    fontWeight: '600',
    fontSize: 13,
  },
  uploadProgressWrap: {
    marginTop: 8,
  },
  scriptInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 120,
    textAlignVertical: 'top',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    marginBottom: 10,
  },
  langChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  langChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  langChipText: {
    color: '#334155',
    fontWeight: '600',
  },
  langChipTextActive: {
    color: '#1E3A8A',
  },
  video: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 420,
    alignSelf: 'stretch',
    backgroundColor: '#111827',
    borderRadius: 10,
    marginTop: 0,
    overflow: 'hidden',
  },
  statusText: {
    color: '#334155',
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
});
