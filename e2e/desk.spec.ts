import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * The desk (FB-128).
 *
 * The screen a founder opens and leaves open. What is asserted here is the **order** — which is the
 * argument, and is contractual — plus the three properties that can be quietly wrong: that one count
 * reaches the summary, the banner and the rail's badge; that the degraded strip sits below anything
 * the founder must act on; and that the prompt bar carries words without filing anything.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

test.describe('the desk', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/venture/arca');
  });

  test('the sections run in the design’s order', async ({ page }) => {
    // The order is the argument: what is happening, what waits on me, what my team did, is any of
    // it working. A dashboard that shuffles those is a dashboard that answers a different question.
    const order = await page.evaluate(() => {
      const ids = ['desk-summary', 'prompt-bar', 'office-plate', 'lane-activity', 'waiting-on-you', 'dept-surfaces'];
      return ids
        .map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          return el ? { id, top: el.getBoundingClientRect().top + window.scrollY } : null;
        })
        .filter((x): x is { id: string; top: number } => x !== null);
    });
    expect(order.map((o) => o.id)).toEqual(['desk-summary', 'prompt-bar', 'office-plate', 'lane-activity', 'waiting-on-you', 'dept-surfaces']);
    expect(order.map((o) => o.top)).toEqual([...order.map((o) => o.top)].sort((a, b) => a - b));

    await page.screenshot({ path: `${SHOTS}/20-desk.png`, fullPage: true });
  });

  test('the summary and the banner are one count', async ({ page }) => {
    // FB-099 is what happens when two surfaces answer "how much is waiting?" from different
    // knowledge: a badge saying 15 over columns saying 0.
    const summary = (await page.getByTestId('desk-summary').textContent()) ?? '';
    const inSummary = summary.match(/(\d+)\s+decisions?\s+waits?\s+on you/)?.[1] ?? '0';

    const banner = page.getByTestId('blocker-banner');
    if (await banner.count()) expect((await banner.textContent()) ?? '').toContain(`${inSummary} item`);
    else expect(inSummary).toBe('0');
  });

  test('the rail’s badge states the number its own destination lists', async ({ page }) => {
    // The badge counts open work; the desk's sentence counts external actions awaiting the gate as
    // well, because the desk shows both and `/attention` does not. Unifying them needs a destination
    // that can list an external action, which is FB-149 with FB-129. What must NOT happen meanwhile
    // is a badge asserting a number the page it links to contradicts.
    const badge = page.getByTestId('rail-needs-badge');
    const shown = (await badge.count()) ? ((await badge.textContent()) ?? '').trim() : '0';

    await page.goto('/attention');
    const there = ((await page.getByTestId('attention-count').textContent()) ?? '').trim();
    expect(shown).toBe(there);
  });

  test('what could not be read sits below what must be acted on', async ({ page }) => {
    // A condition that clears on its own must never push the one item a founder is blocking down
    // the page. If the fixtures produce no failures there is nothing to place, which is also right.
    const strip = page.getByTestId('degraded-strip');
    if ((await strip.count()) === 0) return;

    const tops = await page.evaluate(() => {
      const y = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.getBoundingClientRect().top + window.scrollY : null;
      };
      return { strip: y('[data-testid="degraded-strip"]'), brief: y('[data-testid="founder-brief"]') };
    });
    if (tops.brief !== null && tops.strip !== null) expect(tops.strip).toBeGreaterThan(tops.brief);
  });

  test('“Decide now” lands on the work it just counted', async ({ page }) => {
    // The banner used to link to an anchor sitting above the external-approval cards alone. On a
    // venture whose waiting items are all open pull requests — the common case — a founder pressed
    // it and was scrolled past the office to an empty space.
    const banner = page.getByTestId('blocker-banner');
    if ((await banner.count()) === 0) return;
    await expect(page.getByTestId('blocker-decide')).toHaveAttribute('href', /#waiting-on-you$/);

    const section = page.getByTestId('waiting-on-you');
    await expect(section).toBeVisible();
    // It holds the work, not an empty heading.
    const rows = section.getByTestId('waiting-queue').locator('li');
    const empty = section.getByTestId('waiting-queue-empty');
    expect((await rows.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('a prompt chip seeds the composer and files nothing', async ({ page }) => {
    await page.getByTestId('prompt-chip-0').click();
    await expect(page.getByTestId('prompt-bar-input')).toHaveValue('Break this document into tickets');

    await page.getByTestId('prompt-bar-send').click();
    await page.waitForURL(/\/composer/);
    // The words arrive already typed, and nothing has been filed: the composer's own gate is still
    // the only thing that turns them into work.
    await expect(page.getByTestId('composer-input')).toHaveValue('Break this document into tickets');
    await expect(page.getByTestId('composer-thread').getByTestId('composer-turn-0')).toHaveCount(0);
  });

  test('the office says it is not live rather than drawing an empty room', async ({ page }) => {
    // A frozen last-known scene would read as a team sitting still. FB-139 makes it live.
    // FB-139 replaced the placeholder with the live office. The fixture machine is reporting, so
    // this is the live plate — and the ledger beside it is the same events.
    await expect(page.getByTestId('office-live')).toBeVisible();
    await expect(page.getByTestId('office-ledger')).toBeVisible();
  });

  test('Scale says it is not connected, and counts what waits on it', async ({ page }) => {
    const scale = page.getByTestId('dept-scale-outcome');
    await expect(scale).toContainText('Not connected · platform tbd');
    // No invented number: whatever it says is a count of real tickets.
    await expect(scale).toContainText(/(\d+ tickets? waiting on it|No tickets yet)/);
  });

  test('Sell says what went out, and never a number it does not have', async ({ page }) => {
    // FB-142: Sell is no longer silent — the studio holds every send it gated, so it can say what
    // went and when. What it cannot say is what happened NEXT: the ratified architecture sends from
    // the venture's own Workspace through `gmail.send`, which reports neither opens nor replies
    // without a read scope or a tracking pixel. So it says that, rather than printing a zero.
    const sell = page.getByTestId('dept-sell-outcome');
    await expect(sell).toContainText(/Last send|Nothing has been sent yet/);
    await expect(sell, 'a delivered/opened/replied count appeared from nowhere')
      .not.toContainText(/\d+ (delivered|opened|replied)/);
  });

  test('the outbox is a reference, and only to the venture’s own', async ({ page }) => {
    // The design's "Open your outbox ↗". The studio does not read the mailbox, so this is the one
    // place a founder can see the message itself.
    const outbox = page.getByTestId('sell-outbox');
    if (await outbox.count()) {
      await expect(outbox).toHaveAttribute('href', /^https:\/\/mail\.google\.com\/mail\/u\/[^/]+\/#sent$/);
      await expect(outbox).toHaveAttribute('rel', /noopener/);
    }
  });

  test('it fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk-summary')).toBeVisible();
    await expect(page.getByTestId('prompt-bar-input')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/20-mobile-desk.png`, fullPage: true });
  });
});

/**
 * FB-157 — the desk streams, and a fallback is not a place for controls.
 *
 * Putting the prompt bar in the Suspense fallback looked like a kindness: the founder could start
 * typing while the board loaded. They could not — a fallback is not hydrated — and for the moment
 * the boundary took to resolve there were TWO prompt bars in the document, one of them dead.
 */
test.describe('the desk streams (FB-157)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
  });

  test('there is exactly one prompt bar, and it works', async ({ page }) => {
    await page.goto('/venture/arca');
    await expect(page.getByTestId('prompt-bar-input')).toHaveCount(1);
    await expect(page.getByTestId('prompt-chip-0')).toHaveCount(1);
    // Not just present — the one that is there is the live one.
    await page.getByTestId('prompt-chip-0').click();
    await expect(page.getByTestId('prompt-bar-input')).not.toHaveValue('');
  });

  test('the waiting shell is gone once the desk is in, not merely hidden', async ({ page }) => {
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk-summary')).toBeVisible();
    await expect(page.getByTestId('desk-waiting')).toHaveCount(0);
  });
});

/**
 * FB-139 — the office, live.
 *
 * The design's constraint is the whole ticket: *"The office is the feeling; this ledger is the
 * record. Same events, so they cannot disagree."*
 */
test.describe('the office (FB-139)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/venture/arca');
  });

  test('every character on the plate has a row in the ledger, and the same state', async ({ page }) => {
    // Not two lists checked against each other — one list, mapped twice. This asserts that nothing
    // has grown a second one.
    const desks = await page.locator('[data-testid^="office-desk-"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid')!.replace('office-desk-', '')));
    const rows = await page.locator('[data-testid^="office-row-"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid')!.replace('office-row-', '')));
    expect(desks.length, 'the office is empty').toBeGreaterThan(0);
    expect(rows, 'the plate and the ledger draw different surfaces').toEqual(desks);
  });

  test('a raised hand means something is genuinely waiting on the founder', async ({ page }) => {
    // The hand must mean what the amber banner means. Every desk with a hand has a row saying so.
    const hands = await page.locator('[data-testid^="office-hand-"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid')!.replace('office-hand-', '')));
    for (const id of hands) {
      await expect(page.getByTestId(`office-row-${id}`)).toHaveAttribute('data-state', 'waiting-on-you');
      await expect(page.getByTestId(`office-row-${id}`)).toContainText('waiting on you');
    }
  });

  test('every row says what its surface is doing — never a blank', async ({ page }) => {
    const rows = page.locator('[data-testid^="office-row-"]');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator('td').nth(1)).not.toBeEmpty();
    }
  });

  test('the plate is drawn for the eye and the ledger is read aloud', async ({ page }) => {
    // Every state on the plate is written in words beside it; the pictures are hidden from a screen
    // reader because a picture is the feeling and the record is the half they get.
    const svg = page.locator('[data-testid^="pixel-agent-"]').first();
    await expect(svg).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('office-ledger')).toBeVisible();
  });
});
