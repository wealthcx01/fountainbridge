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
      APPROVALS_FIXTURE_DIR: 'e2e/fixtures/approvals',
      // FB-042. The heartbeat fixture is dated relative to E2E_NOW below, so the engine reads as
      // running rather than as stalled-for-six-months every time the real clock moves on.
      RUNREPORTS_FIXTURE_DIR: 'e2e/fixtures/runreports',
      // FB-064. Gated on E2E_TEST_LOGIN at the call site as well — this surface can MERGE.
      WORK_FIXTURE_DIR: 'e2e/fixtures/work',
      // FB-065. A recorded stream off the real ARCA box, including the inconsistent tool-call
      // indices the engine actually sends — so the UI gate proves the surface against what the
      // engine does, not against what its format says it should do.
      COMPOSER_FIXTURE: 'e2e/fixtures/composer/stream.sse',
      // The gate's shared secret. Without it every fixture grant reads `unattested` and a granted
      // spend silently reverts to "awaiting your OK" — which is the correct product behaviour
      // (FB-051) but means the e2e would never exercise the attested path at all. The fixture
      // grants are signed with THIS value; regenerate them with `make sign-approval-fixtures`.
      FOUNDRY_APPROVAL_SECRET: 'e2e-approval-secret-not-for-production',
      // Pin "now" so staleness is deterministic against the fixed-date health fixtures (FB-032).
      // arca's last activity is 2026-07-21 → active; thereset-platform's is 2026-01-10 → stale.
      E2E_NOW: '2026-07-22T00:00:00Z',
      STUDIO_ADMIN_EMAILS: 'john.gallagher@wealthcx.com',
      // FB-092: the email+password door, driven end to end by password-login.spec.ts. The hash is
      // for 'e2e-founder-password-not-for-production' — minted with scripts/mint-password-login.mjs
      // and safe to commit precisely because it is a hash of a test-only password.
      STUDIO_PASSWORD_LOGINS:
        'arca.founder@bruntsfield.capital=scrypt:16384:8:1:WOJHurNFM0_Pg9TJPpclNA:9hY2bijcoZlJ0eYUaNDtoQg-KLQ9v7ZyWjuX21SPIB8',
      AUTH_SECRET: 'e2e-test-secret-not-for-production',
      AUTH_TRUST_HOST: 'true',
      GOOGLE_CLIENT_ID: 'e2e-dummy',
      GOOGLE_CLIENT_SECRET: 'e2e-dummy',
    },
  },
});
