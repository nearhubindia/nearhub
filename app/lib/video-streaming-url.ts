import { getApiUrl } from '@/lib/query-client';

export function remapLoopbackUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isLoopbackHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0';

    if (!isLoopbackHost) {
      return url;
    }

    const apiBase = new URL(getApiUrl());
    parsed.protocol = apiBase.protocol;
    parsed.host = apiBase.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getStreamingUrl(videoUrl: string): string {
  const apiBaseUrl = getApiUrl();

  if (videoUrl.startsWith('https://') || videoUrl.startsWith('http://')) {
    return remapLoopbackUrl(videoUrl);
  }

  if (videoUrl.startsWith('/videos/')) {
    const filename = videoUrl.replace(/^\/videos\//, '');
    return `${apiBaseUrl}/api/videos/stream/${filename}`;
  }

  return `${apiBaseUrl}/api/videos/stream/${videoUrl}`;
}

export function getAdaptiveStreamingUrl(videoUrl: string): string {
  const streamingUrl = getStreamingUrl(videoUrl);
  if (!/^https?:\/\//i.test(streamingUrl)) return streamingUrl;
  const apiBaseUrl = getApiUrl();
  return `${apiBaseUrl}/api/videos/hls/master.m3u8?source=${encodeURIComponent(streamingUrl)}`;
}

export function getProxyStreamingUrl(videoUrl: string): string {
  const apiBaseUrl = getApiUrl();
  return `${apiBaseUrl}/api/videos/proxy?url=${encodeURIComponent(videoUrl)}`;
}
