import { randomUUID } from 'crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../../data/db';
import { inAppNotifications } from '../../features/admin/models/admin-settings';
import { users } from '../../features/users/models/users';
import { createTestApp } from '../setup/test-app';

describe('In-App Notifications API', () => {
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

  it('returns 401 when user identity is missing for user notification feed', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/notifications');

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });

  it('creates, reads, marks read, and verifies unread count for a user', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    const title = `Promo-${Date.now()}`;
    await seedUser(userId, 'Notify User');

    const create = await request(app).post('/api/admin/notifications/create').send({
      userId,
      title,
      message: 'New offer available',
      type: 'info',
      category: 'system',
    });

    expect(create.status).toBe(200);
    expect(create.body?.success).toBe(true);
    expect(typeof create.body?.id).toBe('string');

    const notificationId = String(create.body.id);

    const feed = await request(app).get('/api/notifications').query({ userId, limit: 20 });
    expect(feed.status).toBe(200);
    expect(feed.body?.success).toBe(true);
    expect(Array.isArray(feed.body?.data)).toBe(true);
    expect(
      feed.body.data.some(
        (item: { id?: string; title?: string; isRead?: boolean }) =>
          item.id === notificationId && item.title === title && item.isRead === false
      )
    ).toBe(true);

    const unreadBefore = await request(app)
      .get('/api/notifications/unread-count')
      .query({ userId });
    expect(unreadBefore.status).toBe(200);
    expect(unreadBefore.body?.success).toBe(true);
    expect(typeof unreadBefore.body?.count).toBe('number');
    expect(unreadBefore.body.count).toBeGreaterThanOrEqual(1);

    const markRead = await request(app)
      .post(`/api/notifications/${notificationId}/read`)
      .send({ userId });
    expect(markRead.status).toBe(200);
    expect(markRead.body?.success).toBe(true);

    const afterRead = await request(app).get('/api/notifications').query({ userId, limit: 20 });
    expect(afterRead.status).toBe(200);
    expect(afterRead.body?.success).toBe(true);
    expect(
      afterRead.body.data.some(
        (item: { id?: string; isRead?: boolean }) =>
          item.id === notificationId && item.isRead === true
      )
    ).toBe(true);
  });

  it('defaults in-app notifications to expire in about one day', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Expiry User');

    const before = Date.now();
    const create = await request(app).post('/api/admin/notifications/create').send({
      userId,
      title: `Expiry-${Date.now()}`,
      message: 'This notification should default to 1 day expiry',
      type: 'info',
      category: 'system',
    });

    expect(create.status).toBe(200);
    expect(create.body?.success).toBe(true);
    expect(typeof create.body?.id).toBe('string');

    const row = await db.query.inAppNotifications.findFirst({
      where: eq(inAppNotifications.id, String(create.body.id)),
    });

    expect(row).toBeTruthy();
    expect(row?.expiresAt).toBeTruthy();

    const expiresAtMs = new Date(String(row?.expiresAt)).getTime();
    const lowerBound = before + 23 * 60 * 60 * 1000;
    const upperBound = before + 25 * 60 * 60 * 1000;

    expect(expiresAtMs).toBeGreaterThanOrEqual(lowerBound);
    expect(expiresAtMs).toBeLessThanOrEqual(upperBound);
  });

  it('honors a custom expiry when one is provided', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Custom Expiry User');

    const customExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const create = await request(app).post('/api/admin/notifications/create').send({
      userId,
      title: `CustomExpiry-${Date.now()}`,
      message: 'This notification has a custom expiry',
      type: 'info',
      category: 'system',
      expiresAt: customExpiry.toISOString(),
    });

    expect(create.status).toBe(200);
    expect(create.body?.success).toBe(true);

    const row = await db.query.inAppNotifications.findFirst({
      where: eq(inAppNotifications.id, String(create.body.id)),
    });

    expect(row?.expiresAt).toBeTruthy();
    expect(Math.abs(new Date(String(row?.expiresAt)).getTime() - customExpiry.getTime())).toBeLessThan(
      5000
    );
  });

  it('supports read-all and admin stats endpoints', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Notify User Two');

    const n1 = await request(app)
      .post('/api/admin/notifications/create')
      .send({
        userId,
        title: `N1-${Date.now()}`,
        message: 'One',
      });
    const n2 = await request(app)
      .post('/api/admin/notifications/create')
      .send({
        userId,
        title: `N2-${Date.now()}`,
        message: 'Two',
      });

    expect(n1.status).toBe(200);
    expect(n2.status).toBe(200);

    const readAll = await request(app).post('/api/notifications/read-all').send({ userId });
    expect(readAll.status).toBe(200);
    expect(readAll.body?.success).toBe(true);

    const unread = await request(app).get('/api/notifications/unread-count').query({ userId });
    expect(unread.status).toBe(200);
    expect(unread.body?.success).toBe(true);
    expect(unread.body?.count).toBe(0);

    const stats = await request(app).get('/api/admin/notifications/stats');
    expect(stats.status).toBe(200);
    expect(stats.body?.success).toBe(true);
    expect(typeof stats.body?.data?.total).toBe('number');
    expect(typeof stats.body?.data?.unread).toBe('number');
  });

  it('supports mark-read by payload and broadcast visibility for all users', async () => {
    const app = createTestApp();
    const senderUserId = randomUUID();
    const receiverUserId = randomUUID();
    await seedUser(senderUserId, 'Broadcast Sender');
    await seedUser(receiverUserId, 'Broadcast Receiver');

    const title = `Broadcast-${Date.now()}`;
    const message = 'Visible to all users';
    const broadcast = await request(app).post('/api/admin/notifications/broadcast').send({
      userType: 'all',
      title,
      message,
      type: 'success',
      category: 'system',
    });

    expect(broadcast.status).toBe(200);
    expect(broadcast.body?.success).toBe(true);

    const senderFeed = await request(app).get('/api/notifications').query({ userId: senderUserId });
    const receiverFeed = await request(app)
      .get('/api/notifications')
      .query({ userId: receiverUserId });

    expect(senderFeed.status).toBe(200);
    expect(receiverFeed.status).toBe(200);
    expect(
      Array.isArray(senderFeed.body?.data) &&
        senderFeed.body.data.some((item: { title?: string; message?: string }) =>
          item.title === title && item.message === message
        )
    ).toBe(true);
    expect(
      Array.isArray(receiverFeed.body?.data) &&
        receiverFeed.body.data.some((item: { title?: string; message?: string }) =>
          item.title === title && item.message === message
        )
    ).toBe(true);

    const directTitle = `Direct-${Date.now()}`;
    const directMessage = 'Direct notification for payload read';
    const directCreate = await request(app).post('/api/admin/notifications/create').send({
      userId: senderUserId,
      title: directTitle,
      message: directMessage,
      type: 'info',
      category: 'system',
    });

    expect(directCreate.status).toBe(200);
    expect(directCreate.body?.success).toBe(true);

    const notificationId = String(directCreate.body.id);
    const markRead = await request(app).post('/api/notifications/mark-read').send({
      userId: senderUserId,
      notificationId,
      title: directTitle,
      message: directMessage,
      category: 'system',
      type: 'info',
    });
    expect(markRead.status).toBe(200);
    expect(markRead.body?.success).toBe(true);

    const afterMark = await request(app).get('/api/notifications').query({ userId: senderUserId });
    expect(
      Array.isArray(afterMark.body?.data) &&
        afterMark.body.data.some(
          (item: { id?: string; isRead?: boolean }) => item.id === notificationId && item.isRead
        )
    ).toBe(true);
  });

  it('hides expired notifications from the feed and cleanup removes them', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Expired User');

    const expiresAt = new Date(Date.now() - 60 * 60 * 1000);
    const expiredTitle = `Expired-${Date.now()}`;
    const create = await request(app).post('/api/admin/notifications/create').send({
      userId,
      title: expiredTitle,
      message: 'This notification is already expired',
      type: 'warning',
      category: 'system',
      expiresAt: expiresAt.toISOString(),
    });

    expect(create.status).toBe(200);
    expect(create.body?.success).toBe(true);

    const feed = await request(app).get('/api/notifications').query({ userId });
    expect(feed.status).toBe(200);
    expect(feed.body?.success).toBe(true);
    expect(
      Array.isArray(feed.body?.data) &&
        feed.body.data.every((item: { title?: string }) => item.title !== expiredTitle)
    ).toBe(true);

    const cleanup = await request(app).post('/api/admin/notifications/cleanup');
    expect(cleanup.status).toBe(200);
    expect(cleanup.body?.success).toBe(true);
    expect(typeof cleanup.body?.deletedCount).toBe('number');
    expect(cleanup.body.deletedCount).toBeGreaterThanOrEqual(1);
  });

  it('returns only the latest 50 notifications in the user feed', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Feed Limit User');

    for (let i = 0; i < 55; i += 1) {
      const response = await request(app).post('/api/admin/notifications/create').send({
        userId,
        title: `Feed-${i}-${Date.now()}`,
        message: `Notification ${i}`,
        type: 'info',
        category: 'system',
      });
      expect(response.status).toBe(200);
    }

    const feed = await request(app).get('/api/notifications').query({ userId });
    expect(feed.status).toBe(200);
    expect(feed.body?.success).toBe(true);
    expect(Array.isArray(feed.body?.data)).toBe(true);
    expect(feed.body.data).toHaveLength(50);
    expect(String(feed.body.data[0]?.title || '')).toContain('Feed-54-');
    expect(String(feed.body.data[49]?.title || '')).toContain('Feed-5-');
  });
});
