import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * Tickets: master-detail, and deciding without leaving (FB-129).
 *
 * What is asserted is the thing a founder will notice: that the list, the ticket and the decision
 * are one screen, that a ticket can be linked to, and that clearing a decision offers the next one
 * rather than sending them back to a list to find it.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

test.describe('tickets', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/venture/arca/tickets');
  });

  test('the list, the ticket and the decision are one screen', async ({ page }) => {
    await expect(page.getByTestId('tickets-list')).toBeVisible();
    await expect(page.getByTestId('tickets-detail')).toBeVisible();
    await expect(page.getByTestId('tickets-summary')).toContainText('Every one can be followed');
    await page.screenshot({ path: `${SHOTS}/21-tickets.png`, fullPage: true });
  });

  test('the four filters are there and each says how many', async ({ page }) => {
    for (const f of ['needs', 'all', 'underway', 'settled']) {
      await expect(page.getByTestId(`tickets-filter-${f}`)).toBeVisible();
    }
    // A count on a filter that hides nothing is the total, and the sentence must agree with it.
    const all = (await page.getByTestId('tickets-filter-all').textContent()) ?? '';
    const total = all.match(/(\d+)/)?.[1] ?? '';
    await expect(page.getByTestId('tickets-summary')).toContainText(`${total} ticket`);
  });

  test('the selected ticket and the filter are in the URL, and a link restores both', async ({ page }) => {
    await page.getByTestId('tickets-filter-needs').click();
    await expect(page).toHaveURL(/filter=needs/);

    const first = page.getByTestId('tickets-list').locator('li button').first();
    const id = ((await first.textContent()) ?? '').match(/([A-Z]+-\d+)/)?.[1];
    await first.click();
    await expect(page).toHaveURL(new RegExp(`t=${id}`));

    // The whole point: paste the link somewhere and it comes back to the same ticket.
    const url = page.url();
    await page.goto('/venture/arca');
    await page.goto(url);
    await expect(page.getByTestId('detail-title')).toBeVisible();
    await expect(page.getByTestId('tickets-filter-needs')).toHaveAttribute('aria-selected', 'true');
  });

  test('a ticket waiting on the founder can be decided right there', async ({ page }) => {
    await page.getByTestId('tickets-filter-needs').click();
    await page.getByTestId('tickets-list').locator('li button').first().click();

    const decision = page.getByTestId('detail-decision');
    await expect(decision).toBeVisible();
    // What it reaches, what it costs, what proves it — in front of them, not on a page they have to
    // go and find.
    for (const fact of ['Reaches', 'Costs', 'Proven']) await expect(decision).toContainText(fact);
    await expect(decision).toContainText(/decision \d+ of \d+/);
    await expect(page.getByTestId('detail-approve')).toBeVisible();
    await expect(page.getByTestId('detail-refuse')).toBeVisible();
  });

  test('refusing requires a note, because a send-back with no reason is a lane guessing', async ({ page }) => {
    await page.getByTestId('tickets-filter-needs').click();
    await page.getByTestId('tickets-list').locator('li button').first().click();
    await page.getByTestId('detail-refuse').click();

    await expect(page.getByTestId('detail-send-back')).toBeDisabled();
    await page.getByTestId('detail-note').fill('The second paragraph is wrong.');
    await expect(page.getByTestId('detail-send-back')).toBeEnabled();

    // And it can be abandoned without deciding anything.
    await page.getByTestId('detail-never-mind').click();
    await expect(page.getByTestId('detail-approve')).toBeVisible();
  });

  test('pressing approve reaches the server and says plainly when it cannot', async ({ page }) => {
    // `acceptWork` MERGES a pull request and needs a write token the e2e studio does not have, so
    // this drives the whole wire — button, server action, refusal — and proves the control is
    // connected to something rather than assumed to be.
    //
    // What it deliberately does NOT do is fake a merge to make the chaining visible. The most
    // consequential button in the product must not have a fixture that makes it look like it
    // worked. The chaining itself — oldest first, never offering back one just answered — is
    // covered in `lib/__tests__/tickets-view.test.ts`, and the honest limit is recorded on FB-129.
    await page.getByTestId('tickets-filter-needs').click();
    await page.getByTestId('tickets-list').locator('li button').first().click();

    await page.getByTestId('detail-approve').click();
    await expect(page.getByTestId('detail-error')).toContainText('not set up');
    await expect(page.getByTestId('detail-outcome')).toHaveCount(0);
    // Still pressable: a refusal an admin can fix must not strand the decision.
    await expect(page.getByTestId('detail-approve')).toBeEnabled();
  });

  test('dependency chips move between tickets', async ({ page }) => {
    await page.goto('/venture/arca/tickets?filter=all');
    const deps = page.getByTestId('tickets-detail').locator('[data-testid^="detail-dep-"]');
    // Only meaningful when the fixture ticket actually declares one.
    if ((await deps.count()) === 0) test.skip();
    const id = (await deps.first().textContent())?.trim();
    await deps.first().click();
    await expect(page).toHaveURL(new RegExp(`t=${id}`));
  });

  test('the rail’s badge and this screen’s "Needs you" filter are the same number', async ({ page }) => {
    // They were not. The rail said 4 and the filter said 2, because the badge counted everything
    // waiting and this screen counted only what happened to have a ticket file. Two of the four
    // were work nobody had written a ticket for — a fact about the venture, not a row to omit.
    //
    // FB-129 pointed the badge's row at this screen, so from here on a disagreement is a visible
    // contradiction one line apart in the rail. This is the check that makes that impossible.
    const badge = page.getByTestId('rail-needs-badge');
    const shown = (await badge.count()) ? ((await badge.textContent()) ?? '').trim() : '0';
    const filter = ((await page.getByTestId('tickets-filter-needs').textContent()) ?? '').match(/(\d+)/)?.[1] ?? '0';
    expect(filter).toBe(shown);
  });

  test('it fits a phone, and the ticket is reachable there', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/venture/arca/tickets');
    await expect(page.getByTestId('tickets-list')).toBeVisible();
    await expect(page.getByTestId('tickets-detail')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/21-mobile-tickets.png`, fullPage: true });
  });
});
