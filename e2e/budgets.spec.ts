import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-054: the founder must see the budget impact AT THE MOMENT THEY DECIDE. Runs against fixture
// approvals (APPROVALS_FIXTURE_DIR): a £5,200 send against Sell's £4,800 monthly envelope.
test.describe('department budget envelopes', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
  });

  test('an over-envelope spend renders a FAILING check on the approval card', async ({ page }) => {
    await page.goto('/venture/arca');
    const card = page.getByTestId('approval-over-budget-send');
    await expect(card).toBeVisible();

    // The lane's own check survives, and the studio-computed envelope check is appended to it.
    const checks = page.getByTestId('approval-over-budget-send-checks');
    await expect(checks).toContainText('no personal data in the body');
    await expect(checks).toContainText('sell budget envelope');
    // 520000 of 480000 = 108%. The founder sees the number they will ask about.
    await expect(checks).toContainText('108%');
    await expect(checks).toContainText('£4,800');
    // One failing check ⇒ the card leads with "needs a look", not "clear".
    await expect(checks).toContainText('need a look');
  });

  test('the department card shows where Sell stands against its envelope', async ({ page }) => {
    await page.goto('/venture/arca');
    const budget = page.getByTestId('dept-sell-budget');
    await expect(budget).toBeVisible();
    // The pending send is NOT committed spend, so the board reads 0% — only approving it moves this.
    await expect(budget).toHaveAttribute('data-budget-state', 'within');
    await expect(budget).toContainText('£4,800');
  });
});
