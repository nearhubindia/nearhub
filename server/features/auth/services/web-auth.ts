import jwt from 'jsonwebtoken';
import { SERVER_CONFIG } from '../../../lib/config';

const WEB_AUTH_SECRET =
  process.env.WEB_AUTH_JWT_SECRET ||
  process.env.JWT_SECRET ||
  SERVER_CONFIG.ADMIN_JWT_SECRET ||
  'nearhub-web-auth-secret-change-in-production';
const WEB_AUTH_EXPIRES_IN = process.env.WEB_AUTH_JWT_EXPIRES_IN || '30d';

type VerifiedWebUserToken = {
  id: string;
  phone?: string;
  type: 'web_user';
};

function isVerifiedWebUserToken(value: unknown): value is VerifiedWebUserToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as Record<string, unknown>;
  return typeof token.id === 'string' && token.type === 'web_user';
}

export function signWebUserToken(input: { id: string; phone?: string }): string {
  return jwt.sign(
    {
      id: input.id,
      phone: input.phone || '',
      type: 'web_user',
    },
    WEB_AUTH_SECRET,
    { expiresIn: WEB_AUTH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyWebUserToken(token: string): { id: string; phone?: string } | null {
  try {
    const decoded = jwt.verify(token, WEB_AUTH_SECRET);
    if (!isVerifiedWebUserToken(decoded)) return null;
    return {
      id: decoded.id,
      phone: decoded.phone,
    };
  } catch {
    return null;
  }
}
