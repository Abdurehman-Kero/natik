import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit tests: no database or Redis needed. SWC keeps decorator metadata for NestJS DI.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
