import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-239 — the monthly budgets for temporary machines. A Bruntsfield page: John approves each
 * venture's budget here, signed in with Google, and nobody else can.
 */
test.describe('monthly budgets for temporary machines (FB-239)', () => {
  test('the budget approver sees each venture, its budget, and an approve button on what is waiting', async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/admin/machine-budgets');
    await expect(page.getByTestId('machine-budgets')).toBeVisible();
    await expect(page.getByTestId('budget-arca-in-force')).toContainText('$40.00 a month, approved by john.gallagher@wealthcx.com');
    await expect(page.getByTestId('budget-arca-in-force')).toContainText('Spent this month: $3.12');
    await expect(page.getByTestId('budget-proposal-0123456789abcdef')).toContainText('$60.00 a month, by ops@bruntsfield.capital');
    await expect(page.getByTestId('budget-approve-0123456789abcdef')).toBeVisible();
    await expect(page.getByTestId('budget-the-reset-in-force')).toContainText('No budget in force');
    await expect(page.getByTestId('budget-propose-the-reset-amount')).toBeVisible();
  });

  test('a founder is told plainly that it is not for them', async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/admin/machine-budgets');
    await expect(page.getByTestId('machine-budgets-forbidden')).toBeVisible();
    await expect(page.getByTestId('machine-budgets')).toHaveCount(0);
  });
});
