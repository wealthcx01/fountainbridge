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
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/venture/arca');
  });

  test('a forged grant is never shown as an approval', async ({ page }) => {
    const card = page.getByTestId('approval-arca/forged-grant');
    await expect(card).toBeVisible();
    const prov = page.getByTestId('approval-arca/forged-grant-provenance');
    await expect(prov).toHaveAttribute('data-grant-provenance', 'unattested');
    // It stays in the queue awaiting the gate — a grant that does not verify is not an approval.
    await expect(page.getByTestId('approval-arca/forged-grant-approve')).toBeVisible();
  });

  test('the warning says what to do about it, not just that something is wrong', async ({ page }) => {
    const prov = page.getByTestId('approval-arca/forged-grant-provenance');
    await expect(prov).toContainText('Next step');
    // A bad signature is an incident, not a re-approve.
    await expect(prov).toContainText(/Tell Bruntsfield|incident/i);
  });

  test('the warning is announced, not only coloured', async ({ page }) => {
    // A state carried by colour alone is a state a screen-reader user does not get.
    const prov = page.getByTestId('approval-arca/forged-grant-provenance');
    await expect(prov).toContainText('Warning:');
    await expect(prov).toHaveCSS('color', 'rgb(138, 32, 32)'); // --color-error
  });

  test('a proposal that changed after approval reads as unverified, with a re-approve', async ({ page }) => {
    const prov = page.getByTestId('approval-arca/changed-proposal-provenance');
    await expect(prov).toHaveAttribute('data-grant-provenance', 'unattested');
    // This one IS a re-approve — the signature is genuine, the document moved.
    await expect(prov).toContainText(/changed|re-approve|read it again/i);
  });

  test('a genuinely attested grant reads as approved, naming the human', async ({ page }) => {
    // The counterweight: if everything rendered as unverified the tests above would pass for the
    // wrong reason.
    const prov = page.getByTestId('approval-arca/past-send-provenance');
    await expect(prov).toHaveAttribute('data-grant-provenance', 'attested');
    await expect(prov).toContainText('john.gallagher@wealthcx.com');
  });

  test('two approvals in different repos do not collide in the DOM', async ({ page }) => {
    // Since FB-045 an approval id is unique only within its department's repo. Repo-qualified test
    // ids are what keeps Playwright's strict mode from failing the moment two departments share a
    // ticket name.
    for (const id of ['past-send', 'forged-grant', 'changed-proposal']) {
      await expect(page.getByTestId(`approval-arca/${id}`)).toHaveCount(1);
    }
  });
});
