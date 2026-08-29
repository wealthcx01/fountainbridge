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
    // Addressed by repository AND id — two repos in one venture may share an id namespace, so an id
    // alone is not a name. The `/` is percent-encoded in the query.
    await expect(page).toHaveURL(new RegExp(`t=[^&]*${id}`));

    // The whole point: paste the link somewhere and it comes back to the same ticket.
    const url = page.url();
    await page.goto('/venture/arca');
    await page.goto(url);
    await expect(page.getByTestId('detail-title')).toBeVisible();
    await expect(page.getByTestId('tickets-filter-needs')).toHaveAttribute('aria-selected', 'true');
  });

  test('a ticket waiting on the founder can be decided right there', async ({ page }) => {
    await page.getByTestId('tickets-filter-needs').click();
    // Wait for the filter to land before clicking a row. Selecting is a server navigation, so the
    // list re-renders — clicking straight after could land on the previous filter's DOM.
    await expect(page).toHaveURL(/filter=needs/);
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
    // Wait for the filter to land before clicking a row. Selecting is a server navigation, so the
    // list re-renders — clicking straight after could land on the previous filter's DOM.
    await expect(page).toHaveURL(/filter=needs/);
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
    // Wait for the filter to land before clicking a row. Selecting is a server navigation, so the
    // list re-renders — clicking straight after could land on the previous filter's DOM.
    await expect(page).toHaveURL(/filter=needs/);
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
    await expect(page).toHaveURL(new RegExp(`t=[^&]*${id}`));
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

  test('the trail renders in time order and closes with its claim', async ({ page }) => {
    await page.goto('/venture/arca/tickets?t=arca%2FARCA-1');
    const trail = page.getByTestId('ticket-trail');
    await expect(trail).toBeVisible();
    await expect(page.getByTestId('trail-claim')).toContainText('nothing shown can disagree with what ran');

    const hops = page.getByTestId('trail-hop');
    if ((await hops.count()) === 0) {
      // A trail with nothing in it says so; it is never an empty box or an error.
      await expect(page.getByTestId('trail-empty')).toBeVisible();
      return;
    }
    // Oldest first. The dates are rendered, so the order is checkable on the page rather than
    // trusted from the join.
    const order = await hops.evaluateAll((els) => els.map((e) => e.getAttribute('data-at') ?? ''));
    expect(order).toEqual([...order].sort());
  });

  test('every link in the trail goes somewhere, and says which way it goes', async ({ page }) => {
    // The claim the whole studio rests on is only true while no dead link renders. Asserted on the
    // page rather than trusted from `buildTrail`, because the page is what a founder presses.
    await page.goto('/venture/arca/tickets?t=arca%2FARCA-1');
    const links = page.getByTestId('ticket-trail').locator('a');
    for (let i = 0; i < (await links.count()); i++) {
      const href = await links.nth(i).getAttribute('href');
      const text = ((await links.nth(i).textContent()) ?? '').trim();
      expect(href, text).toBeTruthy();
      // → stays in the studio, ↗ leaves it. A founder learns this once, on this screen.
      if (href!.startsWith('/')) expect(text, href!).toContain('→');
      else {
        expect(href, text).toMatch(/^https?:\/\//);
        expect(text, href!).toContain('↗');
      }
    }
  });

  test('a one-entry trail is a trail with one entry', async ({ page }) => {
    // Not an error, not an empty box. ARCA-6 has exactly one thing that has happened to it.
    await page.goto('/venture/arca/tickets?t=arca%2FARCA-6');
    await expect(page.getByTestId('trail-hop')).toHaveCount(1);
    await expect(page.getByTestId('trail-empty')).toHaveCount(0);
    await expect(page.getByTestId('trail-claim')).toBeVisible();
  });

  test('no hop reads as though a word were missing', async ({ page }) => {
    // "Work started on " — the attention queue does not carry a branch name, so the trail printed a
    // preposition with nothing after it, on the one surface whose claim is that it cannot be wrong.
    await page.goto('/venture/arca/tickets?t=arca%2FARCA-1');
    const texts = await page.getByTestId('trail-hop').allTextContents();
    for (const t of texts) expect(t.replace(/\s+/g, ' ').trim(), t).not.toMatch(/\b(on|by|from|to)\s*·/);
  });

  test('an unverified step says so, in words a founder can act on', async ({ page }) => {
    await page.goto('/venture/arca/tickets?t=arca%2FARCA-1');
    const unverified = page.getByTestId('ticket-trail').locator('[data-verified="false"]');
    if ((await unverified.count()) === 0) test.skip();
    // Neither hidden nor shown as verified — and it names who to tell, which is the part a founder
    // can do something with.
    await expect(unverified.first()).toContainText('signature does not check out');
    await expect(unverified.first()).toContainText('Bruntsfield');
  });

  test('it fits a phone, and the ticket is reachable there', async ({ page }) => {
    // FB-153: this assertion passed on production data that could not fail. ARCA's real backlog has
    // a ticket citing a 377px URL, which pushed a 393px window to 471px; the fixture had no link
    // long enough to overflow, so the check was looking at nothing. There is one now.
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/venture/arca/tickets?t=arca%2FARCA-6');
    await expect(page.getByTestId('detail-title')).toContainText('Price history');
    await expect(page.getByTestId('tickets-detail')).toContainText('developer.ebay.com');
    await expect(page.getByTestId('tickets-list')).toBeVisible();
    await expect(page.getByTestId('tickets-detail')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/21-mobile-tickets.png`, fullPage: true });
  });
});
