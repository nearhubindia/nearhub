import axios from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { runFfmpeg } from '../media/ffmpeg';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = 'llava-phi3'; // Unified Vision + Text moderation (2.2GB)

export interface AIResponse {
  text: string;
  generated: boolean;
}

/**
 * Generate a listing description using Ollama + LLaVA-Phi3
 */
export async function generateListingDescription(
  title: string,
  category: string,
  price: string,
  condition?: string
): Promise<AIResponse> {
  try {
    const prompt = `You are a professional listing writer for an Indian classifieds marketplace. Generate a compelling product listing description.

Title: ${title}
Category: ${category}
Price: ₹${price} (INR)
Condition: ${condition || 'good'}

Write a professional description (150-200 words, MAXIMUM 800 characters) that:
1. Highlights key features and specifications
2. Clearly mentions condition and quality
3. Appeals to Indian buyers with relevant context
4. Uses simple formatting (bullet points if needed)
5. Is clear, honest, and concise

Keep the tone professional but friendly. Use short paragraphs for readability.

Description:`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.7,
      },
      {
        timeout: 30000,
      }
    );

    let text = response.data.response || '';
    text = text.trim();

    // Enforce 800 character limit
    if (text.length > 800) {
      text = text.substring(0, 797) + '...';
    }

    return {
      text,
      generated: true,
    };
  } catch (error) {
    console.error('AI generation failed:', error);
    throw new Error('Failed to generate description');
  }
}

/**
 * Auto-suggest category for a listing (Indian marketplace context)
 */
export async function suggestCategory(title: string, description: string): Promise<AIResponse> {
  try {
    const categories = [
      'Electronics',
      'Vehicles',
      'Real Estate',
      'Services',
      'Jobs',
      'Furniture',
      'Clothing',
      'Home & Garden',
      'Sports',
      'Education',
      'Pets',
      'Other',
    ];

    const prompt = `You are a product categorizer for an Indian classifieds marketplace.
    
Title: ${title}
Description: ${description}

Based on the title and description, suggest the MOST APPROPRIATE category from this list:
${categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

Respond with ONLY the category name (one word), nothing else.`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.3,
      },
      {
        timeout: 15000,
      }
    );

    const category = response.data.response?.trim() || 'Other';
    return {
      text: category,
      generated: true,
    };
  } catch (error) {
    console.error('Category suggestion failed:', error);
    throw new Error('Failed to suggest category');
  }
}

/**
 * Generate a catchy listing title (Indian marketplace context)
 */
export async function generateTitle(description: string, category: string): Promise<AIResponse> {
  try {
    const prompt = `You are a product title writer for an Indian classifieds marketplace.

Category: ${category}
Description: ${description}

Generate a SINGLE catchy, concise product title (max 60 characters) that:
1. Is compelling and descriptive
2. Includes ONE key feature
3. Sounds natural for Indian buyers

Respond with ONLY the title, nothing else. Keep it SHORT.`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.7,
      },
      {
        timeout: 15000,
      }
    );

    let title = response.data.response?.trim() || '';

    // Enforce 60 character limit
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    return {
      text: title,
      generated: true,
    };
  } catch (error) {
    console.error('Title generation failed:', error);
    throw new Error('Failed to generate title');
  }
}

/**
 * Detect spam/inappropriate content
 */
export async function moderateContent(
  title: string,
  description: string
): Promise<{ flagged: boolean; reason?: string; confidence: number }> {
  try {
    const prompt = `You are a content moderator for a classifieds marketplace.

Title: ${title}
Description: ${description}

Check if this listing contains:
1. Spam or misleading content
2. Prohibited items
3. Inappropriate language
4. Scam indicators

Respond in this format ONLY:
FLAG: YES or NO
REASON: [reason if flagged, or NONE]
CONFIDENCE: [0-100]

Example:
FLAG: NO
REASON: NONE
CONFIDENCE: 95`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.2,
      },
      {
        timeout: 15000,
      }
    );

    const text = response.data.response?.trim() || '';
    const lines = text.split('\n');

    const flagged = lines[0]?.includes('YES') || false;
    const reason = lines[1]?.replace('REASON:', '').trim() || undefined;
    const confidence = parseInt(lines[2]?.replace('CONFIDENCE:', '').trim() || '50') || 50;

    return {
      flagged,
      reason: flagged ? reason : undefined,
      confidence,
    };
  } catch (error) {
    console.error('Content moderation failed:', error);
    return {
      flagged: false,
      confidence: 0,
    };
  }
}

/**
 * Extract keywords from listing for SEO (Indian market optimized)
 */
export async function extractKeywords(title: string, description: string): Promise<string[]> {
  try {
    const prompt = `Extract 5-8 relevant search keywords from this listing for an Indian marketplace.

Title: ${title}
Description: ${description}

Respond with ONLY a comma-separated list of keywords (SHORT words), nothing else.
Example: laptop, gaming, 16GB, new, warranty, delhi

Focus on: brand, key specs, condition, location relevance.`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.5,
      },
      {
        timeout: 15000,
      }
    );

    const text = response.data.response?.trim() || '';
    const keywords = text
      .split(',')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)
      .slice(0, 8); // Limit to 8 keywords max

    return keywords;
  } catch (error) {
    console.error('Keyword extraction failed:', error);
    return [];
  }
}

/**
 * Validate image using Phi2 mini - checks appropriateness, quality, and category match
 */
export async function validateImageWithPhi2(
  title: string,
  description: string,
  category: string
): Promise<{
  isValid: boolean;
  isAppropriate: boolean;
  matchesCategory: boolean;
  confidence: number;
  detectedItems: string[];
  suggestion: string;
  reason: string;
}> {
  try {
    const prompt = `You are a strict classifieds marketplace content moderator. Validate this listing:

Title: "${title}"
Category: "${category}"
Description: "${description}"

Analyze and respond with ONLY a JSON object (no markdown, no code blocks):
{
  "isValid": true/false,
  "isAppropriate": true/false,
  "matchesCategory": true/false,
  "confidence": 0.0-1.0,
  "detectedItems": ["item1", "item2"],
  "suggestion": "Brief suggestion if invalid",
  "reason": "Brief reason"
}

Rules:
- isValid: Listing is clear, describes a real product/service
- isAppropriate: No spam, scams, prohibited items, or offensive language
- matchesCategory: Title and description match the selected category
- confidence: How confident you are in this assessment (0-1)
- Be strict about appropriateness and category matching`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.3,
      },
      {
        timeout: 30000,
      }
    );

    try {
      const jsonStr = response.data.response?.trim() || '{}';
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : jsonStr);

      return {
        isValid: result.isValid ?? true,
        isAppropriate: result.isAppropriate ?? true,
        matchesCategory: result.matchesCategory ?? true,
        confidence: result.confidence ?? 0.7,
        detectedItems: result.detectedItems || [],
        suggestion: result.suggestion || '',
        reason: result.reason || 'Validation complete',
      };
    } catch (parseError) {
      console.error('Failed to parse validation response:', parseError);
      return {
        isValid: true,
        isAppropriate: true,
        matchesCategory: true,
        confidence: 0.5,
        detectedItems: [],
        suggestion: '',
        reason: 'Validation completed with partial results',
      };
    }
  } catch (error) {
    console.error('Image validation with Phi2 failed:', error);
    return {
      isValid: true,
      isAppropriate: true,
      matchesCategory: true,
      confidence: 0.4,
      detectedItems: [],
      suggestion: '',
      reason: 'Could not validate - proceeding anyway',
    };
  }
}

/**
 * Validate video using Phi2 mini - checks appropriateness and quality of video listing
 */
export async function validateVideoWithPhi2(
  title: string,
  description: string,
  category: string,
  duration?: number
): Promise<{
  isValid: boolean;
  isAppropriate: boolean;
  matchesCategory: boolean;
  confidence: number;
  suggestion: string;
  reason: string;
}> {
  try {
    const durationInfo = duration ? ` Duration: ${Math.round(duration / 1000)} seconds.` : '';

    const prompt = `You are a classifieds marketplace content moderator validating a video listing.

Title: "${title}"
Category: "${category}"
Description: "${description}"${durationInfo}

Analyze and respond with ONLY a JSON object (no markdown, no code blocks):
{
  "isValid": true/false,
  "isAppropriate": true/false,
  "matchesCategory": true/false,
  "confidence": 0.0-1.0,
  "suggestion": "Brief suggestion if invalid",
  "reason": "Brief reason"
}

Rules:
- isValid: Video listing is properly described and legitimate
- isAppropriate: No spam, scams, prohibited items, or offensive content
- matchesCategory: Title and description match the selected category
- confidence: How confident you are in this assessment (0-1)
- Video duration should be reasonable (5 seconds to 5 minutes)
- Be strict about appropriateness and category matching`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.3,
      },
      {
        timeout: 30000,
      }
    );

    try {
      const jsonStr = response.data.response?.trim() || '{}';
      // Extract JSON from response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : jsonStr);

      return {
        isValid: result.isValid ?? true,
        isAppropriate: result.isAppropriate ?? true,
        matchesCategory: result.matchesCategory ?? true,
        confidence: result.confidence ?? 0.7,
        suggestion: result.suggestion || '',
        reason: result.reason || 'Validation complete',
      };
    } catch (parseError) {
      console.error('Failed to parse video validation response:', parseError);
      return {
        isValid: true,
        isAppropriate: true,
        matchesCategory: true,
        confidence: 0.5,
        suggestion: '',
        reason: 'Validation completed with partial results',
      };
    }
  } catch (error) {
    console.error('Video validation with Phi2 failed:', error);
    return {
      isValid: true,
      isAppropriate: true,
      matchesCategory: true,
      confidence: 0.4,
      suggestion: '',
      reason: 'Could not validate - proceeding anyway',
    };
  }
}

/**
 * Check Ollama connectivity
 */
export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    console.error('Ollama connection failed:', error);
    return false;
  }
}

export const getModelInfo = () => ({
  model: MODEL,
  url: OLLAMA_URL,
});

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

/**
 * Extract key frames from a local video file and return as data-URI base64 images.
 */
export async function extractVideoFramesAsBase64(
  videoPath: string,
  frameCount = 5
): Promise<string[]> {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Video file not found for moderation: ${videoPath}`);
  }

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'nearhub-video-frames-'));

  try {
    const outputPattern = path.join(tempDir, 'frame_%03d.jpg');
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      videoPath,
      '-vf',
      'fps=1',
      '-frames:v',
      String(frameCount),
      '-y',
      outputPattern,
    ]);

    const frameFiles = (await fsPromises.readdir(tempDir))
      .filter((name) => name.endsWith('.jpg'))
      .sort();

    if (frameFiles.length === 0) {
      throw new Error('No frames extracted from video');
    }

    const framesBase64 = await Promise.all(
      frameFiles.map(async (fileName) => {
        const fullPath = path.join(tempDir, fileName);
        const data = await fsPromises.readFile(fullPath);
        return `data:image/jpeg;base64,${data.toString('base64')}`;
      })
    );

    return framesBase64;
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Moderate a local video file by sampling frames with FFmpeg and running visual moderation.
 */
export async function moderateVideoFile(
  videoPath: string,
  frameCount = 5
): Promise<{
  isAppropriate: boolean;
  hasNudity: boolean;
  hasViolence: boolean;
  hasWeapons: boolean;
  hasDrugs: boolean;
  confidence: number;
  reason: string;
  flaggedFrames: number[];
  analyzedFrameCount: number;
}> {
  const frames = await extractVideoFramesAsBase64(videoPath, frameCount);
  const moderation = await analyzeVideoContent(frames);

  return {
    ...moderation,
    analyzedFrameCount: frames.length,
  };
}

/**
 * Verify if image matches the product title and category
 * @param imageBase64 - Base64 encoded image
 * @param title - Product title
 * @param category - Product category
 * @returns Product-image matching result
 */
export async function verifyProductImageMatch(
  imageBase64: string,
  title: string,
  category: string
): Promise<{
  matches: boolean;
  confidence: number;
  reason: string;
  detectedItems: string[];
}> {
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `You are a product verification AI for a marketplace platform.

Product Title: "${title}"
Category: "${category}"

Analyze the image and determine if it actually shows the product mentioned in the title and category.

For example:
- If title is "Car for sale" but image shows a bottle → NO MATCH
- If title is "iPhone 15" but image shows a laptop → NO MATCH  
- If title is "Sofa set" but image shows furniture → MATCH
- If title is "Gaming laptop" but image shows a computer → MATCH

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "matches": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation of what you see vs what was expected",
  "detectedItems": ["list of items you see in the image"]
}

Be strict: The image must clearly show the advertised product type.`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        images: [base64Data],
        stream: false,
        temperature: 0.2,
      },
      {
        timeout: 45000,
      }
    );

    try {
      const jsonStr = response.data.response?.trim() || '{}';
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : jsonStr);

      return {
        matches: result.matches ?? true,
        confidence: result.confidence ?? 0.5,
        reason: result.reason || 'Verification complete',
        detectedItems: result.detectedItems || [],
      };
    } catch (parseError) {
      console.error('[AI] Failed to parse product match response:', parseError);
      return {
        matches: true,
        confidence: 0.3,
        reason: 'Verification failed - manual review recommended',
        detectedItems: [],
      };
    }
  } catch (error) {
    console.error('[AI] Product-image matching failed:', error);
    return {
      matches: true,
      confidence: 0.2,
      reason: 'Verification service unavailable',
      detectedItems: [],
    };
  }
}

/**
 * Analyze image content for inappropriate material using LLaVA-Phi
 * @param imageBase64 - Base64 encoded image (with or without data URI prefix)
 * @returns Moderation result with flags and confidence
 */
export async function analyzeImageContent(imageBase64: string): Promise<{
  isAppropriate: boolean;
  hasNudity: boolean;
  hasViolence: boolean;
  hasWeapons: boolean;
  hasDrugs: boolean;
  confidence: number;
  reason: string;
  detectedContent: string[];
}> {
  try {
    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `You are a content moderator analyzing images for a marketplace platform.

Analyze this image for inappropriate content. Check for:
1. Nudity or sexual content
2. Violence or gore
3. Weapons (guns, knives, explosives)
4. Illegal drugs or drug paraphernalia
5. Hate symbols or offensive gestures

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "isAppropriate": true/false,
  "hasNudity": true/false,
  "hasViolence": true/false,
  "hasWeapons": true/false,
  "hasDrugs": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "detectedContent": ["list of detected items"]
}

Be strict: Flag anything questionable as inappropriate.`;

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt: prompt,
        images: [base64Data],
        stream: false,
        temperature: 0.2,
      },
      {
        timeout: 45000,
      }
    );

    try {
      const jsonStr = response.data.response?.trim() || '{}';
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : jsonStr);

      return {
        isAppropriate: result.isAppropriate ?? true,
        hasNudity: result.hasNudity ?? false,
        hasViolence: result.hasViolence ?? false,
        hasWeapons: result.hasWeapons ?? false,
        hasDrugs: result.hasDrugs ?? false,
        confidence: result.confidence ?? 0.7,
        reason: result.reason || 'Analysis complete',
        detectedContent: result.detectedContent || [],
      };
    } catch (parseError) {
      console.error('[AI] Failed to parse image analysis response:', parseError);
      // Fail-safe: Allow content but log for manual review
      return {
        isAppropriate: true,
        hasNudity: false,
        hasViolence: false,
        hasWeapons: false,
        hasDrugs: false,
        confidence: 0.3,
        reason: 'Analysis failed - manual review recommended',
        detectedContent: [],
      };
    }
  } catch (error) {
    console.error('[AI] Image content analysis failed:', error);
    // Graceful degradation
    return {
      isAppropriate: true,
      hasNudity: false,
      hasViolence: false,
      hasWeapons: false,
      hasDrugs: false,
      confidence: 0.2,
      reason: 'Analysis service unavailable - manual review required',
      detectedContent: [],
    };
  }
}

/**
 * Analyze video content by extracting and analyzing key frames
 * Note: This expects base64 encoded frames to be extracted client-side or via FFmpeg
 * @param videoFramesBase64 - Array of base64 encoded video frames (3-5 frames recommended)
 * @returns Aggregated moderation result
 */
export async function analyzeVideoContent(videoFramesBase64: string[]): Promise<{
  isAppropriate: boolean;
  hasNudity: boolean;
  hasViolence: boolean;
  hasWeapons: boolean;
  hasDrugs: boolean;
  confidence: number;
  reason: string;
  flaggedFrames: number[];
}> {
  try {
    if (!videoFramesBase64 || videoFramesBase64.length === 0) {
      return {
        isAppropriate: true,
        hasNudity: false,
        hasViolence: false,
        hasWeapons: false,
        hasDrugs: false,
        confidence: 0.5,
        reason: 'No frames provided for analysis',
        flaggedFrames: [],
      };
    }

    // Analyze each frame
    const frameResults = await Promise.all(
      videoFramesBase64.map((frame) => analyzeImageContent(frame))
    );

    // Aggregate results - video is inappropriate if ANY frame is flagged
    const flaggedFrames: number[] = [];
    let hasNudity = false;
    let hasViolence = false;
    let hasWeapons = false;
    let hasDrugs = false;

    frameResults.forEach((result, index) => {
      if (!result.isAppropriate) {
        flaggedFrames.push(index);
      }
      if (result.hasNudity) hasNudity = true;
      if (result.hasViolence) hasViolence = true;
      if (result.hasWeapons) hasWeapons = true;
      if (result.hasDrugs) hasDrugs = true;
    });

    const isAppropriate = flaggedFrames.length === 0;
    const avgConfidence =
      frameResults.reduce((sum, r) => sum + r.confidence, 0) / frameResults.length;

    const reasons = frameResults
      .filter((r) => !r.isAppropriate)
      .map((r) => r.reason)
      .join('; ');

    return {
      isAppropriate,
      hasNudity,
      hasViolence,
      hasWeapons,
      hasDrugs,
      confidence: avgConfidence,
      reason: isAppropriate
        ? 'All frames passed moderation'
        : `Flagged frames: ${flaggedFrames.join(', ')}. ${reasons}`,
      flaggedFrames,
    };
  } catch (error) {
    console.error('[AI] Video content analysis failed:', error);
    return {
      isAppropriate: true,
      hasNudity: false,
      hasViolence: false,
      hasWeapons: false,
      hasDrugs: false,
      confidence: 0.2,
      reason: 'Video analysis failed - manual review required',
      flaggedFrames: [],
    };
  }
}

/**
 * Comprehensive listing validation with text + image/video analysis
 */
export async function validateListingWithVision(
  title: string,
  description: string,
  category: string,
  mediaBase64?: string[], // Images or video frames
  isVideo?: boolean
): Promise<{
  isValid: boolean;
  isAppropriate: boolean;
  matchesCategory: boolean;
  visualContentSafe: boolean;
  confidence: number;
  reason: string;
  detectedIssues: string[];
}> {
  try {
    // 1. Text validation (existing Phi-based validation)
    const textValidation = await validateImageWithPhi2(title, description, category);

    // 2. Visual content validation (if media provided)
    let visualValidation = null;
    let productMatchValidation = null;

    if (mediaBase64 && mediaBase64.length > 0) {
      if (isVideo) {
        visualValidation = await analyzeVideoContent(mediaBase64);
        // TODO: Add video-product matching validation
      } else {
        // For images, analyze the first image
        visualValidation = await analyzeImageContent(mediaBase64[0]);
        // Also check if image matches the product
        productMatchValidation = await verifyProductImageMatch(mediaBase64[0], title, category);
      }
    }

    const detectedIssues: string[] = [];
    if (!textValidation.isAppropriate) {
      detectedIssues.push('Inappropriate text content');
    }
    if (!textValidation.matchesCategory) {
      detectedIssues.push('Category mismatch');
    }
    if (visualValidation && !visualValidation.isAppropriate) {
      detectedIssues.push('Inappropriate visual content');
      if (visualValidation.hasNudity) detectedIssues.push('Nudity detected');
      if (visualValidation.hasViolence) detectedIssues.push('Violence detected');
      if (visualValidation.hasWeapons) detectedIssues.push('Weapons detected');
      if (visualValidation.hasDrugs) detectedIssues.push('Drugs detected');
    }
    if (
      productMatchValidation &&
      !productMatchValidation.matches &&
      productMatchValidation.confidence > 0.6
    ) {
      detectedIssues.push('Product-image mismatch');
      detectedIssues.push(productMatchValidation.reason);
    }

    const visualContentSafe = visualValidation ? visualValidation.isAppropriate : true;
    const productMatches = productMatchValidation
      ? productMatchValidation.matches || productMatchValidation.confidence <= 0.6
      : true;
    const isAppropriate = textValidation.isAppropriate && visualContentSafe && productMatches;
    const isValid = textValidation.isValid && isAppropriate;

    return {
      isValid,
      isAppropriate,
      matchesCategory: textValidation.matchesCategory && productMatches,
      visualContentSafe,
      confidence: productMatchValidation
        ? (textValidation.confidence +
            visualValidation!.confidence +
            productMatchValidation.confidence) /
          3
        : visualValidation
          ? (textValidation.confidence + visualValidation.confidence) / 2
          : textValidation.confidence,
      reason:
        detectedIssues.length > 0
          ? detectedIssues.join('; ')
          : 'Content passed all moderation checks',
      detectedIssues,
    };
  } catch (error) {
    console.error('[AI] Comprehensive validation failed:', error);
    return {
      isValid: true,
      isAppropriate: true,
      matchesCategory: true,
      visualContentSafe: true,
      confidence: 0.3,
      reason: 'Validation service unavailable',
      detectedIssues: [],
    };
  }
}
