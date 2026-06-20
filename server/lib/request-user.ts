import type { Request } from 'express';
import { verifyWebUserToken } from '../features/auth/services/web-auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequestUserId(req: Request): string {
  const candidate = (req as any).userId ?? req.query.userId ?? req.get('x-user-id');
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  if (value && UUID_REGEX.test(value)) return value;

  const authHeader = req.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const verified =
    verifyWebUserToken(bearerToken) ||
    verifyWebUserToken(queryToken);

  return verified?.id && UUID_REGEX.test(verified.id) ? verified.id : '';
}
