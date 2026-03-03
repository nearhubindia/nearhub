const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['@/features/*/{components,hooks,screens,services,utils,types,pages}/*'],
              message:
                'Avoid deep feature imports. Import via the feature public API (index.ts) to keep boundaries clean.',
            },
          ],
        },
      ],
    },
  },
]);
