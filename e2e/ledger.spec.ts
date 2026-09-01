import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-136 — the admin ledger.
 *
 * Every other screen in the redesign is for a founder. This one is for the person running the
 * portfolio, and its question is narrow: where is a venture stuck, and is it stuck on its founder or
 * on its engine?
 */
const JOHN = 'john.gallagher@wealthcx.com';
const ROSS = 'ross@bruntsfield.capital';
const SHOTS = 'e2e/__screenshots__';

test.describe('the ledger (FB-136)', () => {
  test('Bruntsfield gets every venture, with all seven columns', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/');
    const head = await page.getByTestId('ledger-table').locator('thead th').allTextContents();
    expect(head.map((h) => h.trim())).toEqual([
      'Venture', 'Founder', 'Needs them', 'Underway', 'Engine', 'Spend, month', 'Open',
    ]);
    await expect(page.getByTestId('ledger-row-arca')).toBeVisible();
    await expect(page.getByTestId('ledger-row-the-reset')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/19-admin-ledger.png`, fullPage: true });
  });

  test('a founder never sees it — they land on their own desk', async ({ page }) => {
    // The property the whole screen hangs on. Venture isolation is server-side (CLAUDE.md #6), and
    // this is the one page that would show a founder the shape of the portfolio.
    await testLogin(page, ROSS);
    await page.goto('/');
    await expect(page).toHaveURL(/\/venture\/the-reset$/);
    await expect(page.getByTestId('ledger')).toHaveCount(0);
    await expect(page.getByTestId('ledger-table')).toHaveCount(0);
  });

  test('every row says its colour in words, not only in colour', async ({ page }) => {
    // State carried only by a colour is state a screen-reader user does not get — and "amber" does
    // not say which of six decisions is the old one.
    await testLogin(page, JOHN);
    await page.goto('/');
    const rows = page.locator('[data-testid^="ledger-row-"]');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const id = (await rows.nth(i).getAttribute('data-testid'))!.replace('ledger-row-', '');
      await expect(page.getByTestId(`ledger-why-${id}`)).not.toBeEmpty();
      await expect(rows.nth(i)).toHaveAttribute('data-tone', /unknown|blocked|attention|ok|idle/);
    }
  });

  test('the summary counts the rows the table shows', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/');
    const n = await page.locator('[data-testid^="ledger-row-"]').count();
    await expect(page.getByTestId('ledger-summary')).toContainText(`${n} venture`);
  });

  test('the engine column carries the engine’s own sentence', async ({ page }) => {
    // "Nobody has run here yet" is a fact the studio owns and a founder needs. Collapsing it into
    // the same dash as a read that FAILED throws the sentence away and says nothing instead.
    await testLogin(page, JOHN);
    await page.goto('/');
    // ARCA's engine has checked in; the-reset's never has. BOTH must read as sentences — the second
    // is the one that matters, because "nobody has run here yet" is the state the first draft threw
    // away by collapsing it into the same dash as a read that failed.
    await expect(page.getByTestId('ledger-engine-arca')).toContainText('checked in');
    await expect(page.getByTestId('ledger-engine-the-reset')).toContainText('not working on this venture yet');
  });

  test('a venture with no envelope reads "not set", never £0', async ({ page }) => {
    // A venture that has set no limit and a venture that has spent nothing are different facts.
    await testLogin(page, JOHN);
    await page.goto('/');
    const spend = await page.getByTestId('ledger-spend-the-reset').textContent();
    expect(spend?.trim()).not.toBe('£0');
  });

  test('the three footnotes are there, and none of them invents a number', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/');
    await expect(page.getByTestId('ledger-wiring')).toBeVisible();
    await expect(page.getByTestId('ledger-onboarding')).toBeVisible();
    await expect(page.getByTestId('ledger-waiting-note')).toBeVisible();
    // The design asks for "median response time". Nothing records when something STARTED needing a
    // founder, so the note says what it measures instead of guessing.
    await expect(page.getByTestId('ledger-waiting-note')).toContainText('is not recorded anywhere yet');
  });

  test('opening a venture shows the founder’s exact desk, with a way back', async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/');
    await page.getByTestId('ledger-open-arca').click();
    await expect(page).toHaveURL(/\/venture\/arca$/);
    // The founder's own desk — same board, same rail — with the strip saying whose it is.
    await expect(page.getByTestId('rail')).toHaveCount(1);
    await expect(page.getByTestId('as-founder-strip')).toContainText('exactly what');
    // Persistent: still there three screens deep into someone else's venture.
    await page.goto('/venture/arca/handbook');
    await expect(page.getByTestId('as-founder-strip')).toBeVisible();
    await page.getByTestId('as-founder-back').click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a founder is never told they are seeing what a founder sees', async ({ page }) => {
    // Ross opening his own venture is not "viewing as a founder" — he is the founder.
    await testLogin(page, ROSS);
    await page.goto('/venture/the-reset');
    await expect(page.getByTestId('as-founder-strip')).toHaveCount(0);
  });

  test('it fits a phone', async ({ page }) => {
    // Seven columns on a 393px screen is FB-153 waiting to happen.
    await page.setViewportSize({ width: 393, height: 851 });
    await testLogin(page, JOHN);
    await page.goto('/');
    await expect(page.getByTestId('ledger-table')).toBeVisible();
    await expect(page.getByTestId('ledger-waiting')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page itself scrolls sideways').toBeLessThanOrEqual(1);
    // And it genuinely does not move: `scrollWidth` and "can the reader drag the page" are not
    // always the same question, and it is the second one that ruins a phone.
    const scrolledTo = await page.evaluate(() => {
      window.scrollTo(300, 0);
      const x = window.scrollX;
      window.scrollTo(0, 0);
      return x;
    });
    expect(scrolledTo, 'the reader can drag the page sideways').toBe(0);
    // The table still scrolls INSIDE its own box, which is where seven columns belong.
    const inner = await page.locator('.table-scroll').evaluate((e) => e.scrollWidth > e.clientWidth);
    expect(inner, 'the table scrolls within its own box').toBe(true);
  });
});


