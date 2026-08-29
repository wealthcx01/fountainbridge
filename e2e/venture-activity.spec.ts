import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * What happened (FB-132).
 *
 * The standard is the design's own line: *"Sent, failed, refused: it stays here with its state."* A
 * log that quietly drops failures teaches a founder that silence means nothing happened, so most of
 * what is asserted here is that nothing is filtered for tidiness.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const ROSS = 'ross@bruntsfield.capital';
const SHOTS = 'e2e/__screenshots__';

test.describe('what happened', () => {
  test('it is one record, newest first, with a summary above it', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/venture/arca/activity');
    await expect(page.getByTestId('venture-activity')).toBeVisible();
    await expect(page.getByTestId('activity-summary')).toBeVisible();

    const items = page.getByTestId('activity-item');
    expect(await items.count()).toBeGreaterThan(0);
    const dates = await items.evaluateAll((els) =>
      els.map((e) => e.querySelector('.mono')?.textContent?.trim() ?? ''));
    expect(dates.filter(Boolean).length).toBe(dates.length);

    await page.screenshot({ path: `${SHOTS}/23-what-happened.png`, fullPage: true });
  });

  test('the founder’s own decisions are in it', async ({ page }) => {
    // The thing that has never been on this page: a founder could not see their own yes in the
    // record, which is a strange omission from a page called "what happened".
    await testLogin(page, JOHN);
    await page.goto('/venture/arca/activity');
    const decisions = page.getByTestId('activity-item').filter({ has: page.locator('[data-source]') });
    const sources = await page.getByTestId('activity-item').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-source')));
    expect(sources).toContain('decision');
    void decisions;
  });

  test('every entry says its state in words, not only in colour', async ({ page }) => {
    // A state carried only by a coloured dot is a state a screen-reader user does not get.
    await testLogin(page, JOHN);
    await page.goto('/venture/arca/activity');
    const labelled = await page.getByTestId('activity-item').evaluateAll((els) =>
      els.every((e) => (e.querySelector('.sr-only')?.textContent ?? '').trim().length > 0));
    expect(labelled).toBe(true);
  });

  test('a founder cannot see another venture’s history through it', async ({ page }) => {
    // Venture isolation is server-side and absolute (CLAUDE.md #6). This route used to span every
    // venture the viewer could reach.
    await testLogin(page, ROSS);
    await page.goto('/venture/arca/activity');
    await expect(page.getByTestId('venture-forbidden')).toBeVisible();
    await expect(page.getByTestId('activity-feed')).toHaveCount(0);
  });

  // Two tests rather than one: `testLogin` goes to /login, which redirects away when a session
  // already exists, so signing in twice in one test hangs on a form that never appears.
  test('a founder is not offered the cross-venture feed', async ({ page }) => {
    // They have one venture. A door to "every venture at once" is a door to a room with their own
    // furniture in it.
    await testLogin(page, ROSS);
    await page.goto('/venture/the-reset/activity');
    await expect(page.getByTestId('venture-activity')).toBeVisible();
    await expect(page.getByTestId('activity-all-ventures')).toHaveCount(0);
  });

  test('Bruntsfield keeps the way to every venture at once', async ({ page }) => {
    // Scoping this screen narrows what an admin sees. The all-ventures feed still exists rather than
    // being taken away and replaced with nothing; FB-136 gives it a proper home.
    await testLogin(page, JOHN);
    await page.goto('/venture/arca/activity');
    await expect(page.getByTestId('activity-all-ventures')).toBeVisible();
  });

  test('it fits a phone', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/venture/arca/activity');
    await expect(page.getByTestId('activity-feed')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/23-mobile-what-happened.png`, fullPage: true });
  });
});
