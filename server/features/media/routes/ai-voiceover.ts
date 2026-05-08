import type { Express, Request, Response } from 'express';
import { db } from '../../../data/db';
import { sql } from 'drizzle-orm';

type SupportedLanguage = 'telugu' | 'kannada' | 'hindi';

function parseLanguage(value: unknown): SupportedLanguage | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'telugu' || raw === 'kannada' || raw === 'hindi') return raw;
  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function languageName(value: SupportedLanguage | null): string {
  if (value === 'telugu') return 'Telugu';
  if (value === 'kannada') return 'Kannada';
  if (value === 'hindi') return 'Hindi';
  return 'Telugu';
}

export function registerAIVoiceoverRoutes(app: Express) {
  app.get('/api/media/ai-voiceover/jobs', async (req: Request, res: Response) => {
    try {
      const userId = asString(req.query.userId || req.get('x-user-id'));
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const result = await db.execute(sql`
        SELECT id, user_id, source_video_url, output_video_url, language, status, script_text, error_message,
               title_text, highlights_text, description_text,
               attempts, max_attempts, created_at, updated_at, processed_at
        FROM ai_voiceover_jobs
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 50
      `);

      const jobs = Array.isArray((result as any).rows) ? (result as any).rows : [];
      return res.json({ success: true, jobs });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voice-over jobs',
      });
    }
  });

  app.post('/api/media/ai-voiceover/script-draft', async (req: Request, res: Response) => {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const title = asString(req.body?.title || 'Product listing');
      const details = asString(req.body?.details || '');
      const language = parseLanguage(req.body?.language) || 'telugu';
      const apiKey = process.env.GOOGLE_GENAI_API_KEY || '';
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Gemini API key not configured' });
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_SCRIPT_MODEL || 'gemini-2.5-flash',
        contents: `Write a short product-specific English voice-over script.
Title: ${title}
Details: ${details}
Target dubbing language: ${languageName(language)}
Rules:
- Mention only details present in title/details.
- Do not use generic marketplace lines.
- Do not invent brand/model/specs not provided.
- Keep 2-3 sentences, around 35-60 words.
- Conversational and buyer-friendly tone.
- No hashtags, no emojis.
Return only script text.`,
      });

      return res.json({
        success: true,
        scriptText: String(response.text || '').trim(),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate draft script',
      });
    }
  });

  app.post('/api/media/ai-voiceover/jobs', async (req: Request, res: Response) => {
    try {
      const userId = asString(req.body?.userId);
      const sourceVideoUrl = asString(req.body?.sourceVideoUrl);
      const language = parseLanguage(req.body?.language);
      const scriptText = asString(req.body?.scriptText);
      const titleText = asString(req.body?.title);
      const highlightsText = asString(req.body?.highlights);
      const descriptionText = asString(req.body?.description);
      const normalizedScriptText =
        scriptText ||
        (titleText || highlightsText || descriptionText
          ? `Product: ${titleText}\nHighlights: ${highlightsText}\nDescription: ${descriptionText}`
          : '');

      if (!userId || !sourceVideoUrl || !language) {
        return res.status(400).json({
          success: false,
          error: 'userId, sourceVideoUrl, and language (telugu|kannada|hindi) are required',
        });
      }
      if (!titleText) {
        return res.status(400).json({
          success: false,
          error: 'title is required',
        });
      }

      const existingActive = await db.execute(sql`
        SELECT id, status
        FROM ai_voiceover_jobs
        WHERE user_id = ${userId}
          AND source_video_url = ${sourceVideoUrl}
          AND language = ${language}
          AND status IN ('pending','processing')
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const activeRow = Array.isArray((existingActive as any).rows)
        ? (existingActive as any).rows[0]
        : null;
      if (activeRow?.id) {
        return res.json({
          success: true,
          job: activeRow,
          deduped: true,
        });
      }

      const created = await db.execute(sql`
        INSERT INTO ai_voiceover_jobs (
          user_id, source_video_url, language, status, script_text, title_text, highlights_text, description_text
        )
        VALUES (
          ${userId}, ${sourceVideoUrl}, ${language}, 'pending',
          ${normalizedScriptText || null}, ${titleText || null}, ${highlightsText || null}, ${descriptionText || null}
        )
        RETURNING id, user_id, source_video_url, language, status, script_text, title_text, highlights_text, description_text, created_at
      `);
      const job = Array.isArray((created as any).rows) ? (created as any).rows[0] : null;

      return res.json({
        success: true,
        job,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create voice-over job',
      });
    }
  });

  app.get('/api/media/ai-voiceover/jobs/:id', async (req: Request, res: Response) => {
    try {
      const id = asString(req.params.id);
      const userId = asString(req.query.userId || req.get('x-user-id'));
      if (!id || !userId) {
        return res.status(400).json({ success: false, error: 'id and userId are required' });
      }

      const result = await db.execute(sql`
        SELECT id, user_id, source_video_url, output_video_url, language, status, script_text, error_message,
               title_text, highlights_text, description_text,
               attempts, max_attempts, created_at, updated_at, processed_at
        FROM ai_voiceover_jobs
        WHERE id = ${id} AND user_id = ${userId}
        LIMIT 1
      `);
      const row = Array.isArray((result as any).rows) ? (result as any).rows[0] : null;
      if (!row) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      return res.json({ success: true, job: row });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voice-over job',
      });
    }
  });

  app.post('/api/media/ai-voiceover/jobs/:id/regenerate', async (req: Request, res: Response) => {
    try {
      const id = asString(req.params.id);
      const userId = asString(req.body?.userId || req.get('x-user-id'));
      if (!id || !userId) {
        return res.status(400).json({ success: false, error: 'id and userId are required' });
      }

      const source = await db.execute(sql`
        SELECT source_video_url, language
        FROM ai_voiceover_jobs
        WHERE id = ${id} AND user_id = ${userId}
        LIMIT 1
      `);
      const row = Array.isArray((source as any).rows) ? (source as any).rows[0] : null;
      if (!row?.source_video_url || !row?.language) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      const created = await db.execute(sql`
        INSERT INTO ai_voiceover_jobs (user_id, source_video_url, language, status)
        VALUES (${userId}, ${String(row.source_video_url)}, ${String(row.language)}, 'pending')
        RETURNING id, user_id, source_video_url, language, status, created_at
      `);
      const newJob = Array.isArray((created as any).rows) ? (created as any).rows[0] : null;
      return res.json({ success: true, job: newJob });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate voice-over',
      });
    }
  });

  app.delete('/api/media/ai-voiceover/jobs/:id', async (req: Request, res: Response) => {
    try {
      const id = asString(req.params.id);
      const userId = asString(req.query.userId || req.get('x-user-id'));
      if (!id || !userId) {
        return res.status(400).json({ success: false, error: 'id and userId are required' });
      }

      await db.execute(sql`
        DELETE FROM ai_voiceover_jobs
        WHERE id = ${id} AND user_id = ${userId}
      `);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete voice-over job',
      });
    }
  });
}
