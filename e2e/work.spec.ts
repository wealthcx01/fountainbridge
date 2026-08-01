import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

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

    // A ticket is something a founder can genuinely read, so it is rendered.
    const ticket = page.locator('[data-testid^="work-file-"][data-kind="description"]').first();
    await expect(ticket).toContainText('congratulates you is worse');

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

  test('nothing on the work page sends the founder to a code host', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    expect(await page.locator('a[href*="github.com"]').count()).toBe(0);
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

  test('the decision comes before the detail (FB-081)', async ({ page }) => {
    // It used to sit under 13,856 characters, which is how a page teaches someone to press the
    // button without reading it.
    await page.goto('/venture/arca/work/arca/10');
    const accept = page.getByTestId('work-accept');
    if (await accept.count()) {
      const decision = await accept.boundingBox();
      const changes = await page.getByTestId('work-changes').boundingBox();
      expect(decision!.y).toBeLessThan(changes!.y);
    }
  });

  test('the page says how long it has been waiting (FB-081)', async ({ page }) => {
    // The queue said "17h old"; this page said nothing about time at all, so a founder deciding
    // whether to read it now or later had nothing to decide with.
    await page.goto('/venture/arca/work/arca/10');
    await expect(page.getByTestId('work-arca/10')).toContainText('Waiting');
  });
});
