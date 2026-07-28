import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-023: the Founder Handbook reading surface — private (FB-015), mirrors the /playbook pattern.
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

test('handbook is private — a signed-out visitor is sent to login', async ({ page }) => {
  await page.goto('/handbook');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});

test('a signed-out visitor cannot reach a chapter either', async ({ page }) => {
  await page.goto('/handbook/how-to-start');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
});

test('a signed-in user sees the index and can open a chapter', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/handbook');
  await expect(page.getByTestId('handbook-index')).toBeVisible();
  await expect(page.getByTestId('hb-how-to-start')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/14-handbook-index.png`, fullPage: true });

  await page.getByTestId('hb-how-to-start').click();
  await page.waitForURL(/\/handbook\/how-to-start$/);
  await expect(page.getByTestId('handbook-chapter')).toBeVisible();
  await expect(page.getByText('Chapter 1', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/14-handbook-chapter.png`, fullPage: true });
});

test('handbook is reachable from the studio nav', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/');
  await page.getByRole('link', { name: 'Handbook', exact: true }).click();
  await page.waitForURL(/\/handbook$/);
  await expect(page.getByTestId('handbook-index')).toBeVisible();
});
