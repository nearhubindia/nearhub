import type { Express, Request, Response } from 'express';
import {
  generateListingDescription,
  suggestCategory,
  generateTitle,
  moderateContent,
  extractKeywords,
  checkOllamaConnection,
  getModelInfo,
} from '../../../shared/ai/ai';
import { aiLimiter } from '../../../lib/rate-limiter';

export function registerAIRoutes(app: Express) {
  /**
   * GET /api/ai/status
   */
  app.get('/api/ai/status', async (_req: Request, res: Response) => {
    try {
      const isConnected = await checkOllamaConnection();
      const modelInfo = getModelInfo();
      res.json({ connected: isConnected, model: modelInfo.model, url: modelInfo.url });
    } catch {
      res.status(500).json({ error: 'Failed to check Ollama status' });
    }
  });

  /**
   * POST /api/ai/generate-description
   * Rate limited: 10 requests per minute
   */
  app.post('/api/ai/generate-description', aiLimiter, async (req: Request, res: Response) => {
    try {
      const { title, category, price, condition } = req.body;
      if (!title || !category) return res.status(400).json({ error: 'Title and category are required' });
      const result = await generateListingDescription(title, category, price || 'Not specified', condition);
      res.json(result);
    } catch (error) {
      console.error('Description generation error:', error);
      res.status(500).json({ error: 'Failed to generate description' });
    }
  });

  /**
   * POST /api/ai/suggest-category
   * Rate limited: 10 requests per minute
   */
  app.post('/api/ai/suggest-category', aiLimiter, async (req: Request, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      const result = await suggestCategory(title, description || '');
      res.json(result);
    } catch (error) {
      console.error('Category suggestion error:', error);
      res.status(500).json({ error: 'Failed to suggest category' });
    }
  });

  /**
   * POST /api/ai/generate-title
   * Rate limited: 10 requests per minute
   */
  app.post('/api/ai/generate-title', aiLimiter, async (req: Request, res: Response) => {
    try {
      const { description, category } = req.body;
      if (!description || !category) return res.status(400).json({ error: 'Description and category are required' });
      const result = await generateTitle(description, category);
      res.json(result);
    } catch (error) {
      console.error('Title generation error:', error);
      res.status(500).json({ error: 'Failed to generate title' });
    }
  });

  /**
   * POST /api/ai/moderate
   * Rate limited: 10 requests per minute
   */
  app.post('/api/ai/moderate', aiLimiter, async (req: Request, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      const result = await moderateContent(title, description || '');
      res.json(result);
    } catch (error) {
      console.error('Moderation error:', error);
      res.status(500).json({ error: 'Failed to moderate content' });
    }
  });

  /**
   * POST /api/ai/extract-keywords
   * Rate limited: 10 requests per minute
   */
  app.post('/api/ai/extract-keywords', aiLimiter, async (req: Request, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      const keywords = await extractKeywords(title, description || '');
      res.json({ keywords });
    } catch (error) {
      console.error('Keyword extraction error:', error);
      res.status(500).json({ error: 'Failed to extract keywords' });
    }
  });
}
