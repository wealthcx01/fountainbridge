import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-016: the Foundry story pages — private (FB-015), founder-facing, original DRAFT copy.
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

test('Foundry story is private — a signed-out visitor is sent to login', async ({ page }) => {
  await page.goto('/foundry');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
});

test('a signed-in user sees the Foundry story', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/foundry');
  await expect(page.getByTestId('foundry-story')).toBeVisible();
  await expect(page.getByTestId('foundry-hero')).toBeVisible();
  await expect(page.getByText('Build the company', { exact: false })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/11-foundry-story.png`, fullPage: true });
});

test('Foundry is reachable from the studio nav', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/');
  await page.getByRole('link', { name: 'Foundry', exact: true }).click();
  await page.waitForURL(/\/foundry$/);
  await expect(page.getByTestId('foundry-story')).toBeVisible();
});
