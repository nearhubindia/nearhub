import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { db } from '../../data/db';
import { listings } from '../../features/admin/models/admin-settings';
import { users } from '../../features/users/models/users';
import { createTestApp } from '../setup/test-app';

describe('Admin Listings API', () => {
  const seededUserIds = new Set<string>();
  const createdListingIds = new Set<string>();

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

  async function seedSellerUser(params: {
    id: string;
    username: string;
    mobile?: string;
  }): Promise<void> {
    await db
      .insert(users)
      .values({
        id: params.id,
        username: params.username,
        password: 'otp-auth',
        displayName: 'Seller Account',
        mobile: params.mobile || null,
      })
      .onConflictDoNothing({ target: users.id });
    seededUserIds.add(params.id);
  }

  afterEach(async () => {
    for (const listingId of createdListingIds) {
      await db.delete(listings).where(eq(listings.id, listingId));
    }
    createdListingIds.clear();

    for (const userId of seededUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
    seededUserIds.clear();
  });

  it('returns 401 without admin auth', async () => {
    const app = createTestApp();
    const response = await request(app).post('/api/admin/listings').send({
      title: 'Unauthorized listing',
      description: 'Should not be created',
      category: 'Electronics',
      price: 1200,
      location: 'Chennai',
      userId: 'seller-123',
    });

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });

  it('creates a listing when the seller identifier resolves to a real user', async () => {
    const app = createTestApp();
    const token = await loginAsAdmin(app);
    const sellerId = randomUUID();
    const sellerUsername = `seller-${sellerId.slice(0, 8)}`;
    const sellerMobile = '9876543210';

    await seedSellerUser({
      id: sellerId,
      username: sellerUsername,
      mobile: sellerMobile,
    });

    const response = await request(app)
      .post('/api/admin/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: sellerUsername,
        title: 'Admin created listing',
        description: 'Listing created from the admin console',
        category: 'Electronics',
        price: 2499,
        condition: 'good',
        location: 'Bengaluru',
        contactPhone: sellerMobile,
        images: ['https://example.com/photo.jpg'],
        videos: [],
        listingType: 'image',
        status: 'active',
        isActive: true,
        featured: false,
        sponsored: false,
      });

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.userId).toBe(sellerId);
    expect(response.body?.data?.sellerId).toBe(sellerId);
    expect(response.body?.data?.title).toBe('Admin created listing');

    if (response.body?.data?.id) {
      createdListingIds.add(response.body.data.id);
    }
  });

  it('rejects create listing requests without a seller identifier', async () => {
    const app = createTestApp();
    const token = await loginAsAdmin(app);

    const response = await request(app)
      .post('/api/admin/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Missing seller',
        description: 'No seller reference',
        category: 'Electronics',
        price: 999,
        location: 'Hyderabad',
      });

    expect(response.status).toBe(400);
    expect(response.body?.success).toBe(false);
    expect(String(response.body?.error || '')).toMatch(/seller/i);
  });
});
