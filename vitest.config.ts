import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: [
      'tests/ui/**',
      'tests/uat/**',
      'tests/functional/ingestion.test.ts',
      'tests/edge/data-corruption.test.ts',
      'tests/edge/performance.test.ts',
      'tests/edge/external-failure.test.ts',
      'node_modules',
      'dist',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@tests': path.resolve(__dirname, 'tests'),
      '@mocks': path.resolve(__dirname, 'tests/mocks'),
    },
  },
  // Mock external dependencies for testing
  optimizeDeps: {
    exclude: ['@playwright/test'],
  },
});
