import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: process.platform === 'win32' ? 60000 : 15000,
    hookTimeout: 30000,
    maxWorkers: 2,
    expect: { poll: { timeout: process.platform === 'win32' ? 45000 : 5000 } },
    env: { LANG: 'en_US.UTF-8', LC_ALL: '' },
  },
  resolve: {
    alias: {
      '@yaroslavlky/mink-core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
    },
    dedupe: ['react', 'ink'],
  },
});
