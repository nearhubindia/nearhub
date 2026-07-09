import { randomUUID } from 'crypto';
import request from 'supertest';
import { db } from '../../data/db';
import { users } from '../../features/users/models/users';
import { listings } from '../../features/admin/models/admin-settings';
import { eq } from 'drizzle-orm';
import { createTestApp } from '../setup/test-app';

jest.mock('../../features/listings/workers/listing-moderation', () => ({
  enqueueListingModeration: jest.fn(() => Promise.reject(new Error('moderation queue down'))),
}));

describe('Subscriptions create listing', () => {
  const createdListingIds: string[] = [];
  const seededUserIds: string[] = [];

  async function loginAsAdmin(app: ReturnType<typeof createTestApp>): Promise<string> {
    const response = await request(app).post('/api/admin/login').send({
      email: 'admin@nearhub.local',
      password: 'admin123',
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    return response.body.token;
  }

  afterEach(async () => {
    for (const listingId of createdListingIds) {
      await db.delete(listings).where(eq(listings.id, listingId));
    }
    createdListingIds.length = 0;

    for (const userId of seededUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
    seededUserIds.length = 0;
  });

  it('still creates a listing when moderation enqueue fails', async () => {
    const app = createTestApp();
    const token = await loginAsAdmin(app);
    const ownerId = `admin_${randomUUID().slice(0, 8)}`;

    await db
      .insert(users)
      .values({
        id: ownerId,
        username: ownerId,
        password: 'otp-auth',
        displayName: 'Admin Test Seller',
        mobile: String(9000000000 + Math.floor(Math.random() * 1000000000)),
      })
      .onConflictDoNothing({ target: users.id });
    seededUserIds.push(ownerId);

    const response = await request(app)
      .post('/api/subscriptions/create-listing')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: ownerId,
        title: 'Moderation fallback listing',
        description: 'This should survive queue failures',
        category: 'Electronics',
        price: 1200,
        location: 'Chennai',
        condition: 'good',
        images: [],
        videos: [],
      });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.listing?.id).toBeTruthy();

    if (response.body?.listing?.id) {
      createdListingIds.push(response.body.listing.id);
    }
  });
});
