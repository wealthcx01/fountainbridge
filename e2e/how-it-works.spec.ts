import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-017: "How the Foundry works" pages — private (FB-015), founder-facing, our own accurate copy.
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

test('How-it-works is private — a signed-out visitor is sent to login', async ({ page }) => {
  await page.goto('/how-it-works');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
});

test('a signed-in user sees the index and can open a component page', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/how-it-works');
  await expect(page.getByTestId('how-it-works-index')).toBeVisible();
  await expect(page.getByTestId('sys-gstack')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/12-how-it-works-index.png`, fullPage: true });

  await page.getByTestId('sys-gstack').click();
  await page.waitForURL(/\/how-it-works\/gstack$/);
  await expect(page.getByTestId('how-it-works-section')).toBeVisible();
  await expect(page.getByText('The discipline layer', { exact: false })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/12-how-it-works-section.png`, fullPage: true });
});

test('How-it-works is reachable from the Foundry hub', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/foundry');
  await page.getByTestId('foundry-to-how-it-works').click();
  await page.waitForURL(/\/how-it-works$/);
  await expect(page.getByTestId('how-it-works-index')).toBeVisible();
});
