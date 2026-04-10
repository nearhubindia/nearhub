import crypto from 'node:crypto';

export type AppUser = {
  id: string;
  phone: string;
  name: string;
  email: string;
  gender: 'male' | 'female' | 'other';
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
  bio?: string;
  address?: string;
  gstin?: string;
  location?: unknown;
  isVerified?: boolean;
  preferences?: {
    notifications?: boolean;
    emailNotifications?: boolean;
    autoLocalizeListings?: boolean;
  };
};

const usersById = new Map<string, AppUser>();
const userIdByPhone = new Map<string, string>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^\d{10,15}$/;

function normalizeCandidate(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function looksSyntheticDisplayName(trimmed: string): boolean {
  const normalized = trimmed.toLowerCase();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const hasLetters = /[a-z]/i.test(trimmed);
  const hasDigits = /\d/.test(trimmed);

  if (!normalized) return true;

  if (
    normalized === 'user' ||
    normalized === 'buyer' ||
    normalized === 'seller' ||
    normalized === 'unknown' ||
    normalized === 'anonymous'
  ) {
    return true;
  }

  if (/^nearhub(?:[\s_-]*user)?$/i.test(trimmed)) {
    return true;
  }

  if (/^(buyer|seller)[\s_-]*[0-9a-z]+$/i.test(trimmed)) {
    return true;
  }

  if (/^user[\s_-]*[0-9a-z]+$/i.test(trimmed)) {
    return true;
  }

  if (UUID_REGEX.test(trimmed) || PHONE_REGEX.test(trimmed)) {
    return true;
  }

  if (!hasLetters && hasDigits) {
    return true;
  }

  if (tokens.length === 1 && hasLetters && hasDigits) {
    return true;
  }

  if (/^(user|buyer|seller)[\s_-]*\d+$/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function isMeaningfulDisplayName(value: unknown): value is string {
  const trimmed = normalizeCandidate(value);
  if (!trimmed) return false;
  return !looksSyntheticDisplayName(trimmed);
}

export function pickMeaningfulDisplayName(...values: unknown[]): string {
  for (const value of values) {
    if (isMeaningfulDisplayName(value)) {
      return String(value).trim();
    }
  }
  return '';
}

export function normalizePhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '').slice(-10);
}

function toDeterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const base = hash.slice(0, 32).split('');
  // RFC4122-ish UUID formatting.
  base[12] = '4';
  const variantNibble = parseInt(base[16] || '8', 16);
  base[16] = ((variantNibble & 0x3) | 0x8).toString(16);
  const hex = base.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`;
}

export function getStableUserIdFromPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return '';
  return toDeterministicUuid(`nearhub:user:${normalized}`);
}

function indexUser(user: AppUser): AppUser {
  const normalizedId = typeof user.id === 'string' ? user.id.trim() : '';
  const normalizedPhone = normalizePhone(user.phone);
  const nextUser: AppUser = {
    ...user,
    id: normalizedId || normalizedPhone,
    phone: normalizedPhone,
  };

  usersById.set(nextUser.id, nextUser);
  if (normalizedPhone) {
    userIdByPhone.set(normalizedPhone, nextUser.id);
  }
  return nextUser;
}

export function getUserById(userId: string): AppUser | undefined {
  return usersById.get(String(userId || '').trim());
}

export function getUserByPhone(phone: string): AppUser | undefined {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return undefined;
  const linkedId = userIdByPhone.get(normalizedPhone);
  if (linkedId) return usersById.get(linkedId);
  return usersById.get(normalizedPhone);
}

export function upsertUser(user: AppUser): AppUser {
  return indexUser(user);
}

export function upsertUserFromAuth(input: {
  phone: string;
  preferredId?: string;
  name?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}): AppUser {
  const normalizedPhone = normalizePhone(input.phone);
  const stableId = getStableUserIdFromPhone(normalizedPhone);
  const preferredId = typeof input.preferredId === 'string' ? input.preferredId.trim() : '';
  const existing =
    (preferredId ? getUserById(preferredId) : undefined) ||
    getUserById(stableId) ||
    getUserByPhone(normalizedPhone);
  const nowIso = new Date().toISOString();
  const existingName = existing?.name;

  return indexUser({
    id: existing?.id || preferredId || stableId,
    phone: normalizedPhone,
    name: isMeaningfulDisplayName(input.name)
      ? input.name.trim()
      : isMeaningfulDisplayName(existingName)
        ? existingName.trim()
        : 'User',
    email: typeof input.email === 'string' ? input.email.trim() : existing?.email || '',
    gender: input.gender || existing?.gender || 'other',
    avatarUrl:
      typeof input.avatarUrl === 'string' && input.avatarUrl.trim()
        ? input.avatarUrl.trim()
        : existing?.avatarUrl || '',
    createdAt: existing?.createdAt || input.createdAt || nowIso,
    updatedAt: input.updatedAt || nowIso,
    bio: existing?.bio || '',
    address: existing?.address || '',
    gstin: existing?.gstin || '',
    location: existing?.location || null,
    isVerified: existing?.isVerified ?? true,
    preferences: existing?.preferences || {
      notifications: true,
      emailNotifications: true,
      autoLocalizeListings: true,
    },
  });
}

export function resolveUserDisplayName(userId: string, fallbackPrefix: 'Buyer' | 'Seller'): string {
  const normalizedId = String(userId || '').trim();
  const byId = getUserById(normalizedId);
  if (isMeaningfulDisplayName(byId?.name)) return byId.name.trim();

  const byPhone = getUserByPhone(normalizedId);
  if (isMeaningfulDisplayName(byPhone?.name)) return byPhone.name.trim();

  return fallbackPrefix;
}

export function removeUserProfile(userId: string): void {
  const normalizedId = String(userId || '').trim();
  if (!normalizedId) return;

  const existing = usersById.get(normalizedId);
  usersById.delete(normalizedId);

  if (existing?.phone) {
    userIdByPhone.delete(normalizePhone(existing.phone));
  }

  for (const [phone, id] of userIdByPhone.entries()) {
    if (id === normalizedId) {
      userIdByPhone.delete(phone);
    }
  }
}
