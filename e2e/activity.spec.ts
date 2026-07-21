import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-008: CI health strips, activity feed, and the staleness flag (on /activity and the board).
// Runs against fixture health data (HEALTH_FIXTURE_DIR).
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

test('health strips show CI status, branch protection, and staleness', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/activity');

  // arca — active, protected, CI green.
  await expect(page.getByTestId('health-arca')).toBeVisible();
  await expect(page.getByTestId('health-run-arca')).toContainText('success');
  await expect(page.getByTestId('health-protection-arca')).toHaveText('protected');
  await expect(page.getByTestId('health-active-arca')).toBeVisible();

  // thereset-platform — stale, unprotected, CI failing.
  await expect(page.getByTestId('health-stale-thereset-platform')).toBeVisible();
  await expect(page.getByTestId('health-protection-thereset-platform')).toHaveText('unprotected');
  await expect(page.getByTestId('health-run-thereset-platform')).toContainText('failure');

  await page.screenshot({ path: `${SHOTS}/08-activity-health.png`, fullPage: true });
});

test('activity feed lists recent events and filters by repo', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/activity');
  await expect(page.getByTestId('activity-feed')).toBeVisible();
  await expect(page.getByTestId('activity-pr-merged').first()).toBeVisible();

  // Filter to a repo with no recent activity → empty.
  await page.getByTestId('filter-thereset-platform').click();
  await expect(page.getByTestId('activity-empty')).toBeVisible();
});

test('staleness flag surfaces on the venture board (FB-006 integration)', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/venture/the-reset');
  await expect(page.getByTestId('lane-stale-thereset-platform')).toBeVisible();
});

test('an active venture shows no staleness flag', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/venture/arca');
  await expect(page.getByTestId('lane-arca')).toBeVisible();
  await expect(page.getByTestId('lane-stale-arca')).toHaveCount(0);
});
