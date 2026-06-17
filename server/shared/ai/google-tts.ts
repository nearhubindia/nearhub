import { GoogleAuth } from 'google-auth-library';

const GOOGLE_TTS_API_KEY = String(process.env.GOOGLE_TTS_API_KEY || '').trim();
const GOOGLE_CLOUD_PROJECT = String(process.env.GOOGLE_CLOUD_PROJECT || '').trim();
const GOOGLE_TTS_SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

let googleTtsAccessTokenCache: { token: string; expiresAtMs: number } | null = null;

export function hasGoogleTtsApiKey(): boolean {
  return Boolean(GOOGLE_TTS_API_KEY);
}

export function hasGoogleTtsAuth(): boolean {
  return (
    hasGoogleTtsApiKey() ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    Boolean(GOOGLE_CLOUD_PROJECT)
  );
}

export function getGoogleTtsEndpoint(): string {
  return GOOGLE_TTS_API_KEY
    ? `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(GOOGLE_TTS_API_KEY)}`
    : 'https://texttospeech.googleapis.com/v1/text:synthesize';
}

async function getGoogleTtsAccessToken(): Promise<string> {
  const now = Date.now();
  if (googleTtsAccessTokenCache && googleTtsAccessTokenCache.expiresAtMs > now) {
    return googleTtsAccessTokenCache.token;
  }

  const auth = new GoogleAuth({
    scopes: GOOGLE_TTS_SCOPES,
    projectId: GOOGLE_CLOUD_PROJECT || undefined,
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token || '';

  if (!token) {
    throw new Error('Failed to obtain Google Cloud access token for TTS');
  }

  googleTtsAccessTokenCache = {
    token,
    expiresAtMs: now + 45 * 60 * 1000,
  };
  return token;
}

export async function getGoogleTtsHeaders(): Promise<Record<string, string>> {
  if (GOOGLE_TTS_API_KEY) {
    return {};
  }

  if (!hasGoogleTtsAuth()) {
    throw new Error(
      'Google TTS auth is missing (set GOOGLE_TTS_API_KEY or GOOGLE_APPLICATION_CREDENTIALS)'
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getGoogleTtsAccessToken()}`,
  };

  if (GOOGLE_CLOUD_PROJECT) {
    headers['x-goog-user-project'] = GOOGLE_CLOUD_PROJECT;
  }

  return headers;
}
