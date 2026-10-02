import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';
import { REFUSED, SIGNED_IN, SIGNED_OUT } from './landmark-pages';

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
 * FB-203 removed the inner one. This holds it removed: it opens every page the studio has (the list
 * is in ./landmark-pages.ts, and a unit test fails if a page is missing from it), at desktop and at
 * phone size, and counts. Two is a failure, and so is none.
 *
 * The same lesson as FB-124's two navigations: a doubled landmark is invisible in every check that
 * looks for one thing being present, and only a check that counts sees it.
 */
const JOHN = 'john.gallagher@wealthcx.com';


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
      // Where the browser landed, not where it was sent. A page that redirected somewhere else
      // was never counted, and a count of the wrong page is not a pass (FB-151's lesson).
      const landed = new URL(page.url()).pathname;
      if (landed !== path.split('?')[0]) wrong.push(`${path} redirected to ${landed}`);
      else if (n !== 1) wrong.push(`${path} has ${n}`);
    }
    // All the pages are opened before failing, so one red run names every page that is wrong.
    expect(wrong, `pages without exactly one <main> at ${size} size: ${wrong.join('; ')}`).toEqual([]);
  });

  test(`the page that refuses an account has exactly one main region, at ${size} size`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    // An account with no venture is sent here on sign-in, so it is reached the way a person reaches it.
    await testLogin(page, 'stranger@example.com');
    await page.goto(REFUSED);
    expect(new URL(page.url()).pathname).toBe(REFUSED);
    expect(await mainCount(page)).toBe(1);
  });

  test(`the sign-in page has exactly one main region, at ${size} size`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(SIGNED_OUT);
    expect(new URL(page.url()).pathname).toBe(SIGNED_OUT);
    expect(await mainCount(page)).toBe(1);
  });
}
