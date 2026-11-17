import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * End-to-end tests. Locally and in CI they run against a production build
 * (`pnpm build` first). M8 adds an iPhone (WebKit) project for device checks.
 */
export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  // The API hashes passwords and stores uploads on this same machine; more than 3 browsers at once
  // makes sign-in slower than the 5-second checks on a typical laptop.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // 320 px is the smallest phone the SRS requires (§2.4, FR-UI-002).
  projects: [
    { name: 'phone-320', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 640 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  // The browser tests use the real API, database and Redis (pnpm services:up, then pnpm db:seed).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node dist/main.js',
          cwd: '../api',
          url: 'http://localhost:4000/api/v1/health',
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            APP_ENV: 'local',
            RUN_WORKER_IN_API: 'true',
            RATE_LIMIT_MULTIPLIER: '100',
            LOG_LEVEL: 'warn',
          },
        },
        {
          command: `pnpm exec next start --port ${PORT}`,
          url: baseURL,
          // Always start fresh: a leftover server would serve an older build.
          reuseExistingServer: false,
          timeout: 120_000,
          env: { APP_ENV: 'local', API_INTERNAL_URL: 'http://localhost:4000' },
        },
      ],
});
