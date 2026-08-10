import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedVitestConfig } from './vitest.shared';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['features/**/tests/**/*.test.ts'],
    },
  })
);
