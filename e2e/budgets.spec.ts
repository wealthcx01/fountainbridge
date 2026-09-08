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

  test('the card states what THIS action costs, and nothing else (FB-068)', async ({ page }) => {
    // FB-183: the card is on the send's own decision page now; the desk carries a row pointing at it.
    await page.goto('/venture/arca/approvals/arca/over-budget-send');
    // Moved by FB-068, not weakened. Four cards each carried the identical department paragraph in
    // red — one fact about a department repeated as though it were four facts about four actions —
    // which flattened the hierarchy so an unverifiable grant read no louder than a routine spend.
    // The department states its position once (asserted below); a card states only its own cost.
    const budget = page.getByTestId('approval-arca/over-budget-send-budget');
    await expect(budget).toBeVisible();
    await expect(budget).toContainText('This one costs £5,200');
    await expect(budget).not.toContainText('Limit £4,800');
    await expect(budget).not.toContainText('192%');
  });

  test('the board reports the same figure, and marks the department over its limit', async ({ page }) => {
    const budget = page.getByTestId('dept-sell-budget');
    await expect(budget).toHaveAttribute('data-budget-over', 'true');
    // The board shows committed spend plus what is queued — it is not deciding a proposal.
    await expect(budget).toContainText('The venture reports £4,000 spent, £5,200 more awaiting your OK');
    await expect(budget).toContainText('192% of the limit');
    await expect(budget).toHaveCSS('color', 'rgb(138, 32, 32)'); // --color-error
    // FB-068: the provenance moved here with the position. FB-054's reasoning is unchanged — the
    // studio owns the limit and does not own the spend, and it says so where the figure is stated.
    await expect(budget).toContainText('Limit set in the studio; spend as reported by the venture');
  });

  test('a department within its limit says nothing about money on the desk (FB-203, item 11)', async ({ page }) => {
    // The rail carries every surface's figure on every screen. Restating three of them in the
    // surface columns was the desk answering a question that was already answered, three times,
    // each with the same provenance sentence under it.
    //
    // Over-limit is the exception and is asserted above: the rail can colour a figure red, but it
    // cannot say 192% of the limit, or that £5,200 of it is still awaiting a founder's OK.
    await expect(page.getByTestId('dept-build-budget')).toHaveCount(0);
    // The fact did not disappear with the sentence. Build has no envelope, and the rail says so —
    // "not set", which is a statement about this venture's setup, not "£0", which would be a
    // statement about its spending.
    // Scoped to `rail`. Its waiting shell (`rail-waiting`, FB-158) renders the same children while
    // the numbers stream, so every child testid matches twice for that instant — the second time
    // this ticket has been caught by it, after `rail-nav-memory` in items 2–6.
    await expect(page.getByTestId('rail').getByTestId('rail-budgets')).toContainText('not set');
  });
});
