import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
    hookTimeout: 30000,
    maxWorkers: 2,
    env: { LANG: 'en_US.UTF-8', LC_ALL: '' },
  },
  resolve: {
    alias: { '@mink/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname },
  },
});
