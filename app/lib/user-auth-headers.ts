type UserHeaderIdentity = {
  id?: string | null;
  phone?: string | null;
  name?: string | null;
  token?: string | null;
};

type BuildUserAuthHeadersOptions = {
  includeContentType?: boolean;
  includeName?: boolean;
};

export function buildUserAuthHeaders(
  user: UserHeaderIdentity | null | undefined,
  options: BuildUserAuthHeadersOptions = {}
): Record<string, string> {
  const { includeContentType = true, includeName = false } = options;
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const userId = typeof user?.id === 'string' ? user.id.trim() : '';
  const userName = typeof user?.name === 'string' ? user.name.trim() : '';

  if (userId) {
    headers['x-user-id'] = userId;
  }

  const userPhone = typeof user?.phone === 'string' ? user.phone.trim() : '';
  if (userPhone) {
    headers['x-user-phone'] = userPhone;
  }

  if (includeName && userName) {
    headers['x-user-name'] = userName;
  }

  const token = typeof user?.token === 'string' ? user.token.trim() : '';
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
