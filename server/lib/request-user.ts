import type { Request } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequestUserId(req: Request): string {
  const candidate = (req as any).userId ?? req.get('x-user-id');
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  if (!value) return '';
  return UUID_REGEX.test(value) ? value : '';
}
