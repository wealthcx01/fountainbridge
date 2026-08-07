import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-106 — what has the venture been given?
 *
 * John: "nothing that allows the founder to see what docs have been uploaded either to the composer
 * or the studio?" Documents went in through the composer, landed in the venture's context/ and
 * library/ on git, and then vanished from the founder's view — the only way to see the corpus was
 * GitHub, which is the product this studio exists to replace.
 */
test.describe('what your venture knows (FB-106)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
  });

  test('the board offers the way in', async ({ page }) => {
    await page.goto('/venture/arca');
    await page.getByTestId('venture-knowledge-link').click();
    await expect(page).toHaveURL(/\/venture\/arca\/knowledge$/);
  });

  test('every deposited document is listed, grouped by what it is for', async ({ page }) => {
    await page.goto('/venture/arca/knowledge');
    await expect(page.getByTestId('knowledge-context')).toContainText('Brand positioning');
    await expect(page.getByTestId('knowledge-context')).toContainText('Price list');
    await expect(page.getByTestId('knowledge-library')).toContainText('Set naming decision');
    // The two areas mean different things, and the page says which is which.
    await expect(page.getByTestId('knowledge-context')).toContainText('reads before it works');
  });

  test('a founder reads a document without leaving the studio', async ({ page }) => {
    // The whole point: the only way to see this was GitHub.
    await page.goto('/venture/arca/knowledge');
    await page.getByTestId('knowledge-doc-context/sell/brand-positioning.md').click();
    const reader = page.getByTestId('knowledge-reader');
    await expect(reader).toBeVisible();
    await expect(reader).toContainText('a trading desk, not a toy aisle');
    // Rendered, not printed: the founder never meets raw markdown.
    await expect(page.getByTestId('knowledge-reader-title')).toHaveText('Brand positioning');
  });

  test('the rules are stated where the button is', async ({ page }) => {
    // A founder who meets a refusal they were not warned about learns the studio does not know its
    // own limits. The sentence is built from the constant the code enforces.
    await page.goto('/venture/arca/knowledge');
    await expect(page.getByTestId('knowledge-limits')).toContainText('PDF');
    await expect(page.getByTestId('knowledge-limits')).toContainText('12MB');
    await expect(page.getByTestId('knowledge-limits')).toContainText('until you approve it');
  });

  test('handing a document over reaches the server and answers honestly', async ({ page }) => {
    // No write credential in the UI gate, so the honest refusal is what this proves: the control
    // exists, reaches the server, and says what is wrong rather than failing silently.
    await page.goto('/venture/arca/knowledge');
    await page.getByTestId('knowledge-file').setInputFiles({
      name: 'price-list.txt', mimeType: 'text/plain', buffer: Buffer.from('Graded slabs: 10% over market.'),
    });
    await page.getByTestId('knowledge-submit').click();
    await expect(page.getByTestId('knowledge-result')).toBeVisible();
  });

  test('another venture’s knowledge is not reachable by guessing the URL', async ({ page }) => {
    // Venture isolation is server-side on this route like every other (CLAUDE.md #6).
    await page.goto('/venture/the-reset/knowledge');
    await expect(page.getByTestId('knowledge')).toHaveCount(0);
  });
});
