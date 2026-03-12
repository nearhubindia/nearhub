import type { Request } from 'express';

export function getRequestUserId(req: Request): string {
  const candidate = (req as any).userId ?? req.get('x-user-id');
  return typeof candidate === 'string' ? candidate.trim() : '';
}
