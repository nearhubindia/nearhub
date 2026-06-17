export function buildAuthRegisterPath(
  pathname: string,
  search = '',
  fallback = '/browse'
): string {
  const currentPath = `${pathname || ''}${search || ''}`.trim();
  const redirectTarget =
    currentPath && currentPath !== '/auth/register' ? currentPath : fallback;
  return `/auth/register?redirect=${encodeURIComponent(redirectTarget)}`;
}
