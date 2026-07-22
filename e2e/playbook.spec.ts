import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-015: the playbook is now PRIVATE (behind login). Signed-out visitors are gated; signed-in users
// can read it.
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

test('playbook is private — a signed-out visitor is sent to login', async ({ page }) => {
  await page.goto('/playbook');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});

test('a signed-out visitor cannot reach a playbook section either', async ({ page }) => {
  await page.goto('/playbook/moats');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
});

test('a signed-in user can read the playbook and its sections', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/playbook');
  await expect(page.getByTestId('playbook-index')).toBeVisible();
  await page.getByTestId('pb-build-arc').click();
  await page.waitForURL(/\/playbook\/build-arc$/);
  await expect(page.getByTestId('playbook-section')).toBeVisible();
  await expect(page.getByText('Who is your customer?', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/10-playbook-private.png`, fullPage: true });
});

test('the detailed DE and 7 Powers deep pages render (FB-018)', async ({ page }) => {
  await testLogin(page, JOHN);
  await page.goto('/playbook');
  await page.getByTestId('pb-de-money').click();
  await page.waitForURL(/\/playbook\/de-money$/);
  await expect(page.getByTestId('playbook-section')).toBeVisible();
  await expect(page.getByText('Cost of Customer Acquisition', { exact: false }).first()).toBeVisible();

  await page.goto('/playbook/seven-powers');
  await expect(page.getByTestId('playbook-section')).toBeVisible();
  await expect(page.getByText('Counter-Positioning', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/13-playbook-deep.png`, fullPage: true });
});
