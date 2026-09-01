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

/**
 * FB-135 — the front door, restyled.
 *
 * A restyle of the one screen where a cosmetic change locks a founder out of everything. These are
 * the properties the design asks for, and the ones a careless restyle would take away.
 */
test.describe('the sign-in screen (FB-135)', () => {
  test('it says both doors in one sentence, before either of them', async ({ page }) => {
    // A founder holding an email login was once told, by the page offering it, that Google was the
    // way in (FB-100). The sentence covers whichever doors are actually open.
    await page.goto('/login');
    await expect(page.getByTestId('signin')).toContainText(
      'Sign in with your venture account: Google, or the email and password you were given.',
    );
  });

  test('the studio introduces itself once, not twice', async ({ page }) => {
    // The screen carries the wordmark, so the top bar's copy of it is hidden here. Two wordmarks on
    // the one screen whose job is to say who this is would be the studio not knowing its own name.
    await page.goto('/login');
    // Visible, not merely present: the top bar's wordmark is still in the document, hidden by
    // `body:has(.signin) .topbar`. What must be true is that the reader sees one.
    await expect(page.locator('.wordmark:visible')).toHaveCount(1);
    await expect(page.getByTestId('signin')).toContainText('Bruntsfield');
    await expect(page.getByTestId('signin-footer')).toHaveText('A Bruntsfield Capital venture · Edinburgh');
  });

  test('Google is above the password form, and both are still reachable', async ({ page }) => {
    await page.goto('/login');
    const google = await page.getByRole('button', { name: /continue with google/i }).boundingBox();
    const password = await page.getByTestId('password-submit').boundingBox();
    expect(google, 'the Google door is on the page').not.toBeNull();
    expect(password, 'the password door is on the page').not.toBeNull();
    expect(google!.y, 'Google is the primary door and sits above').toBeLessThan(password!.y);
  });

  test('the fields carry the studio’s own border, not the browser’s', async ({ page }) => {
    // FB-150: two design tokens that do not exist left inputs borderless — an undefined custom
    // property invalidates the whole declaration, silently.
    //
    // Asserting "has a border" is not enough, and this test was written that way first: every input
    // has a border from the browser, so it passed with the rule deleted. What must be true is that
    // the border is OURS — the token, resolved.
    await page.goto('/login');
    const border = await page.getByTestId('password-email').evaluate((e) => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--color-border-strong)';
      document.body.appendChild(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      return { actual: getComputedStyle(e).borderTopColor, token };
    });
    expect(border.actual, 'the field border is the token, not a browser default').toBe(border.token);
  });

  test('it fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/login');
    await expect(page.getByTestId('password-submit')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
