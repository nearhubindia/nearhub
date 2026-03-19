/**
 * Admin Authentication Service
 * Handles admin login, logout, and session management
 */

import jwt from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // Admin sessions valid for 7 days

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'moderator';
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  admin?: AdminUser;
  message?: string;
}

type VerifiedAdminToken = {
  id: string;
  email: string;
  role: string;
  type: 'admin';
};

function isVerifiedAdminToken(value: unknown): value is VerifiedAdminToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token.id === 'string' &&
    typeof token.email === 'string' &&
    typeof token.role === 'string' &&
    token.type === 'admin'
  );
}

// In-memory admin store (replace with database in production)
const admins = new Map<string, { user: AdminUser; passwordHash: string }>();

/**
 * Initialize default admin (dev only)
 */
export function initializeDefaultAdmin() {
  const defaultAdmin: AdminUser = {
    id: 'admin_001',
    email: 'admin@nearhub.local',
    name: 'Admin',
    role: 'super_admin',
    createdAt: new Date(),
    isActive: true,
  };

  // For development: simple password storage
  // In production, properly hash this password!
  const passwordHash = 'admin123'; // Plain password for development

  admins.set(defaultAdmin.email, { user: defaultAdmin, passwordHash });
  console.log(
    '[Admin Auth] Default admin initialized (email: admin@nearhub.local, password: admin123)'
  );
}

/**
 * Login admin with email and password
 */
export async function loginAdmin(email: string, password: string): Promise<AdminLoginResponse> {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    // Find admin
    const adminData = admins.get(email);
    if (!adminData) {
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    const { user, passwordHash } = adminData;

    // Check if admin is active
    if (!user.isActive) {
      return {
        success: false,
        message: 'Admin account is inactive',
      };
    }

    // Verify password (for development - using plain comparison)
    // In production, use bcrypt.compare(password, passwordHash)
    const isPasswordValid = password === passwordHash;
    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'admin',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return {
      success: true,
      token,
      admin: user,
    };
  } catch (error) {
    console.error('[Admin Auth] Login error:', error);
    return {
      success: false,
      message: 'Login failed',
    };
  }
}

/**
 * Verify admin JWT token
 */
export function verifyAdminToken(
  token: string
): { id: string; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!isVerifiedAdminToken(decoded)) {
      return null;
    }
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // Token verification failed (invalid signature, expired, etc.)
    return null;
  }
}

/**
 * Get admin by ID
 */
export function getAdminById(id: string): AdminUser | null {
  for (const { user } of admins.values()) {
    if (user.id === id) {
      return user;
    }
  }
  return null;
}

/**
 * Create new admin (super admin only)
 */
export async function createAdmin(
  email: string,
  name: string,
  password: string,
  role: 'admin' | 'moderator' = 'admin'
): Promise<AdminUser | null> {
  try {
    if (admins.has(email)) {
      console.warn('[Admin Auth] Admin with email already exists:', email);
      return null;
    }

    const passwordHash = await hash(password, 10);

    const newAdmin: AdminUser = {
      id: `admin_${Date.now()}`,
      email,
      name,
      role,
      createdAt: new Date(),
      isActive: true,
    };

    admins.set(email, { user: newAdmin, passwordHash });
    console.log(`[Admin Auth] New admin created: ${email} (${role})`);

    return newAdmin;
  } catch (error) {
    console.error('[Admin Auth] Create admin error:', error);
    return null;
  }
}

/**
 * Logout admin (invalidate token server-side if needed)
 * In a real system, this would add token to blacklist
 */
export function logoutAdmin(_token: string): boolean {
  try {
    void _token;
    // In production, add token to redis blacklist:
    // await redisCache.set(`admin_blacklist:${token}`, 1, { ttl: 604800 }) // 7 days
    console.log('[Admin Auth] Admin logged out');
    return true;
  } catch (error) {
    console.error('[Admin Auth] Logout error:', error);
    return false;
  }
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(_token: string): Promise<boolean> {
  void _token;
  // TODO: Implement with Redis
  // return await redisCache.get(`admin_blacklist:${token}`) !== null;
  return false;
}

/**
 * Update admin password
 */
export async function updateAdminPassword(
  email: string,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    const adminData = admins.get(email);
    if (!adminData) {
      return false;
    }

    // Verify old password
    const isOldPasswordValid = await compare(oldPassword, adminData.passwordHash);
    if (!isOldPasswordValid) {
      return false;
    }

    // Hash and update new password
    const newPasswordHash = await hash(newPassword, 10);
    adminData.passwordHash = newPasswordHash;

    console.log(`[Admin Auth] Password updated for admin: ${email}`);
    return true;
  } catch (error) {
    console.error('[Admin Auth] Update password error:', error);
    return false;
  }
}
