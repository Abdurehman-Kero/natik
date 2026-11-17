import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests: need PostgreSQL and Redis (pnpm services:up, or CI service containers).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.int-spec.ts'],
    environment: 'node',
    globalSetup: ['src/test/global-setup.ts'],
    setupFiles: ['src/test/load-env.ts'],
    testTimeout: 20_000,
    // Starting the whole app (database, Redis, queues) can take a while on a busy laptop.
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
