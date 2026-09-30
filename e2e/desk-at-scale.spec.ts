import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * The desk, over a venture with a real backlog (FB-178).
 *
 * Run it:
 *
 *     npm run test:e2e:scale
 *
 * ## Why a separate suite and a separate server
 *
 * FB-178's last criterion asks for a height "measured against a venture with a real backlog rather
 * than a fixture with three tickets". The gate's committed ARCA fixture holds **6 tickets and 6 run
 * reports**; production ARCA holds **73 and 1,773**.
 *
 * That difference is the whole measurement. Every list on this desk is capped, and a cap of four
 * over six items renders exactly the same screen as no cap at all over six items. So the committed
 * fixture cannot tell a bounded desk from an unbounded one — which is precisely the fault FB-178
 * was raised for, a desk that grew as its venture aged until it was 9,908px.
 *
 * The fixture directory has to be chosen when the server starts, so this cannot be a per-test
 * decision. Same shape as `E2E_FAIL_READS` and `e2e/degraded.spec.ts`.
 *
 * ## Why it skips rather than passes when the fixture is absent
 *
 * A suite that quietly passes against the small fixture would report "the desk is bounded" in the
 * same voice as a real result, having measured nothing of the sort. `test.skip` says "not measured",
 * which is the honest outcome and is loud in the report.
 *
 * The first test below is a guard on the guard: it fails if the server is somehow serving the small
 * fixture despite the variable being set. Without it, every height below could be a reading of six
 * tickets wearing this file's name.
 */
const AT_SCALE = (process.env.E2E_SCALE_FIXTURES ?? '').length > 0;
const SHOTS = 'e2e/__screenshots__';
const JOHN = 'john.gallagher@wealthcx.com';

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 393, height: 851 };

/**
 * The stated heights (FB-178's criterion, and FB-186's).
 *
 * A RATCHET, not a design target. The design's desk is about 1,900px. Measured 2026-09-30 over 73
 * tickets and 1,773 run reports: **2,230px at 1440x1000 and 2,721px at 393x851**. The ceilings are
 * those plus a little room, so an honest change does not fail and the defect this ticket is about —
 * a list that grows per ticket — fails immediately.
 *
 * Checked by breaking it: raising the run cap from four back to twenty, which is FB-178's original
 * defect, takes the desktop reading to **2,795px** and fails this. Returning the ticket board would
 * add about 4,600px.
 *
 * The number that matters is the COMPARISON: the same desk over six tickets and six run reports is
 * **2,165px** (`e2e/desk.spec.ts`, same viewport). Sixty-five pixels separate a venture's first week
 * from its 1,773rd run report — which is what "the desk does not grow as the venture ages" means as
 * a measurement, rather than as a claim.
 */
const CEILING = { desktop: 2_400, phone: 2_900 };

async function heightOf(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  return page.evaluate(() => document.documentElement.scrollHeight);
}

test.describe('the desk over a real backlog (FB-178)', () => {
  test.skip(!AT_SCALE, 'run with npm run test:e2e:scale — see the header of this file');

  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/venture/arca');
    // Print where you landed. A height measured on the sign-in page is a smaller number and a
    // completely wrong answer — FB-151 merged exactly that mistake.
    expect(new URL(page.url()).pathname, 'not on the desk').toBe('/venture/arca');
  });

  test('the fixture really is at ARCA’s size — everything below depends on it', async ({ page }) => {
    // Two independent readings off the screen, because one of them could be wired to a constant.
    const runs = page.getByTestId('lane-activity-more');
    await expect(runs, 'no "showing N of M" line, so the run total cannot be read').toHaveCount(1);
    const total = Number((((await runs.textContent()) ?? '').match(/of ([\d,]+) runs/)?.[1] ?? '0').replace(/,/g, ''));
    expect(total, `the server is serving ${total} run reports, not a real backlog`).toBeGreaterThan(1_000);

    const surfaces = (await page.getByTestId('dept-surfaces').textContent()) ?? '';
    const tickets = Number(surfaces.match(/(\d+)\s+tickets?/)?.[1] ?? '0');
    expect(tickets, `the build surface holds ${tickets} tickets, not a real backlog`).toBeGreaterThan(50);
  });

  test('the desk is a readable length at 1440×1000', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/venture/arca');
    const h = await heightOf(page);
    await page.screenshot({ path: `${SHOTS}/20-desk-at-scale-desktop.png`, fullPage: true });
    // The message carries the number, so a failure says what the desk measured rather than only
    // that it was too tall.
    expect(h, `the desk is ${h}px over 73 tickets and 1,773 runs; it was 9,908px on production before FB-178`)
      .toBeLessThan(CEILING.desktop);
  });

  test('the desk is a readable length at 393×851', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/venture/arca');
    const h = await heightOf(page);
    await page.screenshot({ path: `${SHOTS}/20-desk-at-scale-phone.png`, fullPage: true });
    expect(h, `the desk is ${h}px on a phone over a real backlog; it was 5,190px at FB-186`)
      .toBeLessThan(CEILING.phone);
  });

  test('no finished ticket is on the desk', async ({ page }) => {
    // FB-178's second criterion. 37 of ARCA's 73 were done, and the board that drew them was half
    // the page. This fixture is 50% done on purpose.
    await expect(page.locator('[data-testid^="col-"]'), 'the ticket board is back on the desk')
      .toHaveCount(0);
    const main = (await page.locator('main').innerText()) ?? '';
    expect(main, 'a DONE column is back on the desk').not.toMatch(/\bDONE\b/);
  });

  test('four runs, with an accurate "showing N of M" and a way to the rest', async ({ page }) => {
    // FB-178's third criterion, and the one that needs a real history to mean anything: over six
    // reports "showing 4 of 6" and "showing 6 of 6" are both plausible.
    const rows = page.getByTestId('lane-activity-list').locator('li');
    const shown = await rows.count();
    expect(shown, `the desk drew ${shown} run rows`).toBeLessThanOrEqual(4);

    const foot = (await page.getByTestId('lane-activity-more').textContent()) ?? '';
    expect(foot, 'the footer does not state how many runs it is showing').toContain(`Showing the ${shown} most recent`);
    expect(foot).toMatch(/of [\d,]+ runs/);
    await expect(page.getByTestId('lane-activity-more').getByRole('link', { name: 'What happened' }))
      .toHaveAttribute('href', '/venture/arca/activity');
  });

  test('“What happened” never claims everything over a record it only partly read (FB-242)', async ({ page }) => {
    // The scale fixture is the only place in the gate where the record is larger than the page:
    // 1,773 run reports against a read that stops at twenty. The committed fixture holds six, so it
    // takes the unbounded branch and cannot exercise this at all — which is how the old sentence
    // shipped saying "Everything ARCA did since [today]" over 9,889 reports on production.
    await page.goto('/venture/arca/activity');
    const scope = (await page.getByTestId('activity-scope').textContent()) ?? '';

    expect(scope, 'the page claims to show everything over a partly-read record')
      .not.toMatch(/Everything .* did since/);
    expect(scope, 'the page does not say how much the record holds').toMatch(/1,773 reports/);
    expect(scope, 'the page does not say how far back the record goes').toMatch(/since \d+ \w+ 2026/);

    // And the caveat, which used to depend on whether the last step dropped a row.
    await expect(page.getByTestId('activity-capped')).toContainText('still in your venture’s records');
  });

  test('the repeated park is one row that says how many times', async ({ page }) => {
    // FB-178's fourth criterion. The fixture parks on ARCA-61 nineteen times in twenty, the way
    // production did, so if the merge stopped working the panel fills with one sentence.
    const repeats = page.locator('[data-testid$="-repeats"]');
    expect(await repeats.count(), 'no row states a repeat count over a history that is mostly repeats')
      .toBeGreaterThan(0);
    const said = (await repeats.first().textContent()) ?? '';
    expect(said, `the repeat count reads "${said}"`).toMatch(/\d/);
  });
});
