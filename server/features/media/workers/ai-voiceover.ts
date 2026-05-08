import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { db } from '../../../data/db';
import { SERVER_CONFIG } from '../../../lib/config';
import { uploadLocalFileAsMedia } from '../services/cloudflare-media';

type VoiceoverJob = {
  id: string;
  user_id: string;
  source_video_url: string;
  language: 'telugu' | 'kannada' | 'hindi';
  script_text?: string | null;
  attempts: number;
  max_attempts: number;
};

const SCRIPT_MODEL = process.env.GEMINI_SCRIPT_MODEL || 'gemini-2.5-flash';
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const AI_TTS_PROVIDER = (process.env.AI_TTS_PROVIDER || 'google').toLowerCase();
const AI_VOICEOVER_BGM_SOURCE = process.env.AI_VOICEOVER_BGM_SOURCE || 'builtin-cinematic';
const AI_VOICEOVER_BGM_VOLUME = Number.parseFloat(process.env.AI_VOICEOVER_BGM_VOLUME || '0.18');
const AI_VOICEOVER_ENHANCE_VIDEO = process.env.AI_VOICEOVER_ENHANCE_VIDEO !== 'false';
const AI_VOICEOVER_OUTPUT_WIDTH = Number.parseInt(
  process.env.AI_VOICEOVER_OUTPUT_WIDTH || '1080',
  10
);
const AI_VOICEOVER_OUTPUT_CRF = Number.parseInt(process.env.AI_VOICEOVER_OUTPUT_CRF || '21', 10);
const AI_VOICEOVER_OUTPUT_PRESET = process.env.AI_VOICEOVER_OUTPUT_PRESET || 'medium';

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
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
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
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
  return 'Write in Hindi (Devanagari script).';
}

function getTargetLanguageName(language: VoiceoverJob['language']): string {
  if (language === 'telugu') return 'Telugu';
  if (language === 'kannada') return 'Kannada';
  return 'Hindi';
}

function getVoiceName(language: VoiceoverJob['language']): string {
  if (language === 'telugu') return 'Kore';
  if (language === 'kannada') return 'Aoede';
  return 'Puck';
}

function getPollyVoice(language: VoiceoverJob['language']): {
  voiceId: string;
  languageCode: string;
} {
  if (language === 'hindi') {
    return { voiceId: 'Kajal', languageCode: 'hi-IN' };
  }
  return { voiceId: 'Aditi', languageCode: 'en-IN' };
}

async function claimNextJob(): Promise<VoiceoverJob | null> {
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
    RETURNING j.id, j.user_id, j.source_video_url, j.language, j.script_text, j.attempts, j.max_attempts
  `);
  const rows = Array.isArray((result as any).rows) ? ((result as any).rows as VoiceoverJob[]) : [];
  return rows[0] || null;
}

async function generateScript(
  ai: GoogleGenAI,
  language: VoiceoverJob['language'],
  videoDurationSeconds: number
): Promise<string> {
  const instruction = getLanguageInstruction(language);
  const targetWords = Math.max(8, Math.min(45, Math.floor(videoDurationSeconds * 2.2)));
  const response = await ai.models.generateContent({
    model: SCRIPT_MODEL,
    contents: `Generate a concise product promo voice-over script for a marketplace video.
Limit to 2-3 short sentences.
Keep it around ${targetWords} words so it comfortably fits a ${videoDurationSeconds.toFixed(1)} second video.
Tone: clear, friendly, and sales-focused.
${instruction}
Return only the final script.`,
  });
  return String(response.text || '').trim();
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
  const response = await ai.models.generateContent({
    model: SCRIPT_MODEL,
    contents: `Rewrite the following product voice-over script in ${targetLanguage}.
${targetScript}
Keep meaning intact, keep it natural and realistic for spoken narration, and keep it concise.
Target around ${targetWords} words so it fits a ${videoDurationSeconds.toFixed(1)} second video.
Return only the rewritten script.

Input script:
${script}`,
  });

  const localized = String(response.text || '').trim();
  return localized || script;
}

async function generateSpeechWav(
  ai: GoogleGenAI,
  script: string,
  language: VoiceoverJob['language'],
  outPath: string
): Promise<void> {
  const voiceName = getVoiceName(language);
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: script,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    } as any,
  });

  const parts = Array.isArray(response?.candidates?.[0]?.content?.parts)
    ? (response?.candidates?.[0]?.content?.parts as any[])
    : [];
  const audioPart = parts.find((part) => typeof part?.inlineData?.data === 'string');
  const audioBase64 = audioPart?.inlineData?.data || null;
  const mimeType = String(audioPart?.inlineData?.mimeType || '').toLowerCase();

  if (!audioBase64) {
    throw new Error('Gemini TTS did not return audio payload');
  }
  const audioBuffer = Buffer.from(String(audioBase64), 'base64');

  if (!mimeType || mimeType.includes('wav')) {
    await fs.writeFile(outPath, audioBuffer);
    return;
  }

  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    const tempMp3 = `${outPath}.mp3`;
    await fs.writeFile(tempMp3, audioBuffer);
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      tempMp3,
      '-ac',
      '1',
      '-ar',
      '24000',
      outPath,
    ]);
    return;
  }

  if (mimeType.includes('l16') || mimeType.includes('pcm')) {
    const sampleRateMatch = mimeType.match(/rate=(\d+)/);
    const channelMatch = mimeType.match(/channels=(\d+)/);
    const sampleRate = sampleRateMatch?.[1] || '24000';
    const channels = channelMatch?.[1] || '1';
    const tempRaw = `${outPath}.raw`;
    await fs.writeFile(tempRaw, audioBuffer);
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      's16le',
      '-ar',
      sampleRate,
      '-ac',
      channels,
      '-i',
      tempRaw,
      '-ac',
      '1',
      '-ar',
      '24000',
      outPath,
    ]);
    return;
  }

  const tempUnknown = `${outPath}.bin`;
  await fs.writeFile(tempUnknown, audioBuffer);
  await runCommand('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    tempUnknown,
    '-ac',
    '1',
    '-ar',
    '24000',
    outPath,
  ]);
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

async function generateSpeechWavPolly(
  script: string,
  language: VoiceoverJob['language'],
  outPath: string
): Promise<void> {
  const { voiceId, languageCode } = getPollyVoice(language);
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const polly = new PollyClient({ region });
  const result = await polly.send(
    new SynthesizeSpeechCommand({
      Engine: 'neural',
      OutputFormat: 'mp3',
      TextType: 'text',
      Text: script,
      VoiceId: voiceId as any,
      LanguageCode: languageCode as any,
    })
  );
  const audioBuffer = await streamToBuffer(result.AudioStream);
  if (!audioBuffer.length) {
    throw new Error('AWS Polly did not return audio payload');
  }
  const tempMp3 = `${outPath}.polly.mp3`;
  await fs.writeFile(tempMp3, audioBuffer);
  await runCommand('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    tempMp3,
    '-ac',
    '1',
    '-ar',
    '24000',
    outPath,
  ]);
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
    // Procedurally generate a cinematic ambient bed so BGM is enabled by default.
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anoisesrc=color=brown:amplitude=0.05:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=110:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=220:sample_rate=24000:duration=${durationSeconds.toFixed(3)}`,
      '-filter_complex',
      '[0:a]lowpass=f=900,highpass=f=40,volume=0.45[n];' +
        '[1:a]volume=0.05,bass=g=4:f=120[w1];' +
        '[2:a]volume=0.025,lowpass=f=1400[w2];' +
        '[n][w1][w2]amix=inputs=3:normalize=0,' +
        'aecho=0.8:0.88:60:0.2,' +
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
  const targetWidth = Number.isFinite(AI_VOICEOVER_OUTPUT_WIDTH)
    ? Math.max(720, Math.min(1440, AI_VOICEOVER_OUTPUT_WIDTH))
    : 1080;
  return [
    `scale='min(${targetWidth},iw)':'-2':flags=lanczos`,
    'unsharp=5:5:0.6:5:5:0.2',
    'eq=contrast=1.06:brightness=0.01:saturation=1.08:gamma=1.02',
    'format=yuv420p',
  ].join(',');
}

export async function processAIVoiceoverQueue(batchSize = 2): Promise<{
  processed: number;
  completed: number;
  failed: number;
}> {
  const usingGoogle = AI_TTS_PROVIDER !== 'aws';
  if (usingGoogle && !SERVER_CONFIG.GOOGLE_GENAI_API_KEY) {
    return { processed: 0, completed: 0, failed: 0 };
  }

  let processed = 0;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < batchSize; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nearhub-ai-voiceover-'));
    const sourceVideoPath = path.join(tempDir, 'source.mp4');
    const voiceWavPath = path.join(tempDir, 'voice.wav');
    const bgmPath = path.join(tempDir, 'bgm.wav');
    const outputVideoPath = path.join(tempDir, 'output.mp4');

    try {
      const ai = SERVER_CONFIG.GOOGLE_GENAI_API_KEY
        ? new GoogleGenAI({ apiKey: SERVER_CONFIG.GOOGLE_GENAI_API_KEY })
        : null;
      await downloadToFile(job.source_video_url, sourceVideoPath);
      const videoDurationSeconds = await getMediaDurationSeconds(sourceVideoPath);

      const baseScript =
        typeof job.script_text === 'string' && job.script_text.trim().length > 0
          ? job.script_text.trim()
          : ai
            ? await generateScript(ai, job.language, videoDurationSeconds)
            : 'Limited time offer. Check this listing now.';
      const script = ai
        ? await localizeScript(ai, baseScript, job.language, videoDurationSeconds)
        : baseScript;
      if (AI_TTS_PROVIDER === 'aws') {
        await generateSpeechWavPolly(script, job.language, voiceWavPath);
      } else {
        if (!ai) throw new Error('Google API key missing for Google TTS provider');
        await generateSpeechWav(ai, script, job.language, voiceWavPath);
      }

      const audioFilter = `apad,atrim=0:${videoDurationSeconds.toFixed(3)}`;
      const hasBackgroundMusic = await prepareBackgroundMusic(videoDurationSeconds, bgmPath);

      const videoFilter = buildVideoEnhancementFilter();
      const voiceFilter = `apad,atrim=0:${videoDurationSeconds.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=7`;

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
      }

      const uploaded = await uploadLocalFileAsMedia({
        mediaType: 'video',
        contentType: 'video/mp4',
        originalFileName: `ai_voiceover_${job.id}.mp4`,
        filePath: outputVideoPath,
        userId: job.user_id,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Voice-over generation failed';
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
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  return { processed, completed, failed };
}
