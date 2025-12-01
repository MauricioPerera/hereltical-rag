import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/skills/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/fixtures/**',
        '**/types.ts'
      ],
      reportsDirectory: './coverage'
    },
    // Timeout for async tests
    testTimeout: 10000,
    // Run tests in sequence for DB consistency
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});

