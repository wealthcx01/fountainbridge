import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-141 — asking a phone whether it may buzz, in a real browser.
 *
 * Runs in the `mobile` project (Pixel 5): the config sends any file ending `pocket.spec.ts` there.
 * The rules are unit tested in `lib/__tests__/push-offer.test.ts`; this checks that the screen
 * actually follows them.
 *
 * The rig has no database, so `PUSH_FIXTURE` (playwright.config.ts) lets the card be drawn anyway.
 * The browser is granted notification permission, and runs as the full Chromium rather than the
 * headless shell, because the shell reports every permission as "blocked" and the card could never
 * show.
 *
 * A "decision" here is the mark `noteDecision` leaves (lib/decided.ts). No decision can succeed on
 * this rig — it holds no write credential — and the unit test already holds every decision button to
 * calling `noteDecision`.
 */
const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

/** Exactly what `noteDecision` does after a decision goes through. */
async function decide(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.localStorage.setItem('foundry.decided', '1');
    window.dispatchEvent(new Event('foundry:decided'));
  });
}

// Chromium's lighter headless shell answers "blocked" to every notification question, whatever it
// was granted. The full browser in headless mode answers truthfully. `playwright install chromium`
// installs both.
test.use({ channel: 'chromium' });

test.describe('notifications on a phone (FB-141)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await testLogin(page, JOHN);
  });

  test('never asks on first load', async ({ page }) => {
    await page.goto('/venture/arca/tickets');
    await expect(page.getByTestId('tickets-filter-all')).toBeVisible();
    // Give the card every chance to appear: it reads the device after hydration.
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('push-offer')).toHaveCount(0);
  });

  test('asks once after a decision, and "Not now" sticks', async ({ page }) => {
    await page.goto('/venture/arca/tickets');
    await expect(page.getByTestId('tickets-filter-all')).toBeVisible();
    await decide(page);

    const card = page.getByTestId('push-offer');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Want a buzz when something needs you?');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the card pushes the phone sideways').toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/141-push-offer-phone.png` });

    await page.getByTestId('push-not-now').click();
    await expect(card).toHaveCount(0);

    // Gone everywhere else, after a reload too.
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('push-offer')).toHaveCount(0);
    await expect(page.getByTestId('push-off')).toHaveCount(0);

    // Where every buzz lands, one quiet line to turn it back on.
    await page.goto('/venture/arca/tickets');
    await expect(page.getByTestId('push-off')).toBeVisible();
    await expect(page.getByTestId('push-offer')).toHaveCount(0);
  });

  test('pressing "Turn on" where nothing can be kept says so, and never claims it worked', async ({ page }) => {
    await page.goto('/venture/arca/tickets');
    await expect(page.getByTestId('tickets-filter-all')).toBeVisible();
    await decide(page);
    await page.getByTestId('push-yes').click();
    // This rig has nowhere to keep the phone, so the honest answer is a refusal in words.
    await expect(page.getByTestId('push-message')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('push-on')).toHaveCount(0);
  });
});
