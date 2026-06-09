export type StoredWebUser = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  address?: string;
  gstin?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferences?: {
    notifications?: boolean;
    emailNotifications?: boolean;
    autoLocalizeListings?: boolean;
    searchRadiusKm?: number;
  };
};

export const WEB_USER_STORAGE_KEY = 'nearhub_web_user';
export const WEB_TOKEN_STORAGE_KEY = 'nearhub_web_token';
export const WEB_AUTH_CHANGED_EVENT = 'nearhub-web-auth-changed';

export function getMeaningfulWebUserName(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const normalized = trimmed.toLowerCase();
  if (!trimmed) return '';
  if (['user', 'buyer', 'seller', 'unknown', 'anonymous'].includes(normalized)) return '';
  if (/^nearhub(?:[\s_-]*user)?$/i.test(trimmed)) return '';
  if (/^(user|buyer|seller)[\s_-]*[0-9a-z]+$/i.test(trimmed)) return '';
  if (/^\d{10,15}$/.test(trimmed)) return '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed))
    return '';
  if (!/[a-z]/i.test(trimmed) && /\d/.test(trimmed)) return '';
  if (/^\S+$/.test(trimmed) && /[a-z]/i.test(trimmed) && /\d/.test(trimmed)) return '';
  return trimmed;
}

export function readStoredWebUser(): StoredWebUser | null {
  try {
    const raw = localStorage.getItem(WEB_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredWebUser;
  } catch {
    return null;
  }
}

export function writeStoredWebUser(user: StoredWebUser): void {
  localStorage.setItem(WEB_USER_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(WEB_AUTH_CHANGED_EVENT));
}

export function writeStoredWebAuth(user: StoredWebUser, token: string): void {
  localStorage.setItem(WEB_USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(WEB_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new Event(WEB_AUTH_CHANGED_EVENT));
}

export function clearStoredWebAuth(): void {
  localStorage.removeItem(WEB_USER_STORAGE_KEY);
  localStorage.removeItem(WEB_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(WEB_AUTH_CHANGED_EVENT));
}
