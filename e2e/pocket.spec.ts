import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-138 — the pocket studio.
 *
 * Runs in the `mobile` project (Pixel 5), so every case here is a phone.
 *
 * The line the ticket hangs on: *"Decisions work exactly as on the desk: read it, one press, grant
 * signed."* Not a cut-down view — the same authority. A founder who can only READ on a phone stays
 * the bottleneck until they get home.
 */
const JOHN = 'john.gallagher@wealthcx.com';
const SHOTS = 'e2e/__screenshots__';

const topOf = async (page: import('@playwright/test').Page, testId: string) => {
  const box = await page.getByTestId(testId).first().boundingBox();
  expect(box, `${testId} is not on the screen`).not.toBeNull();
  return box!.y;
};

test.describe('the pocket studio (FB-138)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('one column, in the order a founder needs on a phone', async ({ page }) => {
    // Blocker → office → queue → prompt. At a desk the order is different because the eye scans a
    // wide page differently; this is the design's screen 11.
    await page.goto('/venture/arca');
    await expect(page.getByTestId('desk')).toBeVisible();
    // Measure a settled page. The desk streams (FB-157), so a bounding box read the instant the
    // shell arrives is a box for markup that is about to move.
    await expect(page.getByTestId('waiting-on-you')).toBeVisible();
    await expect(page.getByTestId('office-plate')).toBeVisible();
    await expect(page.getByTestId('prompt-bar-input')).toBeVisible();

    const hasBanner = (await page.getByTestId('blocker-banner').count()) > 0;
    const blocker = await topOf(page, hasBanner ? 'blocker-banner' : 'blocker-none');
    const office = await topOf(page, 'office-plate');
    const queue = await topOf(page, 'waiting-on-you');
    const prompt = await topOf(page, 'prompt-bar-input');

    expect(blocker, 'what you are blocking comes first').toBeLessThan(office);
    expect(office, 'then what your team is doing').toBeLessThan(queue);
    expect(queue, 'then the queue').toBeLessThan(prompt);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the pocket studio scrolls sideways').toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/20-pocket-studio.png`, fullPage: true });
  });

  test('"Decide →" goes to the decision, not to a query nobody reads', async ({ page }) => {
    // It was `?work=<repo>#<number>` — a parameter the desk ignores. The row the amber banner sends
    // a founder to did nothing at all when pressed.
    await page.goto('/venture/arca');
    // A pull request row specifically. FB-183 put external sends in this same queue, above the work
    // — nothing leaves the company without one — so "the first row" is no longer a pull request.
    const decide = page.locator('[data-testid^="waiting-decide-"]:not([data-testid^="waiting-decide-external-"])').first();
    await expect(decide).toHaveText(/Decide/);
    await decide.click();
    await expect(page).toHaveURL(/\/venture\/arca\/work\/[^/]+\/\d+$/);
    await expect(page.getByTestId('work-decision')).toBeVisible();
  });

  test('a founder can approve from a phone, through the same signed path', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    const accept = page.getByTestId('work-accept');
    await expect(accept).toBeVisible();
    // Reachable and pressable at this width — a control that exists off-screen is not a decision.
    const box = await accept.boundingBox();
    expect(box!.x + box!.width, 'the Approve button is off the side of the phone')
      .toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box!.height, 'the Approve button is not a thumb target').toBeGreaterThanOrEqual(32);
    await accept.click();
    // It reached the server and answered — this rig holds no write credential, so the honest
    // refusal is what proves the path, exactly as the desk's own test does.
    await expect(page.getByTestId('work-msg')).toBeVisible();
  });

  test('refusing still requires a note, on a phone as at a desk', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await page.getByTestId('work-sendback-open').click();
    const send = page.getByTestId('work-sendback');
    await expect(send, 'work can be sent back with no reason given').toBeDisabled();
    await page.getByTestId('work-note').fill('Not this quarter — the pricing page comes first.');
    await expect(send).toBeEnabled();
  });

  test('there is always a way back to the desk', async ({ page }) => {
    await page.goto('/venture/arca/work/arca/10');
    await page.getByTestId('work-back').click();
    await expect(page).toHaveURL(/\/venture\/arca$/);
  });

  test('the prompt bar opens the same composer', async ({ page }) => {
    await page.goto('/venture/arca');
    await page.getByTestId('prompt-bar-input').fill('Draft the pricing page');
    await page.getByTestId('prompt-bar-send').click();
    await page.waitForURL(/\/composer/);
    await expect(page.getByTestId('composer-input')).toHaveValue('Draft the pricing page');
  });
});

/**
 * FB-160 — what the pocket studio contains.
 *
 * FB-138 put the four sections in the design's order and left the rest of the desk underneath, on
 * purpose: hiding is not safe by guess, and the obvious rule would have taken the approval gate off
 * the phone. This is the decision about contents.
 *
 * The rule: the four the design names, plus everything a founder can act on, plus one press to the
 * rest. Nothing duplicated — one markup, sections stood down.
 */
test.describe('what the pocket studio contains (FB-160)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, 'arca.founder@bruntsfield.capital');
    await page.goto('/venture/arca');
  });

  test('the venture is named before anything else, not after the prompt', async ({ page }) => {
    // Everything the pocket order does not name falls to `order: 5`, and that included the title —
    // so a founder scrolled the whole screen before being told which venture they were looking at.
    const title = page.locator('.desk .pocket-0').first();
    const banner = page.getByTestId('blocker-banner');
    const titleY = (await title.boundingBox())?.y ?? 0;
    const bannerY = (await banner.boundingBox())?.y ?? 0;
    expect(titleY).toBeLessThan(bannerY);
  });

  test('the sections the design does not put on a phone are stood down', async ({ page }) => {
    await expect(page.getByTestId('dept-surfaces')).toBeHidden();
    await expect(page.getByTestId('desk-summary')).toBeHidden();
  });

  test('nothing a founder can act on is hidden', async ({ page }) => {
    // The queue, with its decisions — external sends included since FB-183 — and the thing that is
    // stuck, which the banner counts but does not name.
    await expect(page.getByTestId('waiting-on-you')).toBeVisible();
    await expect(page.getByTestId('blocker-banner')).toBeVisible();
    await expect(page.getByTestId('founder-brief')).toBeVisible();
    await expect(page.getByTestId('prompt-bar')).toBeVisible();
  });

  test('the whole desk is one press away, and one press back', async ({ page }) => {
    await page.getByTestId('pocket-more').click();
    await expect(page).toHaveURL(/\?full=1$/);
    await expect(page.getByTestId('dept-surfaces')).toBeVisible();
    await expect(page.getByTestId('desk-summary')).toBeVisible();

    await page.getByTestId('pocket-less').click();
    await expect(page).toHaveURL(/\/venture\/arca$/);
    await expect(page.getByTestId('dept-surfaces')).toBeHidden();
  });

  /**
   * The rule FB-158 and FB-136 both learned the hard way: a phone-only second copy of a section is
   * how two of every control end up in one document.
   */
  test('no section is rendered twice, in either mode', async ({ page }) => {
    for (const url of ['/venture/arca', '/venture/arca?full=1']) {
      await page.goto(url);
      // Scoped to the DESK's own sections, which is what the rule is about. The rail streams its
      // numbers behind a Suspense boundary (FB-151), so during the fallback the rail and its shell
      // are both in the document by design — that is FB-158's rule, with its own test, not this one.
      await expect(page.getByTestId('desk')).toBeVisible();
      const dupes = await page.evaluate(() => {
        const desk = document.querySelector('[data-testid="desk"]');
        if (!desk) return [['no desk', 0]] as [string, number][];
        const seen = new Map<string, number>();
        for (const el of desk.querySelectorAll('[data-testid]')) {
          const id = el.getAttribute('data-testid') as string;
          seen.set(id, (seen.get(id) ?? 0) + 1);
        }
        // `pixel-agent-<state>` is keyed on the agent's state, not on its desk, so three desks in
        // one state share an id. Decorative, aria-hidden, and not a section — noted, not fixed here.
        return [...seen].filter(([id, n]) => n > 1 && !id.startsWith('pixel-agent-'));
      });
      expect(dupes, `${url} renders these twice`).toEqual([]);
    }
  });
});
