import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * Day one (FB-066).
 *
 * The genuinely-empty venture here is the **modernisation engine** — no tickets, no runs, no repo
 * history, no box. THE RESET is deliberately NOT used: its platform repo has a failing build from
 * January in the fixtures, and a venture with a red build is not a blank page. That distinction was
 * a live bug in the first version of this ticket, and these tests are where it stays fixed.
 *
 * The regression this file stops is the one the ticket was written about: a founder's first ten
 * seconds being four empty panels that between them argue the product does nothing.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const ROSS = 'ross@bruntsfield.capital';

test.describe('a founder’s first ten seconds', () => {
  test('an empty venture is a welcome, not a board of empty boxes', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/venture/modernisation-engine');

    await expect(page.getByTestId('first-run')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome');

    // The empty panels the ticket is about are gone — not reworded, gone.
    await expect(page.getByTestId('lane-empty')).toHaveCount(0);
    await expect(page.getByTestId('lane-activity-empty')).toHaveCount(0);
  });

  test('a venture with no box offers no action it cannot honour', async ({ page }) => {
    // Offering "tell the studio what you want" to a venture with no composer would be a button that
    // goes nowhere. Better to say plainly that there is nothing to do yet — and to say what WILL be
    // here, because a page with nothing to do and nothing to read looks broken.
    await testLogin(page, JOHN);
    await page.goto('/venture/modernisation-engine');
    await expect(page.getByTestId('first-run-action')).toHaveCount(0);
    await expect(page.getByTestId('first-run-waiting')).toContainText('fill up on its own');
    await expect(page.getByTestId('first-run-coming')).toBeVisible();
  });

  test('a venture with a failing build is never greeted as a blank page', async ({ page }) => {
    // The live bug. THE RESET has no tickets, no runs and no approvals — but its platform repo has a
    // failing build from January, so it gets a board, not "nothing has happened yet, which is
    // exactly right for day one". Comforting a founder about a problem they have is the failure this
    // whole ticket exists to fix.
    await testLogin(page, ROSS);
    await page.goto('/venture/the-reset');
    await expect(page.getByTestId('first-run')).toHaveCount(0);
  });

  test('a founder with one venture never sees a picker', async ({ page }) => {
    // Choosing between one thing is not a choice; it is a page in the way of what they came for.
    await testLogin(page, ROSS);
    await page.goto('/');
    await expect(page).toHaveURL(/\/venture\/the-reset$/);
  });

  test('an admin still gets the list, because they are genuinely choosing', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/');
    await expect(page.getByTestId('venture-grid')).toBeVisible();
    await expect(page.getByTestId('venture-arca')).toBeVisible();
  });

  test('a venture with work in it still gets its board', async ({ page }) => {
    // The welcome must not swallow a real venture. ARCA has tickets, runs and approvals.
    await testLogin(page, JOHN);
    await page.goto('/venture/arca');
    await expect(page.getByTestId('first-run')).toHaveCount(0);
    await expect(page.getByTestId('col-todo').first()).toBeVisible();
  });
});
