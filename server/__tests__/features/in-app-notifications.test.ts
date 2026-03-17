import { randomUUID } from 'crypto';
import request from 'supertest';
import { db } from '../../data/db';
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

    const unreadBefore = await request(app).get('/api/notifications/unread-count').query({ userId });
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
        (item: { id?: string; isRead?: boolean }) => item.id === notificationId && item.isRead === true
      )
    ).toBe(true);
  });

  it('supports read-all and admin stats endpoints', async () => {
    const app = createTestApp();
    const userId = randomUUID();
    await seedUser(userId, 'Notify User Two');

    const n1 = await request(app).post('/api/admin/notifications/create').send({
      userId,
      title: `N1-${Date.now()}`,
      message: 'One',
    });
    const n2 = await request(app).post('/api/admin/notifications/create').send({
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
});
