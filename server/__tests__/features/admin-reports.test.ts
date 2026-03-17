import request from 'supertest';
import { createTestApp } from '../setup/test-app';

describe('Admin Reports API', () => {
  const reportEndpoints = [
    '/api/admin/reports/recent-activity',
    '/api/admin/reports/growth',
    '/api/admin/reports/performance',
    '/api/admin/reports/transaction',
    '/api/admin/reports/moderation',
    '/api/admin/revenue',
  ];

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

  describe('Authentication', () => {
    it.each(reportEndpoints)('returns 401 for unauthenticated access: %s', async (endpoint) => {
      const app = createTestApp();
      const response = await request(app).get(endpoint);

      expect(response.status).toBe(401);
      expect(response.body?.success).toBe(false);
    });

    it.each(reportEndpoints)('returns 401 for invalid token: %s', async (endpoint) => {
      const app = createTestApp();
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body?.success).toBe(false);
    });
  });

  describe('Response Shape', () => {
    it('returns recent activity list', async () => {
      const app = createTestApp();
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get('/api/admin/reports/recent-activity')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(Array.isArray(response.body?.activities)).toBe(true);
      expect(response.body.activities.length).toBeLessThanOrEqual(10);
    });

    it('returns growth report with numeric summary and chart arrays', async () => {
      const app = createTestApp();
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get('/api/admin/reports/growth')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(typeof response.body?.totalUsers).toBe('number');
      expect(typeof response.body?.activeListings).toBe('number');
      expect(typeof response.body?.totalTransactions).toBe('number');
      expect(typeof response.body?.revenue).toBe('number');
      expect(typeof response.body?.usersTrend).toBe('string');
      expect(typeof response.body?.listingsTrend).toBe('string');
      expect(typeof response.body?.transactionsTrend).toBe('string');
      expect(typeof response.body?.revenueTrend).toBe('string');
      expect(Array.isArray(response.body?.chartData)).toBe(true);
      expect(Array.isArray(response.body?.categoryData)).toBe(true);
      expect(response.body?.data).toBeDefined();
    });

    it('returns performance report with top listings and categories', async () => {
      const app = createTestApp();
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get('/api/admin/reports/performance')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(Array.isArray(response.body?.topListings)).toBe(true);
      expect(Array.isArray(response.body?.topCategories)).toBe(true);
      expect(response.body?.data?.summary).toBeDefined();
      expect(typeof response.body?.data?.summary?.avgViewsPerListing).toBe('number');
    });

    it('returns transaction report with summary and transaction list', async () => {
      const app = createTestApp();
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get('/api/admin/reports/transaction')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(Array.isArray(response.body?.transactions)).toBe(true);
      expect(typeof response.body?.summary?.totalRevenue).toBe('number');
      expect(typeof response.body?.summary?.totalTransactions).toBe('number');
      expect(typeof response.body?.summary?.avgTransactionValue).toBe('number');
    });

    it('returns moderation report with summary', async () => {
      const app = createTestApp();
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get('/api/admin/reports/moderation')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(Array.isArray(response.body?.reports)).toBe(true);
      expect(typeof response.body?.data?.summary?.pendingReports).toBe('number');
      expect(typeof response.body?.data?.summary?.resolvedReports).toBe('number');
      expect(typeof response.body?.data?.summary?.chatConversations).toBe('number');
    });

    it('returns revenue report with totals, trend and monthly data', async () => {
      const app = createTestApp();
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get('/api/admin/revenue')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(typeof response.body?.totalRevenue).toBe('number');
      expect(typeof response.body?.subscriptionRevenue).toBe('number');
      expect(typeof response.body?.transactionFees).toBe('number');
      expect(typeof response.body?.totalTrend).toBe('string');
      expect(Array.isArray(response.body?.monthlyData)).toBe(true);
      expect(response.body?.data).toBeDefined();
    });
  });
});
