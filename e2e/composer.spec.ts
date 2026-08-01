import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * The composer, inside the studio (FB-065).
 *
 * The regression this file exists to stop is the one the ticket was written about: the founder being
 * sent to a different product at a different address to do the most important thing they do. The
 * assertion that matters most is the last one — no link to the box's own chat host.
 */

const JOHN = 'john.gallagher@wealthcx.com';

test.describe('describing what you want, without leaving the studio', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('the board opens the composer inside the studio, not on another host', async ({ page }) => {
    await page.goto('/venture/arca');
    const link = page.getByTestId('venture-chat-link');
    await expect(link).toBeVisible();
    // The regression: this used to be an <a href="https://chat.arca…"> with target=_blank.
    await expect(link).toHaveAttribute('href', '/venture/arca/composer');
    await link.click();
    await expect(page).toHaveURL(/\/venture\/arca\/composer$/);
    await expect(page.getByTestId('composer')).toBeVisible();
  });

  test('an empty thread says what to do rather than showing a blank box', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('composer-empty')).toContainText('Describe what you want');
  });

  test('the reply streams in, and what it DID is shown as an action', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('What do we know about the price feed?');
    await page.getByTestId('composer-send').click();

    // The founder's own words land immediately — the thread never swallows what they typed.
    await expect(page.getByTestId('composer-turn-0')).toContainText('price feed');

    // The action is visible BEFORE the answer. After FB-062 — where the composer said it had filed
    // a ticket it had not filed — a visible action is what makes the words trustworthy.
    const action = page.getByTestId('composer-action').first();
    await expect(action).toContainText('Looking through what your venture knows');
    // Two calls, not three: the engine numbered the search's chunks inconsistently (id at index 1,
    // arguments at index 0), and a strict index read would have invented an extra action.
    await expect(page.getByTestId('composer-action')).toHaveCount(2);
    // The filing is named as filing. It rendered as "Working…" until a live run caught that the real
    // tool is `file_venture_ticket`, not the `file_ticket` this table first guessed.
    await expect(page.getByTestId('composer-action').nth(1)).toContainText('Filing this as a piece of work');

    await expect(page.getByTestId('composer-turn-1')).toContainText('Here is what I found, and what I would file.');
  });

  test('the thread is still there when the founder comes back', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('Remember this one');
    await page.getByTestId('composer-send').click();
    await expect(page.getByTestId('composer-turn-1')).toBeVisible();

    await page.goto('/venture/arca');
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('composer-turn-0')).toContainText('Remember this one');
  });

  test('a file it cannot read is refused with somewhere to put it, not dropped', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-file').setInputFiles({
      name: 'deck.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4'),
    });
    await expect(page.getByTestId('composer-error')).toContainText('deck.pdf');
    await expect(page.getByTestId('composer-error')).toContainText('own box');
  });

  test('a readable document is attached and named before it is sent', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-file').setInputFiles({
      name: 'positioning.md', mimeType: 'text/markdown', buffer: Buffer.from('We win on trust.'),
    });
    await expect(page.getByTestId('composer-doc')).toContainText('positioning.md');
  });

  test('nothing on the composer sends the founder to another product', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs.filter((h) => /chat\.|github\.com/.test(h))).toEqual([]);
  });
});
