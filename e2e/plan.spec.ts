import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * A document becomes a ticket set (FB-127, gap G5).
 *
 * The single most valuable thing a founder can do in the studio, and until this it was impossible:
 * they would file one ticket, then another, describing the same document from memory each time.
 *
 * What is asserted here is what a founder can actually SEE — the lines, where each came from, the
 * chain shortening when one is struck, and one button that says how many it will file. The filing
 * itself has 22 unit tests against a mocked GitHub; what those cannot see is a screen.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

/** The fixture composer proposes a plan when it is asked to break something into tickets. */
async function proposePlan(page: import('@playwright/test').Page) {
  await page.goto('/venture/arca/composer');
  await page.getByTestId('composer-input').fill('Break the auction aggregator PRD into tickets');
  await page.getByTestId('composer-send').click();
  await expect(page.getByTestId('plan-panel')).toBeVisible();
}

test.describe('a PRD becomes a ticket set', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('the whole set is on the screen, in dependency order, with one button', async ({ page }) => {
    await proposePlan(page);

    await expect(page.getByTestId('plan-panel')).toContainText('Auction aggregator PRD');
    await expect(page.getByTestId('plan-lines').getByRole('listitem')).toHaveCount(5);
    await expect(page.getByTestId('plan-file-all')).toHaveText('File all 5');

    // Smallest shippable first: the research ticket is above the QA ticket that waits on everything.
    const titles = await page.getByTestId('plan-lines').getByRole('listitem').allTextContents();
    expect(titles[0]).toContain('Find which auction houses publish a feed');
    expect(titles[4]).toContain('QA the aggregator end to end');

    // Into the gate's gallery: the one check in CI that can see a screen (CLAUDE.md #2).
    await page.screenshot({ path: `${SHOTS}/19-plan-set.png`, fullPage: true });
  });

  test('every line says which part of the document it came from', async ({ page }) => {
    // A founder must be able to check that the machine did not invent a requirement. Shown by
    // default, not behind a control.
    await proposePlan(page);
    await expect(page.getByTestId('plan-line-auction-source-research')).toContainText('PRD §1, Sources');
    await expect(page.getByTestId('plan-line-auction-aggregator-qa')).toContainText('PRD §5, Acceptance');
  });

  test('the dependency chain is drawn, and shortens when a line is struck', async ({ page }) => {
    await proposePlan(page);
    const view = page.getByTestId('plan-line-auction-live-view');
    await expect(view).toContainText('after Ingest the feeds we are allowed to use');

    // Strike ingestion: the view still needs the research ingestion needed. The chain shortens
    // rather than snapping, and the founder watches it happen.
    await page.getByTestId('plan-strike-auction-feed-ingestion').click();
    await expect(page.getByTestId('plan-line-auction-feed-ingestion')).toHaveAttribute('data-struck', 'true');
    await expect(view).toContainText('after Find which auction houses publish a feed');
    await expect(page.getByTestId('plan-file-all')).toHaveText('File all 4');
  });

  test('a strike can be undone', async ({ page }) => {
    await proposePlan(page);
    await page.getByTestId('plan-strike-auction-watch-notifications').click();
    await expect(page.getByTestId('plan-file-all')).toHaveText('File all 4');
    await page.getByTestId('plan-strike-auction-watch-notifications').click();
    await expect(page.getByTestId('plan-file-all')).toHaveText('File all 5');
  });

  test('the plan is read as a plan, never as a wall of JSON', async ({ page }) => {
    // The block the composer wrote is a data structure. Offering "show me exactly what will be
    // filed" over it would open plumbing at a founder — the mistake FB-073 exists to prevent.
    await proposePlan(page);
    await expect(page.getByTestId('composer-draft')).toHaveCount(0);
    const shown = (await page.getByTestId('composer-turn-1').textContent()) ?? '';
    for (const marker of ['foundry_plan', '{"', '```']) expect(shown).not.toContain(marker);
  });

  test('a plan replaces the single-ticket button rather than sitting beside it', async ({ page }) => {
    // Two buttons over one proposal is two decisions where there is one.
    await proposePlan(page);
    await expect(page.getByTestId('composer-decision')).toHaveCount(0);
  });

  test('pressing file reaches the server and says plainly when it cannot', async ({ page }) => {
    // The e2e studio has no write token, so this exercises the whole wire — button, server action,
    // refusal — and proves the founder gets one plain sentence rather than a spinner that stops.
    // The filing itself is covered by 22 unit tests against a mocked GitHub; what those cannot see
    // is whether the button is connected to anything at all (FB-062's lesson, on the press side).
    await proposePlan(page);
    await page.getByTestId('plan-file-all').click();
    await expect(page.getByTestId('plan-error')).toContainText('not set up');
    await expect(page.getByTestId('plan-filed')).toHaveCount(0);
    // Still pressable: a refusal an admin can fix must not leave the set stranded.
    await expect(page.getByTestId('plan-file-all')).toBeEnabled();
  });

  test('it fits a phone, and the whole set is reachable there', async ({ page }) => {
    // FB-124's lesson: a 250px rail on a 393px screen was green in every check that could not see a
    // screen. Anything new gets measured on a phone before it is called done.
    await page.setViewportSize({ width: 393, height: 851 });
    await proposePlan(page);
    await expect(page.getByTestId('plan-lines').getByRole('listitem')).toHaveCount(5);
    await expect(page.getByTestId('plan-file-all')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/19-mobile-plan-set.png`, fullPage: true });
  });
});
