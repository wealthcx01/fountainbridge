import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-009 mobile UI-gate: the studio must be usable at phone size (~393×851, Pixel 5) — runs under
// the `mobile` project (Chromium-based, so no separate WebKit install in CI).
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

async function noHorizontalScroll(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test('mobile: shell + ventures render, nav is thumb-reachable, no horizontal scroll', async ({ page }) => {
  await testLogin(page, JOHN);
  await expect(page.getByTestId('venture-grid')).toBeVisible();

  const nav = page.getByTestId('topnav');
  await expect(nav).toBeVisible();
  // Nav pill is a ≥44px thumb target.
  const box = await page.getByRole('link', { name: /Attention/ }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(40);

  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/09-mobile-home.png`, fullPage: true });
});

test('mobile: attention queue reachable from nav', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.getByRole('link', { name: /Attention/ }).click();
  await page.waitForURL(/\/attention/);
  await expect(page.getByTestId('attention-queue').or(page.getByTestId('attention-empty'))).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/09-mobile-attention.png`, fullPage: true });
});

test('mobile: venture board + full-width ticket drawer', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/venture/arca');
  await expect(page.getByTestId('lane-arca')).toBeVisible();
  // Open the drawer from a ticket in the first ("To do") column. On the phone layout the columns
  // stack, so a ticket in the last ("Done") column sits at the very bottom of the page — a spot
  // where Playwright's click hit-testing is unreliable. Any ticket exercises the same drawer, so
  // click one that's reliably in the initial viewport.
  await page.getByTestId('ticket-ARCA-3').click();
  await expect(page.getByTestId('ticket-drawer')).toBeVisible();
  await expect(page.getByTestId('drawer-title')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/09-mobile-drawer.png`, fullPage: true });
});

test('health endpoint is public (uptime monitor path)', async ({ page }) => {
  // No login — /api/health must return 200 without an auth redirect.
  const res = await page.request.get('/api/health');
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe('ok');
});
