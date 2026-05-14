import { GoogleGenAI } from '@google/genai';
import { SERVER_CONFIG } from '../../lib/config';

function parseBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function shouldUseVertexAI(): boolean {
  if (typeof process.env.GOOGLE_GENAI_USE_VERTEX === 'string') {
    return parseBoolean(process.env.GOOGLE_GENAI_USE_VERTEX, false);
  }
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT);
}

export function isGoogleGenAIConfigured(): boolean {
  if (!SERVER_CONFIG.AI_FEATURES_ENABLED) return false;
  if (shouldUseVertexAI()) {
    return Boolean(process.env.GOOGLE_CLOUD_PROJECT);
  }
  return Boolean(SERVER_CONFIG.GOOGLE_GENAI_API_KEY);
}

export function getGoogleGenAIClient(): GoogleGenAI {
  if (shouldUseVertexAI()) {
    const project = String(process.env.GOOGLE_CLOUD_PROJECT || '').trim();
    const location = String(process.env.GOOGLE_CLOUD_LOCATION || 'global').trim() || 'global';
    if (!project) {
      throw new Error('GOOGLE_CLOUD_PROJECT is required for Vertex AI auth');
    }
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }

  if (!SERVER_CONFIG.GOOGLE_GENAI_API_KEY) {
    throw new Error('GOOGLE_GENAI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey: SERVER_CONFIG.GOOGLE_GENAI_API_KEY });
}

export function getGoogleGenAIAuthMode(): 'vertex' | 'api_key' | 'none' {
  if (shouldUseVertexAI()) return 'vertex';
  if (SERVER_CONFIG.GOOGLE_GENAI_API_KEY) return 'api_key';
  return 'none';
}
