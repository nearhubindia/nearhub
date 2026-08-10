import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const host = '127.0.0.1';
const port = Number(process.env.WEB_PORT || 4173);
const baseURL = `http://${host}:${port}`;
const reuseExistingServer = process.env.PW_REUSE_SERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'test-results/html', open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  expect: {
    timeout: 15_000,
  },
  webServer: {
    cwd: webRoot,
    command: `npm run e2e:build && npm run e2e:start -- --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
    env: {
      VITE_API_URL: 'http://127.0.0.1:5000',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  outputDir: path.resolve(webRoot, 'test-results/artifacts'),
});
