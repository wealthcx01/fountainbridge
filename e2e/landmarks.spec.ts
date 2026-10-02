import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-168 — every page has exactly one main region.
 *
 * A screen reader lets its user jump straight to "main", the part of the page that is the content.
 * Every venture page once had two, one inside the other: `app/layout.tsx` drew one around every
 * page and the venture layout drew another inside it. A listener jumping to "main" landed in the
 * outer one and had no way to tell which was the real content. It also broke our own checks:
 * `page.locator('main')` refuses to pick between two, so a script that asked for it threw instead
 * of measuring anything. That is how it was found.
 *
 * FB-203 removed the inner one. This holds it removed: it opens every page the UI gate already
 * visits, at desktop and at phone size, and counts. Two is a failure, and so is none.
 *
 * The same lesson as FB-124's two navigations: a doubled landmark is invisible in every check that
 * looks for one thing being present, and only a check that counts sees it.
 */
const JOHN = 'john.gallagher@wealthcx.com';

/** Every page the gate's other tests open, once each, without the query strings that pick a tab. */
const SIGNED_IN = [
  '/',
  '/attention',
  '/activity',
  '/lanes',
  '/foundry',
  '/handbook',
  '/handbook/how-to-start',
  '/how-it-works',
  '/playbook',
  '/playbook/moats',
  '/admin/timing',
  '/admin/machine-budgets',
  '/venture/arca',
  '/venture/arca/tickets',
  '/venture/arca/tickets?t=arca%2FARCA-1',
  '/venture/arca/knowledge',
  '/venture/arca/activity',
  '/venture/arca/composer',
  '/venture/arca/handbook',
  '/venture/arca/handbook/how-to-start',
  '/venture/arca/sell',
  '/venture/arca/work/arca/10',
  '/venture/arca/approvals/arca/free-post',
  '/venture/the-reset',
  '/venture/the-reset/knowledge',
  '/venture/the-reset/sell',
] as const;

const SIZES = [
  ['desktop', 1440, 1000],
  ['phone', 393, 851],
] as const;

async function mainCount(page: import('@playwright/test').Page): Promise<number> {
  // Counted from the finished page. The venture screens stream in pieces, and a second <main>
  // drawn by a late piece would not be there at the first paint.
  await page.waitForLoadState('load');
  return page.evaluate(() => document.querySelectorAll('main, [role="main"]').length);
}

for (const [size, width, height] of SIZES) {
  test(`every signed-in page has exactly one main region, at ${size} size`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height });
    await testLogin(page, JOHN);
    const wrong: string[] = [];
    for (const path of SIGNED_IN) {
      await page.goto(path);
      const n = await mainCount(page);
      if (n !== 1) wrong.push(`${path} has ${n}`);
    }
    // All the pages are opened before failing, so one red run names every page that is wrong.
    expect(wrong, `pages without exactly one <main> at ${size} size: ${wrong.join('; ')}`).toEqual([]);
  });

  test(`the sign-in page has exactly one main region, at ${size} size`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/login');
    expect(await mainCount(page)).toBe(1);
  });
}
