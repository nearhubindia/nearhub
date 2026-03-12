type UserHeaderIdentity = {
  id?: string | null;
  phone?: string | null;
  name?: string | null;
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

  if (includeName && userName) {
    headers['x-user-name'] = userName;
  }

  return headers;
}
