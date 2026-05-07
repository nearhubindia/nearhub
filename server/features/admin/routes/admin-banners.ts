import type { Express, Request, Response } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../../../data/db';
import { appScreenBanners } from '../models/admin-settings';
import { adminAuthMiddleware } from './admin-auth';
import { handleError, notFound, validationError } from '../../../lib/error-handler';

interface BannerPayload {
  title?: string;
  screen?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

const VALID_BANNER_SCREENS = ['home', 'search', 'profile', 'shorts', 'listings'] as const;

function normalizeScreen(screen: string): string {
  return screen.trim().toLowerCase();
}

function isDataUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith('data:');
}

function isValidBannerImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isDataUrl(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function mapBanner(banner: typeof appScreenBanners.$inferSelect): {
  id: string;
  title: string;
  screen: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: banner.id,
    title: banner.title,
    screen: banner.screen,
    imageUrl: banner.imageUrl,
    sortOrder: banner.sortOrder,
    isActive: banner.isActive,
    createdBy: banner.createdBy ?? null,
    createdAt: banner.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: banner.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export function registerAdminBannersRoutes(app: Express): void {
  app.get('/api/admin/banners', async (req: Request, res: Response) => {
    try {
      const screen =
        typeof req.query.screen === 'string' ? normalizeScreen(req.query.screen) : undefined;

      const rows = screen
        ? await db
            .select()
            .from(appScreenBanners)
            .where(eq(appScreenBanners.screen, screen))
            .orderBy(asc(appScreenBanners.sortOrder), desc(appScreenBanners.createdAt))
        : await db
            .select()
            .from(appScreenBanners)
            .orderBy(asc(appScreenBanners.sortOrder), desc(appScreenBanners.createdAt));

      return res.json({
        success: true,
        banners: rows.map(mapBanner),
      });
    } catch (error: unknown) {
      return handleError(res, error, '[Admin Banners]', 'Failed to fetch banners');
    }
  });

  app.get('/api/banners', async (req: Request, res: Response) => {
    try {
      const screen =
        typeof req.query.screen === 'string' ? normalizeScreen(req.query.screen) : undefined;
      const filters = [eq(appScreenBanners.isActive, true)];

      if (screen) {
        filters.push(eq(appScreenBanners.screen, screen));
      }

      const rows = await db
        .select()
        .from(appScreenBanners)
        .where(and(...filters))
        .orderBy(asc(appScreenBanners.sortOrder), desc(appScreenBanners.createdAt));

      const sanitizedRows = rows.filter((row) => isValidBannerImageUrl(row.imageUrl));

      return res.json({
        success: true,
        banners: sanitizedRows.map(mapBanner),
      });
    } catch (error: unknown) {
      return handleError(res, error, '[App Banners]', 'Failed to fetch app banners');
    }
  });

  app.post('/api/admin/banners', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { title, screen, imageUrl, sortOrder, isActive } = req.body as BannerPayload;
      const normalizedScreen = normalizeScreen(screen ?? 'home');

      if (!title?.trim()) {
        return validationError(res, 'Title is required');
      }

      if (!imageUrl?.trim()) {
        return validationError(res, 'Banner image URL is required');
      }

      if (!isValidBannerImageUrl(imageUrl)) {
        return validationError(
          res,
          'Banner image URL must be a valid http/https URL (data URLs are not allowed)'
        );
      }

      if (
        !VALID_BANNER_SCREENS.includes(normalizedScreen as (typeof VALID_BANNER_SCREENS)[number])
      ) {
        return validationError(res, `Invalid screen. Allowed: ${VALID_BANNER_SCREENS.join(', ')}`);
      }

      const admin = (req as Request & { admin?: { id?: string } }).admin;
      const [created] = await db
        .insert(appScreenBanners)
        .values({
          title: title.trim(),
          screen: normalizedScreen,
          imageUrl: imageUrl.trim(),
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
          isActive: typeof isActive === 'boolean' ? isActive : true,
          createdBy: admin?.id,
        })
        .returning();

      return res.status(201).json({
        success: true,
        banner: mapBanner(created),
      });
    } catch (error: unknown) {
      return handleError(res, error, '[Admin Banners]', 'Failed to create banner');
    }
  });

  app.patch('/api/admin/banners/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const { title, screen, imageUrl, sortOrder, isActive } = req.body as BannerPayload;

      const updates: Partial<typeof appScreenBanners.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (title !== undefined) {
        if (!title.trim()) {
          return validationError(res, 'Title cannot be empty');
        }
        updates.title = title.trim();
      }

      if (screen !== undefined) {
        const normalizedScreen = normalizeScreen(screen);
        if (
          !VALID_BANNER_SCREENS.includes(normalizedScreen as (typeof VALID_BANNER_SCREENS)[number])
        ) {
          return validationError(
            res,
            `Invalid screen. Allowed: ${VALID_BANNER_SCREENS.join(', ')}`
          );
        }
        updates.screen = normalizedScreen;
      }

      if (imageUrl !== undefined) {
        if (!imageUrl.trim()) {
          return validationError(res, 'Banner image URL cannot be empty');
        }
        if (!isValidBannerImageUrl(imageUrl)) {
          return validationError(
            res,
            'Banner image URL must be a valid http/https URL (data URLs are not allowed)'
          );
        }
        updates.imageUrl = imageUrl.trim();
      }

      if (sortOrder !== undefined) {
        updates.sortOrder = sortOrder;
      }

      if (isActive !== undefined) {
        updates.isActive = isActive;
      }

      const [updated] = await db
        .update(appScreenBanners)
        .set(updates)
        .where(eq(appScreenBanners.id, id))
        .returning();

      if (!updated) {
        return notFound(res, 'Banner');
      }

      return res.json({
        success: true,
        banner: mapBanner(updated),
      });
    } catch (error: unknown) {
      return handleError(res, error, '[Admin Banners]', 'Failed to update banner');
    }
  });

  app.delete('/api/admin/banners/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const [deleted] = await db
        .delete(appScreenBanners)
        .where(eq(appScreenBanners.id, id))
        .returning();

      if (!deleted) {
        return notFound(res, 'Banner');
      }

      return res.json({
        success: true,
        message: 'Banner deleted successfully',
      });
    } catch (error: unknown) {
      return handleError(res, error, '[Admin Banners]', 'Failed to delete banner');
    }
  });
}
