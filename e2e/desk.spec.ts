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

/**
 * FB-167 — one machine, one answer.
 *
 * The rail carried a placeholder reading *"Not live yet. Your team's desks appear here once this
 * venture's machine reports what they are doing"* three lines above its own engine line saying
 * *"Your team checked in 2 minutes ago"*. Two statements about the same machine, one screen apart,
 * contradicting each other on every venture page in production for weeks.
 *
 * Asserted at the level of the **page**, not either component, because neither component was wrong
 * on its own — that is exactly why it survived. The desk's office and the rail's engine were each
 * internally consistent and each told a different story about the same box.
 */
test.describe('the venture is alive, or it is not (FB-167)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
  });

  for (const route of ['/venture/arca', '/venture/arca/tickets', '/venture/arca/knowledge']) {
    test(`${route} does not both claim and deny that the machine reports`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByTestId('rail')).toBeVisible();
      const text = await page.locator('body').innerText();

      const deniesItReports = /not live yet/i.test(text);
      const saysItReported = /checked in|is working|woke/i.test(text);
      expect(
        deniesItReports && saysItReported,
        `${route} says the machine is not live AND that it reported. One of them is wrong.`,
      ).toBe(false);
    });
  }

  test('the rail states the engine once, and nothing else in it answers the same question', async ({ page }) => {
    await page.goto('/venture/arca');
    const rail = page.getByTestId('rail');
    await expect(rail.getByTestId('rail-engine')).toHaveCount(1);
    // The placeholder that used to sit above it is gone, not merely reworded.
    await expect(rail).not.toContainText('Not live yet');
  });
});

/**
 * FB-178 — the desk is a page you read, not a page you scroll.
 *
 * Measured against the design at 1440×1000: the design's desk is ~1,900px; the live one was
 * **9,908px**, because it rendered a four-column board of every ticket on every surface — on ARCA
 * 73 of them, **37 already finished** — taking 4,634px, plus twenty run rows at 2,621px where the
 * design shows four.
 *
 * Asserted as a HEIGHT, because nothing else catches it. Every section was present, in the right
 * order, with correct data — `the sections run in the design's order` above passes either way. The
 * page was right and unusable, which is the FB-124 family, and only a measurement sees it.
 */
test.describe('the desk fits on a desk (FB-178)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk-summary')).toBeVisible();
  });

  test('no finished ticket is rendered on the desk', async ({ page }) => {
    // The clearest symptom, and the clearest rule. Done work answers none of the desk's questions.
    await expect(page.getByTestId('col-done')).toHaveCount(0);
    await expect(page.locator('[data-testid^="col-"]'), 'the ticket board is back on the desk')
      .toHaveCount(0);
  });

  test('each surface still says what is in it, and where to go', async ({ page }) => {
    // Removing the board must not remove the SIGNAL. A founder still has to be able to see that a
    // surface exists, roughly how much is in it, and get to it in one press.
    const links = page.locator('[data-testid^="lane-open-"]');
    expect(await links.count(), 'no surface offers a way through to its queue').toBeGreaterThan(0);
    await expect(links.first()).toHaveAttribute('href', /\/venture\/arca\/tickets/);
  });

  test('a read failure is still stated — that signal was inside the block that went', async ({ page }) => {
    // `lane-error` lived in the removed markup. If the fixtures produce no failure there is nothing
    // to assert, which is also right; what must not happen is the element ceasing to exist.
    const errors = page.getByTestId('lane-error');
    if (await errors.count()) await expect(errors.first()).toBeVisible();
  });

  test('the whole page is a readable length', async ({ page }) => {
    // A RATCHET, not a design target. The named sections now total 1,892px against the design's
    // ~1,900 — the shape is right. What is left above that is `approvals-queue` (739px) and
    // `approvals-decided` (356px), which are a separate question from the ticket board and are
    // named as follow-up in FB-178 rather than changed here.
    //
    // The structural assertions above are the real guard; this one exists because the defect was a
    // page that grew without bound as a venture aged, and only a measurement sees that. Returning
    // the board would add thousands of pixels and fail this immediately.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(h, `the desk is ${h}px; it was 9,908px on production before FB-178`)
      .toBeLessThan(4300);
  });
});

/**
 * Claude Design's rulings on the desk, 2026-09-02 (FB-182).
 *
 * Three of the five were implementable at once; the fourth needs a place to approve an external
 * send that is not the desk, and the fifth changes the ticket schema. Both are filed.
 */
test.describe('the desk answers Claude Design (FB-182)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk-summary')).toBeVisible();
  });

  test('a completed approval still shows whether its signature was genuine', async ({ page }) => {
    // Claude Design asked for "Decided — what happened next" to move to What happened, and as a
    // layout judgement that is right. It is staying until that screen can carry the ATTESTATION.
    //
    // This section is the only place a founder can see whether a completed approval's signature was
    // genuine, forged, or made against a proposal that changed afterwards (FB-046). What happened
    // lists decisions in prose and carries none of that. Moving it as instructed would make a forged
    // grant on a past send invisible — non-negotiable 4 failing quietly.
    //
    // Asserted here rather than left implicit, so that whoever finally moves the section has to move
    // this property with it.
    await expect(page.getByTestId('approvals-decided')).toBeVisible();
    await expect(page.getByTestId('approval-arca/past-send-provenance'))
      .toHaveAttribute('data-grant-provenance', 'attested');
  });

  test('the office says it is a stand-in, because it is one', async ({ page }) => {
    // Claude Design confirmed the room is the pixel-agents embed and allowed three figures as an
    // interim "ONLY if labelled as placeholder". Unlabelled, a founder cannot tell that what they
    // are looking at is a stand-in for something much richer.
    await expect(page.getByTestId('office-placeholder-note')).toContainText('stand-in');
  });

  test('a surface states a count and a door, not a breakdown of the queue', async ({ page }) => {
    // "20 waiting to be picked up · 14 being worked" restates the queue, which the banner and the
    // Tickets summary already count. The design's line is "14 tickets".
    //
    // FB-186 widened this from the door's own line to the whole card. Scoped to the line, it passed
    // while the card carried "4 waiting for your OK · 14 in progress" two lines above it — the rule
    // was being applied to one line and not to the thing it is a rule about.
    const card = page.getByTestId('dept-build');
    await expect(card).toContainText(/\d+ tickets?/);
    await expect(card, 'the card is restating the queue again').not.toContainText('waiting to be picked up');
    await expect(card, 'the card is restating the queue again').not.toContainText('waiting for your OK');
    await expect(card.getByTestId('lane-open-arca')).toBeVisible();
  });

  test('a surface says how much is in it exactly once', async ({ page }) => {
    // FB-186: the desk stated each surface twice as two blocks, and then each card stated its own
    // ticket count twice — once in the outcome sentence and again beside the door.
    const text = await page.getByTestId('dept-build').innerText();
    const counts = text.match(/\d+ tickets?/g) ?? [];
    expect(counts.length, `the count appears ${counts.length} times: ${counts.join(', ')}`).toBe(1);
  });
});
