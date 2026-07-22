import { test, expect, type Page } from '@playwright/test';

// The three FB-005 acceptance cases, end to end against a running server:
//   1. John (admin) → all ventures
//   2. Ross (the-reset founder) → only the-reset
//   3. an unlisted account → refused
// Each captures a screenshot into e2e/__screenshots__ for the PR UI-gate gallery.

const SHOTS = 'e2e/__screenshots__';

async function testLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('e2e-email').fill(email);
  await page.getByTestId('e2e-submit').click();
  // Leave /login once the session is set — either to '/' or a redirect (e.g. /not-authorized).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test('admin (John) sees every venture', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('venture-grid')).toBeVisible();
  await expect(page.getByTestId('venture-arca')).toBeVisible();
  await expect(page.getByTestId('venture-the-reset')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-admin-all-ventures.png`, fullPage: true });
});

test('founder (Ross) sees only the-reset', async ({ page }) => {
  await testLogin(page, 'ross@bruntsfield.capital');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('venture-the-reset')).toBeVisible();
  await expect(page.getByTestId('venture-arca')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/02-founder-scoped.png`, fullPage: true });
});

test('an unlisted account is refused', async ({ page }) => {
  await testLogin(page, 'stranger@example.com');
  await expect(page).toHaveURL(/\/not-authorized$/);
  await expect(page.getByTestId('not-authorized')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-not-authorized.png`, fullPage: true });
});

test('signed-out visitor is sent to login (no public pages, FB-015)', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await expect(page.getByTestId('venture-grid')).toHaveCount(0); // studio data never shown signed-out
  await page.screenshot({ path: `${SHOTS}/04-login.png`, fullPage: true });
});

test('middleware gates a placeholder route for a signed-out visitor', async ({ page }) => {
  // Proves the `authorized` callback is wired: /lanes has no page-level guard of its own yet,
  // so it must be the middleware that redirects an unauthenticated request to /login.
  await page.goto('/lanes');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});
