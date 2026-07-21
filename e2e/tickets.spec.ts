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
  // Graceful degradation, surfaced not hidden: the imperfect ticket (ARCA-4, odd status) drives the
  // warnings badge; the stray README is counted as a skipped non-ticket file, not shown as a card.
  await expect(page.getByTestId('warnings-badge')).toBeVisible();
  await expect(page.getByTestId('lane-skipped-arca')).toBeVisible();

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
  await testLogin(page, 'ross@thereset.com'); // founder of the-reset only
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
