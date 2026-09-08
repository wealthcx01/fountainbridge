import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-042: what the engine did, and the brief that tells the founder what to do about it.
 *
 * The fixtures (`e2e/fixtures/runreports/`) deliberately include BOTH record shapes — the lane's
 * own, which is what has actually been on the state ref since FB-040, and the bcap-contracts shape
 * the writer will migrate to. If the reader ever stops understanding the legacy one, the studio goes
 * blind to every report already written, and this catches it.
 *
 * "now" is pinned by E2E_NOW (2026-07-22T00:00:00Z); the heartbeat fixture is 10 minutes before it.
 */
test.describe('run reports and the founder brief', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('the desk leads with what needs the founder, not with what is newest', async ({ page }) => {
    // arca's fixtures have proposals awaiting the gate and work awaiting a read, so the count of
    // what is waiting outranks everything else on the board.
    //
    // FB-128 moved this claim from the brief's headline to the desk's amber banner. The brief said
    // the number, the banner said the number, and the new serif summary said it a third time —
    // three blocks in a row stating one fact. The banner keeps the breakdown, which is the part
    // that was actually worth reading.
    //
    // FB-203, item 5 finished the job: the "Where things stand" box is gone. Its blocked lines are
    // now rows in the banner's own shape, asserted below.
    const banner = page.getByTestId('blocker-banner');
    await expect(banner).toContainText('finished work to read');
    await expect(banner).toContainText('outside the company');
  });

  test('repeated attempts at one ticket are one fact, named (FB-104)', async ({ page }) => {
    // FB-104 built this as a line in the founder brief. FB-203 deleted the brief's box and kept
    // this line, because it is the only place on the desk — or on the phone — where a founder is
    // told which ticket their team could not finish. The wording and the deduplication are the
    // brief's still (`lib/brief.ts`); only the box around them went.
    const stuck = page.getByTestId('desk-stuck');
    await expect(stuck.first()).toBeVisible();
    await expect(stuck.first()).toContainText('stuck and need');
    await expect(stuck.first()).toContainText('ARCA-31');
    // The machine's own account of the attempt belongs beside the attempt, not in the summary.
    await expect(stuck.first()).not.toContainText('review/tests');
  });

  test('the stuck line is a way in, not a notice (FB-104, FB-203)', async ({ page }) => {
    // The property FB-104 protected: a sentence that states a fact a founder then has to go and
    // find is a sentence that costs them a search. It is now the whole row that is the door, which
    // is item 4's rule for the banner applied to the banner's other shape.
    const stuck = page.getByTestId('desk-stuck').first();
    await expect(stuck).toHaveAttribute('href', /.+/);
    // The link down to the activity strip must land on the strip, not under the sticky bar.
    await expect(page.locator('#what-your-team-is-doing')).toBeVisible();
  });

  test('the activity strip shows what each lane did, across department repos', async ({ page }) => {
    const activity = page.getByTestId('lane-activity');
    await expect(activity).toBeVisible();
    const list = page.getByTestId('lane-activity-list');
    // Newest first across BOTH repos. FB-098 added the in-flight ARCA-3 (23:50) and the twice-parked
    // ARCA-4 (22:00, 21:00), so they now precede the Sell run (18:00) and the older arca ones.
    await expect(list.locator('li').nth(0)).toContainText('ARCA-6');
    await expect(list.locator('li').nth(0)).toContainText('Working');
    await expect(list.locator('li').nth(1)).toContainText('ARCA-4');
    await expect(list.locator('li').nth(3)).toContainText('SELL-002');
    await expect(list.locator('li').nth(3)).toContainText('waiting for your approval');
    // The desk shows the design's four (FB-178); the rest are behind the "What happened" link
    // below the list, which is asserted in `the heartbeat is not shown as work`.
    //
    // The two ARCA-4 rows are NOT collapsed into one, and that is correct: `collapseRepeats` merges
    // only rows a reader would see as duplicated, and these say different things — "First attempt at
    // the animation polish stopped" and "Could not get the animation polish past its own check".
    // The contract-shaped record parsed as well as the lane-shaped ones.
    await expect(list.locator('li[data-outcome="awaiting-approval"]')).toHaveCount(1);
  });

  test('the engine reports itself as running, from the heartbeat alone', async ({ page }) => {
    const engine = page.getByTestId('engine-state');
    await expect(engine).toHaveAttribute('data-engine-state', 'running');
    await expect(engine).toContainText('checked in');
  });

  test('a run that finished something links to the work itself', async ({ page }) => {
    // On the activity page, which shows every run — the desk shows the design's four and the run
    // that carries PR 12 is older than those (FB-178).
    await page.goto('/venture/arca/activity');
    const link = page.locator('a[href*="/pull/12"]').first();
    await expect(link).toBeVisible();
  });

  test('the heartbeat is not shown as work', async ({ page }) => {
    // It is a liveness beacon overwritten on every wake, not run history — showing it would fill the
    // strip with "woke up, did nothing" and bury the runs that matter.
    await expect(page.getByTestId('lane-activity-list')).not.toContainText('heartbeat');
    // The desk shows four (FB-178, the design's own "Showing the 4 most recent of 31 runs"), and
    // says how many there are in total. Six runs in the fixtures; the heartbeat is the seventh
    // record on the ref and must not be counted among them — which is what "of 6" asserts.
    await expect(page.getByTestId('lane-activity-list').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('lane-activity-more')).toContainText('4 most recent of 6 runs');
  });
});
