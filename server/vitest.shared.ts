import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.dirname(fileURLToPath(import.meta.url));

export const sharedVitestConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'features/auth/services/web-auth.ts',
        'features/listings/lib/deal-status.ts',
        'features/listings/lib/ist-time.ts',
        'features/listings/services/listing-classification.ts',
        'features/payments/services/dynamic-pricing.ts',
        'features/search/services/distance.ts',
        'features/subscriptions/services/pricing.ts',
        'features/users/services/spam-detector.ts',
        'features/valuations/services/device-intelligence.ts',
        'features/valuations/services/evidence-validator.ts',
      ],
      exclude: ['features/**/index.ts', 'features/**/tests/**'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': serverRoot,
    },
  },
});
