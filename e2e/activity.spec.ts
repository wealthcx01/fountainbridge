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

test('Activity is what happened, not repository administration (FB-080)', async ({ page }) => {
  // The page was called "CI & activity" and opened, per repository, with "no CI runs · unprotected ·
  // active". Branch-protection state labelled as Activity, 3.3 screens of it.
  await testLogin(page, 'ross@bruntsfield.capital');
  await page.goto('/activity');
  const body = (await page.locator('body').textContent()) ?? '';

  expect(body).not.toContain('CI & activity');
  expect(body).not.toContain('unprotected');
  expect(body).not.toContain('no CI runs');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What has been happening');
});

test('the administration is not deleted, it is shown to Bruntsfield (FB-080)', async ({ page }) => {
  // It is real and John needs it. A founder should not have to learn what branch protection is to
  // read their own company's news.
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/activity');
  await expect(page.getByText('Repository health')).toBeVisible();
  // And still below the news, not in front of it.
  const news = await page.getByRole('heading', { name: 'Last 14 days' }).boundingBox();
  const admin = await page.getByText('Repository health').boundingBox();
  expect(admin!.y).toBeGreaterThan(news!.y);
});

/**
 * FB-096 — "merged" does not mean what the founder thinks it means.
 *
 * The feed said MERGED — Replace Bloomberg/Pokemon tagline, three days before the founder opened
 * their product and found the old tagline still there. What merged was the REQUEST.
 */
test.describe('the feed says what actually happened (FB-096)', () => {
  test('a ticket-only change reads as a request, never as shipped work', async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/activity');
    const filing = page.getByTestId('activity-pr-merged').first();
    await expect(filing).toContainText('Card animation polish');
    await expect(filing).toContainText('asked for');
    await expect(filing).not.toContainText('shipped');
  });

  test('a change to the product reads as shipped', async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/activity');
    await expect(page.getByTestId('activity-feed')).toContainText('shipped');
  });

  test('one merge is one row', async ({ page }) => {
    // Every MERGED row was shadowed by a COMMIT row saying the same words.
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/activity');
    await expect(page.getByTestId('activity-feed').getByText('Card animation polish')).toHaveCount(1);
  });

  test('the founder’s feed has no housekeeping, and says that it does not', async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/activity');
    await expect(page.getByTestId('activity-feed')).not.toContainText('seed: arca-ops');
    await expect(page.getByTestId('activity-hidden')).toContainText('housekeeping');
  });

  test('Bruntsfield still sees the housekeeping', async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/activity');
    await expect(page.getByTestId('activity-feed')).toContainText('seed: arca-ops');
  });

  test('a filing whose work later parked says so where the founder asked', async ({ page }) => {
    // "Whatever happened to the tagline fix?" — the answer has to be on the row that raised it.
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/activity');
    await expect(page.getByTestId('activity-parked')).toContainText('needs a person');
  });
});
