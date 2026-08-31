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
  const box = await page.getByRole('link', { name: /Needs you/ }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(40);

  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/09-mobile-home.png`, fullPage: true });
});

test('mobile: attention queue reachable from nav', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.getByRole('link', { name: /Needs you/ }).click();
  await page.waitForURL(/\/attention/);
  await expect(page.getByTestId('attention-queue').or(page.getByTestId('attention-empty'))).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/09-mobile-attention.png`, fullPage: true });
});

test('mobile: the venture shell fits the phone it is on', async ({ page }) => {
  // FB-124 shipped a 250px rail with no phone handling: 620px of content in a 390px viewport,
  // horizontal scrolling, and — because the rail hides the top bar — no navigation at all. Every
  // unit test, every linter and the build were green. Only a browser at 390px could see it.
  await testLogin(page, JOHN);
  await page.goto('/venture/arca');
  await expect(page.getByTestId('lane-arca')).toBeVisible();

  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(scrollW, `horizontal scroll: ${scrollW} > ${clientW}`).toBeLessThanOrEqual(clientW + 1);

  // And there is still a way to move around. A hidden rail with no fallback is worse than no rail.
  await expect(page.getByTestId('topnav')).toBeVisible();
  await expect(page.getByTestId('rail')).toBeHidden();
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






/**
 * FB-158 — the rail's waiting shell is not the rail, and neither belongs on a phone.
 *
 * While a Suspense boundary resolves, the fallback and the streamed content are both in the document
 * for an instant. Sharing one test id made "is the rail there?" un-askable and the mobile check a
 * coin flip — and then giving the shell its own id took it out of the phone media query, because
 * that rule keyed on the test id rather than the class. A 250px rail came back on a 393px screen:
 * FB-124's defect, returning through a test id.
 */
test('the rail and its waiting shell are never the same thing', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/venture/arca');
  await expect(page.getByTestId('lane-arca')).toBeVisible();
  await expect(page.getByTestId('rail')).toHaveCount(1);
  await expect(page.getByTestId('rail-waiting')).toHaveCount(0);
});

test('neither the rail nor its shell is ever on the phone', async ({ page }) => {
  await testLogin(page, JOHN);
  // Measured at domcontentloaded, when the shell is most likely to still be up — the moment CI
  // caught and a warm local server did not.
  await page.goto('/venture/arca', { waitUntil: 'domcontentloaded' });
  const widestAtLoad = await page.evaluate(() =>
    Math.max(0, ...[...document.querySelectorAll('.rail')].map((e) => e.getBoundingClientRect().right)));
  expect(widestAtLoad, 'a rail or its shell is drawn on the phone').toBeLessThanOrEqual(1);

  await expect(page.getByTestId('lane-arca')).toBeVisible();
  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(scrollW, `horizontal scroll: ${scrollW} > ${clientW}`).toBeLessThanOrEqual(clientW + 1);
});
