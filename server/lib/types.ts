/**
 * Shared Type Definitions
 * Common types used across the server application
 */

import type { Request } from 'express';

/**
 * Authenticated Request
 * Extended Express Request with user information from auth middleware
 */
export interface AuthRequest extends Request {
  userId?: string;
  userPhone?: string;
  isAdmin?: boolean;
  adminId?: string;
  adminEmail?: string;
}

/**
 * Standard API Response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination Parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
  page?: number;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
}
