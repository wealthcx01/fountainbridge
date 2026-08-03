import { test, expect } from '@playwright/test';

// FB-092: the email+password door, end to end against a real production build. The account is
// ARCA's founder (FB-090), so this also proves the property that matters most: WHICH door you
// come through changes nothing about what you may see — scoping is lib/authz on the email,
// server-side, same as Google.

const SHOTS = 'e2e/__screenshots__';
const EMAIL = 'arca.founder@bruntsfield.capital';
const PASSWORD = 'e2e-founder-password-not-for-production';

test('the login page offers the password form when accounts are configured', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId('password-email')).toBeVisible();
  await expect(page.getByTestId('password-password')).toBeVisible();
  // Google stays the primary door, above it.
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/15-password-login-form.png`, fullPage: true });
});

test('a wrong password fails with one generic message and no session', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('password-email').fill(EMAIL);
  await page.getByTestId('password-password').fill('not-the-password');
  await page.getByTestId('password-submit').click();
  await page.waitForURL(/\/login\?error=password/);
  await expect(page.getByTestId('password-error')).toBeVisible();
  // Still signed out: the studio serves no venture data.
  await page.goto('/venture/arca');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await page.screenshot({ path: `${SHOTS}/16-password-login-refused.png`, fullPage: true });
});

test('ARCA’s founder signs in with a password and is scoped exactly as with Google', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('password-email').fill(EMAIL);
  await page.getByTestId('password-password').fill(PASSWORD);
  await page.getByTestId('password-submit').click();
  // A founder with one venture is taken straight into it (FB-066).
  await page.waitForURL(/\/venture\/arca$/);
  await page.screenshot({ path: `${SHOTS}/17-password-login-founder.png`, fullPage: true });

  // The isolation property, asserted through THIS door: another venture is refused server-side.
  await page.goto('/venture/the-reset');
  await expect(page.getByTestId('venture-forbidden')).toBeVisible();
});

test('an email that is not in the allowlist cannot sign in, even with a used password', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('password-email').fill('stranger@example.com');
  await page.getByTestId('password-password').fill(PASSWORD);
  await page.getByTestId('password-submit').click();
  await page.waitForURL(/\/login\?error=password/);
  await expect(page.getByTestId('password-error')).toBeVisible();
});
