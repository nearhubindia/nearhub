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

export function normalizePhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '').slice(-10);
}

export function getStableUserIdFromPhone(phone: string): string {
  return normalizePhone(phone);
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
  name?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}): AppUser {
  const normalizedPhone = normalizePhone(input.phone);
  const stableId = getStableUserIdFromPhone(normalizedPhone);
  const existing = getUserById(stableId) || getUserByPhone(normalizedPhone);
  const nowIso = new Date().toISOString();

  return indexUser({
    id: existing?.id || stableId,
    phone: normalizedPhone,
    name:
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim()
        : existing?.name || 'User',
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
  if (byId?.name?.trim()) return byId.name.trim();

  const byPhone = getUserByPhone(normalizedId);
  if (byPhone?.name?.trim()) return byPhone.name.trim();

  const suffix = normalizedId.slice(-4) || normalizedId;
  return `${fallbackPrefix} ${suffix}`;
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
