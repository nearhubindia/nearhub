import { randomUUID } from 'crypto';
import request from 'supertest';
import { db } from '../../data/db';
import { users } from '../../features/users/models/users';
import { createListing } from '../../features/listings/services/listings';
import { createTestApp } from '../setup/test-app';

describe('Listings API - Strict Tests', () => {
  async function seedUser(id: string, mobile?: string) {
    const uniqueMobile = mobile || `${Math.floor(9000000000 + Math.random() * 100000000)}`;
    await db
      .insert(users)
      .values({
        id,
        username: id,
        password: 'otp-auth',
        displayName: 'Test User',
        mobile: uniqueMobile,
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

  async function seedGeoListing(
    ownerId: string,
    input: {
      title: string;
      location: string;
      latitude: string;
      longitude: string;
      isDeal?: boolean;
    }
  ) {
    return createListing({
      sellerId: ownerId,
      title: input.title,
      description: 'Geo test listing',
      category: 'Electronics',
      price: '1200',
      condition: 'good',
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'active',
      isActive: true,
      isDeal: input.isDeal ?? true,
      images: ['https://example.com/geo.jpg'],
      videos: [],
    } as any);
  }

  it('creates a listing when no media is provided', async () => {
    const ownerId = randomUUID();
    await seedUser(ownerId);

    const listing = await createListing({
      sellerId: ownerId,
      title: `Empty Media ${randomUUID().slice(0, 8)}`,
      description: 'Strict test listing',
      category: 'Electronics',
      price: '1200',
      condition: 'good',
      location: 'Delhi',
      status: 'active',
      isActive: true,
      images: [],
      videos: [],
    } as any);

    expect(listing?.id).toBeTruthy();
    expect(listing?.title).toContain('Empty Media');
  });

  it('GET /api/listings returns 200 with list payload', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data)).toBe(true);
  });

  it('GET /api/listings with geo filters still returns a nearby deal even when a newer far-away deal fills the page limit', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    await seedUser(ownerId);

    const nearbyDeal = await seedGeoListing(ownerId, {
      title: `Nearby Deal ${randomUUID().slice(0, 8)}`,
      location: 'Bengaluru',
      latitude: '12.9716',
      longitude: '77.5946',
    });

    await seedGeoListing(ownerId, {
      title: `Far Deal ${randomUUID().slice(0, 8)}`,
      location: 'Delhi',
      latitude: '28.6139',
      longitude: '77.2090',
    });

    const res = await request(app).get('/api/listings').query({
      dealsOnly: '1',
      limit: 1,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]?.id).toBe(nearbyDeal.id);
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
    const sellerMobile = `98765${randomUUID().replace(/\D/g, '').slice(0, 5)}`;
    await seedUser(ownerId, sellerMobile);
    await seedUser(requesterId, `91234${randomUUID().replace(/\D/g, '').slice(0, 5)}`);
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

  it('PATCH /api/listings/:id returns normalized media arrays', async () => {
    const app = createTestApp();
    const ownerId = randomUUID();
    await seedUser(ownerId);
    const listing = await seedListing(ownerId);

    const res = await request(app)
      .patch(`/api/listings/${listing.id}`)
      .set('x-user-id', ownerId)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.listing?.sellerId).toBe(ownerId);
    expect(res.body?.listing?.userId).toBe(ownerId);
    expect(Array.isArray(res.body?.listing?.images)).toBe(true);
    expect(Array.isArray(res.body?.listing?.videos)).toBe(true);
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
