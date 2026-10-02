import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * A new venture's first tickets come out of a founding map (FB-236).
 *
 * The walk itself is a conversation with the composer on the venture's box, so what a browser can
 * check is its last stage: the map and the first tickets arrive together, the founder can read the
 * map and every line says which part of it the line came from, and one press sends both.
 *
 * The scripted reply is `fixtures/composer/founding.sse`, generated from the same fixture the unit
 * tests use, and a unit test holds it to the rules the studio files by.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

async function handOver(page: import('@playwright/test').Page, ask = 'Hand over the map') {
  await page.goto('/venture/arca/composer');
  await page.getByTestId('composer-input').fill(ask);
  await page.getByTestId('composer-send').click();
}

test.describe('the founding map and its first tickets', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('the map arrives with the tickets', async ({ page }) => {
    await handOver(page);
    await expect(page.getByTestId('plan-panel')).toBeVisible();
    await expect(page.getByTestId('plan-map')).toContainText('I want the kiln to keep its own book');
    await expect(page.getByTestId('plan-lines').getByRole('listitem')).toHaveCount(5);
    await expect(page.getByTestId('plan-file-all')).toHaveText('File all 5');
    await expect(page.getByTestId('plan-panel')).toContainText('They file together with the map');
    // The source is the map just above, so it is not named again mid-sentence ("From The founding map").
    await expect(page.getByTestId('plan-panel')).not.toContainText('From The founding map');
    await page.screenshot({ path: `${SHOTS}/24-founding-map.png`, fullPage: true });
  });

  test('pressing file sends the map with the tickets', async ({ page }) => {
    // The e2e studio has no write token, so the press ends in "not set up". That refusal comes AFTER
    // the server's map checks: a press that left the map behind is refused earlier, with "the map
    // itself did not come with them". So reaching "not set up" proves the map travelled with the set.
    await handOver(page);
    await page.getByTestId('plan-file-all').click();
    await expect(page.getByTestId('plan-error')).toContainText('not set up');
    await expect(page.getByTestId('plan-error')).not.toContainText('did not come with them');
    await expect(page.getByTestId('plan-filed')).toHaveCount(0);
  });

  test('every line says which part of the map it came from', async ({ page }) => {
    await handOver(page);
    await expect(page.getByTestId('plan-line-kiln-insurance-records')).toContainText('Unknown unknowns');
    await expect(page.getByTestId('plan-line-ask-twelve-owners')).toContainText('Known unknowns');
  });

  test('the whole map can be read before pressing, all four parts of it', async ({ page }) => {
    await handOver(page);
    await page.getByTestId('plan-map-details').locator('summary').click();
    await expect(page.getByTestId('plan-map-section')).toHaveCount(4);
    await expect(page.getByTestId('plan-map-details')).toContainText('Two earlier booking tools for studios closed');
  });

  test('the map is not shown twice as raw data in the conversation', async ({ page }) => {
    await handOver(page);
    await expect(page.getByTestId('plan-panel')).toBeVisible();
    await expect(page.getByTestId('composer-draft')).toHaveCount(0);
  });

  test('a map whose tickets cannot be read stays on screen, and says what is missing', async ({ page }) => {
    // Before, the conversation hid the map and the side panel showed nothing: the walk's whole
    // result vanished without a word (CLAUDE.md #10).
    await handOver(page, 'Hand over the map, with unreadable tickets');
    await expect(page.getByTestId('rail-map-only')).toBeVisible();
    await expect(page.getByTestId('rail-map-problem')).toContainText('could not be read');
    await expect(page.getByTestId('plan-map-section')).toHaveCount(4);
    await expect(page.getByTestId('plan-file-all')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/24-founding-map-only.png`, fullPage: true });
  });
});
