type JsonResponse = Record<string, unknown> & {
  success?: boolean;
  message?: string;
};

export async function parseJsonSafely<T extends JsonResponse = JsonResponse>(
  res: Response,
  requestUrl: string
): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();

  if (contentType.includes('application/json')) {
    return JSON.parse(raw || '{}') as T;
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Unexpected HTML response from ${requestUrl}. Check EXPO_PUBLIC_API_URL / EXPO_PUBLIC_DOMAIN.`
    );
  }

  return JSON.parse(trimmed || '{}') as T;
}
