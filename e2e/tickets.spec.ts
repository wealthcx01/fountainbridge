import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-006: venture → lane → ticket drawer, and end-to-end venture scoping. Runs against local
// fixtures (TICKETS_FIXTURE_DIR) so it's deterministic and offline.
const SHOTS = 'e2e/__screenshots__';

test('venture → lane → ticket drawer, with dependency link', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com'); // admin — sees all ventures
  // FB-136: the admin's home is the ledger, and its way in is "Open as founder".
  await page.getByTestId('ledger-open-arca').click();
  await page.waitForURL(/\/venture\/arca$/);

  await expect(page.getByTestId('lane-arca')).toBeVisible();
  // FB-025/FB-038: the conversational composer entry point. ARCA's box is provisioned
  // (ventures/arca.yaml has vps.host) → the live chat link, not the pending note.
  await expect(page.getByTestId('venture-composer-link')).toBeVisible();
  // FB-048: the three founder-owned surfaces. FB-045 provisioned Sell and Scale their own repos, so
  // all three now read active — selling and scaling are worked by the lane, not only declared.
  await expect(page.getByTestId('dept-build')).toBeVisible();
  await expect(page.getByTestId('dept-build-state')).toHaveText('active');
  await expect(page.getByTestId('dept-sell-state')).toHaveText('active');
  await expect(page.getByTestId('dept-scale-state')).toHaveText('active');
  // FB-093: Build's door is real since 2026-08-04 (the terminal lives on Railway); Sell still has
  // nothing running, so its honest pending state must survive Build going live — one surface with
  // a door and one without is exactly the state this feature exists to render truthfully.
  const buildLaunch = page.getByTestId('dept-build-launch');
  await expect(buildLaunch).toBeVisible();
  await expect(buildLaunch).toHaveAttribute('href', 'https://arca-production-4e99.up.railway.app');
  await expect(buildLaunch).toHaveAttribute('rel', /noopener/);
  await expect(page.getByTestId('dept-sell-launch-pending')).toBeVisible();
  // Graceful degradation, surfaced not hidden: the imperfect ticket (ARCA-4, odd status) drives the
  // warnings badge. The stray README is still counted as a skipped non-ticket file, but FB-103 took
  // that count off the founder's header — it is a note the ticket reader wrote to itself, and it
  // must not come back as "· 8 non-ticket files skipped" beside the ticket count.
  await expect(page.getByTestId('warnings-badge')).toBeVisible();
  await expect(page.getByTestId('lane-skipped-arca')).toHaveCount(0);
  await expect(page.getByTestId('lane-arca')).not.toContainText('non-ticket');

  // The desk no longer carries a ticket board (FB-178), so opening a ticket from here is no longer
  // the path — the queue is one press away and the ticket, its dependencies and its decision are all
  // on that screen. `tickets-view.spec.ts` asserts every one of those, against the screen that
  // replaced the drawer rather than against the drawer.
  await expect(page.getByTestId('lane-open-arca')).toHaveAttribute('href', /\/venture\/arca\/tickets/);

  await page.screenshot({ path: `${SHOTS}/05-venture-board.png`, fullPage: true });
});

test('a founder cannot open another venture — no ticket data is served', async ({ page }) => {
  await testLogin(page, 'ross@bruntsfield.capital'); // founder of the-reset only
  await page.goto('/venture/arca');
  await expect(page.getByTestId('venture-forbidden')).toBeVisible();
  await expect(page.getByTestId('lane-arca')).toHaveCount(0); // board never rendered
  await page.screenshot({ path: `${SHOTS}/06-venture-forbidden.png`, fullPage: true });
});

test('empty / not-provisioned repos render a clear state, not a crash', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/venture/the-reset'); // its repos have no fixtures → empty lanes
  await expect(page.getByTestId('lane-thereset-platform')).toBeVisible();
  await expect(page.getByTestId('lane-thereset-platform').getByTestId('lane-empty')).toBeVisible();
});


/**
 * FB-105's decision-on-the-ticket tests lived here, against the desk's drawer.
 *
 * The drawer is gone (FB-178): the desk no longer carries a ticket board, so nothing could open it,
 * and an unreachable control is worse than none. It had already been superseded — `TicketsView`'s
 * own header says *"The list, the ticket and the decision are one screen. Before this the drawer
 * showed a ticket…"* — and `tickets-view.spec.ts` asserts all six of the properties this block did,
 * against the screen a founder actually uses: the decision offered where the ticket is, a refusal
 * requiring a note, dependency chips moving between tickets, and approve reaching the server.
 *
 * Deleted rather than repointed, because repointing would have produced a second copy of tests that
 * already exist.
 */


/**
 * FB-098 — watching your ticket being worked.
 *
 * John: *"the ticket get's worked (we should have some sort of simulator or loading bar for this),
 * and then a message or notification that the ticket has been worked."* Every piece of the loop
 * existed; none of it was visible AS a loop. The rule these pin is that what became visible is
 * EVIDENCE — real timestamps, real check-ins, real attempt counts — and never a bar counting to
 * nothing.
 */
test.describe('the loop is visible on the queue (FB-098)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    // The Tickets screen, not the desk. FB-178 took the board off the desk and this moved with it —
    // it is the founder's answer to "is anything happening to the thing I asked for", and it now
    // lives on the only list of tickets they have.
    // `filter=all` explicitly: FB-185 made "Needs you" the default, and these are assertions about
    // how any ticket renders, not about which ones the screen opens on.
    await page.goto('/venture/arca/tickets?filter=all');
  });

  test('a worked ticket says so, and the ticket carries the way through', async ({ page }) => {
    const line = page.getByTestId('ticket-progress-ARCA-1');
    await expect(line).toHaveAttribute('data-state', 'worked');
    await expect(line).toContainText('read it and decide');
    // The line itself is text, not a link: the row already opens the ticket, and a link inside a
    // link is not a control a keyboard user can reach. The destination is on the ticket.
    await page.getByTestId('tickets-row-ARCA-1').click();
    await expect(page.getByTestId('detail-read-work')).toHaveAttribute('href', '/venture/arca/work/arca/10');
  });

  test('a ticket being worked shows when it was picked up and the real check-in', async ({ page }) => {
    const line = page.getByTestId('ticket-progress-ARCA-6');
    await expect(line).toHaveAttribute('data-state', 'working');
    await expect(line).toContainText('picked this up');
    await expect(line).toContainText('checked in');
  });

  test('nothing on a card counts to a finish it cannot know', async ({ page }) => {
    // The honesty rule. A progress bar that lies is the composer-said-it-filed bug in a costume.
    const line = page.getByTestId('ticket-progress-ARCA-6');
    await expect(line).not.toContainText('%');
    await expect(page.locator('progress')).toHaveCount(0);
  });

  test('a parked ticket names how many attempts it took', async ({ page }) => {
    const line = page.getByTestId('ticket-progress-ARCA-4');
    await expect(line).toHaveAttribute('data-state', 'parked');
    await expect(line).toContainText('Tried 2 times and stopped');
  });

  test('a ticket nobody has touched says nothing at all', async ({ page }) => {
    // Twenty rows each saying "waiting to be picked up" is how a list teaches someone to stop
    // reading it (FB-100's item 5). On the board that reassurance lived on the column header; this
    // screen has filters rather than columns, and the row's own status label already says "To do".
    await expect(page.getByTestId('ticket-progress-ARCA-2')).toHaveCount(0);
    // And no row invents one either: a progress line appears only where there is evidence for it,
    // so the list does not read as twenty copies of the same reassurance.
    const rows = await page.locator('[data-testid^="tickets-row-"]').count();
    const lines = await page.locator('[data-testid^="ticket-progress-"]').count();
    expect(lines, 'every row carries a progress line, which is the noise FB-100 asked us to stop')
      .toBeLessThan(rows);
  });
});


/**
 * FB-099 — the board said zero while fifteen waited.
 *
 * The badge counted open work; the columns counted ticket files whose status had been inferred from
 * a matching piece of work. The lane's own branches (`foundry/<slug>`) carry no ticket id, so
 * nothing matched, and the two numbers sat six centimetres apart telling different stories.
 */
test.describe('one number for what is waiting (FB-099)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
  });

  test('work the lane filed under its own branch reaches its ticket', async ({ page }) => {
    // PR 13 is `foundry/deck-export` / "build: deck-export (Foundry lane)" — no id anywhere. Before
    // FB-099 it matched nothing and ARCA-3 sat in "To do" while the badge counted the work.
    // The board is gone (FB-178); the same claim is now made by the row's status and its progress.
    await page.goto('/venture/arca/tickets');
    await expect(page.getByTestId('tickets-row-ARCA-3')).toContainText('Needs your OK');
    await expect(page.getByTestId('ticket-progress-ARCA-3')).toHaveAttribute('data-state', 'worked');
  });

  test('work that matches nothing is shown as exactly that', async ({ page }) => {
    // Inventing a match to make the numbers add up would be the same failure in the opposite
    // costume. It appears as its own row, says it has no ticket, and can still be read and decided.
    await page.goto('/venture/arca/tickets');
    const orphan = page.getByTestId('tickets-row-arca#14');
    await expect(orphan).toBeVisible();
    await orphan.click();
    await expect(page.getByTestId('detail-no-ticket')).toContainText('There is no ticket for this');
    await expect(page.getByTestId('detail-read-work')).toHaveAttribute('href', '/venture/arca/work/arca/14');
  });

  test('the queue and the attention page count the same work', async ({ page }) => {
    // The whole ticket in one assertion: what the ticket screen says is waiting, and what the
    // cross-venture queue says is waiting, are one number from one knowledge. The board's column
    // was the other half of this pair and is gone (FB-178); the filter is its successor.
    await page.goto('/venture/arca/tickets');
    const filter = Number((await page.getByTestId('tickets-filter-needs').innerText()).match(/\d+/)?.[0] ?? '-1');
    await page.goto('/attention');
    const badge = Number(await page.getByTestId('attention-count').innerText());
    expect(filter).toBe(badge);
  });

  test('the queue calls work by its ticket’s name, not the lane’s branch', async ({ page }) => {
    await page.goto('/attention');
    const queue = page.getByTestId('attention-queue');
    // PR 13 is `foundry/deck-export` and used to read "build: deck-export (Foundry lane)" here while
    // the board called the same thing "Deck export" — two lists a founder could not connect.
    await expect(queue).toContainText('Deck export');
    await expect(queue).not.toContainText('build: deck-export');
    // The fallback survives exactly where it should: work that matches no ticket has no other name,
    // and inventing one would be worse than showing the lane's.
    await expect(queue).toContainText('build: something-nobody-filed (Foundry lane)');
  });
});


/**
 * FB-097 — a ticket with no number is nobody's ticket.
 *
 * The composer filed everything as `<PREFIX>-NEW`; the walkthrough counted four distinct pieces of
 * work all called ARCA-NEW. The filer allocates real ids now; this is the studio's half — anything
 * still unnumbered is shown as unnumbered rather than rendered as though "ARCA-NEW" were a name.
 */
test.describe('an unnumbered ticket is flagged, not named (FB-097)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    // The Tickets screen, not the desk. The desk's board is gone (FB-178), and this rule had only
    // ever been applied THERE — so removing the board would have quietly reintroduced the defect
    // FB-097 exists to fix, on the screen that is now the only list of tickets a founder has.
    // `filter=all` explicitly: an unnumbered ticket is not necessarily waiting on the founder, and
    // FB-185 made "Needs you" what the screen opens on.
    await page.goto('/venture/arca/tickets?filter=all');
  });

  test('the list says "unnumbered" instead of pretending -NEW is a name', async ({ page }) => {
    await expect(page.getByTestId('tickets-id-ARCA-NEW')).toHaveText('unnumbered');
  });

  test('the title does the work while it has no number', async ({ page }) => {
    await expect(page.getByTestId('tickets-row-ARCA-NEW')).toContainText('Show set name on card pages');
  });

  test('a numbered ticket still shows its number', async ({ page }) => {
    await expect(page.getByTestId('tickets-id-ARCA-3')).toHaveText('ARCA-3');
  });

  test('the ticket itself says it too, not just the list', async ({ page }) => {
    // Two places render an id on this screen and only one of them was fixed the first time I looked.
    await page.getByTestId('tickets-row-ARCA-NEW').click();
    await expect(page.getByTestId('detail-id')).toHaveText('unnumbered');
  });
});


/**
 * FB-109 — the surfaces organise the board.
 *
 * John: "We then have the surfaces… and dont actually act as a filter. Because then underneath we
 * have each repo of Build, GTM, Growth & Ops - sat underneath." The board showed the same three-way
 * split twice and never joined them.
 */
test.describe('a surface is the door to its queue (FB-109)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('the lane leads with the surface’s name, with the repo demoted to an aside', async ({ page }) => {
    // A founder had to already know that "Build — Product" IS `arca`.
    const lane = page.getByTestId('lane-arca');
    await expect(lane.locator('h3')).toContainText('Build — Product');
    await expect(lane.locator('h3')).toContainText('arca');
  });

  test('the card says what its queue is worth before it is clicked', async ({ page }) => {
    await expect(page.getByTestId('dept-build-queue')).toContainText('waiting for your OK');
  });

  test('selecting a surface brings its queue forward and quiets the others', async ({ page }) => {
    await page.getByTestId('dept-build-select').click();
    await expect(page.getByTestId('dept-build-select')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('lane-arca')).toHaveAttribute('data-quiet', 'false');
    // Quieted, never hidden: hiding two-thirds of the board is how a founder loses work they did not
    // know to look for.
    await expect(page.getByTestId('lane-arca-marketing')).toHaveAttribute('data-quiet', 'true');
    await expect(page.getByTestId('lane-arca-marketing')).toBeVisible();
  });

  test('deselecting puts all three back on equal terms', async ({ page }) => {
    await page.getByTestId('dept-build-select').click();
    await page.getByTestId('dept-build-select').click();
    await expect(page.getByTestId('dept-build-select')).toHaveAttribute('aria-pressed', 'false');
    for (const repo of ['arca', 'arca-marketing', 'arca-ops']) {
      await expect(page.getByTestId(`lane-${repo}`)).toHaveAttribute('data-quiet', 'false');
    }
  });

  test('the card is operable from the keyboard', async ({ page }) => {
    // The audit found the surface cards were the most button-shaped objects on the page and the only
    // ones that did nothing. They must not become mouse-only controls instead.
    const select = page.getByTestId('dept-build-select');
    // FB-157: the desk streams, so this content arrives after the shell and is inert until React
    // has attached to it. `click()` waits for actionability and rides that out; a bare `focus()` +
    // key press does not, and fired into markup with no handler on it. Waiting for the page to go
    // quiet is waiting for the thing the test is actually about — that the control WORKS from the
    // keyboard, not that it works three milliseconds after first paint.
    await page.waitForLoadState('networkidle');
    await select.focus();
    await page.keyboard.press('Enter');
    await expect(select).toHaveAttribute('aria-pressed', 'true');
  });
});
