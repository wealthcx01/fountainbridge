import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-042: what the engine did, and the brief that tells the founder what to do about it.
 *
 * The fixtures (`e2e/fixtures/runreports/`) deliberately include BOTH record shapes — the lane's
 * own, which is what has actually been on the state ref since FB-040, and the bcap-contracts shape
 * the writer will migrate to. If the reader ever stops understanding the legacy one, the studio goes
 * blind to every report already written, and this catches it.
 *
 * "now" is pinned by E2E_NOW (2026-07-22T00:00:00Z); the heartbeat fixture is 10 minutes before it.
 */
test.describe('run reports and the founder brief', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('the brief leads with what needs the founder, not with what is newest', async ({ page }) => {
    const brief = page.getByTestId('founder-brief');
    await expect(brief).toBeVisible();
    // arca's approval fixture has a proposal awaiting the gate, so that outranks everything.
    await expect(page.getByTestId('brief-headline')).toContainText('needs you');
    const first = page.getByTestId('brief-lines').locator('li').first();
    await expect(first).toContainText('waiting for your approval');
    await expect(first).toContainText('Nothing has been sent.');
  });

  test('a blocked run is named with its reason, in the founder\'s language', async ({ page }) => {
    const lines = page.getByTestId('brief-lines');
    await expect(lines).toContainText('ARCA-31');
    // The reason is the entire point — a count of blocked things is not actionable.
    await expect(lines).toContainText('needs a human');
    await expect(lines.locator('li[data-tone="blocked"]').first()).toBeVisible();
  });

  test('the activity strip shows what each lane did, across department repos', async ({ page }) => {
    const activity = page.getByTestId('lane-activity');
    await expect(activity).toBeVisible();
    const list = page.getByTestId('lane-activity-list');
    // Newest first across BOTH repos: the Sell run (18:00) precedes the arca ones (16:00, 14:00).
    await expect(list.locator('li').nth(0)).toContainText('waiting for your approval');
    await expect(list.locator('li').nth(0)).toContainText('SELL-002');
    await expect(list.locator('li').nth(1)).toContainText('ARCA-31');
    await expect(list.locator('li').nth(2)).toContainText('opened a pull request');
    // The contract-shaped record parsed as well as the lane-shaped ones.
    await expect(list.locator('li[data-outcome="awaiting-approval"]')).toHaveCount(1);
  });

  test('the engine reports itself as running, from the heartbeat alone', async ({ page }) => {
    const engine = page.getByTestId('engine-state');
    await expect(engine).toHaveAttribute('data-engine-state', 'running');
    await expect(engine).toContainText('checked in');
  });

  test('a run that opened a pull request links to it', async ({ page }) => {
    const link = page.getByTestId('lane-activity-list').locator('a').first();
    await expect(link).toHaveAttribute('href', /pull\/12/);
  });

  test('the heartbeat is not shown as work', async ({ page }) => {
    // It is a liveness beacon overwritten on every wake, not run history — showing it would fill the
    // strip with "woke up, did nothing" and bury the runs that matter.
    await expect(page.getByTestId('lane-activity-list')).not.toContainText('heartbeat');
    await expect(page.getByTestId('lane-activity-list').locator('li')).toHaveCount(3);
  });
});
