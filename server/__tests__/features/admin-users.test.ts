import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { db } from '../../data/db';
import { users } from '../../features/users/models/users';
import { removeUserProfile, upsertUser } from '../../features/users/services/user-profiles';
import { createTestApp } from '../setup/test-app';

describe('Admin Users API', () => {
  const seededUserIds = new Set<string>();

  async function loginAsAdmin(app: ReturnType<typeof createTestApp>): Promise<string> {
    const response = await request(app).post('/api/admin/login').send({
      email: 'admin@nearhub.local',
      password: 'admin123',
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(typeof response.body?.token).toBe('string');

    return response.body.token;
  }

  async function seedPlaceholderUser(params: {
    id: string;
    displayName: string;
    username?: string;
    mobile?: string | null;
  }): Promise<void> {
    await db
      .insert(users)
      .values({
        id: params.id,
        username: params.username || params.id,
        displayName: params.displayName,
        password: 'otp-auth',
        mobile: params.mobile || null,
      })
      .onConflictDoNothing({ target: users.id });
    seededUserIds.add(params.id);
  }

  afterEach(async () => {
    for (const userId of seededUserIds) {
      removeUserProfile(userId);
      await db.delete(users).where(eq(users.id, userId));
    }
    seededUserIds.clear();
  });

  it('prefers a real cached name and phone number over placeholder DB labels', async () => {
    const app = createTestApp();
    const token = await loginAsAdmin(app);
    const userId = randomUUID();
    const phone = '9876543210';

    upsertUser({
      id: userId,
      phone,
      name: 'Real Admin User',
      email: '',
      gender: 'other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await seedPlaceholderUser({
      id: userId,
      username: userId,
      displayName: 'NearHub User',
    });

    const listResponse = await request(app)
      .get(`/api/admin/users?search=${encodeURIComponent(userId)}&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body?.success).toBe(true);
    const row = Array.isArray(listResponse.body?.data)
      ? listResponse.body.data.find((item: { id?: string }) => item.id === userId)
      : null;
    expect(row).toBeTruthy();
    expect(row?.displayName).toBe('Real Admin User');
    expect(row?.mobile).toBe(phone);

    const detailResponse = await request(app)
      .get(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body?.success).toBe(true);
    expect(detailResponse.body?.data?.displayName).toBe('Real Admin User');
    expect(detailResponse.body?.data?.mobile).toBe(phone);
  });
});
