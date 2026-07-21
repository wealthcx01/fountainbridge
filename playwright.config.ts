import { defineConfig, devices } from '@playwright/test';

// FB-005 UI-gate: builds the app and drives the three authorization cases against a real server.
// The server runs with E2E_TEST_LOGIN=1 so the credentials provider can sign in as any email
// (never enabled in production). Screenshots land in e2e/__screenshots__ and are uploaded as a CI
// artifact (the "gallery per PR"). Google client vars are dummies — e2e uses the test provider.
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    // FB-009: the mobile UI-gate at phone size (~393×851). Pixel 5 is Chromium-based, so it runs on
    // the same browser CI installs (iPhone/WebKit would need a separate webkit install).
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      E2E_TEST_LOGIN: '1',
      E2E_TEST_LOGIN_SECRET: 'e2e-playwright-shared-secret',
      TICKETS_FIXTURE_DIR: 'e2e/fixtures/tickets',
      PRS_FIXTURE_DIR: 'e2e/fixtures/prs',
      HEALTH_FIXTURE_DIR: 'e2e/fixtures/health',
      STUDIO_ADMIN_EMAILS: 'john.gallagher@wealthcx.com',
      AUTH_SECRET: 'e2e-test-secret-not-for-production',
      AUTH_TRUST_HOST: 'true',
      GOOGLE_CLIENT_ID: 'e2e-dummy',
      GOOGLE_CLIENT_SECRET: 'e2e-dummy',
    },
  },
});
