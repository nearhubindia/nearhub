import type { Express, Response } from 'express';
import { eq, count } from 'drizzle-orm';
import { db } from '../../../data/db';
import { users } from '../../users/models/users';
import type { AuthRequest } from '../../../lib/types';
import { handleError, notFound } from '../../../lib/error-handler';

export function registerAdminUsersRoutes(app: Express) {
  /**
   * GET /api/admin/users
   * Get all users (admin only)
   */
  app.get('/api/admin/users', async (req: AuthRequest, res: Response) => {
    try {
      const allUsers = await db.select().from(users).limit(100);

      const safeUsers = allUsers.map((user) => ({
        id: user.id,
        username: user.username,
        mobile: user.mobile || '-',
        location: user.location || '-',
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      }));

      res.json({
        success: true,
        data: safeUsers,
        total: safeUsers.length,
      });
    } catch (error) {
      console.error('[Admin Users] Error fetching users:', error);
      handleError(res, error, '[Admin Users]', 'Failed to fetch users');
    }
  });

  /**
   * GET /api/admin/users/:id
   * Get user by ID (admin only)
   */
  app.get('/api/admin/users/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

      const [user] = await db.select().from(users).where(eq(users.id, id));

      if (!user) {
        return notFound(res, 'User');
      }

      const safeUser = {
        id: user.id,
        username: user.username,
        mobile: user.mobile || '-',
        location: user.location || '-',
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      };

      res.json({
        success: true,
        data: safeUser,
      });
    } catch (error) {
      console.error('[Admin Users] Error fetching user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to fetch user');
    }
  });

  /**
   * DELETE /api/admin/users/:id
   * Delete user (admin only)
   */
  app.delete('/api/admin/users/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

      const result = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning();

      if (result.length === 0) {
        return notFound(res, 'User');
      }

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('[Admin Users] Error deleting user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to delete user');
    }
  });

  /**
   * PUT /api/admin/users/:id
   * Update user data (admin only)
   */
  app.put('/api/admin/users/:id', async (req: AuthRequest, res: Response) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
      const { username, mobile, location } = req.body;

      if (!username || !mobile || !location) {
        return res.status(400).json({
          success: false,
          message: 'Username, mobile, and location are required',
        });
      }

      const result = await db
        .update(users)
        .set({
          username,
          mobile,
          location,
        })
        .where(eq(users.id, id))
        .returning();

      if (result.length === 0) {
        return notFound(res, 'User');
      }

      const updatedUser = result[0];
      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        mobile: updatedUser.mobile || '-',
        location: updatedUser.location || '-',
        createdAt: updatedUser.createdAt?.toISOString() || new Date().toISOString(),
      };

      res.json({
        success: true,
        data: safeUser,
        message: 'User updated successfully',
      });
    } catch (error) {
      console.error('[Admin Users] Error updating user:', error);
      handleError(res, error, '[Admin Users]', 'Failed to update user');
    }
  });
}
