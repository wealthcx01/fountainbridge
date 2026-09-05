import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Sign in via the env-gated E2E credentials provider, then wait until we leave /login. */
export async function testLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('e2e-email').fill(email);
  await page.getByTestId('e2e-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/**
 * Measure an element, retrying until the measurement actually happens.
 *
 * `locator.boundingBox()` returns `null` for an element that is not laid out — and, less obviously,
 * for one that has just been replaced. The studio's screens are server-rendered and then hydrated,
 * so a node that is on the screen one millisecond can be a different node the next, and a handle
 * taken before that swap measures nothing.
 *
 * FB-191: a test wrote `(await x.boundingBox())?.y ?? 0`, which turned "I could not measure this"
 * into "I measured this at the very top of the page" — the one value that made its ordering
 * assertion fail. The required gate went red at random on unchanged code. Waiting for the element to
 * be visible was not enough on its own: caught in the act, the page reported the title at y=222
 * while Playwright's own measurement of it came back null.
 *
 * So: retry, and if there is still no box after ten seconds, fail loudly and by name (CLAUDE.md
 * #10). Never substitute a number for a measurement that did not happen.
 */
export async function boxOf(locator: Locator, name: string) {
  await expect(locator, `${name} never appeared on the screen`).toBeVisible();
  let box: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect(async () => {
    box = await locator.boundingBox();
    expect(box, `${name} is on the screen but has no box to measure`).not.toBeNull();
  }).toPass({ timeout: 10_000 });
  return box!;
}

/**
 * Assert that things appear down the page in the order given, top to bottom.
 *
 * Every position is read inside one retried block, so all of them come from the same render. Two
 * measurements taken either side of a hydration swap can disagree about a page that was never
 * wrong, and that is the fault this exists to remove — the same fault as `boxOf`, one level up.
 *
 * Pass plain names, in the reader's words: they are what the failure says.
 */
export async function inTopDownOrder(
  expected: ReadonlyArray<readonly [string, Locator]>,
): Promise<void> {
  for (const [name, locator] of expected) {
    await expect(locator, `${name} never appeared on the screen`).toBeVisible();
  }
  await expect(async () => {
    const seen: { name: string; y: number }[] = [];
    for (const [name, locator] of expected) {
      const box = await locator.boundingBox();
      expect(box, `${name} is on the screen but has no box to measure`).not.toBeNull();
      seen.push({ name, y: box!.y });
    }
    const order = seen.map((s) => s.name);
    const topDown = [...seen].sort((a, b) => a.y - b.y).map((s) => s.name);
    expect(order, `the page reads ${topDown.join(' → ')}, not ${order.join(' → ')}`).toEqual(topDown);
  }).toPass({ timeout: 10_000 });
}
