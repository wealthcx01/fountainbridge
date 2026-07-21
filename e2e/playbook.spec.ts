import { test, expect } from '@playwright/test';

// FB-013: the public educational landing + playbook, and the auth boundary that must still hold.
const SHOTS = 'e2e/__screenshots__';

test('landing shows the educational soft-intro + chapters (public, no login)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('landing')).toBeVisible();
  await expect(page.getByTestId('landing-intro')).toBeVisible();
  await expect(page.getByTestId('landing-chapters')).toBeVisible();
  await expect(page.getByTestId('chapter-moats')).toBeVisible();
  await expect(page.getByTestId('nav-signin')).toBeVisible(); // header shows a way in, not studio nav
  await page.screenshot({ path: `${SHOTS}/10-landing.png`, fullPage: true });
});

test('playbook index + a section render publicly, with cross-links', async ({ page }) => {
  await page.goto('/playbook');
  await expect(page.getByTestId('playbook-index')).toBeVisible();
  await page.getByTestId('pb-build-arc').click();
  await page.waitForURL(/\/playbook\/build-arc$/);
  await expect(page.getByTestId('playbook-section')).toBeVisible();
  await expect(page.getByText('Who is your customer?', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/10-playbook-section.png`, fullPage: true });
});

test('auth boundary still holds — a signed-out visitor cannot reach the studio', async ({ page }) => {
  await page.goto('/attention');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});
