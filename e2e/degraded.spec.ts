import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-137 — every screen, with every read failing.
 *
 * This suite only means anything when the server was started with `E2E_FAIL_READS`. Run it:
 *
 *     E2E_FAIL_READS=all npx playwright test e2e/degraded.spec.ts
 *
 * ## Why it skips rather than passes when the faults are off
 *
 * A degraded-state suite that quietly passes against a healthy server is the worst kind of green:
 * it asserts nothing and says so in the same voice as a real result. `test.skip` is the honest
 * outcome, and it is loud in the report.
 */
const FAULTS_ON = (process.env.E2E_FAIL_READS ?? '').length > 0;

const SCREENS: ReadonlyArray<{ route: string; name: string; reads: boolean }> = [
  { route: '/', name: 'the ledger', reads: true },
  { route: '/venture/arca', name: 'the desk', reads: true },
  { route: '/venture/arca/tickets', name: 'tickets', reads: true },
  { route: '/venture/arca/activity', name: 'what happened', reads: true },
  { route: '/venture/arca/knowledge', name: 'memory', reads: true },
  { route: '/venture/arca/routines', name: 'recurring work', reads: true },
  { route: '/attention', name: 'needs you', reads: true },
  { route: '/venture/arca/composer', name: 'the composer', reads: false },
  { route: '/venture/arca/handbook', name: 'the handbook', reads: false },
];

/**
 * Sentences a screen must never say while it is failing to read.
 *
 * Each one is an invitation — it tells a founder their venture is a blank page — and over a failed
 * read it is a claim with no evidence behind it, and the most reassuring one the studio can make.
 */
const REASSURANCES = [
  'Nothing is waiting for you',
  'The queue is clear',
  'No tickets yet',
  'Nothing handed over yet',
  'No recurring work yet',
  'nothing is stuck',
];

test.describe('every screen, with every read failing (FB-137)', () => {
  test.skip(!FAULTS_ON, 'run with E2E_FAIL_READS=all — see the header of this file');

  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    // Prove the session held: every page is a 200, the login page included, and a sweep that never
    // checks has measured the login screen nine times.
    await page.goto('/venture/arca/handbook');
    expect(new URL(page.url()).pathname, 'not signed in').not.toContain('/login');
  });

  for (const { route, name, reads } of SCREENS) {
    test(`${name} renders, and says why`, async ({ page }) => {
      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      expect(res?.status(), `${route} answered ${res?.status()}`).toBe(200);

      const text = await page.evaluate(() => (document.querySelector('main') as HTMLElement)?.innerText ?? '');
      // Not a blank page. Three screens rendered NOTHING before this ticket, and two were 500s.
      expect(text.trim().length, `${route} rendered nothing at all`).toBeGreaterThan(80);

      if (reads) {
        // It says something failed, in words, somewhere on the screen.
        expect(text, `${route} never says it could not read`).toMatch(/could not (be )?read|not known|checking/i);
        for (const line of REASSURANCES) {
          expect(text, `${route} reassures the founder over a read it could not make: "${line}"`)
            .not.toContain(line);
        }
      }
    });
  }

  test('a record of use that could not be READ never reads as "nothing has read this" (FB-156)', async ({ page }) => {
    // The `Last used` column has three states and only two of them are the studio's to claim. With
    // the record unreadable, every cell must fall back to "we do not keep this" — printing "nothing
    // has read this document" over a read that failed would be a fact about the founder's venture
    // invented out of a broken request, on the screen whose whole job is to say what was read.
    await page.goto('/venture/arca/knowledge');
    const cells = page.locator('[data-testid^="memory-used-"]');
    const n = await cells.count();
    // With EVERY read failing the corpus is unreadable too, so there are no rows and the loop below
    // asserts nothing. That is the honest outcome to declare rather than to report as a pass — the
    // logic itself is pinned in lib/__tests__/readings.test.ts, where the corpus can be readable
    // while the record is not. Skipping says "not measured"; passing would say "measured, fine".
    test.skip(n === 0, 'the corpus is unreadable in this run, so there are no cells to check');
    for (let i = 0; i < n; i++) {
      await expect(cells.nth(i)).not.toHaveAttribute('data-use', 'never');
    }
  });

  test('the rail says "checking" rather than a spend it could not read', async ({ page }) => {
    // £0/£4,800 for a venture whose spending the studio had not managed to look at, on the
    // most-seen surface in the product.
    await page.goto('/venture/arca');
    const rail = await page.getByTestId('rail').first().innerText();
    expect(rail).toContain('checking');
    expect(rail, 'the rail states a spend it could not read').not.toMatch(/£\d/);
  });
});
