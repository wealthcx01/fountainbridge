import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * The approval card's provenance render (FB-058).
 *
 * This is the only place the sentence "the studio cannot verify this approval" reaches a human, and
 * until this file existed it was deletable without failing a single test — `app/` was outside the
 * unit glob and no e2e touched the card. The most consequential surface in the product was the least
 * covered one.
 *
 * The fixtures behind these tests are adversarial on purpose (`_adversarial` in the grant file keeps
 * `make sign-approval-fixtures` from quietly repairing them):
 *   forged-grant      — a grant.json with a bogus attestation, of the kind a lane could write
 *   changed-proposal  — a genuinely studio-signed grant, pinned to a proposal that then changed
 */
test.describe('what the studio can prove about an approval', () => {
  // FB-183: a send awaiting the gate is a ROW on the desk and a decision on its own page. These
  // assertions follow the provenance render to where it now lives; the desk keeps the alarm, which
  // is asserted separately below.
  const decisionPage = (id: string) => `/venture/arca/approvals/arca/${id}`;

  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
  });

  test('a forged grant is never shown as an approval', async ({ page }) => {
    await page.goto(decisionPage('forged-grant'));
    const card = page.getByTestId('approval-arca/forged-grant');
    await expect(card).toBeVisible();
    const prov = page.getByTestId('approval-arca/forged-grant-provenance');
    await expect(prov).toHaveAttribute('data-grant-provenance', 'unattested');
    // It stays awaiting the gate — a grant that does not verify is not an approval.
    await expect(page.getByTestId('approval-arca/forged-grant-approve')).toBeVisible();
  });

  test('the warning says what to do about it, not just that something is wrong', async ({ page }) => {
    await page.goto(decisionPage('forged-grant'));
    const prov = page.getByTestId('approval-arca/forged-grant-provenance');
    await expect(prov).toContainText('Next step');
    // A bad signature is an incident, not a re-approve.
    await expect(prov).toContainText(/Tell Bruntsfield|incident/i);
  });

  test('the warning is announced, not only coloured', async ({ page }) => {
    // A state carried by colour alone is a state a screen-reader user does not get.
    await page.goto(decisionPage('forged-grant'));
    const prov = page.getByTestId('approval-arca/forged-grant-provenance');
    await expect(prov).toContainText('Warning:');
    await expect(prov).toHaveCSS('color', 'rgb(138, 32, 32)'); // --color-error
  });

  test('a proposal that changed after approval reads as unverified, with a re-approve', async ({ page }) => {
    await page.goto(decisionPage('changed-proposal'));
    const prov = page.getByTestId('approval-arca/changed-proposal-provenance');
    await expect(prov).toHaveAttribute('data-grant-provenance', 'unattested');
    // This one IS a re-approve — the signature is genuine, the document moved.
    await expect(prov).toContainText(/changed|re-approve|read it again/i);
  });

  /**
   * The alarm survives becoming a row (FB-183).
   *
   * This is the assertion that would have caught the regression writing that ticket introduced: the
   * card carried the "cannot verify" warning, and the first version of the row carried only a title,
   * so a forged grant would have read as an ordinary line in a list.
   */
  test('the desk itself still shouts about a grant it cannot verify', async ({ page }) => {
    await page.goto('/venture/arca');
    const warning = page.getByTestId('waiting-external-arca-forged-grant-unverified');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('cannot verify');
    await expect(warning).toContainText('Warning:');
    await expect(warning).toHaveCSS('color', 'rgb(138, 32, 32)');
  });

  test('the row is a pointer, and the decision is on the page it opens', async ({ page }) => {
    await page.goto('/venture/arca');
    // No approve control anywhere on the desk — the whole point of the ticket.
    await expect(page.locator('[data-testid$="-approve"]')).toHaveCount(0);
    await page.getByTestId('waiting-decide-external-arca-forged-grant').click();
    await expect(page).toHaveURL(/\/venture\/arca\/approvals\/arca\/forged-grant$/);
    await expect(page.getByTestId('approval-arca/forged-grant-approve')).toBeVisible();
    await expect(page.getByTestId('approval-arca/forged-grant-refuse')).toBeVisible();
  });

  test('a genuinely attested grant reads as approved, naming the human', async ({ page }) => {
    await page.goto('/venture/arca');
    // The counterweight: if everything rendered as unverified the tests above would pass for the
    // wrong reason.
    const prov = page.getByTestId('approval-arca/past-send-provenance');
    await expect(prov).toHaveAttribute('data-grant-provenance', 'attested');
    await expect(prov).toContainText('john.gallagher@wealthcx.com');
  });

  test('an approved action stays visible instead of disappearing', async ({ page }) => {
    await page.goto('/venture/arca');
    // Found by writing the test above: `granted` rendered NOWHERE. A founder clicked Approve on
    // something irreversible and the card vanished, returning only if it later failed. Every
    // approval now appears somewhere with its state on it.
    const decided = page.getByTestId('approvals-decided');
    await expect(decided).toBeVisible();
    await expect(decided).toContainText('Decided');
    await expect(page.getByTestId('approval-arca/past-send-state')).toHaveText('approved');
  });

  test('two approvals in different repos do not collide in the DOM', async ({ page }) => {
    await page.goto('/venture/arca/approvals/arca/past-send');
    // Since FB-045 an approval id is unique only within its department's repo. Repo-qualified test
    // ids are what keeps Playwright's strict mode from failing the moment two departments share a
    // ticket name.
    for (const id of ['past-send', 'forged-grant', 'changed-proposal']) {
      await page.goto(`/venture/arca/approvals/arca/${id}`);
      await expect(page.getByTestId(`approval-arca/${id}`)).toHaveCount(1);
    }
  });
});
