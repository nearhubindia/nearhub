import { randomUUID } from 'crypto';
import request from 'supertest';
import { db } from '../../data/db';
import { listings } from '../../features/admin/models/admin-settings';
import { users } from '../../features/users/models/users';
import { createTestApp } from '../setup/test-app';

describe('Messages API', () => {
  async function seedUser(id: string, label: string, avatarUrl = '') {
    await db
      .insert(users)
      .values({
        id,
        username: `${label}-${id.slice(0, 8)}`,
        displayName: label,
        avatarUrl,
        password: 'otp-auth',
      })
      .onConflictDoNothing({ target: users.id });
  }

  async function seedListing(id: string, sellerId: string, title: string) {
    await db
      .insert(listings)
      .values({
        id,
        sellerId,
        title,
        description: 'Listing used for message tests',
        category: 'Electronics',
        price: '2500',
        condition: 'good',
        location: 'Delhi',
        status: 'active',
        isActive: true,
        images: JSON.stringify(['https://example.com/item.jpg']),
        videos: JSON.stringify([]),
      })
      .onConflictDoNothing({ target: listings.id });
  }

  it('returns 401 when user identity is missing', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/messages/threads');

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });

  it('creates a conversation from listingId and returns messages for both participants', async () => {
    const app = createTestApp();
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const listingId = randomUUID();
    const text = `hello-${Date.now()}`;
    const sellerAvatar = `https://example.com/sellers/${Date.now()}.jpg`;

    await seedUser(sellerId, 'Seller One', sellerAvatar);
    await seedUser(buyerId, 'Buyer One');
    await seedListing(listingId, sellerId, `Phone ${Date.now()}`);

    const send = await request(app)
      .post('/api/messages/send')
      .set('x-user-id', buyerId)
      .set('x-user-name', 'Buyer One')
      .send({ listingId, text });

    expect(send.status).toBe(200);
    expect(send.body?.success).toBe(true);
    expect(typeof send.body?.data?.conversationId).toBe('string');
    expect(send.body?.data?.listingId).toBe(listingId);
    expect(send.body?.data?.otherUserAvatar).toBe(sellerAvatar);
    expect(send.body?.data?.message?.text).toBe(text);

    const conversationId = String(send.body.data.conversationId);

    const sellerThreads = await request(app)
      .get('/api/messages/threads')
      .set('x-user-id', sellerId);
    expect(sellerThreads.status).toBe(200);
    expect(sellerThreads.body?.success).toBe(true);
    expect(Array.isArray(sellerThreads.body?.data)).toBe(true);
    expect(
      sellerThreads.body.data.some(
        (thread: { conversationId?: string; listingId?: string; unreadCount?: number }) =>
          thread.conversationId === conversationId &&
          thread.listingId === listingId &&
          Number(thread.unreadCount || 0) >= 1
      )
    ).toBe(true);

    const sellerConversation = await request(app)
      .get(`/api/messages/conversations/${conversationId}`)
      .set('x-user-id', sellerId);
    expect(sellerConversation.status).toBe(200);
    expect(sellerConversation.body?.success).toBe(true);
    expect(sellerConversation.body?.data?.conversationId).toBe(conversationId);
    expect(sellerConversation.body?.data?.listingId).toBe(listingId);
    expect(sellerConversation.body?.data?.otherUserAvatar).toBe(sellerAvatar);

    const sellerMessages = await request(app)
      .get(`/api/messages/conversations/${conversationId}/messages`)
      .set('x-user-id', sellerId);
    expect(sellerMessages.status).toBe(200);
    expect(sellerMessages.body?.success).toBe(true);
    expect(Array.isArray(sellerMessages.body?.data)).toBe(true);
    expect(
      sellerMessages.body.data.some(
        (message: { text?: string; senderId?: string; recipientId?: string }) =>
          message.text === text && message.senderId === buyerId && message.recipientId === sellerId
      )
    ).toBe(true);
  });

  it('prevents seller from initiating message with listingId directly', async () => {
    const app = createTestApp();
    const sellerId = randomUUID();
    const listingId = randomUUID();

    await seedUser(sellerId, 'Seller Two');
    await seedListing(listingId, sellerId, `Laptop ${Date.now()}`);

    const response = await request(app)
      .post('/api/messages/send')
      .set('x-user-id', sellerId)
      .send({ listingId, text: 'seller init attempt' });

    expect(response.status).toBe(400);
    expect(response.body?.success).toBe(false);
  });
});
