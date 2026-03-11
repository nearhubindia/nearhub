import type { Express, Request, Response } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../data/db';
import { contactSubmissionComments, contactSubmissions } from '../models/admin-settings';
import { adminAuthMiddleware } from './admin-auth';

export function registerAdminContactSubmissionRoutes(app: Express) {
  /**
   * GET /api/admin/contact-submissions
   * Get contact form submissions (admin only)
   */
  app.get(
    '/api/admin/contact-submissions',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const rawLimit = parseInt(String(req.query.limit || '50'), 10);
        const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 200);

        const submissions = await db
          .select()
          .from(contactSubmissions)
          .orderBy(desc(contactSubmissions.createdAt))
          .limit(limit);

        const submissionIds = submissions.map((row) => row.id);
        const comments =
          submissionIds.length > 0
            ? await db
                .select()
                .from(contactSubmissionComments)
                .where(inArray(contactSubmissionComments.submissionId, submissionIds))
                .orderBy(asc(contactSubmissionComments.createdAt))
            : [];

        const commentsBySubmission = new Map<string, Array<(typeof comments)[number]>>();
        for (const comment of comments) {
          const list = commentsBySubmission.get(comment.submissionId) || [];
          list.push(comment);
          commentsBySubmission.set(comment.submissionId, list);
        }

        return res.json({
          success: true,
          submissions: submissions.map((row) => ({
            ...row,
            createdAt: row.createdAt?.toISOString() || null,
            contactedAt: row.contactedAt?.toISOString() || null,
            comments: (commentsBySubmission.get(row.id) || []).map((comment) => ({
              ...comment,
              createdAt: comment.createdAt?.toISOString() || null,
              updatedAt: comment.updatedAt?.toISOString() || null,
            })),
          })),
          total: submissions.length,
        });
      } catch (error) {
        console.error('[Admin Contact Submissions] Failed to fetch submissions:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch contact submissions',
        });
      }
    }
  );

  /**
   * PATCH /api/admin/contact-submissions/:id
   * Update enquiry status/comments (admin only)
   */
  app.patch(
    '/api/admin/contact-submissions/:id',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const id = String(req.params.id || '').trim();
        const contacted = typeof req.body?.contacted === 'boolean' ? req.body.contacted : undefined;
        const adminComments =
          typeof req.body?.adminComments === 'string' ? req.body.adminComments.trim() : undefined;

        if (!id) {
          return res.status(400).json({
            success: false,
            error: 'Submission id is required',
          });
        }

        if (contacted === undefined && adminComments === undefined) {
          return res.status(400).json({
            success: false,
            error: 'No fields provided to update',
          });
        }

        if (adminComments !== undefined && adminComments.length > 2000) {
          return res.status(400).json({
            success: false,
            error: 'Comments cannot exceed 2000 characters',
          });
        }

        const updatePayload: Partial<typeof contactSubmissions.$inferInsert> = {};
        if (contacted !== undefined) {
          updatePayload.contacted = contacted;
          updatePayload.contactedAt = contacted ? new Date() : null;
        }
        if (adminComments !== undefined) {
          updatePayload.adminComments = adminComments || null;
        }

        const updated = await db
          .update(contactSubmissions)
          .set(updatePayload)
          .where(eq(contactSubmissions.id, id))
          .returning();

        if (!updated.length) {
          return res.status(404).json({
            success: false,
            error: 'Enquiry not found',
          });
        }

        const row = updated[0];
        return res.json({
          success: true,
          submission: {
            ...row,
            createdAt: row.createdAt?.toISOString() || null,
            contactedAt: row.contactedAt?.toISOString() || null,
          },
        });
      } catch (error) {
        console.error('[Admin Contact Submissions] Failed to update enquiry:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update enquiry',
        });
      }
    }
  );

  /**
   * POST /api/admin/contact-submissions/:id/comments
   * Add a new comment to an enquiry (admin only)
   */
  app.post(
    '/api/admin/contact-submissions/:id/comments',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const submissionId = String(req.params.id || '').trim();
        const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
        const adminId = (req as any)?.admin?.id || null;

        if (!submissionId || !comment) {
          return res.status(400).json({
            success: false,
            error: 'Submission id and comment are required',
          });
        }

        if (comment.length > 2000) {
          return res.status(400).json({
            success: false,
            error: 'Comment cannot exceed 2000 characters',
          });
        }

        const exists = await db
          .select({ id: contactSubmissions.id })
          .from(contactSubmissions)
          .where(eq(contactSubmissions.id, submissionId))
          .limit(1);
        if (!exists.length) {
          return res.status(404).json({
            success: false,
            error: 'Enquiry not found',
          });
        }

        const created = await db
          .insert(contactSubmissionComments)
          .values({
            submissionId,
            comment,
            createdBy: adminId,
          })
          .returning();

        const row = created[0];
        return res.status(201).json({
          success: true,
          comment: {
            ...row,
            createdAt: row.createdAt?.toISOString() || null,
            updatedAt: row.updatedAt?.toISOString() || null,
          },
        });
      } catch (error) {
        console.error('[Admin Contact Submissions] Failed to add comment:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to add comment',
        });
      }
    }
  );

  /**
   * PATCH /api/admin/contact-submissions/:id/comments/:commentId
   * Edit an existing comment (admin only)
   */
  app.patch(
    '/api/admin/contact-submissions/:id/comments/:commentId',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const submissionId = String(req.params.id || '').trim();
        const commentId = String(req.params.commentId || '').trim();
        const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

        if (!submissionId || !commentId || !comment) {
          return res.status(400).json({
            success: false,
            error: 'Submission id, comment id, and comment are required',
          });
        }

        if (comment.length > 2000) {
          return res.status(400).json({
            success: false,
            error: 'Comment cannot exceed 2000 characters',
          });
        }

        const updated = await db
          .update(contactSubmissionComments)
          .set({
            comment,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(contactSubmissionComments.id, commentId),
              eq(contactSubmissionComments.submissionId, submissionId)
            )
          )
          .returning();

        const row = updated[0];
        if (!row) {
          return res.status(404).json({
            success: false,
            error: 'Comment not found',
          });
        }

        return res.json({
          success: true,
          comment: {
            ...row,
            createdAt: row.createdAt?.toISOString() || null,
            updatedAt: row.updatedAt?.toISOString() || null,
          },
        });
      } catch (error) {
        console.error('[Admin Contact Submissions] Failed to edit comment:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to edit comment',
        });
      }
    }
  );

  /**
   * DELETE /api/admin/contact-submissions/:id/comments/:commentId
   * Delete an existing comment (admin only)
   */
  app.delete(
    '/api/admin/contact-submissions/:id/comments/:commentId',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const submissionId = String(req.params.id || '').trim();
        const commentId = String(req.params.commentId || '').trim();
        if (!submissionId || !commentId) {
          return res.status(400).json({
            success: false,
            error: 'Submission id and comment id are required',
          });
        }

        const deleted = await db
          .delete(contactSubmissionComments)
          .where(
            and(
              eq(contactSubmissionComments.id, commentId),
              eq(contactSubmissionComments.submissionId, submissionId)
            )
          )
          .returning();
        const row = deleted[0];
        if (!row) {
          return res.status(404).json({
            success: false,
            error: 'Comment not found',
          });
        }

        return res.json({
          success: true,
          message: 'Comment deleted successfully',
        });
      } catch (error) {
        console.error('[Admin Contact Submissions] Failed to delete comment:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete comment',
        });
      }
    }
  );
}
