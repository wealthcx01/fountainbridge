import { defineConfig, devices } from "@playwright/test";

// FB-005 UI-gate: drives the studio shell in a real browser for the auth-scoping cases and the
// screenshot gallery. Boots the app with dev-login enabled so scoping is testable without real
// Google OAuth credentials in CI.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Chromium-only so CI needs a single browser download. "Pixel 5" is a chromium mobile
    // emulation (iPhone descriptors use WebKit); the real mobile pass is FB-009.
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    // Run the dev server (NODE_ENV=development) so the guarded dev-login is active for tests; the
    // production build keeps dev-login inert (STUDIO_DEV_LOGIN only works when NODE_ENV != production).
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      STUDIO_DEV_LOGIN: "1",
      STUDIO_SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-32",
      BRUNTSFIELD_ADMIN_EMAILS: "john.gallagher@wealthcx.com",
    },
  },
});
