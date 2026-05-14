type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

const DEFAULT_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.AI_GEMINI_RETRY_ATTEMPTS || '4', 10) || 4
);
const DEFAULT_BASE_DELAY_MS = Math.max(
  250,
  Number.parseInt(process.env.AI_GEMINI_RETRY_BASE_MS || '1200', 10) || 1200
);

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error');
}

function extractStatusLikeCode(error: any): number | null {
  const values = [
    error?.status,
    error?.statusCode,
    error?.code,
    error?.cause?.status,
    error?.response?.status,
  ];
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function isRetriableGeminiError(error: unknown): boolean {
  const status = extractStatusLikeCode(error);
  if (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message = asErrorMessage(error);
  return (
    /UNAVAILABLE/i.test(message) ||
    /RESOURCE_EXHAUSTED/i.test(message) ||
    /rate limit/i.test(message) ||
    /high demand/i.test(message) ||
    /\b(408|409|429|500|502|503|504)\b/.test(message) ||
    /deadline/i.test(message) ||
    /timed out|timeout/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(message)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGeminiWithRetry<T>(
  operationLabel: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const baseDelayMs = Math.max(100, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 20000);
  const jitterMs = Math.max(0, options.jitterMs ?? 450);
  const shouldRetry = options.shouldRetry ?? isRetriableGeminiError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && shouldRetry(error);
      if (!canRetry) break;
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * (jitterMs + 1));
      await sleep(delayMs + jitter);
    }
  }

  throw new Error(`${operationLabel} failed after retries: ${asErrorMessage(lastError)}`);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function extractTextFromGeminiResponse(response: any): string {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text.trim();
  if (typeof response.text === 'function') {
    try {
      const value = response.text();
      if (typeof value === 'string') return value.trim();
    } catch {
      // ignore function access errors and continue fallback parsing
    }
  }

  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];
  const text = parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
  return text;
}

export function extractInlineAudioFromGeminiResponse(response: any): {
  mimeType: string;
  data: string;
} | null {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];

  for (const part of parts) {
    const legacyInline = part?.inlineData;
    const snakeInline = part?.inline_data;
    const inline = legacyInline || snakeInline;
    if (typeof inline?.data === 'string') {
      return {
        mimeType: String(inline.mimeType || inline.mime_type || ''),
        data: inline.data,
      };
    }
  }
  return null;
}
