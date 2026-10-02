import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-179 — "Go to anything", driven with the keyboard only.
 *
 * The ticket's criterion is "⌘K reaches any venture, ticket, or the composer, from any screen, with
 * the keyboard only". Every step below is a key press; nothing is clicked. What the list holds and
 * how typing narrows it is unit tested in `lib/__tests__/palette.test.ts`; this checks the screen.
 */
const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

test.describe('go to anything (FB-179)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('Ctrl-K from the Handbook, type, Enter: the ticket opens', async ({ page }) => {
    await page.goto('/venture/arca/handbook');
    await expect(page.getByTestId('palette')).toHaveCount(0);

    await page.keyboard.press('Control+k');
    const palette = page.getByTestId('palette');
    await expect(palette).toBeVisible();
    await expect(page.getByTestId('palette-input')).toBeFocused();
    await expect(page.getByTestId('palette-status')).not.toHaveText('Loading…');

    await page.keyboard.type('card search');
    const first = page.getByTestId('palette-option').first();
    await expect(first).toContainText('Card search');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `${SHOTS}/179-palette-desktop.png` });

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/venture\/arca\/tickets\?filter=all&t=arca%2FARCA-2$/);
    await expect(page.getByTestId('detail-title')).toContainText('Card search');
    await expect(palette).toHaveCount(0);
  });

  test('the arrow keys choose, and Enter goes to the composer', async ({ page }) => {
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk')).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('palette-status')).not.toHaveText('Loading…');
    await page.keyboard.type('composer');

    const options = page.getByTestId('palette-option');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    if ((await options.count()) > 1) {
      // Down moves the choice, Up brings it back: the keys do what the hint at the foot says.
      await page.keyboard.press('ArrowDown');
      await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowUp');
    }
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await expect(options.first()).toContainText('Composer');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/venture\/arca\/composer$/);
  });

  test('Escape closes it and puts the cursor back where it was', async ({ page }) => {
    await page.goto('/venture/arca/handbook');
    await page.keyboard.press('Tab');
    // The first thing Tab reaches on every page is the way in, for anyone who does not know the
    // shortcut.
    const skip = page.getByTestId('palette-open');
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('palette-input')).toBeFocused();
    // Tab stays inside the open box.
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('palette-input')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('palette')).toHaveCount(0);
    await expect(skip).toBeFocused();
  });
});
