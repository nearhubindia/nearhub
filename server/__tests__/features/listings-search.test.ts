import { randomUUID } from 'crypto';
import request from 'supertest';
import { db } from '../../data/db';
import { listings } from '../../features/admin/models/admin-settings';
import { users } from '../../features/users/models/users';
import { createTestApp } from '../setup/test-app';

describe('Listings Search API', () => {
  async function seedUser(id: string, label: string) {
    await db
      .insert(users)
      .values({
        id,
        username: `${label}-${id.slice(0, 8)}`,
        displayName: label,
        password: 'otp-auth',
      })
      .onConflictDoNothing({ target: users.id });
  }

  async function seedListing(input: {
    id: string;
    sellerId: string;
    title: string;
    description: string;
    category: string;
    price: string;
    location: string;
  }) {
    await db
      .insert(listings)
      .values({
        id: input.id,
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        category: input.category,
        price: input.price,
        condition: 'good',
        location: input.location,
        status: 'active',
        isActive: true,
        images: JSON.stringify(['https://example.com/search.jpg']),
        videos: JSON.stringify([]),
      })
      .onConflictDoNothing({ target: listings.id });
  }

  it('filters by text, category, location and price range', async () => {
    const app = createTestApp();
    const sellerId = randomUUID();
    await seedUser(sellerId, 'Search Seller');

    const matchingId = randomUUID();
    await seedListing({
      id: matchingId,
      sellerId,
      title: 'iPhone 15 Pro',
      description: 'Excellent condition phone',
      category: 'Electronics',
      price: '65000',
      location: 'Mumbai',
    });

    await seedListing({
      id: randomUUID(),
      sellerId,
      title: 'Mountain Bike',
      description: 'Sports bike',
      category: 'Sports',
      price: '12000',
      location: 'Pune',
    });

    const response = await request(app).get('/api/listings/search').query({
      q: 'iphone',
      category: 'Electronics',
      location: 'mumbai',
      minPrice: 60000,
      maxPrice: 70000,
      limit: 20,
      offset: 0,
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(Array.isArray(response.body?.data)).toBe(true);
    expect(response.body?.data.some((item: { id?: string }) => item.id === matchingId)).toBe(true);
    expect(typeof response.body?.pagination?.total).toBe('number');
  });

  it('supports pagination metadata on search results', async () => {
    const app = createTestApp();
    const sellerId = randomUUID();
    await seedUser(sellerId, 'Pagination Seller');

    for (let index = 0; index < 3; index += 1) {
      await seedListing({
        id: randomUUID(),
        sellerId,
        title: `Searchable Item ${Date.now()}-${index}`,
        description: 'Paginated list item',
        category: 'Electronics',
        price: String(1000 + index),
        location: 'Delhi',
      });
    }

    const response = await request(app).get('/api/listings/search').query({
      q: 'searchable item',
      limit: 2,
      offset: 0,
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(Array.isArray(response.body?.data)).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(2);
    expect(response.body?.pagination?.limit).toBe(2);
    expect(response.body?.pagination?.offset).toBe(0);
    expect(typeof response.body?.pagination?.hasMore).toBe('boolean');
    expect(Array.isArray(response.body?.results)).toBe(true);
  });
});
