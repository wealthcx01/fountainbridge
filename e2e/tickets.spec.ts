import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-006: venture → lane → ticket drawer, and end-to-end venture scoping. Runs against local
// fixtures (TICKETS_FIXTURE_DIR) so it's deterministic and offline.
const SHOTS = 'e2e/__screenshots__';

test('venture → lane → ticket drawer, with dependency link', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com'); // admin — sees all ventures
  await page.getByTestId('venture-arca').click();
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

  // Open a Done ticket that depends on another in view.
  await page.getByTestId('ticket-ARCA-2').click();
  const drawer = page.getByTestId('ticket-drawer');
  await expect(drawer).toBeVisible();
  await expect(page.getByTestId('drawer-title')).toHaveText('Card search & filter');
  await expect(page.getByTestId('drawer-github-link')).toHaveAttribute('href', /arca\/blob\/.*ARCA-2-card-search\.md/);

  // Dependency link jumps to ARCA-1.
  await page.getByTestId('dep-ARCA-1').click();
  await expect(page.getByTestId('drawer-title')).toHaveText('Terminal card renderer setup');

  await page.screenshot({ path: `${SHOTS}/05-venture-board.png`, fullPage: true });
  await page.getByTestId('drawer-close').click();
  await expect(drawer).toBeHidden();
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
 * FB-105 — the whole ticket lives in the studio.
 *
 * John: "some ticket's 'need my okay' but there is then no button to click accept, or deny, or then
 * use the composer to edit the tickets." The drawer showed him a decision and denied him the lever.
 */
test.describe('the ticket carries its own decision (FB-105)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('a ticket waiting on the founder offers accept and send-back where the ticket is', async ({ page }) => {
    // ARCA-1 has an open piece of work (PR 10), so the board files it under "Needs your OK".
    await page.getByTestId('ticket-ARCA-1').click();
    const decision = page.getByTestId('drawer-decision');
    await expect(decision).toBeVisible();
    await expect(page.getByTestId('drawer-read-work')).toHaveAttribute('href', '/venture/arca/work/arca/10');
    await expect(page.getByTestId('drawer-accept')).toBeVisible();
    await page.getByTestId('drawer-sendback-open').click();
    await expect(page.getByTestId('drawer-note')).toBeVisible();
  });

  test('the ticket does not print its own name twice', async ({ page }) => {
    // The drawer shows the title above the body, and the body opened with the same title as an <h1>.
    await page.getByTestId('ticket-ARCA-1').click();
    await expect(page.getByTestId('drawer-title')).toHaveText('Terminal card renderer setup');
    await expect(page.getByTestId('ticket-drawer').locator('h1')).toHaveCount(0);
  });

  test('the drawer and the board agree about the status, and the body does not argue', async ({ page }) => {
    // The audit: "Needs your OK" in the banner and `Status: Todo` two lines below it — two answers
    // to one question, in one view, and the wrong one written larger.
    await page.getByTestId('ticket-ARCA-1').click();
    await expect(page.getByTestId('drawer-status')).toHaveText('Needs your OK');
    await expect(page.getByTestId('ticket-drawer')).not.toContainText('Status:');
  });

  test('a ticket nobody is waiting on offers no decision at all', async ({ page }) => {
    // Offering an Accept button for work that does not exist would be worse than offering none.
    await page.getByTestId('ticket-ARCA-6').click();
    await expect(page.getByTestId('drawer-decision')).toHaveCount(0);
  });

  test('changing the ask is a sentence, through the composer that already exists', async ({ page }) => {
    await page.getByTestId('ticket-ARCA-1').click();
    await page.getByTestId('drawer-ask-changes').click();
    await expect(page).toHaveURL(/\/venture\/arca\/composer\?about=ARCA-1$/);
  });

  test('the code host is a reference here too, not the continuation of reading', async ({ page }) => {
    await page.getByTestId('ticket-ARCA-1').click();
    await expect(page.getByTestId('drawer-github-link')).not.toHaveClass(/btn/);
  });
});

/**
 * FB-098 — watching your ticket being worked.
 *
 * John: *"the ticket get's worked (we should have some sort of simulator or loading bar for this),
 * and then a message or notification that the ticket has been worked."* Every piece of the loop
 * existed; none of it was visible AS a loop. The rule these pin is that what became visible is
 * EVIDENCE — real timestamps, real check-ins, real attempt counts — and never a bar counting to
 * nothing.
 */
test.describe('the loop is visible on the board (FB-098)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('a worked ticket says so on the board and links to the review', async ({ page }) => {
    const line = page.getByTestId('ticket-progress-ARCA-1');
    await expect(line).toHaveAttribute('data-state', 'worked');
    await expect(line).toHaveAttribute('href', '/venture/arca/work/arca/10');
    await expect(line).toContainText('read it and decide');
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

  test('a ticket nobody has touched says nothing, and the column says it once', async ({ page }) => {
    // Twenty cards each saying "waiting to be picked up" is how a board teaches someone to stop
    // reading it (FB-100's item 5), so the reassurance lives on the column.
    await expect(page.getByTestId('ticket-progress-ARCA-2')).toHaveCount(0);
    await expect(page.getByTestId('col-todo-note')).toContainText('Waiting for your team to pick up');
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
    await page.goto('/venture/arca');
    await expect(page.getByTestId('col-pr-open').getByTestId('ticket-ARCA-3')).toBeVisible();
    await expect(page.getByTestId('ticket-progress-ARCA-3')).toHaveAttribute('data-state', 'worked');
  });

  test('work that matches nothing is shown as exactly that', async ({ page }) => {
    // Inventing a match to make the columns add up would be the same failure in the opposite
    // costume. It appears, says it has no ticket, and can still be read and decided.
    await page.goto('/venture/arca');
    const orphan = page.getByTestId('unmatched-work-arca-14');
    await expect(orphan).toBeVisible();
    await expect(orphan).toContainText('No ticket');
    await expect(orphan).toHaveAttribute('href', '/venture/arca/work/arca/14');
  });

  test('the column and the queue count the same work', async ({ page }) => {
    // The whole ticket in one assertion: what the board says is waiting, and what the queue says is
    // waiting, are the same number computed from the same knowledge.
    await page.goto('/venture/arca');
    const column = Number(await page.getByTestId('col-pr-open-count').innerText());
    await page.goto('/attention');
    const badge = Number(await page.getByTestId('attention-count').innerText());
    expect(column).toBe(badge);
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
