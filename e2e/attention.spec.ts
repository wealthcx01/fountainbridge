import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

// FB-007: the attention queue + PR-derived ticket status inference. Runs against fixture PRs
// (PRS_FIXTURE_DIR) so it's deterministic.
const SHOTS = 'e2e/__screenshots__';

test('attention queue lists open PRs oldest-first, with preview as the primary link', async ({ page }) => {
  await testLogin(page, 'john.gallagher@wealthcx.com'); // admin — sees all ventures' PRs
  await page.goto('/attention');

  await expect(page.getByTestId('attention-count')).toHaveText('2'); // 2 open, 1 merged excluded
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
  await expect(page.getByTestId('nav-attention-badge')).toHaveText('2');
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
