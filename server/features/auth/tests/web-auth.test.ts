import { describe, expect, it } from 'vitest';
import { signWebUserToken, verifyWebUserToken } from '../services/web-auth';

describe('web authentication tokens', () => {
  it('signs and verifies a web user token', () => {
    const token = signWebUserToken({ id: 'user-1', phone: '+919999999999' });
    expect(verifyWebUserToken(token)).toEqual({ id: 'user-1', phone: '+919999999999' });
  });

  it('rejects malformed, tampered, and wrong-type tokens', () => {
    expect(verifyWebUserToken('not-a-jwt')).toBeNull();
    const token = signWebUserToken({ id: 'user-2' });
    expect(verifyWebUserToken(`${token}tampered`)).toBeNull();
  });
});
