import axios from 'axios';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import {
  DetectModerationLabelsCommand,
  RekognitionClient,
  type ModerationLabel,
} from '@aws-sdk/client-rekognition';

export type AwsModerationResult = {
  safe: boolean;
  confidence: number;
  reasons: string[];
  detectedRisks: Array<'nudity' | 'drugs' | 'guns' | 'knives'>;
};

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
const DEFAULT_MIN_CONFIDENCE = Number.parseFloat(
  process.env.AWS_REKOGNITION_MIN_CONFIDENCE || '75'
);
const VIDEO_FRAME_INTERVAL_SECONDS = Math.max(
  1,
  Number.parseInt(process.env.AWS_VIDEO_MODERATION_FRAME_INTERVAL_SECONDS || '2', 10) || 2
);
const VIDEO_MAX_FRAMES_PER_VIDEO = Math.max(
  1,
  Number.parseInt(process.env.AWS_VIDEO_MODERATION_MAX_FRAMES || '12', 10) || 12
);
const VIDEO_MAX_VIDEOS_PER_LISTING = Math.max(
  1,
  Number.parseInt(process.env.AWS_VIDEO_MODERATION_MAX_VIDEOS || '2', 10) || 2
);

const rekognitionClient = new RekognitionClient({ region: AWS_REGION });

function classifyRisk(label: ModerationLabel): 'nudity' | 'drugs' | 'guns' | 'knives' | null {
  const text = `${label.Name || ''} ${label.ParentName || ''}`.toLowerCase();
  if (text.includes('nudity') || text.includes('sexual')) return 'nudity';
  if (text.includes('drug') || text.includes('tobacco') || text.includes('alcohol')) return 'drugs';
  if (text.includes('gun') || text.includes('firearm') || text.includes('weapon violence'))
    return 'guns';
  if (text.includes('knife') || text.includes('sharp') || text.includes('weapon')) return 'knives';
  return null;
}

async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 3,
  });
  return new Uint8Array(response.data);
}

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

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 3,
  });
  await fs.writeFile(filePath, Buffer.from(response.data));
}

async function extractVideoFrames(videoUrl: string): Promise<Uint8Array[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nearhub-aws-video-mod-'));
  const inputPath = path.join(tempDir, 'input.mp4');
  const framePattern = path.join(tempDir, 'frame_%03d.jpg');
  try {
    await downloadToFile(videoUrl, inputPath);
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-vf',
      `fps=1/${VIDEO_FRAME_INTERVAL_SECONDS}`,
      '-frames:v',
      String(VIDEO_MAX_FRAMES_PER_VIDEO),
      framePattern,
    ]);

    const files = (await fs.readdir(tempDir))
      .filter((name) => /^frame_\d+\.jpg$/i.test(name))
      .sort();
    const frames: Uint8Array[] = [];
    for (const file of files) {
      const frameBytes = await fs.readFile(path.join(tempDir, file));
      frames.push(new Uint8Array(frameBytes));
    }
    return frames;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function detectLabelsForBytes(bytes: Uint8Array): Promise<ModerationLabel[]> {
  const response = await rekognitionClient.send(
    new DetectModerationLabelsCommand({
      Image: { Bytes: bytes },
      MinConfidence: Number.isFinite(DEFAULT_MIN_CONFIDENCE) ? DEFAULT_MIN_CONFIDENCE : 75,
    })
  );
  return Array.isArray(response.ModerationLabels) ? response.ModerationLabels : [];
}

export async function moderateImagesWithRekognition(
  imageUrls: string[]
): Promise<AwsModerationResult> {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return {
      safe: true,
      confidence: 0.9,
      reasons: ['No images provided for moderation'],
      detectedRisks: [],
    };
  }

  const reasons: string[] = [];
  const detectedRisks = new Set<'nudity' | 'drugs' | 'guns' | 'knives'>();
  let highestConfidence = 0;

  for (const url of imageUrls.slice(0, 4)) {
    try {
      const bytes = await fetchImageBytes(url);
      const labels = await detectLabelsForBytes(bytes);
      for (const label of labels) {
        const confidence = Number(label.Confidence || 0);
        if (confidence > highestConfidence) highestConfidence = confidence;
        const risk = classifyRisk(label);
        if (risk) {
          detectedRisks.add(risk);
          reasons.push(`${label.Name || 'Unsafe content'} (${confidence.toFixed(1)}%)`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Rekognition error';
      reasons.push(`Image moderation failed: ${message}`);
      return {
        safe: false,
        confidence: 0,
        reasons,
        detectedRisks: [],
      };
    }
  }

  if (detectedRisks.size === 0) {
    return {
      safe: true,
      confidence: 0.95,
      reasons: ['No unsafe content detected by Rekognition'],
      detectedRisks: [],
    };
  }

  return {
    safe: false,
    confidence: Math.max(0, Math.min(1, highestConfidence / 100)),
    reasons,
    detectedRisks: Array.from(detectedRisks),
  };
}

export async function moderateMediaWithRekognition(input: {
  imageUrls: string[];
  videoUrls: string[];
}): Promise<AwsModerationResult> {
  const imageResult = await moderateImagesWithRekognition(input.imageUrls || []);
  const reasons = [...imageResult.reasons];
  const detectedRisks = new Set(imageResult.detectedRisks);
  let highestConfidence = imageResult.confidence;

  const videos = (input.videoUrls || []).filter(Boolean).slice(0, VIDEO_MAX_VIDEOS_PER_LISTING);
  for (const videoUrl of videos) {
    try {
      const frames = await extractVideoFrames(videoUrl);
      if (frames.length === 0) {
        reasons.push('Video moderation failed: no frames extracted');
        return {
          safe: false,
          confidence: 0,
          reasons,
          detectedRisks: Array.from(detectedRisks),
        };
      }
      for (const frameBytes of frames) {
        const labels = await detectLabelsForBytes(frameBytes);
        for (const label of labels) {
          const confidence = Number(label.Confidence || 0);
          if (confidence > highestConfidence) highestConfidence = confidence;
          const risk = classifyRisk(label);
          if (risk) {
            detectedRisks.add(risk);
            reasons.push(
              `Video frame: ${label.Name || 'Unsafe content'} (${confidence.toFixed(1)}%)`
            );
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown video moderation error';
      reasons.push(`Video moderation failed: ${message}`);
      return {
        safe: false,
        confidence: 0,
        reasons,
        detectedRisks: Array.from(detectedRisks),
      };
    }
  }

  if (detectedRisks.size === 0) {
    const safeReasons =
      reasons.length > 0 ? reasons : ['No unsafe content detected by Rekognition'];
    return {
      safe: true,
      confidence: Math.max(highestConfidence, 0.95),
      reasons: safeReasons,
      detectedRisks: [],
    };
  }

  return {
    safe: false,
    confidence: Math.max(0, Math.min(1, highestConfidence / 100)),
    reasons,
    detectedRisks: Array.from(detectedRisks),
  };
}
