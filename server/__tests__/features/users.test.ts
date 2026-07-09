import { randomUUID } from 'crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../../data/db';
import { users } from '../../features/users/models/users';
import { createListing } from '../../features/listings/services/listings';
import { createTestApp } from '../setup/test-app';

describe('Users API - Strict Tests', () => {
  async function seedUser(id: string, name = 'Test User') {
    await db
      .insert(users)
      .values({
        id,
        username: id,
        password: 'otp-auth',
        displayName: name,
        email: `${id.slice(0, 8)}@nearhub.local`,
      })
      .onConflictDoNothing({ target: users.id });
  }

  it('GET /api/users/profile returns 401 without authentication', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/profile returns authenticated profile', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Profile User');

    const res = await request(app).get('/api/users/profile').set('x-user-id', userId);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.id).toBe(userId);
    expect(typeof res.body?.profileComplete).toBe('boolean');
  });

  it('DELETE /api/users/profile deletes the authenticated account', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Delete User');

    const res = await request(app)
      .delete('/api/users/profile')
      .set('x-user-id', userId)
      .set('x-user-phone', '9876543210');

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const deletedRow = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    expect(deletedRow).toBeUndefined();
  });

  it('GET /api/users/:userId/profile validates user id format', async () => {
    const app = createTestApp();
    const invalid = await request(app).get('/api/users/not-a-uuid/profile');
    expect(invalid.status).toBe(400);
    expect(invalid.body?.error).toContain('Invalid user id format');
  });

  it('GET /api/users/:userId/profile returns 404 for missing user', async () => {
    const app = createTestApp();
    const missingId = randomUUID();
    const res = await request(app).get(`/api/users/${missingId}/profile`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/users/:userId/profile enforces self-update only', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    const otherId = randomUUID();
    await seedUser(ownerId, 'Owner');

    const forbidden = await request(app)
      .put(`/api/users/${ownerId}/profile`)
      .set('x-user-id', otherId)
      .send({ name: 'Hijacked Name' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.error).toContain('only update your own profile');

    const badRequest = await request(app)
      .put(`/api/users/${ownerId}/profile`)
      .set('x-user-id', ownerId)
      .send({ name: '' });
    expect(badRequest.status).toBe(400);

    const ok = await request(app)
      .put(`/api/users/${ownerId}/profile`)
      .set('x-user-id', ownerId)
      .send({
        name: 'Updated Owner',
        email: 'owner@nearhub.local',
        address: 'Bengaluru',
      });
    expect(ok.status).toBe(200);
    expect(ok.body?.success).toBe(true);
    expect(ok.body?.user?.name).toBe('Updated Owner');
  });

  it('GET /api/users/:userId/listings supports status filtering', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Seller');

    await createListing({
      sellerId: userId,
      title: `Active Listing ${randomUUID().slice(0, 6)}`,
      description: 'active',
      category: 'Electronics',
      price: '1000',
      condition: 'good',
      location: 'Delhi',
      status: 'active',
      isActive: true,
      images: ['https://example.com/a.jpg'],
      videos: [],
    } as any);

    await createListing({
      sellerId: userId,
      title: `Sold Listing ${randomUUID().slice(0, 6)}`,
      description: 'sold',
      category: 'Electronics',
      price: '900',
      condition: 'good',
      location: 'Delhi',
      status: 'sold',
      isActive: false,
      images: ['https://example.com/b.jpg'],
      videos: [],
    } as any);

    const all = await request(app).get(`/api/users/${userId}/listings`);
    expect(all.status).toBe(200);
    expect(Array.isArray(all.body?.listings)).toBe(true);
    expect(typeof all.body?.total).toBe('number');

    const activeOnly = await request(app).get(`/api/users/${userId}/listings?status=active`);
    expect(activeOnly.status).toBe(200);
    expect(Array.isArray(activeOnly.body?.listings)).toBe(true);
    for (const listing of activeOnly.body.listings) {
      expect(listing.status).toBe('active');
    }
  });

  it('GET /api/users/invoices requires authentication and returns invoice list for user', async () => {
    const app = createTestApp();
    const unauth = await request(app).get('/api/users/invoices');
    expect(unauth.status).toBe(401);

    const userId = randomUUID();
    await seedUser(userId);
    const auth = await request(app).get('/api/users/invoices').set('x-user-id', userId);
    expect(auth.status).toBe(200);
    expect(auth.body?.success).toBe(true);
    expect(Array.isArray(auth.body?.invoices)).toBe(true);
  });

  it('POST /api/invoices/generate preserves submitted customer identity fields', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/invoices/generate').send({
      customerId: randomUUID(),
      customerName: 'Correct Customer Name',
      customerEmail: 'customer@nearhub.local',
      customerPhone: '9876543210',
      items: [
        {
          description: 'Subscription Plan',
          quantity: 1,
          unitPrice: 499,
          amount: 499,
        },
      ],
      paymentMethod: 'Razorpay',
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.customerName).toBe('Correct Customer Name');
    expect(res.body?.data?.customerPhone).toBe('9876543210');
    expect(res.body?.data?.vendorName).toBeDefined();
    expect(res.body?.data?.vendorPhone).toBeDefined();
  });
});
