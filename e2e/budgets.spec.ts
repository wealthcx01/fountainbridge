import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-054: the founder must see the budget impact AT THE MOMENT THEY DECIDE, and every number here
// must be one that actually moves. Envelopes come from ventures/budgets/arca.yaml (the STUDIO repo —
// not a file the venture's own lane can write); approvals come from APPROVALS_FIXTURE_DIR; "now" is
// pinned by E2E_NOW (2026-07-22) so the window is observable.
//
// The fixture, against Sell's £4,800/month envelope:
//   past-send        £4,000 granted 2026-07-05 — IN this month's window, counts
//   last-month-send  £4,500 granted 2026-06-20 — PREVIOUS window, must NOT count
//   over-budget-send £5,200 proposed           — queued, not committed
test.describe('department budget envelopes', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('an over-envelope spend renders a FAILING studio check, apart from the proposer’s own', async ({ page }) => {
    const studio = page.getByTestId('approval-over-budget-send-studio-checks');
    await expect(studio).toBeVisible();
    // £4,000 committed + £5,200 pending against £4,800 = 192%. An assertion that moves with the maths.
    await expect(studio).toContainText('budget envelope');
    await expect(studio).toContainText('✗');          // it does NOT pass
    await expect(studio).toContainText('over');
    // £4,000 committed this month + £5,200 pending = £9,200 of £4,800 = 192%. If the previous
    // month's £4,500 leaked in, this reads 285% and the test fails — which is the point.
    await expect(studio).toContainText('192%');
    await expect(studio).toContainText('£4,800 this month');
    await expect(studio).toContainText('checked by the studio');
    // The lane's own claim is rendered separately so it cannot pass itself off as the studio's.
    await expect(page.getByTestId('approval-over-budget-send-checks')).toContainText('stated by the proposer');
  });

  test('the board shows Sell over budget, visibly — not in the same grey as a healthy department', async ({ page }) => {
    const budget = page.getByTestId('dept-sell-budget');
    // Committed spend is 83% — "nearing" on its own. The MARKER escalates because the queued
    // £5,200 would take Sell to 192%, which is the risk the board exists to flag.
    // The DOM attribute now carries the state the founder is SHOWN, escalated by the queue.
    await expect(budget).toHaveAttribute('data-budget-state', 'over');
    await expect(budget).toHaveAttribute('data-budget-committed', 'nearing');
    await expect(budget).toContainText('⚠');
    // …and the WORDS say the escalation too, not just the colour and the glyph.
    await expect(budget).toContainText('over if everything queued is approved');
    await expect(budget).toContainText('83% of £4,800 this month');
    // …and the queue would take it far past that, which is the thing a founder needs before deciding.
    await expect(budget).toContainText('192% if everything queued is approved');
    await expect(budget).toHaveCSS('color', 'rgb(138, 32, 32)'); // --color-error
  });

  test('a department with no envelope reads "no budget set", not a silent blank', async ({ page }) => {
    const build = page.getByTestId('dept-build-budget');
    await expect(build).toHaveAttribute('data-budget-state', 'unset');
    await expect(build).toContainText('no budget set');
  });
});
