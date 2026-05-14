import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { db } from '../../../data/db';
import { uploadLocalFileAsMedia } from '../services/cloudflare-media';
import { getGoogleGenAIClient, isGoogleGenAIConfigured } from '../../../shared/ai/genai-client';
import {
  callGeminiWithRetry,
  extractTextFromGeminiResponse,
  withTimeout,
} from '../../../shared/ai/genai-resilience';

type VoiceoverJob = {
  id: string;
  user_id: string;
  source_video_url: string;
  language: 'telugu' | 'kannada' | 'hindi' | 'english';
  script_text?: string | null;
  title_text?: string | null;
  highlights_text?: string | null;
  description_text?: string | null;
  attempts: number;
  max_attempts: number;
};

const SCRIPT_MODEL = process.env.GEMINI_SCRIPT_MODEL || 'gemini-2.5-flash';
const AI_SCRIPT_PROVIDER = (process.env.AI_SCRIPT_PROVIDER || 'aws').toLowerCase();
const AI_TRANSLATION_PROVIDER = (process.env.AI_TRANSLATION_PROVIDER || 'aws').toLowerCase();
const BEDROCK_SCRIPT_MODEL = process.env.BEDROCK_SCRIPT_MODEL || 'amazon.nova-lite-v1:0';
const GOOGLE_TTS_API_KEY = String(process.env.GOOGLE_TTS_API_KEY || '').trim();
const GOOGLE_CLOUD_PROJECT = String(process.env.GOOGLE_CLOUD_PROJECT || '').trim();
const requiresGoogleGenAI = AI_SCRIPT_PROVIDER === 'google' || AI_TRANSLATION_PROVIDER === 'google';
let googleTtsAccessTokenCache: { token: string; expiresAtMs: number } | null = null;
const AI_VOICEOVER_BGM_SOURCE = process.env.AI_VOICEOVER_BGM_SOURCE || 'builtin-cinematic';
const AI_VOICEOVER_BGM_VOLUME = Number.parseFloat(process.env.AI_VOICEOVER_BGM_VOLUME || '0.3');
const AI_VOICEOVER_ENHANCE_VIDEO = process.env.AI_VOICEOVER_ENHANCE_VIDEO !== 'false';
const AI_VOICEOVER_OUTPUT_WIDTH = Number.parseInt(
  process.env.AI_VOICEOVER_OUTPUT_WIDTH || '1080',
  10
);
const AI_VOICEOVER_OUTPUT_CRF = Number.parseInt(process.env.AI_VOICEOVER_OUTPUT_CRF || '21', 10);
const AI_VOICEOVER_OUTPUT_PRESET = process.env.AI_VOICEOVER_OUTPUT_PRESET || 'medium';
const AI_VOICEOVER_COMMAND_TIMEOUT_MS = Math.max(
  15_000,
  Number.parseInt(process.env.AI_VOICEOVER_COMMAND_TIMEOUT_MS || '180000', 10) || 180000
);
const AI_VOICEOVER_TTS_TIMEOUT_MS = Math.max(
  15_000,
  Number.parseInt(process.env.AI_VOICEOVER_TTS_TIMEOUT_MS || '120000', 10) || 120000
);

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${AI_VOICEOVER_COMMAND_TIMEOUT_MS}ms`));
    }, AI_VOICEOVER_COMMAND_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

function runCommandWithOutput(command: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${AI_VOICEOVER_COMMAND_TIMEOUT_MS}ms`));
    }, AI_VOICEOVER_COMMAND_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

function runCommandWithStderrOutput(command: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${AI_VOICEOVER_COMMAND_TIMEOUT_MS}ms`));
    }, AI_VOICEOVER_COMMAND_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stderr);
        return;
      }
      reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const output = await runCommandWithOutput('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nokey=1:noprint_wrappers=1',
    filePath,
  ]);
  const duration = Number.parseFloat(String(output).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to determine media duration for ${path.basename(filePath)}`);
  }
  return duration;
}

async function getMeanVolumeDb(filePath: string): Promise<number> {
  const output = await runCommandWithStderrOutput('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const match = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const meanVolume = Number.parseFloat(match?.[1] || '');
  if (!Number.isFinite(meanVolume)) {
    throw new Error(`Unable to measure audio volume for ${path.basename(filePath)}`);
  }
  return meanVolume;
}

async function assertAudibleAudio(filePath: string, label: string): Promise<void> {
  const duration = await getMediaDurationSeconds(filePath);
  const meanVolume = await getMeanVolumeDb(filePath);
  if (duration < 1 || meanVolume < -45) {
    throw new Error(
      `${label} is not audible enough (duration=${duration.toFixed(2)}s, mean=${meanVolume.toFixed(1)}dB)`
    );
  }
}

function buildAtempoFilter(speedFactor: number): string {
  const filters: string[] = [];
  let remaining = speedFactor;

  while (remaining > 2.0) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(4)}`);

  return filters.join(',');
}

function getLanguageInstruction(language: VoiceoverJob['language']): string {
  if (language === 'telugu') return 'Write in Telugu script.';
  if (language === 'kannada') return 'Write in Kannada script.';
  if (language === 'english') return 'Write in English.';
  return 'Write in Hindi (Devanagari script).';
}

function getTargetLanguageName(language: VoiceoverJob['language']): string {
  if (language === 'telugu') return 'Telugu';
  if (language === 'kannada') return 'Kannada';
  if (language === 'english') return 'English';
  return 'Hindi';
}

function getAwsTranslateLanguageCode(language: VoiceoverJob['language']): string {
  if (language === 'telugu') return 'te';
  if (language === 'kannada') return 'kn';
  if (language === 'english') return 'en';
  return 'hi';
}

function getVoiceName(language: VoiceoverJob['language']): string {
  const teluguVoice = process.env.AI_TTS_VOICE_TELUGU || 'te-IN-Standard-A';
  const kannadaVoice = process.env.AI_TTS_VOICE_KANNADA || 'kn-IN-Standard-A';
  const hindiVoice = process.env.AI_TTS_VOICE_HINDI || 'hi-IN-Standard-A';
  const englishVoice = process.env.AI_TTS_VOICE_ENGLISH || 'en-IN-Standard-A';

  if (language === 'telugu') return teluguVoice;
  if (language === 'kannada') return kannadaVoice;
  if (language === 'english') return englishVoice;
  return hindiVoice;
}

function getTtsLanguageCode(language: VoiceoverJob['language']): string {
  if (language === 'telugu') return 'te-IN';
  if (language === 'kannada') return 'kn-IN';
  if (language === 'english') return 'en-IN';
  return 'hi-IN';
}

function postProcessNarrationScript(
  language: VoiceoverJob['language'],
  inputScript: string
): string {
  let script = String(inputScript || '').trim();
  if (!script) return script;

  // Remove leading/trailing decorative quotes which can be spoken literally by some voices.
  script = script.replace(/^[“"']+/, '').replace(/[”"']+$/, '');

  if (language === 'telugu') {
    script = script
      .replace(/\bi\s*5\s*13\b/gi, 'ఐ ఫైవ్ పదమూడు')
      .replace(/\bI\s*5\b/gi, 'ఐ ఫైవ్')
      .replace(/\bI\s*7\b/gi, 'ఐ సెవెన్')
      .replace(/ఐ\s*5/g, 'ఐ ఫైవ్')
      .replace(/ఐ\s*7/g, 'ఐ సెవెన్')
      .replace(/\b13\b/g, 'పదమూడు')
      .replace(/\b32\b/g, 'ముప్పై రెండు')
      .replace(/\b(\d+)\s*th\s*generation\b/gi, '$1వ తరం')
      .replace(/\b(\d+)\s*gb\b/gi, '$1 జీబీ')
      .replace(/\bRAM\b/gi, 'ర్యామ్')
      .replace(/మనం\s+విక్రయించడానికి/g, 'అమ్మకానికి')
      .replace(/కూర్నూల్\s*లో/g, 'కర్నూలులో')
      .replace(/కర్నూల్\s*లో/g, 'కర్నూలులో')
      .replace(/లాప్‌టాప్/g, 'ల్యాప్‌టాప్')
      .replace(/ఆదర్శ\s+ఎంపిక/g, 'మంచి ఎంపిక')
      .replace(
        /రోజువారీ\s+ఉపయోగం\s+కోసం\s+సరళంగా\s+సిద్ధం\.?/g,
        'రోజువారీ వినియోగానికి మంచి ఎంపిక.'
      )
      .replace(/కర్నూలులో\s+మీరు\s+కనుగొనవచ్చు\.?/g, 'కర్నూలులో అందుబాటులో ఉంది.')
      .replace(/కర్నూలులో\s+దీనిని\s+కొనండి\.?/g, 'ఆసక్తి ఉంటే విక్రేతను సంప్రదించండి.')
      .replace(
        /మీ\s+డీల్‌?\s*ను\s+ఇప్పుడు\s+నిర్ధారించుకోండి\.?/g,
        'ఆసక్తి ఉంటే విక్రేతను సంప్రదించండి.'
      )
      .replace(/[.]{2,}/g, '.');
  }

  if (language === 'kannada') {
    script = script
      .replace(/\bi\s*5\s*13\b/gi, 'ಐ ಫೈವ್ ಹದಿಮೂರು')
      .replace(/\bI\s*5\b/gi, 'ಐ ಫೈವ್')
      .replace(/\bI\s*7\b/gi, 'ಐ ಸೆವೆನ್')
      .replace(/ಐ\s*5/g, 'ಐ ಫೈವ್')
      .replace(/ಐ\s*7/g, 'ಐ ಸೆವೆನ್')
      .replace(/\b13\b/g, 'ಹದಿಮೂರು')
      .replace(/\b32\b/g, 'ಮೂವತ್ತೆರಡು')
      .replace(/\b(\d+)\s*th\s*generation\b/gi, '$1ನೇ ತಲೆಮಾರು')
      .replace(/\b(\d+)\s*gb\b/gi, '$1 ಜಿಬಿ')
      .replace(/\bRAM\b/gi, 'ರ್ಯಾಮ್')
      .replace(/[.]{2,}/g, '.');
  }

  if (language === 'hindi') {
    script = script
      .replace(/\bi\s*5\s*13\b/gi, 'आई फाइव तेरह')
      .replace(/\bI\s*5\b/gi, 'आई फाइव')
      .replace(/\bI\s*7\b/gi, 'आई सेवन')
      .replace(/आई\s*5/g, 'आई फाइव')
      .replace(/आई\s*7/g, 'आई सेवन')
      .replace(/\b13\b/g, 'तेरह')
      .replace(/\b32\b/g, 'बत्तीस')
      .replace(/\b(\d+)\s*th\s*generation\b/gi, '$1वीं जेनरेशन')
      .replace(/\b(\d+)\s*gb\b/gi, '$1 जीबी')
      .replace(/\bRAM\b/gi, 'रैम')
      .replace(/[.]{2,}/g, '.');
  }

  return script;
}

function normalizeContextValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toSafeFileSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'ai-voiceover';
}

function parseContextFromLegacyScript(scriptText: string): {
  title: string;
  highlights: string;
  description: string;
} {
  const titleMatch = scriptText.match(/(?:^|\n)\s*Product:\s*(.+?)(?:\n|$)/i);
  const highlightsMatch = scriptText.match(/(?:^|\n)\s*Highlights:\s*(.+?)(?:\n|$)/i);
  const descriptionMatch = scriptText.match(/(?:^|\n)\s*Description:\s*([\s\S]+)$/i);
  return {
    title: normalizeContextValue(titleMatch?.[1] || ''),
    highlights: normalizeContextValue(highlightsMatch?.[1] || ''),
    description: normalizeContextValue(descriptionMatch?.[1] || ''),
  };
}

function buildContextBlock(context: {
  title: string;
  highlights: string;
  description: string;
}): string {
  const lines: string[] = [];
  if (context.title) lines.push(`Title: ${context.title}`);
  if (context.highlights) lines.push(`Highlights: ${context.highlights}`);
  if (context.description) lines.push(`Description: ${context.description}`);
  return lines.join('\n');
}

function buildEngagingFallbackSeed(context: {
  title: string;
  highlights: string;
  description: string;
}): string {
  const title = context.title || 'this listing';
  const normalizedHighlights = context.highlights
    .split(/\n|,|;|\||•|·/)
    .map((item) => item.trim())
    .filter(Boolean);
  const topHighlights = normalizedHighlights.slice(0, 3);
  const highlightLine =
    topHighlights.length > 0 ? `Top highlights: ${topHighlights.join(', ')}.` : '';
  const descriptionLine = context.description ? `${context.description}.` : '';

  return [
    `Take a look at ${title}.`,
    highlightLine,
    descriptionLine,
    'If this matches what you need, contact the seller today.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildDeterministicNarrationSeed(context: {
  title: string;
  highlights: string;
  description: string;
}): string {
  const title = context.title || 'this listing';
  const highlights = context.highlights ? `Key highlights: ${context.highlights}.` : '';
  const description = context.description ? `${context.description}.` : '';
  return [
    `For sale: ${title}.`,
    highlights,
    description,
    'If this fits your need, contact the seller now.',
  ]
    .filter(Boolean)
    .join(' ');
}

function scriptLooksContextual(
  script: string,
  context: { title: string; highlights: string; description: string }
): boolean {
  const normalizedScript = String(script || '').toLowerCase();
  const normalizedTitle = String(context.title || '').toLowerCase();
  if (!normalizedScript || !normalizedTitle) return Boolean(normalizedScript);

  const titleTokens = normalizedTitle
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 6);

  if (titleTokens.length === 0) return true;
  return titleTokens.some((token) => normalizedScript.includes(token));
}

function scriptLooksTooWeak(script: string): boolean {
  const value = String(script || '').trim();
  if (!value) return true;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  const alphaChars = (value.match(/\p{L}/gu) || []).length;
  const digitChars = (value.match(/[0-9]/g) || []).length;
  if (alphaChars === 0) return true;
  if (digitChars > alphaChars) return true;
  return false;
}

function scriptLooksNumberHeavy(script: string): boolean {
  const value = String(script || '').trim();
  if (!value) return true;
  const alphaChars = (value.match(/\p{L}/gu) || []).length;
  const digitChars = (value.match(/[0-9]/g) || []).length;
  if (alphaChars === 0) return true;
  return digitChars >= Math.max(3, Math.floor(alphaChars * 0.35));
}

function scriptLooksTooSloganLike(script: string): boolean {
  const value = String(script || '').toLowerCase();
  return /\b(unleash|elevate|experience the|do not miss|don't miss|power[-\s]?packed|game[-\s]?changer|ultimate|revolutionary)\b/.test(
    value
  );
}

function scriptHasTargetWriting(script: string, language: VoiceoverJob['language']): boolean {
  const value = String(script || '').trim();
  if (!value) return false;
  if (language === 'telugu') return /[\u0C00-\u0C7F]/.test(value);
  if (language === 'kannada') return /[\u0C80-\u0CFF]/.test(value);
  if (language === 'hindi') return /[\u0900-\u097F]/.test(value);
  return /[A-Za-z]/.test(value);
}

async function translateFieldAws(
  text: string,
  language: VoiceoverJob['language']
): Promise<string> {
  const input = String(text || '').trim();
  if (!input) return '';
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const client = new TranslateClient({ region });
  const response = await client.send(
    new TranslateTextCommand({
      SourceLanguageCode: 'auto',
      TargetLanguageCode: getAwsTranslateLanguageCode(language),
      Text: input,
    })
  );
  return String(response.TranslatedText || input).trim();
}

async function buildGuaranteedMarketingNarration(
  language: VoiceoverJob['language'],
  context: { title: string; highlights: string; description: string }
): Promise<string> {
  const title = await translateFieldAws(context.title || 'this product', language);
  const highlightsRaw = await translateFieldAws(context.highlights || '', language);
  const description = await translateFieldAws(context.description || '', language);
  const hasDigitsInHighlights = /[0-9]/.test(highlightsRaw);

  if (language === 'telugu') {
    const highlights = hasDigitsInHighlights
      ? 'శక్తివంతమైన పనితీరు, చక్కటి కండిషన్, నమ్మకమైన రోజువారీ వినియోగం'
      : highlightsRaw;
    return [
      `శక్తివంతమైన పనితీరుతో ${title} ఇప్పుడు అమ్మకానికి అందుబాటులో ఉంది.`,
      highlights ? `ప్రధాన విశేషాలు: ${highlights}.` : '',
      description ? `${description}.` : '',
      'ఇలాంటి మంచి డీల్ మిస్ కావొద్దు, వెంటనే విక్రేతను సంప్రదించండి.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (language === 'kannada') {
    const highlights = hasDigitsInHighlights
      ? 'ಶಕ್ತಿಯುತ ಕಾರ್ಯಕ್ಷಮತೆ, ಉತ್ತಮ ಸ್ಥಿತಿ, ವಿಶ್ವಾಸಾರ್ಹ ದಿನನಿತ್ಯ ಬಳಕೆ'
      : highlightsRaw;
    return [
      `ಶಕ್ತಿಯುತ ಕಾರ್ಯಕ್ಷಮತೆಯೊಂದಿಗೆ ${title} ಈಗ ಮಾರಾಟಕ್ಕೆ ಲಭ್ಯವಿದೆ.`,
      highlights ? `ಮುಖ್ಯ ವೈಶಿಷ್ಟ್ಯಗಳು: ${highlights}.` : '',
      description ? `${description}.` : '',
      'ಇಂತಹ ಒಳ್ಳೆಯ ಡೀಲ್ ತಪ್ಪಿಸಿಕೊಳ್ಳಬೇಡಿ, ತಕ್ಷಣ ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (language === 'hindi') {
    const highlights = hasDigitsInHighlights
      ? 'दमदार परफॉर्मेंस, बेहतरीन कंडीशन और भरोसेमंद रोज़मर्रा उपयोग'
      : highlightsRaw;
    return [
      `दमदार परफॉर्मेंस के साथ ${title} अभी बिक्री के लिए उपलब्ध है।`,
      highlights ? `मुख्य विशेषताएँ: ${highlights}।` : '',
      description ? `${description}।` : '',
      'ऐसी बेहतरीन डील मिस न करें, अभी विक्रेता से संपर्क करें।',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    `${context.title || 'This product'} is now available for sale with strong performance.`,
    context.highlights ? `Key highlights: ${context.highlights}.` : '',
    context.description ? `${context.description}.` : '',
    'Do not miss this deal, contact the seller now.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildTeluguPhoneticTtsScript(context: {
  title: string;
  highlights: string;
  description: string;
}): string {
  const rawTitle = context.title || 'this listing';
  const safeTitle = rawTitle
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\b(i\s*)?5\b/gi, 'i five')
    .replace(/\b(i\s*)?7\b/gi, 'i seven')
    .replace(/\b13\b/g, 'thirteen')
    .replace(/\b32\b/g, 'thirty two')
    .replace(/\b4\b/g, 'four')
    .replace(/\s+/g, ' ')
    .trim();
  const location = /kurnool/i.test(`${context.title} ${context.highlights} ${context.description}`)
    ? 'Kurnool lo'
    : 'mee area lo';

  // ElevenLabs voices available in this workspace are not Telugu-native, so Telugu script
  // can become silent or punctuation-like. Feed clean phonetic Telugu with no symbols.
  return [
    'Namaskaram',
    `${safeTitle || 'ee product'} ippudu ${location} sale ki ready ga undi`,
    'balamaina performance smooth daily use gaming ki chala manchi option',
    'interested buyers ventane seller ni contact cheyyandi',
  ].join(' ');
}

function buildTtsInputForProvider(
  language: VoiceoverJob['language'],
  script: string,
  context: { title: string; highlights: string; description: string }
): string {
  return script;
}

function enforceSalesRubric(
  language: VoiceoverJob['language'],
  script: string,
  context: { title: string; highlights: string; description: string }
): string {
  const normalized = String(script || '')
    .replace(/\s+/g, ' ')
    .trim();
  const title = (context.title || '').trim();
  const highlights = (context.highlights || '').trim();
  const description = (context.description || '').trim();

  let result = normalized;
  if (!result) {
    result = buildDeterministicNarrationSeed(context);
  }

  const lower = result.toLowerCase();
  const titleMentioned =
    !title ||
    lower.includes(title.toLowerCase()) ||
    title
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length >= 4)
      .some((part) => lower.includes(part));

  if (!titleMentioned) {
    if (language === 'hindi') result = `${title} बिक्री के लिए उपलब्ध है. ${result}`.trim();
    else if (language === 'kannada') result = `${title} ಈಗ ಮಾರಾಟಕ್ಕೆ ಲಭ್ಯವಿದೆ. ${result}`.trim();
    else if (language === 'telugu')
      result = `${title} ఇప్పుడు అమ్మకానికి అందుబాటులో ఉంది. ${result}`.trim();
    else result = `${title} is now available for sale. ${result}`.trim();
  }

  const benefitSignals =
    /(highlight|feature|benefit|performance|condition|quality|usage|విశేష|పనితీరు|మంచి|ವೈಶಿಷ್ಟ|ಕಾರ್ಯಕ್ಷಮ|उपयोग|फीचर|परफॉर्मेंस)/i;
  const hasBenefitLine = benefitSignals.test(result) || Boolean(highlights || description);
  if (!hasBenefitLine && highlights) {
    if (language === 'hindi') result = `${result} मुख्य विशेषताएँ: ${highlights}.`;
    else if (language === 'kannada') result = `${result} ಮುಖ್ಯ ವೈಶಿಷ್ಟ್ಯಗಳು: ${highlights}.`;
    else if (language === 'telugu') result = `${result} ప్రధాన విశేషాలు: ${highlights}.`;
    else result = `${result} Key highlights: ${highlights}.`;
  }

  const ctaSignals =
    /(contact|call|message|check this listing|seller|book now|సంప్రదించ|ಮಾರಾಟಗಾರ|ವಿಕ್ರೇತ|ಸಂಪರ್ಕಿಸಿ|संपर्क|विक्रेता)/i;
  if (!ctaSignals.test(result)) {
    if (language === 'hindi') result = `${result} इच्छुक खरीदार अभी विक्रेता से संपर्क करें।`;
    else if (language === 'kannada')
      result = `${result} ಆಸಕ್ತ ಖರೀದಿದಾರರು ತಕ್ಷಣ ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ.`;
    else if (language === 'telugu')
      result = `${result} ఆసక్తి ఉన్న కొనుగోలుదారులు వెంటనే విక్రేతను సంప్రదించండి.`;
    else result = `${result} Interested buyers can contact the seller now.`;
  }

  return result.replace(/\s+/g, ' ').trim();
}

async function claimNextJob(): Promise<VoiceoverJob | null> {
  // Recover jobs that got stuck in processing (for example due to external
  // provider/network stalls) so the queue can keep moving.
  await db.execute(sql`
    UPDATE ai_voiceover_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
        attempts = CASE WHEN attempts >= max_attempts THEN attempts ELSE attempts + 1 END,
        error_message = COALESCE(error_message, 'Voice-over worker watchdog: processing timeout'),
        updated_at = CURRENT_TIMESTAMP,
        processed_at = CASE WHEN attempts >= max_attempts THEN CURRENT_TIMESTAMP ELSE processed_at END
    WHERE status = 'processing'
      AND updated_at < (CURRENT_TIMESTAMP - INTERVAL '8 minutes')
  `);

  const result = await db.execute(sql`
    UPDATE ai_voiceover_jobs j
    SET status = 'processing',
        attempts = j.attempts + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE j.id = (
      SELECT id
      FROM ai_voiceover_jobs
      WHERE status = 'pending'
        AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING j.id, j.user_id, j.source_video_url, j.language, j.script_text, j.title_text, j.highlights_text, j.description_text, j.attempts, j.max_attempts
  `);
  const rows = Array.isArray((result as any).rows) ? ((result as any).rows as VoiceoverJob[]) : [];
  return rows[0] || null;
}

async function generateScript(
  ai: GoogleGenAI,
  language: VoiceoverJob['language'],
  videoDurationSeconds: number,
  context: { title: string; highlights: string; description: string }
): Promise<string> {
  const instruction = getLanguageInstruction(language);
  const targetWords = Math.max(8, Math.min(45, Math.floor(videoDurationSeconds * 2.2)));
  const contextBlock = buildContextBlock(context);
  const response = await callGeminiWithRetry('Gemini script generation', () =>
    ai.models.generateContent({
      model: SCRIPT_MODEL,
      contents: `Generate a concise, natural product promo voice-over script for a marketplace video.
Use Title and Highlights first, and Description as supporting context.
Do not invent specs/claims not present in the input.
Limit to 2-3 short sentences.
Keep it around ${targetWords} words so it comfortably fits a ${videoDurationSeconds.toFixed(1)} second video.
Tone: engaging, lively, and trustworthy (not robotic).
Start with a strong hook in the first line.
Highlight 2-3 strongest buyer benefits.
End with a soft call-to-action (for example: contact now / check this listing).
Avoid generic filler like "best deal ever" unless supported by input.
${instruction}
Input:
${contextBlock || 'No listing context provided.'}
Return only the final script.`,
    })
  );
  return extractTextFromGeminiResponse(response);
}

async function generateScriptAws(
  language: VoiceoverJob['language'],
  videoDurationSeconds: number,
  context: { title: string; highlights: string; description: string }
): Promise<string> {
  const targetLanguage = getTargetLanguageName(language);
  const targetScript = getLanguageInstruction(language);
  const targetWords = Math.max(8, Math.min(38, Math.floor(videoDurationSeconds * 2.0)));
  const contextBlock = buildContextBlock(context);
  const prompt = `Write the final product promo voice-over narration in ${targetLanguage} for a local marketplace video.
${targetScript}
Use only details from the input. Do not invent specs or claims.
Make it marketing-oriented: clearly promote why the buyer should care about this product.
Sound confident, clean, and natural (not robotic), like a real local seller speaking clearly to a buyer.
Turn the key highlights into buyer benefits.
Use plain local-seller wording, not big advertising slogans.
Avoid idioms, metaphors, and phrases like "unleash", "elevate", "experience the", "do not miss", "ultimate", or "game changer".
For Telugu, prefer everyday local wording like "అమ్మకానికి సిద్ధంగా ఉంది", "మంచి ఎంపిక", and "విక్రేతను సంప్రదించండి"; avoid formal phrases like "డీల్ నిర్ధారించుకోండి" or "ఆదర్శ ఎంపిక".
For Hindi, prefer everyday local wording like "बिक्री के लिए उपलब्ध है", "अच्छा विकल्प", and "विक्रेता से संपर्क करें".
Mention the product title clearly.
Mention the strongest key highlights clearly.
Mention the description/location if provided.
Fit naturally inside a ${videoDurationSeconds.toFixed(1)} second video.
Structure:
1) Clear opening that says the item is available/sale-ready
2) 2-3 strongest buyer benefits
3) Soft call-to-action ending
Length: around ${targetWords} spoken words, 2-3 short sentences.
The narration should fit the video comfortably at natural speech speed, not slow and not rushed.
Return only the final narration text in ${targetLanguage}. No labels, no bullets.

Input:
${contextBlock || 'No listing context provided.'}`;

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const client = new BedrockRuntimeClient({ region });
  const command = new ConverseCommand({
    modelId: BEDROCK_SCRIPT_MODEL,
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 220,
      temperature: 0.65,
    },
  });
  const response = await client.send(command);
  const content = response.output?.message?.content ?? [];
  const text = String(
    content
      .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n')
  ).trim();
  if (!text || scriptLooksTooSloganLike(text)) {
    return buildDeterministicNarrationSeed(context);
  }
  return text;
}

async function localizeScript(
  ai: GoogleGenAI,
  script: string,
  language: VoiceoverJob['language'],
  videoDurationSeconds: number
): Promise<string> {
  const targetLanguage = getTargetLanguageName(language);
  const targetScript = getLanguageInstruction(language);
  const targetWords = Math.max(8, Math.min(45, Math.floor(videoDurationSeconds * 2.2)));
  const response = await callGeminiWithRetry('Gemini localization', () =>
    ai.models.generateContent({
      model: SCRIPT_MODEL,
      contents: `Rewrite the following product voice-over script in ${targetLanguage}.
${targetScript}
Keep meaning intact, keep it natural and realistic for spoken narration, and keep it concise.
Target around ${targetWords} words so it fits a ${videoDurationSeconds.toFixed(1)} second video.
Make the delivery engaging and conversational for marketplace buyers.
Preserve a hook-like opening and a gentle call-to-action ending.
Return only the rewritten script.

Input script:
${script}`,
    })
  );

  const localized = extractTextFromGeminiResponse(response);
  return localized || script;
}

async function localizeScriptAws(
  script: string,
  language: VoiceoverJob['language']
): Promise<string> {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const client = new TranslateClient({ region });
  const response = await client.send(
    new TranslateTextCommand({
      SourceLanguageCode: 'auto',
      TargetLanguageCode: getAwsTranslateLanguageCode(language),
      Text: script,
    })
  );
  let translated = String(response.TranslatedText || '').trim();

  const isIndicLanguage = language === 'telugu' || language === 'kannada' || language === 'hindi';
  const hasTargetScript = (value: string): boolean => {
    if (language === 'telugu') return /[\u0C00-\u0C7F]/.test(value);
    if (language === 'kannada') return /[\u0C80-\u0CFF]/.test(value);
    if (language === 'hindi') return /[\u0900-\u097F]/.test(value);
    return true;
  };

  // Guard against cases where translation returns mostly English text for Indic targets.
  if (isIndicLanguage && translated && !hasTargetScript(translated)) {
    const retry = await client.send(
      new TranslateTextCommand({
        SourceLanguageCode: 'en',
        TargetLanguageCode: getAwsTranslateLanguageCode(language),
        Text: script,
      })
    );
    const retried = String(retry.TranslatedText || '').trim();
    if (retried && hasTargetScript(retried)) translated = retried;
  }

  // Never allow English/Latin-only text to proceed for Indic languages.
  if (isIndicLanguage && translated && !hasTargetScript(translated)) {
    throw new Error(`Localization did not produce ${language} script text`);
  }

  return translated || script;
}

async function generateSpeechWav(
  script: string,
  language: VoiceoverJob['language'],
  outPath: string
): Promise<void> {
  if (!GOOGLE_TTS_API_KEY && !GOOGLE_CLOUD_PROJECT) {
    throw new Error('Google TTS auth is missing (set GOOGLE_TTS_API_KEY or GOOGLE_CLOUD_PROJECT)');
  }
  const voiceName = getVoiceName(language);
  const languageCode = getTtsLanguageCode(language);
  const endpoint = GOOGLE_TTS_API_KEY
    ? `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(GOOGLE_TTS_API_KEY)}`
    : 'https://texttospeech.googleapis.com/v1/text:synthesize';
  const headers: Record<string, string> = {};
  if (!GOOGLE_TTS_API_KEY) {
    const now = Date.now();
    if (!googleTtsAccessTokenCache || googleTtsAccessTokenCache.expiresAtMs <= now) {
      let token = '';
      try {
        token = (
          await runCommandWithOutput('gcloud', [
            'auth',
            'application-default',
            'print-access-token',
          ])
        ).trim();
      } catch {
        token = (await runCommandWithOutput('gcloud', ['auth', 'print-access-token'])).trim();
      }
      if (!token) throw new Error('Failed to obtain Google Cloud access token for TTS');
      googleTtsAccessTokenCache = { token, expiresAtMs: now + 45 * 60 * 1000 };
    }
    headers.Authorization = `Bearer ${googleTtsAccessTokenCache.token}`;
    headers['x-goog-user-project'] = GOOGLE_CLOUD_PROJECT;
  }
  const response = await withTimeout(
    axios.post(
      endpoint,
      {
        input: { text: script },
        voice: { languageCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          speakingRate: 1.02,
          pitch: 0,
        },
      },
      { timeout: AI_VOICEOVER_TTS_TIMEOUT_MS, headers }
    ),
    AI_VOICEOVER_TTS_TIMEOUT_MS,
    'Google Cloud TTS request'
  );
  const audioBase64 = String((response.data as any)?.audioContent || '').trim();
  if (!audioBase64) throw new Error('Google Cloud TTS did not return audio payload');
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  await fs.writeFile(outPath, audioBuffer);
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadToFile(url: string, targetPath: string): Promise<void> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 3,
  });
  await fs.writeFile(targetPath, Buffer.from(response.data));
}

async function prepareBackgroundMusic(durationSeconds: number, outPath: string): Promise<boolean> {
  if (AI_VOICEOVER_BGM_SOURCE === 'none') return false;

  if (AI_VOICEOVER_BGM_SOURCE === 'builtin-cinematic') {
    // Procedurally generate a warm musical bed so BGM is clearly present by default.
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anoisesrc=color=brown:amplitude=0.08:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=146.83:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=220:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=293.66:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-filter_complex',
      '[0:a]lowpass=f=1200,highpass=f=60,volume=0.45[n];' +
        '[1:a]volume=0.75,bass=g=5:f=140[p1];' +
        '[2:a]volume=0.42[p2];' +
        '[3:a]volume=0.32,tremolo=f=0.45:d=0.25[p3];' +
        '[4:a]volume=0.18,lowpass=f=1600[p4];' +
        '[n][p1][p2][p3][p4]amix=inputs=5:normalize=0,' +
        'aecho=0.8:0.88:55:0.18,' +
        'afade=t=in:st=0:d=1.5,' +
        `afade=t=out:st=${Math.max(0, durationSeconds - 1.8).toFixed(3)}:d=1.8` +
        '[bgm]',
      '-map',
      '[bgm]',
      '-ar',
      '24000',
      '-ac',
      '1',
      outPath,
    ]);
    return true;
  }

  if (
    AI_VOICEOVER_BGM_SOURCE.startsWith('http://') ||
    AI_VOICEOVER_BGM_SOURCE.startsWith('https://')
  ) {
    await downloadToFile(AI_VOICEOVER_BGM_SOURCE, outPath);
    return true;
  }

  await fs.copyFile(AI_VOICEOVER_BGM_SOURCE, outPath);
  return true;
}

function buildVideoEnhancementFilter(): string {
  if (!AI_VOICEOVER_ENHANCE_VIDEO) return 'null';
  return [
    'unsharp=5:5:0.6:5:5:0.2',
    'eq=contrast=1.06:brightness=0.01:saturation=1.08:gamma=1.02',
    'format=yuv420p',
  ].join(',');
}

function toUserFriendlyVoiceoverError(rawMessage: string): string {
  const message = String(rawMessage || '').trim();
  const isGoogleTtsOutage =
    /google cloud tts/i.test(message) &&
    /\b(429|500|503|internal|unavailable|resource_exhausted|timed out|timeout)\b/i.test(message);

  if (isGoogleTtsOutage) {
    return 'AI voice-over is down right now. Please try again after some time.';
  }

  return message || 'Voice-over generation failed';
}

export async function processAIVoiceoverQueue(batchSize = 2): Promise<{
  processed: number;
  completed: number;
  failed: number;
}> {
  const hasGoogleTtsAuth = Boolean(GOOGLE_TTS_API_KEY || GOOGLE_CLOUD_PROJECT);
  if ((requiresGoogleGenAI && !isGoogleGenAIConfigured()) || !hasGoogleTtsAuth) {
    await db.execute(sql`
      UPDATE ai_voiceover_jobs
      SET status = 'failed',
          error_message = 'AI voice-over is temporarily unavailable. Please try again later.',
          updated_at = CURRENT_TIMESTAMP,
          processed_at = CURRENT_TIMESTAMP
      WHERE status IN ('pending', 'processing')
    `);
    return { processed: 0, completed: 0, failed: 0 };
  }

  let processed = 0;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < batchSize; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;
    console.info('[AI Voiceover] Job claimed', {
      jobId: job.id,
      attempt: job.attempts,
      language: job.language,
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nearhub-ai-voiceover-'));
    const sourceVideoPath = path.join(tempDir, 'source.mp4');
    const voiceWavPath = path.join(tempDir, 'voice.wav');
    const bgmPath = path.join(tempDir, 'bgm.wav');
    const outputVideoPath = path.join(tempDir, 'output.mp4');

    try {
      // Google client is always needed for TTS in this worker, regardless of
      // script/translation provider selection.
      const ai = requiresGoogleGenAI && isGoogleGenAIConfigured() ? getGoogleGenAIClient() : null;
      await downloadToFile(job.source_video_url, sourceVideoPath);
      console.info('[AI Voiceover] Source downloaded', { jobId: job.id });
      const videoDurationSeconds = await getMediaDurationSeconds(sourceVideoPath);
      console.info('[AI Voiceover] Source inspected', {
        jobId: job.id,
        videoDurationSeconds: Number(videoDurationSeconds.toFixed(2)),
      });

      const baseScript =
        typeof job.script_text === 'string' && job.script_text.trim().length > 0
          ? job.script_text.trim()
          : '';
      const context = {
        title: normalizeContextValue(job.title_text),
        highlights: normalizeContextValue(job.highlights_text),
        description: normalizeContextValue(job.description_text),
      };
      if (!context.title && !context.highlights && !context.description && baseScript) {
        const parsed = parseContextFromLegacyScript(baseScript);
        context.title = parsed.title;
        context.highlights = parsed.highlights;
        context.description = parsed.description;
      }
      const hasContext = Boolean(context.title || context.highlights || context.description);
      let scriptSeed = baseScript || 'Limited time offer. Check this listing now.';
      let scriptSeedAlreadyLocalized = false;
      if (hasContext && AI_SCRIPT_PROVIDER === 'google' && ai) {
        scriptSeed = await generateScript(ai, job.language, videoDurationSeconds, context);
        scriptSeedAlreadyLocalized = true;
      } else if (hasContext && AI_SCRIPT_PROVIDER === 'aws') {
        try {
          scriptSeed = await generateScriptAws(job.language, videoDurationSeconds, context);
          scriptSeedAlreadyLocalized = true;
        } catch (error) {
          scriptSeed = buildEngagingFallbackSeed(context);
          console.warn(
            '[AI Voiceover] Bedrock script generation failed, using fallback seed:',
            error
          );
        }
      } else if (hasContext) {
        scriptSeed = buildEngagingFallbackSeed(context);
      }
      if (scriptSeedAlreadyLocalized && !scriptHasTargetWriting(scriptSeed, job.language)) {
        scriptSeedAlreadyLocalized = false;
      }
      if (
        hasContext &&
        (!scriptSeedAlreadyLocalized || job.language === 'english') &&
        (!scriptLooksContextual(scriptSeed, context) || scriptLooksTooSloganLike(scriptSeed))
      ) {
        scriptSeed = buildDeterministicNarrationSeed(context);
        scriptSeedAlreadyLocalized = false;
      }
      let script = baseScript;
      if (scriptSeedAlreadyLocalized) {
        script = scriptSeed;
      } else if (AI_TRANSLATION_PROVIDER === 'aws') {
        script = await localizeScriptAws(scriptSeed, job.language);
      } else if (ai) {
        script = await localizeScript(ai, scriptSeed, job.language, videoDurationSeconds);
      } else {
        script = scriptSeed;
      }
      if (hasContext && (scriptLooksTooWeak(script) || scriptLooksNumberHeavy(script))) {
        const deterministicSeed = buildDeterministicNarrationSeed(context);
        if (AI_TRANSLATION_PROVIDER === 'aws') {
          script = await localizeScriptAws(deterministicSeed, job.language);
        } else if (ai) {
          script = await localizeScript(ai, deterministicSeed, job.language, videoDurationSeconds);
        } else {
          script = deterministicSeed;
        }
      }
      if (hasContext && (scriptLooksTooWeak(script) || scriptLooksNumberHeavy(script))) {
        script = await buildGuaranteedMarketingNarration(job.language, context);
      }
      script = postProcessNarrationScript(job.language, script);
      script = enforceSalesRubric(job.language, script, context);
      console.info('[AI Voiceover] Script ready', {
        jobId: job.id,
        chars: script.length,
      });
      const ttsScript = buildTtsInputForProvider(job.language, script, context);
      await generateSpeechWav(ttsScript, job.language, voiceWavPath);
      console.info('[AI Voiceover] TTS generated', { jobId: job.id });

      const voiceDurationSeconds = await getMediaDurationSeconds(voiceWavPath);
      const targetNarrationDurationSeconds = Math.max(1, videoDurationSeconds - 0.35);
      const voiceSpeedFactor =
        voiceDurationSeconds > targetNarrationDurationSeconds
          ? Math.min(1.18, voiceDurationSeconds / targetNarrationDurationSeconds)
          : 1;
      const voiceTempoFilter =
        voiceSpeedFactor > 1.01 ? `${buildAtempoFilter(voiceSpeedFactor)},` : '';

      const hasBackgroundMusic = await prepareBackgroundMusic(videoDurationSeconds, bgmPath);
      console.info('[AI Voiceover] Background prepared', { jobId: job.id, hasBackgroundMusic });

      const videoFilter = buildVideoEnhancementFilter();
      const voiceFilter = `${voiceTempoFilter}apad,atrim=0:${videoDurationSeconds.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=7`;

      if (hasBackgroundMusic) {
        const bgmVolume = Number.isFinite(AI_VOICEOVER_BGM_VOLUME) ? AI_VOICEOVER_BGM_VOLUME : 0.18;
        await runCommand('ffmpeg', [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          sourceVideoPath,
          '-i',
          voiceWavPath,
          '-stream_loop',
          '-1',
          '-i',
          bgmPath,
          '-filter_complex',
          `[0:v]${videoFilter}[vout];` +
            `[1:a]${voiceFilter}[vo];` +
            `[2:a]atrim=0:${videoDurationSeconds.toFixed(3)},apad,atrim=0:${videoDurationSeconds.toFixed(3)},volume=${bgmVolume.toFixed(3)}[bgm];` +
            '[vo][bgm]amix=inputs=2:normalize=0:duration=first[outa]',
          '-map',
          '[vout]',
          '-map',
          '[outa]',
          '-c:v',
          'libx264',
          '-preset',
          AI_VOICEOVER_OUTPUT_PRESET,
          '-crf',
          String(AI_VOICEOVER_OUTPUT_CRF),
          '-c:a',
          'aac',
          '-b:a',
          '160k',
          '-movflags',
          '+faststart',
          '-t',
          videoDurationSeconds.toFixed(3),
          outputVideoPath,
        ]);
        console.info('[AI Voiceover] Rendered with BGM', { jobId: job.id });
      } else {
        await runCommand('ffmpeg', [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          sourceVideoPath,
          '-i',
          voiceWavPath,
          '-filter_complex',
          `[0:v]${videoFilter}[vout];[1:a]${voiceFilter}[vo]`,
          '-map',
          '[vout]',
          '-map',
          '[vo]',
          '-c:v',
          'libx264',
          '-preset',
          AI_VOICEOVER_OUTPUT_PRESET,
          '-crf',
          String(AI_VOICEOVER_OUTPUT_CRF),
          '-c:a',
          'aac',
          '-b:a',
          '160k',
          '-movflags',
          '+faststart',
          '-t',
          videoDurationSeconds.toFixed(3),
          outputVideoPath,
        ]);
        console.info('[AI Voiceover] Rendered without BGM', { jobId: job.id });
      }

      await withTimeout(
        assertAudibleAudio(outputVideoPath, 'Final voice-over video audio'),
        AI_VOICEOVER_COMMAND_TIMEOUT_MS,
        'Voice-over audio validation'
      );
      console.info('[AI Voiceover] Audio validated', { jobId: job.id });
      const titleSlug = toSafeFileSlug(context.title || job.title_text || '');

      const uploaded = await withTimeout(
        uploadLocalFileAsMedia({
          mediaType: 'video',
          contentType: 'video/mp4',
          originalFileName: `${titleSlug}-${job.id.slice(0, 8)}.mp4`,
          filePath: outputVideoPath,
          userId: job.user_id,
        }),
        AI_VOICEOVER_COMMAND_TIMEOUT_MS,
        'Voice-over upload'
      );
      console.info('[AI Voiceover] Uploaded output', {
        jobId: job.id,
        outputUrl: uploaded.publicUrl,
      });

      await db.execute(sql`
        UPDATE ai_voiceover_jobs
        SET status = 'completed',
            output_video_url = ${uploaded.publicUrl},
            script_text = ${script},
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ${job.id}
      `);
      completed++;
      console.info('[AI Voiceover] Job completed', { jobId: job.id });
    } catch (error) {
      const technicalMessage =
        error instanceof Error ? error.message : 'Voice-over generation failed';
      const message = toUserFriendlyVoiceoverError(technicalMessage);
      const reachedMax = job.attempts >= job.max_attempts;
      await db.execute(sql`
        UPDATE ai_voiceover_jobs
        SET status = ${reachedMax ? 'failed' : 'pending'},
            error_message = ${message},
            updated_at = CURRENT_TIMESTAMP,
            processed_at = ${reachedMax ? sql`CURRENT_TIMESTAMP` : null}
        WHERE id = ${job.id}
      `);
      failed++;
      console.error('[AI Voiceover] Job failed', {
        jobId: job.id,
        error: technicalMessage,
        userMessage: message,
        reachedMax,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  return { processed, completed, failed };
}
