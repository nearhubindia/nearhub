export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest-setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'features/**/*.ts',
    '!features/**/*.test.ts',
    '!features/**/__tests__/**',
    '!**/node_modules/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^\\.\\./(\\.\\./)*(shared/ai/ai)$': '<rootDir>/__mocks__/shared/ai/ai.ts',
  },
  testTimeout: 15000,
  verbose: true,
  bail: false,
  maxWorkers: 1,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
};
