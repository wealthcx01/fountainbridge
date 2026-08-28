import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * The desk (FB-128).
 *
 * The screen a founder opens and leaves open. What is asserted here is the **order** — which is the
 * argument, and is contractual — plus the three properties that can be quietly wrong: that one count
 * reaches the summary, the banner and the rail's badge; that the degraded strip sits below anything
 * the founder must act on; and that the prompt bar carries words without filing anything.
 */

const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

test.describe('the desk', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
    await page.goto('/venture/arca');
  });

  test('the sections run in the design’s order', async ({ page }) => {
    // The order is the argument: what is happening, what waits on me, what my team did, is any of
    // it working. A dashboard that shuffles those is a dashboard that answers a different question.
    const order = await page.evaluate(() => {
      const ids = ['desk-summary', 'prompt-bar', 'office-plate', 'lane-activity', 'dept-surfaces'];
      return ids
        .map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          return el ? { id, top: el.getBoundingClientRect().top + window.scrollY } : null;
        })
        .filter((x): x is { id: string; top: number } => x !== null);
    });
    expect(order.map((o) => o.id)).toEqual(['desk-summary', 'prompt-bar', 'office-plate', 'lane-activity', 'dept-surfaces']);
    expect(order.map((o) => o.top)).toEqual([...order.map((o) => o.top)].sort((a, b) => a - b));

    await page.screenshot({ path: `${SHOTS}/20-desk.png`, fullPage: true });
  });

  test('the summary, the banner and the rail’s badge are one count', async ({ page }) => {
    // FB-099 is what happens when they are not: a badge saying 15 over columns saying 0.
    const summary = (await page.getByTestId('desk-summary').textContent()) ?? '';
    const inSummary = summary.match(/(\d+)\s+decisions?\s+waits?\s+on you/)?.[1] ?? '0';

    // Absent at zero rather than showing "0" — so an absent badge asserts the count is zero.
    const badge = page.getByTestId('rail-needs-badge');
    if (await badge.count()) expect(((await badge.textContent()) ?? '').trim()).toBe(inSummary);
    else expect(inSummary).toBe('0');

    const banner = page.getByTestId('blocker-banner');
    if (await banner.count()) {
      expect((await banner.textContent()) ?? '').toContain(`${inSummary} item`);
    } else {
      expect(inSummary).toBe('0');
    }
  });

  test('what could not be read sits below what must be acted on', async ({ page }) => {
    // A condition that clears on its own must never push the one item a founder is blocking down
    // the page. If the fixtures produce no failures there is nothing to place, which is also right.
    const strip = page.getByTestId('degraded-strip');
    if ((await strip.count()) === 0) return;

    const tops = await page.evaluate(() => {
      const y = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.getBoundingClientRect().top + window.scrollY : null;
      };
      return { strip: y('[data-testid="degraded-strip"]'), brief: y('[data-testid="founder-brief"]') };
    });
    if (tops.brief !== null && tops.strip !== null) expect(tops.strip).toBeGreaterThan(tops.brief);
  });

  test('a prompt chip seeds the composer and files nothing', async ({ page }) => {
    await page.getByTestId('prompt-chip-0').click();
    await expect(page.getByTestId('prompt-bar-input')).toHaveValue('Break this document into tickets');

    await page.getByTestId('prompt-bar-send').click();
    await page.waitForURL(/\/composer/);
    // The words arrive already typed, and nothing has been filed: the composer's own gate is still
    // the only thing that turns them into work.
    await expect(page.getByTestId('composer-input')).toHaveValue('Break this document into tickets');
    await expect(page.getByTestId('composer-thread').getByTestId('composer-turn-0')).toHaveCount(0);
  });

  test('the office says it is not live rather than drawing an empty room', async ({ page }) => {
    // A frozen last-known scene would read as a team sitting still. FB-139 makes it live.
    await expect(page.getByTestId('office-placeholder')).toContainText('Not live yet');
  });

  test('Scale says it is not connected, and counts what waits on it', async ({ page }) => {
    const scale = page.getByTestId('dept-scale-outcome');
    await expect(scale).toContainText('Not connected · platform tbd');
    // No invented number: whatever it says is a count of real tickets.
    await expect(scale).toContainText(/(\d+ tickets? waiting on it|No tickets yet)/);
  });

  test('Sell reports nothing rather than reporting zeroes', async ({ page }) => {
    const sell = page.getByTestId('dept-sell-outcome');
    await expect(sell).toContainText('Nothing reported yet');
  });

  test('it fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk-summary')).toBeVisible();
    await expect(page.getByTestId('prompt-bar-input')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/20-mobile-desk.png`, fullPage: true });
  });
});
