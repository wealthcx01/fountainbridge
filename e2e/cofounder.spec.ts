import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-201 — the studio's cofounder and the dial John turns it with. A Bruntsfield page. It must say,
 * in words, that nothing on it can make the cofounder send, spend, merge, deploy or approve.
 */
test.describe('the studio’s cofounder (FB-201)', () => {
  test('John sees the stop, each venture’s standing and dial, and the venture it is holding back on', async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    await page.goto('/admin/cofounder');
    await expect(page.getByTestId('cofounder-admin')).toBeVisible();
    await expect(page.getByTestId('cofounder-floor')).toContainText('It can never send anything, spend money');
    await expect(page.getByTestId('cofounder-floor')).toContainText('There is no switch on this page that changes that');
    await expect(page.getByTestId('cofounder-stop')).toBeVisible();
    await expect(page.getByTestId('cofounder-arca-standing')).toContainText('Holding back until a person decides.');
    await expect(page.getByTestId('cofounder-arca-latch')).toContainText('ARCA-61 has not moved in 9 days.');
    await expect(page.getByTestId('cofounder-arca-release')).toBeVisible();
    await expect(page.getByTestId('cofounder-arca-on')).toBeChecked();
    await expect(page.getByTestId('cofounder-the-reset-standing')).toContainText('Off.');
    await expect(page.getByTestId('cofounder-the-reset-on')).not.toBeChecked();
    await expect(page.getByTestId('cofounder-the-reset-latch')).toHaveCount(0);
    // The missing switch is the design: nothing on the page offers to let it act.
    await expect(page.getByLabel(/send|spend|merge|deploy|approve/i)).toHaveCount(0);
  });

  test('the page, drawn at desktop and phone size for the gallery, with its height', async ({ page }) => {
    await testLogin(page, 'john.gallagher@wealthcx.com');
    for (const [size, width, height] of [['desktop', 1440, 1000], ['phone', 393, 851]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/admin/cofounder');
      await expect(page.getByTestId('cofounder-admin')).toBeVisible();
      const m = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      console.log(`[cofounder] ${size} ${width}x${height}: page height ${m.height}px, sideways ${m.sideways}px`);
      expect(m.sideways).toBe(0);
      await page.screenshot({ path: `e2e/__screenshots__/fb201-cofounder-${size}.png`, fullPage: true });
    }
  });

  test('a founder is told plainly that it is not for them', async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/admin/cofounder');
    await expect(page.getByTestId('cofounder-forbidden')).toBeVisible();
    await expect(page.getByTestId('cofounder-admin')).toHaveCount(0);
  });
});
