import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { db } from '../../data/db';
import { subscriptionTiers, userSubscriptions } from '../../features/admin/models/admin-settings';
import { users } from '../../features/users/models/users';
import { removeUserProfile, upsertUser } from '../../features/users/services/user-profiles';
import { createTestApp } from '../setup/test-app';

describe('Admin Users API', () => {
  const seededUserIds = new Set<string>();
  const seededTierIds = new Set<string>();
  const seededSubscriptionIds = new Set<string>();

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
    for (const subscriptionId of seededSubscriptionIds) {
      await db.delete(userSubscriptions).where(eq(userSubscriptions.id, subscriptionId));
    }
    seededSubscriptionIds.clear();

    for (const tierId of seededTierIds) {
      await db.delete(subscriptionTiers).where(eq(subscriptionTiers.id, tierId));
    }
    seededTierIds.clear();

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

  it('allows admin to create a seller user for demo listings', async () => {
    const app = createTestApp();
    const token = await loginAsAdmin(app);
    const mobile = '8867653172';
    const location = 'Anakapalle';

    const response = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Demo Seller',
        mobile,
        location,
        isVerified: true,
      });

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.displayName).toBe('Demo Seller');
    expect(response.body?.data?.mobile).toBe(mobile);
    expect(response.body?.data?.location).toBe(location);
    expect(response.body?.data?.isVerified).toBe(true);
    expect(typeof response.body?.data?.id).toBe('string');

    const userId = String(response.body?.data?.id || '');
    seededUserIds.add(userId);

    const detailResponse = await request(app)
      .get(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body?.success).toBe(true);
    expect(detailResponse.body?.data?.displayName).toBe('Demo Seller');
    expect(detailResponse.body?.data?.mobile).toBe(mobile);
  });

  it('allows admin to grant a subscription to a user', async () => {
    const app = createTestApp();
    const token = await loginAsAdmin(app);
    const userId = randomUUID();
    const tierId = randomUUID();

    await seedPlaceholderUser({
      id: userId,
      displayName: 'Grant Target',
      mobile: '9123456780',
    });

    await db
      .insert(subscriptionTiers)
      .values({
        id: tierId,
        name: 'Admin Grant Tier',
        type: 'bundle',
        description: 'Tier for admin grant testing',
        monthlyPrice: '299',
        annualPrice: '2999',
        price: '299',
        offerPrice: '199',
        durationDays: 30,
        features: JSON.stringify(['maxListings']),
        maxListings: 10,
        featuredListingsPerMonth: 1,
        boostCredits: 2,
        highlight: false,
        isActive: true,
      })
      .returning();
    seededTierIds.add(tierId);

    const response = await request(app)
      .post(`/api/admin/users/${userId}/subscriptions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tierId,
        durationDays: 45,
      });

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.userId).toBe(userId);
    expect(response.body?.data?.tierId).toBe(tierId);
    expect(response.body?.data?.status).toBe('active');
    expect(response.body?.data?.boostsRemaining).toBe(2);
    expect(typeof response.body?.data?.id).toBe('string');

    const createdSubscriptionId = String(response.body?.data?.id || '');
    if (createdSubscriptionId) {
      seededSubscriptionIds.add(createdSubscriptionId);
    }
  });
});
