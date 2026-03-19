/**
 * Admin Authentication Routes
 * Handles admin login, logout, and session management
 */

import type { Express, Request, Response, NextFunction } from 'express';
import {
  loginAdmin,
  logoutAdmin,
  verifyAdminToken,
  updateAdminPassword,
  getAdminById,
  initializeDefaultAdmin,
} from '../services/admin-auth';

type AdminTokenPayload = { id: string; email: string; role: string };
type AdminRequest = Request & { admin?: AdminTokenPayload };

/**
 * Middleware to verify admin token
 */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const admin = verifyAdminToken(token);

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Attach admin to request for use in route handlers
    (req as AdminRequest).admin = admin;
    next();
  } catch (error) {
    console.error('[Admin Auth] Middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

export function registerAdminAuthRoutes(app: Express) {
  // Initialize default admin on startup
  initializeDefaultAdmin();

  /**
   * POST /api/admin/login
   * Admin login with email and password
   */
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
      }

      const result = await loginAdmin(email, password);

      if (!result.success) {
        return res.status(401).json(result);
      }

      res.json({
        success: true,
        token: result.token,
        admin: {
          id: result.admin?.id,
          email: result.admin?.email,
          name: result.admin?.name,
          role: result.admin?.role,
        },
      });
    } catch (error) {
      console.error('[Admin Auth] Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  });

  /**
   * POST /api/admin/logout
   * Admin logout - invalidate token
   */
  app.post('/api/admin/logout', adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.substring(7) || '';
      const result = logoutAdmin(token);

      res.json({
        success: result,
        message: result ? 'Logged out successfully' : 'Logout failed',
      });
    } catch (error) {
      console.error('[Admin Auth] Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  });

  /**
   * GET /api/admin/me
   * Get current admin profile
   */
  app.get('/api/admin/me', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const adminData = (req as AdminRequest).admin;
      if (!adminData?.id) {
        return res.status(401).json({
          success: false,
          error: 'Admin context missing',
        });
      }
      const admin = getAdminById(adminData.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          error: 'Admin not found',
        });
      }

      res.json({
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          createdAt: admin.createdAt,
          lastLogin: admin.lastLogin,
          isActive: admin.isActive,
        },
      });
    } catch (error) {
      console.error('[Admin Auth] Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
      });
    }
  });

  /**
   * POST /api/admin/change-password
   * Change admin password
   */
  app.post(
    '/api/admin/change-password',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const adminData = (req as AdminRequest).admin;
        if (!adminData?.id) {
          return res.status(401).json({
            success: false,
            error: 'Admin context missing',
          });
        }

        // Validate new passwords match
        if (newPassword !== confirmPassword) {
          return res.status(400).json({
            success: false,
            error: 'New passwords do not match',
          });
        }

        // Validate password strength (minimum 8 chars, mix of letters and numbers)
        if (newPassword.length < 8) {
          return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters long',
          });
        }

        const hasLetters = /[a-zA-Z]/.test(newPassword);
        const hasNumbers = /[0-9]/.test(newPassword);
        if (!hasLetters || !hasNumbers) {
          return res.status(400).json({
            success: false,
            error: 'Password must contain both letters and numbers',
          });
        }

        const admin = getAdminById(adminData.id);
        if (!admin) {
          return res.status(404).json({
            success: false,
            error: 'Admin not found',
          });
        }

        const success = await updateAdminPassword(admin.email, oldPassword, newPassword);

        if (!success) {
          return res.status(401).json({
            success: false,
            error: 'Incorrect current password',
          });
        }

        res.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error) {
        console.error('[Admin Auth] Change password error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to change password',
        });
      }
    }
  );

  /**
   * GET /api/admin/verify-token
   * Verify admin token is valid
   */
  app.get('/api/admin/verify-token', adminAuthMiddleware, (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Token is valid',
      admin: (req as AdminRequest).admin,
    });
  });

  console.log('[Routes] Admin authentication routes registered');
}
