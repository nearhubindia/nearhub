/**
 * Error Handling Utilities
 * Shared utilities for consistent error handling across the application
 */

import type { Request, Response } from 'express';

export interface AppError {
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
}

/**
 * Standard error response handler
 * @param res - Express response object
 * @param error - Error object
 * @param context - Context label for logging (e.g., '[Auth]', '[Listings]')
 * @param defaultMessage - Default user-facing message
 */
export function handleError(
  res: Response,
  error: any,
  context: string,
  defaultMessage: string = 'An error occurred'
): Response {
  console.error(`${context} Error:`, error);

  const statusCode = error.statusCode || 500;
  const message = error.message || defaultMessage;

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}

/**
 * Create a standard error object
 */
export function createError(message: string, statusCode: number = 500, code?: string): AppError {
  return {
    message,
    statusCode,
    code,
  };
}

/**
 * Async handler wrapper to catch errors
 * Eliminates need for try-catch in every route
 */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<any>
): (req: Request, res: Response) => void {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      handleError(res, error, '[AsyncHandler]');
    });
  };
}

/**
 * Standard 404 response
 */
export function notFound(res: Response, resource: string = 'Resource'): Response {
  return res.status(404).json({
    success: false,
    error: `${resource} not found`,
  });
}

/**
 * Standard unauthorized response
 */
export function unauthorized(res: Response, message: string = 'Unauthorized'): Response {
  return res.status(401).json({
    success: false,
    error: message,
  });
}

/**
 * Standard forbidden response
 */
export function forbidden(res: Response, message: string = 'Forbidden'): Response {
  return res.status(403).json({
    success: false,
    error: message,
  });
}

/**
 * Standard validation error response
 */
export function validationError(res: Response, message: string, details?: any): Response {
  return res.status(400).json({
    success: false,
    error: message,
    ...(details && { details }),
  });
}
