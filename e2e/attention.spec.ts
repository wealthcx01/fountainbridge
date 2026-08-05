import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-007: the attention queue + PR-derived ticket status inference. Runs against fixture PRs
// (PRS_FIXTURE_DIR) so it's deterministic.
const SHOTS = 'e2e/__screenshots__';

test('attention queue lists open PRs oldest-first, with preview as the primary link', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com'); // admin — sees all ventures' PRs
  await page.goto('/attention');

  // 4 open (10, 11, 13, 14), 1 merged excluded. FB-099 added 13 and 14 — the lane's own branch shape,
  // one that matches a ticket by slug and one that matches nothing at all.
  await expect(page.getByTestId('attention-count')).toHaveText('4');
  // FB-024: plain-language copy, no git jargon ("open PR"/"the workshop never merges").
  await expect(page.getByText('Nothing goes live until you approve it.')).toBeVisible();
  const queue = page.getByTestId('attention-queue');
  await expect(queue).toBeVisible();

  // Oldest first: PR #10 (2026-07-15) before PR #11 (2026-07-19).
  const rows = queue.locator('[data-testid^="approval-arca#"]');
  await expect(rows.nth(0)).toHaveAttribute('data-testid', 'approval-arca#10');
  await expect(rows.nth(1)).toHaveAttribute('data-testid', 'approval-arca#11');

  // FB-064: the title opens the work INSIDE the studio. This page promises "waiting on your OK"
  // and used to offer only a link to github.com — three of the seven steps in the loop happened in
  // a developer tool the founder was never meant to open.
  await expect(page.getByTestId('approval-primary-arca#10')).toHaveAttribute('href', '/venture/arca/work/arca/10');
  await expect(page.getByTestId('approval-primary-arca#11')).toHaveAttribute('href', '/venture/arca/work/arca/11');

  // The preview is still one click away when there is one — it just is not the only thing to click.
  await expect(page.getByTestId('approval-preview-arca#10')).toHaveAttribute('href', /preview\.example\.com/);

  // Nothing on this page sends a founder to a code host any more.
  const offsite = await page.locator('a[href*="github.com"]').count();
  expect(offsite).toBe(0);

  await page.screenshot({ path: `${SHOTS}/07-attention-queue.png`, fullPage: true });
});

test('nav shows the attention badge count', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/');
  await expect(page.getByTestId('nav-attention-badge')).toHaveText('4');
});

test('open PR moves its ticket to pr-open in the venture board (status inference)', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/venture/arca');
  // ARCA-1's markdown status is "In progress", but open PR #10 references it → pr-open column.
  await expect(page.getByTestId('col-pr-open').getByTestId('ticket-ARCA-1')).toBeVisible();
});

test('a founder sees only their own ventures in the queue', async ({ page }) => {
  await testLogin(page, 'ross@bruntsfield.capital'); // the-reset only; its repos have no PR fixtures
  await page.goto('/attention');
  await expect(page.getByTestId('attention-empty')).toBeVisible();
  // arca's PRs (John's fixture) must NOT leak into Ross's queue.
  await expect(page.getByTestId('approval-arca#10')).toHaveCount(0);
});

test('the queue says what the checks mean, not CI UNKNOWN', async ({ page }) => {
  // FB-076. `CI UNKNOWN` in monospace small-caps beside every item means "this repository has no
  // automatic checks" — true of a young venture and completely fine, and it read as something being
  // wrong. The work view already said it plainly; the queue did not, so the same fact was
  // reassuring on one screen and alarming on the other.
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/attention');
  const body = (await page.locator('body').textContent()) ?? '';
  expect(body).not.toContain('CI unknown');
  expect(body).not.toContain('CI UNKNOWN');
  await expect(page.getByTestId('approval-ci').first()).not.toHaveText(/^CI /);
});

test('read failures sit below the work and are grouped by cause', async ({ page }) => {
  // The version this replaced opened the page with five failures and two causes run into one
  // sentence, above the work the founder came for.
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/attention');
  const failures = page.getByTestId('attention-errors');
  if (await failures.count()) {
    const queueBox = await page.getByTestId('attention-queue').boundingBox();
    const failBox = await failures.boundingBox();
    expect(failBox!.y).toBeGreaterThan(queueBox!.y);   // below, not above
    // Never a repository owner in front of a founder.
    expect((await failures.textContent()) ?? '').not.toContain('wealthcx01/');
  }
});

test('four destinations, each named for the job (FB-067)', async ({ page }) => {
  // Eight, three of which — Ventures, Workstreams, Foundry — sat next to each other and could not be
  // told apart from the words. They described how the software is organised, not what a founder came
  // to do.
  await testLogin(page, 'ross@bruntsfield.capital');
  await page.goto('/attention');
  const nav = (await page.getByTestId('topnav').locator('a').allTextContents())
    .map((t) => t.replace(/\d+$/, '').trim());
  expect(nav).toEqual(['Your venture', 'Needs you', 'What happened', 'Handbook']);

  // The `03` was a section number from the Bruntsfield marketing site.
  await expect(page.locator('header')).not.toContainText('03');
});

test('an admin is told it is an admin view (FB-067)', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/attention');
  await expect(page.getByTestId('topnav')).toContainText('All ventures');
});

test('the moved pages still exist and are findable (FB-067)', async ({ page }) => {
  // They move, they do not disappear. A 404 would be deleting content the ticket said to keep.
  await testLogin(page, 'john.gallagher@wealthcx.com');
  for (const path of ['/foundry', '/playbook', '/lanes']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
  }
  await page.goto('/handbook');
  await expect(page.getByTestId('handbook-foundry')).toBeVisible();
  await expect(page.getByTestId('handbook-playbook')).toBeVisible();
});

test('badges say what they mean and can be reached by keyboard (FB-068)', async ({ page }) => {
  // A badge that cannot be interrogated trains people to ignore badges.
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await page.goto('/venture/the-reset');
  const stale = page.getByTestId('lane-stale-thereset-platform');
  if (await stale.count()) {
    await expect(stale).toHaveAttribute('tabindex', '0');
    const title = await stale.getAttribute('title');
    expect(title?.length ?? 0).toBeGreaterThan(30);   // an explanation, not a restatement
    await expect(stale).not.toHaveText(/^⚠ stale$/);
  }
});


/**
 * FB-100 — words a founder should never meet. The items the walkthrough actually met, pinned so the
 * next surface does not re-earn them.
 */
test.describe('the walkthrough’s words (FB-100)', () => {
  test('the sign-in page does not disown its own second door', async ({ page }) => {
    // The subtitle read "Sign in with your venture Google account" directly above the email-and-
    // password form — a founder holding an email login told, by the page offering it, to use Google.
    await page.goto('/login');
    await expect(page.getByTestId('password-login')).toBeVisible();
    await expect(page.locator('section')).toContainText('email and password');
  });

  test('one alarm for one fact, not one per card', async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/attention');
    const shared = page.getByTestId('attention-checks-shared');
    const perCard = page.getByTestId('approval-ci');
    // Either the queue says it once above the list, or the items genuinely differ and each says its
    // own. Never fifteen copies of one sentence.
    if (await shared.count()) {
      await expect(perCard).toHaveCount(0);
    } else {
      expect(new Set(await perCard.evaluateAll((els) => els.map((e) => e.getAttribute('data-checks')))).size)
        .toBeGreaterThan(1);
    }
  });

  test('a wait says who it is waiting on', async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/attention');
    await expect(page.getByTestId('attention-queue')).toContainText('for you');
  });

  test('the studio does not introduce the founder to themselves', async ({ page }) => {
    // "Founder: John Gallagher" while signed in AS the founder. The manifest is right; this is
    // presentation. arca.founder@bruntsfield.capital is ARCA's named founder in the manifest.
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/venture/arca');
    await expect(page.getByTestId('board-founder')).toContainText('Founder: you');
  });
});
