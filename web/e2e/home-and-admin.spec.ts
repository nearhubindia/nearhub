import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.url().includes('/api/admin/login')) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid email or password' }),
      });
      return;
    }

    if (request.url().includes('/api/listings')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'listing-1',
              title: 'Pixel Phone Near You',
              category: 'Mobiles',
              price: 25000,
              location: 'Vijayawada',
              status: 'active',
              isActive: true,
              images: ['/nearhub.png'],
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
});

test('loads the public home feature', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/NearHub/i);
  await expect(page.getByAltText('NearHub AI-powered local marketplace')).toBeVisible();
  await expect(page.getByText('Featured Listings', { exact: true })).toBeVisible();
});

test('validates the admin login feature against an API response', async ({ page }) => {
  await page.goto('/admin/login');

  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  await page.getByPlaceholder('••••••••').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
});

test('protects admin routes and preserves public route redirects', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

  await page.goto('/browse');
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('heading', { name: /Browse Local Deals/ })).toBeVisible();
});

test('searches, filters, and renders a listing from the public API', async ({ page }) => {
  await page.goto('/search?q=phone');

  await expect(page.getByRole('heading', { name: /Browse Local Deals/ })).toBeVisible();
  await expect(page.getByText('Pixel Phone Near You')).toBeVisible();
  await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
  await expect(page).toHaveURL(/category=Vehicles/);
});

test('shows a resilient error state when listing search fails', async ({ page }) => {
  await page.route('**/api/listings**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'offline' }),
    });
  });
  await page.goto('/search');
  await expect(page.getByText('Could not load listings right now.')).toBeVisible();
});

test('submits the contact form and renders the success state', async ({ page }) => {
  await page.goto('/contact');
  await page.getByPlaceholder('John Doe').fill('NearHub QA');
  await page.getByPlaceholder('john@example.com').fill('qa@example.com');
  await page.getByPlaceholder('9876543210').fill('9876543210');
  await page.getByPlaceholder('How can we help?').fill('Test support request');
  await page
    .getByPlaceholder('Tell us about your use case...')
    .fill('Testing the public contact workflow.');
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(
    page.getByText('Message sent successfully. Our team will get back to you soon.')
  ).toBeVisible();
});
