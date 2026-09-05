import { test, expect } from '@playwright/test';
import { inTopDownOrder, testLogin } from './helpers';

// The page a founder actually makes a decision on had no picture in the UI-gate gallery, which is
// how it came to be reviewed by reading code rather than by looking at it (FB-107).
const SHOTS = 'e2e/__screenshots__';

/**
 * FB-064 — reading and accepting work without leaving the studio.
 *
 * The behaviour under test is the one that was missing entirely: the Attention page promised
 * "waiting on your OK" and offered a single link to github.com. These assert that a founder can go
 * from that queue to the work, read what they can judge, and be told honestly about what they
 * cannot — with the accept button appearing only when it should.
 */
test.describe('reading and accepting a piece of work', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
  });

  test('the attention queue opens the work inside the studio', async ({ page }) => {
    await page.goto('/attention');
    await page.getByTestId('approval-primary-arca#10').click();
    await expect(page).toHaveURL(/\/venture\/arca\/work\/arca\/10$/);
    await expect(page.getByTestId('work-arca/10')).toBeVisible();
  });

  test('prose is shown, and code is described rather than displayed', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');

    // A ticket is something a founder can genuinely read, so it is rendered — since FB-107 in the
    // "what you asked for" section at the top, whole, rather than as a fragment of its own diff.
    await expect(page.getByTestId('work-ask')).toContainText('congratulates you is worse');
    const ticket = page.locator('[data-testid^="work-file-"][data-kind="description"]').first();
    await expect(ticket).toContainText('at the top of this page');
    await expect(ticket).not.toContainText('# ARCA-44');

    // A code change is not. Showing a TypeScript diff and calling it a review would be asking a
    // founder to rubber-stamp something they cannot read.
    const code = page.locator('[data-testid^="work-file-"][data-kind="code"]').first();
    await expect(code).toContainText('change to the app');
    await expect(code).toContainText('31 lines added');
    await expect(code).not.toContainText('@@');
  });

  test('it summarises the whole change in one sentence', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await expect(page.getByTestId('work-arca/10')).toContainText('2 files');
    await expect(page.getByTestId('work-arca/10')).toContainText('the description of the work');
  });

  test('work whose checks passed can be accepted', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await expect(page.getByTestId('work-checks')).toHaveAttribute('data-checks', 'success');
    await expect(page.getByTestId('work-accept')).toBeVisible();
  });

  test('work whose checks are still running cannot, and says what to do', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/11');
    await expect(page.getByTestId('work-accept')).toHaveCount(0);
    const blocked = page.getByTestId('work-blocked');
    await expect(blocked).toHaveAttribute('data-reason', 'checks-running');
    await expect(blocked).toContainText('few minutes');
  });

  test('work from another venture is not reachable by guessing the URL', async ({ page }) => {
    // Server-side scoping (non-negotiable 6) applies to this route like every other.
    await page.goto('/venture/arca/work/thereset-platform/1');
    await expect(page.getByTestId('work-arca/1')).toHaveCount(0);
  });

  test('the code host is a reference, never the way through (FB-107)', async ({ page }) => {
    // FB-064 banned the link outright, because the queue used to hand the founder to github.com
    // instead of showing them the work. FB-107 amends that: the drawer over-linked and this page did
    // not link at all, and both are wrong the same way. One quiet reference, below the decision,
    // never a button.
    await page.goto('/venture/arca/work/arca/10');
    const host = page.locator('a[href*="github.com"]');
    await expect(host).toHaveCount(1);
    await expect(host).not.toHaveClass(/btn/);
    await inTopDownOrder([
      ['what the work did', page.getByTestId('work-description')],
      ['the GitHub reference', host],
    ]);
  });

  test('the evidence is a decision, not a transcript (FB-081)', async ({ page }) => {
    // FB-064 put the whole pull-request body here and was right to — when the change is code a
    // founder cannot read, the proof it was checked is what they judge. But it ran to 4,000+
    // characters of gate transcript, and the whole page to 13,856.
    await page.goto('/venture/arca/work/arca/10');
    await expect(page.getByTestId('work-description')).toBeVisible();

    // The full record exists and is one press away, never hidden.
    await expect(page.getByTestId('work-record')).toHaveCount(0);
    await page.getByTestId('work-record-toggle').click();
    await expect(page.getByTestId('work-record')).toBeVisible();
  });

  test('the decision never sits under the transcript (FB-081, re-expressed by FB-107)', async ({ page }) => {
    // FB-081 put the decision above "what changed" because it used to sit under 13,856 characters of
    // gate transcript — that is how a page teaches someone to press the button without reading it.
    // FB-107 reorders the page around the decision (ask → did → see → changes → decide → record) and
    // the transcript moves BELOW the button, which is what FB-081 was actually protecting. The
    // bounded file list above it is a few lines, not four thousand words.
    await page.goto('/venture/arca/work/arca/10');
    await inTopDownOrder([
      ['the decision', page.getByTestId('work-decision')],
      ['the record', page.getByTestId('work-record-toggle')],
    ]);
  });

  test('the whole decision page, for the gallery (FB-107)', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await expect(page.getByTestId('work-ask')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/18-work-decision.png`, fullPage: true });
  });

  test('the page reads ask → did → see → changes → decide → record (FB-107)', async ({ page }) => {
    // John read the page top-down as a person making a decision and every complaint was the same
    // one: the order was inverted. His own ask was at the BOTTOM, as a diff fragment of its ticket.
    await page.goto('/venture/arca/work/arca/10');
    await inTopDownOrder([
      ['the ask', page.getByTestId('work-ask')],
      ['what it did', page.getByTestId('work-description')],
      ['what changed', page.getByTestId('work-changes')],
      ['the decision', page.getByTestId('work-decision')],
      ['the record', page.getByTestId('work-record-toggle')],
    ]);
  });

  test('the ask is the founder’s own ticket, whole and readable (FB-107)', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    const ask = page.getByTestId('work-ask');
    await expect(ask).toContainText('ARCA-44');
    await expect(ask).toContainText('congratulates you is worse');
    // Rendered, not printed: `**Status:**` and `- [ ]` used to reach the founder as literal text.
    await expect(page.getByTestId('work-ask-body')).not.toContainText('**Status:**');
    await expect(page.getByTestId('work-ask-body').locator('h2').first()).toBeVisible();
    // The ask does not repeat its own name as a second page heading.
    await expect(page.getByTestId('work-ask-body').locator('h1')).toHaveCount(0);
    // And the page's heading is the ask's title, not the branch-speak the lane named its work.
    await expect(page.locator('h1')).toContainText('Seed script must fail loudly');
  });

  test('the tool’s signature never reaches the founder (FB-107)', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await page.getByTestId('work-record-toggle').click();
    await expect(page.getByTestId('work-arca/10')).not.toContainText('Generated with');
    await expect(page.getByTestId('work-arca/10')).not.toContainText('Co-Authored-By');
  });

  test('a knowledge deposit is introduced, not filed silently (FB-107)', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/12');
    await expect(page.getByTestId('work-changes')).toContainText('also added to what your venture knows');
  });

  test('work that names a required action offers it (FB-107)', async ({ page }) => {
    // The audit's new dead end: the page said "the team needs to bring it up to date before it can
    // be accepted" and gave the founder no control that could ask for that.
    await page.goto('/venture/arca/work/arca/12');
    await expect(page.getByTestId('work-blocked')).toHaveAttribute('data-reason', 'conflicts');
    await page.getByTestId('work-sendback-open').click();
    await expect(page.getByTestId('work-note')).toHaveValue(/bring this up to date/);
  });

  test('a founder can send work back with a note (FB-107)', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await page.getByTestId('work-sendback-open').click();
    await page.getByTestId('work-note').fill('The audit missed the mobile views.');
    await page.getByTestId('work-sendback').click();
    // No write credential in the UI gate, so the honest refusal is what this proves: the control
    // exists, reaches the server, and says what is wrong rather than failing silently.
    await expect(page.getByTestId('work-msg')).toBeVisible();
  });

  test('the page says how long it has been waiting (FB-081)', async ({ page }) => {
    // The queue said "17h old"; this page said nothing about time at all, so a founder deciding
    // whether to read it now or later had nothing to decide with.
    await page.goto('/venture/arca/work/arca/10');
    await expect(page.getByTestId('work-arca/10')).toContainText('Waiting');
  });
});
