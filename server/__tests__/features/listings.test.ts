import { randomUUID } from 'crypto';
import request from 'supertest';
import { db } from '../../data/db';
import { users } from '../../features/users/models/users';
import { createListing } from '../../features/listings/services/listings';
import { createTestApp } from '../setup/test-app';

describe('Listings API - Strict Tests', () => {
  async function seedUser(id: string, mobile?: string) {
    await db
      .insert(users)
      .values({
        id,
        username: id,
        password: 'otp-auth',
        displayName: 'Test User',
        mobile,
      })
      .onConflictDoNothing({ target: users.id });
  }

  async function seedListing(ownerId: string) {
    return createListing({
      sellerId: ownerId,
      title: `Listing ${randomUUID().slice(0, 8)}`,
      description: 'Strict test listing',
      category: 'Electronics',
      price: '1200',
      condition: 'good',
      location: 'Delhi',
      status: 'active',
      isActive: true,
      images: ['https://example.com/a.jpg'],
      videos: [],
    } as any);
  }

  it('GET /api/listings returns 200 with list payload', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data)).toBe(true);
  });

  it('GET /api/listings/:id returns 200 for existing listing and 404 for missing listing', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    await seedUser(ownerId);
    const listing = await seedListing(ownerId);

    const ok = await request(app).get(`/api/listings/${listing.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body?.success).toBe(true);
    expect(ok.body?.listing?.id).toBe(listing.id);

    const missing = await request(app).get(`/api/listings/${randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(missing.body?.success).toBe(false);
  });

  it('GET /api/listings/:id/contact falls back to the seller profile phone', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    const requesterId = randomUUID();
    const sellerMobile = '9876543210';
    await seedUser(ownerId, sellerMobile);
    await seedUser(requesterId, '9123456780');
    const listing = await seedListing(ownerId);

    const res = await request(app)
      .get(`/api/listings/${listing.id}/contact`)
      .set('x-user-id', requesterId);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.contactPhone).toBe(sellerMobile);
    expect(res.body?.sellerPhone).toBe(sellerMobile);
  });

  it('PATCH /api/listings/:id enforces ownership', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    const otherUserId = randomUUID();
    await seedUser(ownerId);
    await seedUser(otherUserId);
    const listing = await seedListing(ownerId);

    const ownerUpdate = await request(app)
      .patch(`/api/listings/${listing.id}`)
      .set('x-user-id', ownerId)
      .send({ price: 2500 });
    expect(ownerUpdate.status).toBe(200);
    expect(ownerUpdate.body?.success).toBe(true);

    const otherUpdate = await request(app)
      .patch(`/api/listings/${listing.id}`)
      .set('x-user-id', otherUserId)
      .send({ price: 2600 });
    expect(otherUpdate.status).toBe(403);
    expect(otherUpdate.body?.success).toBe(false);
  });

  it('PATCH /api/listings/:id rejects local device media URIs', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    await seedUser(ownerId);
    const listing = await seedListing(ownerId);

    const res = await request(app)
      .patch(`/api/listings/${listing.id}`)
      .set('x-user-id', ownerId)
      .send({ images: ['file:///storage/emulated/0/DCIM/test.jpg'] });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.code).toBe('INVALID_IMAGE_URI');
  });

  it('DELETE /api/listings/:id enforces ownership and returns 404 for missing listing', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    const otherUserId = randomUUID();
    await seedUser(ownerId);
    await seedUser(otherUserId);
    const listing = await seedListing(ownerId);

    const forbidden = await request(app)
      .delete(`/api/listings/${listing.id}`)
      .set('x-user-id', otherUserId);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.success).toBe(false);

    const ok = await request(app).delete(`/api/listings/${listing.id}`).set('x-user-id', ownerId);
    expect(ok.status).toBe(200);
    expect(ok.body?.success).toBe(true);

    const missing = await request(app)
      .delete(`/api/listings/${randomUUID()}`)
      .set('x-user-id', ownerId);
    expect(missing.status).toBe(404);
    expect(missing.body?.success).toBe(false);
  });
});
