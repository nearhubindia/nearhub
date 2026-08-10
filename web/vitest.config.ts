import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import viteConfig from './vite.config';

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/features/**/*.test.ts', 'src/features/**/*.test.tsx'],
      passWithNoTests: true,
      testTimeout: 10_000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'src/features/admin/utils/**/*.ts',
          'src/features/landing/lib/**/*.ts',
          'src/lib/auth-redirect.ts',
          'src/lib/category-display.ts',
          'src/lib/deal-timer.ts',
          'src/lib/ist-time.ts',
          'src/lib/web-auth-storage.ts',
          'src/lib/web-geo-storage.ts',
        ],
        exclude: [
          'src/features/**/index.ts',
          'src/features/**/index.tsx',
          'src/features/**/types.ts',
          'src/features/**/types/**/*.ts',
        ],
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
        '@': path.resolve(webRoot, './src'),
      },
    },
  })
);
