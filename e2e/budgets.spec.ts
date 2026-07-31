import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-054: the studio DISCLOSES the budget position at the moment the founder decides — the limit it
// owns, and the spend the venture reports. It does not render a verdict; see lib/budgets.ts.
//
// Limits come from ventures/budgets/arca.yaml (the STUDIO repo, which the venture's lane cannot
// write). Approvals come from APPROVALS_FIXTURE_DIR. "now" is pinned by E2E_NOW (2026-07-22).
//
// The fixture, against Sell's £4,800/month limit:
//   past-send        £4,000 granted 2026-07-05 — in window, reported
//   last-month-send  £4,500 granted 2026-06-20 — previous window, must NOT be reported
//   over-budget-send £5,200 proposed           — queued, awaiting the founder
//   free-post        no price at all           — must not appear as uncounted spend
test.describe('department budget disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('the approval card states the limit, the reported spend, and whose figure it is', async ({ page }) => {
    const budget = page.getByTestId('approval-arca/over-budget-send-budget');
    await expect(budget).toBeVisible();
    await expect(budget).toContainText('Limit £4,800 this month');
    // £4,000 reported + £5,200 this proposal = £9,200. If last month's £4,500 leaked in this is
    // £13,700 and the assertion fails — which is the point of the previous-window fixture.
    await expect(budget).toContainText('£9,200 spent');
    await expect(budget).toContainText('192% of the limit');
    await expect(budget).toHaveAttribute('data-budget-over', 'true');
    // Provenance, stated rather than implied.
    await expect(budget).toContainText('Limit set in the studio; spend as reported by the venture');
    // A free action must NOT show up as spend the studio could not count.
    await expect(budget).not.toContainText('Not counted');
  });

  test('the board reports the same figure, and marks the department over its limit', async ({ page }) => {
    const budget = page.getByTestId('dept-sell-budget');
    await expect(budget).toHaveAttribute('data-budget-over', 'true');
    // The board shows committed spend plus what is queued — it is not deciding a proposal.
    await expect(budget).toContainText('The venture reports £4,000 spent, £5,200 more awaiting your OK');
    await expect(budget).toContainText('192% of the limit');
    await expect(budget).toHaveCSS('color', 'rgb(138, 32, 32)'); // --color-error
  });

  test('a department with no limit says so in a whole sentence', async ({ page }) => {
    const build = page.getByTestId('dept-build-budget');
    await expect(build).toHaveText('No budget set for Build — Product.');
    await expect(build).toHaveAttribute('data-budget-over', 'false');
  });
});
