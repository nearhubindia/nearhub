import type { Express, Request, Response } from 'express';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { errorLogs } from '../models/admin-settings';
import { adminAuthMiddleware } from './admin-auth';
import type { SQL } from 'drizzle-orm';
import crypto from 'node:crypto';

type JsonRecord = Record<string, unknown>;

function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function asObject(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

function normalizeLevel(value: unknown): 'debug' | 'info' | 'warn' | 'error' | 'fatal' {
  const normalized = String(value || 'error')
    .trim()
    .toLowerCase();
  if (normalized === 'debug') return 'debug';
  if (normalized === 'info') return 'info';
  if (normalized === 'warn' || normalized === 'warning') return 'warn';
  if (normalized === 'fatal' || normalized === 'critical') return 'fatal';
  return 'error';
}

function getIpAddress(req: Request): string | null {
  const raw = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '').trim();
  return raw ? raw.slice(0, 100) : null;
}

function getDedupeWindowMs(): number {
  const parsed = Number(process.env.ERROR_LOG_DEDUP_WINDOW_MS || '900000'); // 15 min default
  if (!Number.isFinite(parsed) || parsed < 0) return 900000;
  return parsed;
}

function buildFingerprint(input: {
  appName: string | null;
  environment: string;
  level: string;
  message: string;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  screen: string | null;
}): string {
  const raw = [
    input.appName || '',
    input.environment || '',
    input.level || '',
    input.message || '',
    input.endpoint || '',
    input.method || '',
    input.statusCode !== null ? String(input.statusCode) : '',
    input.screen || '',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isAuthorizedErrorLogIngestion(req: Request): boolean {
  const requiredKey = String(process.env.ERROR_LOG_API_KEY || '').trim();
  if (!requiredKey) return true;
  const providedKey =
    asString(req.header('x-error-log-key'), 512) ||
    asString(req.header('x-api-key'), 512) ||
    asString(req.header('authorization')?.replace(/^Bearer\s+/i, ''), 512);
  return providedKey === requiredKey;
}

export function registerErrorLogRoutes(app: Express) {
  /**
   * POST /api/error-logs
   * Public ingestion endpoint for client/server runtime errors.
   */
  app.post('/api/error-logs', async (req: Request, res: Response) => {
    try {
      if (!isAuthorizedErrorLogIngestion(req)) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized error log ingestion',
        });
      }

      const message = asString(req.body?.message, 4000);
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'message is required',
        });
      }

      const statusCodeRaw = asNumber(req.body?.status_code);
      const statusCode =
        statusCodeRaw !== null && statusCodeRaw >= 100 && statusCodeRaw <= 599
          ? Math.trunc(statusCodeRaw)
          : null;

      const createdAt = asDate(req.body?.timestamp) || new Date();
      const payload = {
        appName: asString(req.body?.app_name, 100),
        environment: asString(req.body?.environment, 50) || 'production',
        level: normalizeLevel(req.body?.level),
        message,
        stackTrace: asString(req.body?.stack_trace, 20000),
        endpoint: asString(req.body?.endpoint, 255),
        method: asString(req.body?.method, 20)?.toUpperCase() || null,
        statusCode,
        userId: asString(req.body?.user_id, 100),
        device: asString(req.body?.device, 255),
        os: asString(req.body?.os, 100),
        appVersion: asString(req.body?.app_version, 50),
        buildNumber: asString(req.body?.build_number, 50),
        screen: asString(req.body?.screen, 255),
        networkType: asString(req.body?.network_type, 50),
        extra: asObject(req.body?.extra),
        ipAddress: getIpAddress(req),
      };
      const fingerprint = buildFingerprint(payload);
      const dedupeCutoff = new Date(Date.now() - getDedupeWindowMs());

      const duplicate = await db
        .select({
          id: errorLogs.id,
          occurrenceCount: errorLogs.occurrenceCount,
        })
        .from(errorLogs)
        .where(
          and(
            eq(errorLogs.fingerprint, fingerprint),
            eq(errorLogs.resolved, false),
            gte(errorLogs.lastSeenAt, dedupeCutoff)
          )
        )
        .orderBy(desc(errorLogs.lastSeenAt))
        .limit(1);

      if (duplicate.length > 0) {
        const existing = duplicate[0];
        const updated = await db
          .update(errorLogs)
          .set({
            occurrenceCount: (existing.occurrenceCount || 1) + 1,
            lastSeenAt: createdAt,
            stackTrace: payload.stackTrace,
            endpoint: payload.endpoint,
            method: payload.method,
            statusCode: payload.statusCode,
            userId: payload.userId,
            device: payload.device,
            os: payload.os,
            appVersion: payload.appVersion,
            buildNumber: payload.buildNumber,
            screen: payload.screen,
            networkType: payload.networkType,
            extra: payload.extra,
            ipAddress: payload.ipAddress,
            resolved: false,
          })
          .where(eq(errorLogs.id, existing.id))
          .returning({
            id: errorLogs.id,
            occurrenceCount: errorLogs.occurrenceCount,
          });

        return res.status(200).json({
          success: true,
          log_id: updated[0]?.id || existing.id,
          deduplicated: true,
          occurrence_count: updated[0]?.occurrenceCount || (existing.occurrenceCount || 1) + 1,
        });
      }

      const inserted = await db
        .insert(errorLogs)
        .values({
          ...payload,
          fingerprint,
          occurrenceCount: 1,
          firstSeenAt: createdAt,
          lastSeenAt: createdAt,
          resolved: false,
          createdAt,
        })
        .returning({ id: errorLogs.id });

      return res.status(201).json({
        success: true,
        log_id: inserted[0]?.id,
      });
    } catch (error) {
      console.error('[Error Logs] Failed to save log:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save error log',
      });
    }
  });

  /**
   * GET /api/admin/error-logs
   * Admin list endpoint with filtering and pagination.
   */
  app.get('/api/admin/error-logs', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const rawLimit = parseInt(String(req.query.limit || '50'), 10);
      const rawOffset = parseInt(String(req.query.offset || '0'), 10);
      const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 200);
      const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);
      const includeResolved =
        String(req.query.include_resolved || 'false').toLowerCase() === 'true';

      const fromDate = asDate(req.query.from);
      const toDate = asDate(req.query.to);
      const searchTerm = asString(req.query.search, 200);

      const filters: SQL[] = [
        asString(req.query.level, 20) ? eq(errorLogs.level, String(req.query.level).trim()) : null,
        asString(req.query.environment, 50)
          ? eq(errorLogs.environment, String(req.query.environment).trim())
          : null,
        asString(req.query.app_name, 100)
          ? eq(errorLogs.appName, String(req.query.app_name).trim())
          : null,
        asString(req.query.user_id, 100)
          ? eq(errorLogs.userId, String(req.query.user_id).trim())
          : null,
        includeResolved ? null : eq(errorLogs.resolved, false),
        fromDate ? gte(errorLogs.createdAt, fromDate) : null,
        toDate ? lte(errorLogs.createdAt, toDate) : null,
        searchTerm
          ? or(
              ilike(errorLogs.message, `%${searchTerm}%`),
              ilike(errorLogs.stackTrace, `%${searchTerm}%`),
              ilike(errorLogs.endpoint, `%${searchTerm}%`),
              ilike(errorLogs.screen, `%${searchTerm}%`)
            )
          : null,
      ].filter((value): value is SQL => value !== null);

      const whereClause = filters.length ? and(...filters) : undefined;

      const logs = await db
        .select()
        .from(errorLogs)
        .where(whereClause)
        .orderBy(desc(errorLogs.createdAt), desc(errorLogs.id))
        .limit(limit)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(errorLogs)
        .where(whereClause);

      return res.json({
        success: true,
        logs: logs.map((row) => ({
          ...row,
          createdAt: row.createdAt?.toISOString() || null,
          firstSeenAt: row.firstSeenAt?.toISOString() || null,
          lastSeenAt: row.lastSeenAt?.toISOString() || null,
        })),
        total: totalResult[0]?.count || 0,
        limit,
        offset,
      });
    } catch (error) {
      console.error('[Admin Error Logs] Failed to fetch logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch error logs',
      });
    }
  });

  /**
   * POST /api/admin/error-logs/reset
   * Mark logs as resolved (default unresolved only).
   */
  app.post(
    '/api/admin/error-logs/reset',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const before = asDate(req.body?.before || req.query.before);
        const level = asString(req.body?.level || req.query.level, 20);
        const appName = asString(req.body?.app_name || req.query.app_name, 100);
        const includeResolved =
          String(
            req.body?.include_resolved || req.query.include_resolved || 'false'
          ).toLowerCase() === 'true';

        const filters: SQL[] = [
          before ? lte(errorLogs.createdAt, before) : null,
          level ? eq(errorLogs.level, level) : null,
          appName ? eq(errorLogs.appName, appName) : null,
          includeResolved ? null : eq(errorLogs.resolved, false),
        ].filter((value): value is SQL => value !== null);

        const whereClause = filters.length ? and(...filters) : undefined;

        const updated = await db
          .update(errorLogs)
          .set({
            resolved: true,
          })
          .where(whereClause)
          .returning({ id: errorLogs.id });

        return res.json({
          success: true,
          affected: updated.length,
        });
      } catch (error) {
        console.error('[Admin Error Logs] Failed to reset logs:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to reset error logs',
        });
      }
    }
  );

  /**
   * POST /api/admin/error-logs/:id/resolve
   * Resolve a specific log row quickly from UI.
   */
  app.post(
    '/api/admin/error-logs/:id/resolve',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid log id',
          });
        }

        const updated = await db
          .update(errorLogs)
          .set({ resolved: true })
          .where(eq(errorLogs.id, id))
          .returning({ id: errorLogs.id, resolved: errorLogs.resolved });

        if (!updated.length) {
          return res.status(404).json({
            success: false,
            error: 'Error log not found',
          });
        }

        return res.json({
          success: true,
          log: updated[0],
        });
      } catch (error) {
        console.error('[Admin Error Logs] Failed to resolve log:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to resolve error log',
        });
      }
    }
  );

  /**
   * PATCH /api/admin/error-logs/:id/resolved
   * Toggle/set resolved status for a specific log row.
   */
  app.patch(
    '/api/admin/error-logs/:id/resolved',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid log id',
          });
        }

        if (typeof req.body?.resolved !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'resolved boolean is required',
          });
        }

        const updated = await db
          .update(errorLogs)
          .set({ resolved: req.body.resolved })
          .where(eq(errorLogs.id, id))
          .returning({ id: errorLogs.id, resolved: errorLogs.resolved });

        if (!updated.length) {
          return res.status(404).json({
            success: false,
            error: 'Error log not found',
          });
        }

        return res.json({
          success: true,
          log: updated[0],
        });
      } catch (error) {
        console.error('[Admin Error Logs] Failed to toggle resolved log:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update resolved status',
        });
      }
    }
  );

  /**
   * DELETE /api/admin/error-logs
   * Cleanup logs. By default deletes resolved logs only.
   */
  app.delete('/api/admin/error-logs', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const before = asDate(req.body?.before || req.query.before);
      const level = asString(req.body?.level || req.query.level, 20);
      const appName = asString(req.body?.app_name || req.query.app_name, 100);
      const mode = String(req.body?.mode || req.query.mode || 'resolved').toLowerCase();

      const filters: SQL[] = [
        before ? lte(errorLogs.createdAt, before) : null,
        level ? eq(errorLogs.level, level) : null,
        appName ? eq(errorLogs.appName, appName) : null,
        mode === 'all' ? null : eq(errorLogs.resolved, true),
      ].filter((value): value is SQL => value !== null);

      const whereClause = filters.length ? and(...filters) : undefined;

      const deleted = await db.delete(errorLogs).where(whereClause).returning({ id: errorLogs.id });

      return res.json({
        success: true,
        deleted: deleted.length,
      });
    } catch (error) {
      console.error('[Admin Error Logs] Failed to cleanup logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup error logs',
      });
    }
  });
}
