import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * The composer (FB-065, amended by FB-086).
 *
 * This file used to assert the exact opposite of what it asserts now, and the inversion is worth
 * recording rather than quietly rewriting.
 *
 * FB-065 pulled the composer into the studio so a founder was not sent to a different product at a
 * different address to do the most important thing they do. That reasoning still holds. But the
 * in-studio surface did not work in production: the route needs `COMPOSER_API_KEY_<VENTURE>` on the
 * studio, and the variable was never set on Railway. It was only ever exercised against a local
 * `.env`, so every press a founder made returned an error — for weeks, while this suite stayed
 * green, because Playwright drives a local server that had the key.
 *
 * That is the real lesson here: an end-to-end test that runs only against localhost proves the code
 * works, not that the deployment does. It cannot see a missing production variable.
 *
 * John tested the real thing, it failed, and he asked for the box's own chat back on its own screen.
 * A working screen beats a well-argued broken one. The in-studio page is still built and still
 * tested below — the tests from here down drive `/venture/arca/composer` directly — so the surface
 * is a preference now, not a rebuild.
 */

const JOHN = 'john.gallagher@wealthcx.com';

test.describe('describing what you want', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('the board sends the founder to the studio’s own composer, one click, no second login', async ({ page }) => {
    // Third inversion of this test, each with its reason on record: FB-065 asserted in-studio,
    // FB-086 asserted the external chat (the in-studio route had never worked in production —
    // the key was never set), FB-102 asserts in-studio again — FB-095 fixed the engine and proved
    // the surface end to end, and the external door meant a second application with a second
    // login guarding the most important button in the product.
    await page.goto('/venture/arca');
    const link = page.getByTestId('venture-composer-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/venture/arca/composer');

    // The box's full chat stays reachable — quiet, secondary, labelled for what it is, and still
    // a new tab with noopener (a different application must never replace the board, and must
    // never get a handle on window.opener).
    const external = page.getByTestId('venture-chat-external');
    await expect(external).toHaveAttribute('href', 'https://chat.arca.bruntsfield.capital');
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', /noopener/);
  });

  test('an empty thread says what to do rather than showing a blank box', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('composer-empty')).toContainText('Describe what you want');
  });

  test('the reply streams in, and what it DID is shown as an action', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('What do we know about the price feed?');
    await page.getByTestId('composer-send').click();

    // The founder's own words land immediately — the thread never swallows what they typed.
    await expect(page.getByTestId('composer-turn-0')).toContainText('price feed');

    // The action is visible BEFORE the answer. After FB-062 — where the composer said it had filed
    // a ticket it had not filed — a visible action is what makes the words trustworthy.
    const action = page.getByTestId('composer-action').first();
    await expect(action).toContainText('Looking through what your venture knows');
    // Two calls, not three: the engine numbered the search's chunks inconsistently (id at index 1,
    // arguments at index 0), and a strict index read would have invented an extra action.
    await expect(page.getByTestId('composer-action')).toHaveCount(2);
    // The filing is named as filing. It rendered as "Working…" until a live run caught that the real
    // tool is `file_venture_ticket`, not the `file_ticket` this table first guessed.
    await expect(page.getByTestId('composer-action').nth(1)).toContainText('Filing this as a piece of work');

    await expect(page.getByTestId('composer-turn-1')).toContainText('Here is what I found, and what I would file.');
  });

  test('the ticket draft is folded away, and opens when asked', async ({ page }) => {
    // FB-073. The draft is a contract with the lane. A founder met 4,282 characters of `## Scope`
    // and `- [ ]` boxes in front of the button; now they meet a control.
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('Show me how fresh prices are');
    await page.getByTestId('composer-send').click();
    await expect(page.getByTestId('composer-turn-1')).toBeVisible();

    await expect(page.getByTestId('composer-draft')).toBeVisible();
    await expect(page.getByTestId('composer-draft-body')).toHaveCount(0);
    // None of the ticket format reaches the founder unasked.
    const shown = (await page.getByTestId('composer-turn-1').textContent()) ?? '';
    for (const marker of ['##', '- [ ]', '```']) expect(shown).not.toContain(marker);

    await page.getByTestId('composer-draft-toggle').click();
    await expect(page.getByTestId('composer-draft-body')).toContainText('# ARCA-NEW');
  });

  test('there is a button for yes, and it names what it is agreeing to', async ({ page }) => {
    // FB-075. The composer asks "want me to file this?" and used to offer only a text box — so the
    // one moment this surface exists for was a guess. It already went wrong once: a founder's yes
    // arrived in a different session and the composer said it had no draft.
    //
    // FB-131 moved the press out of the thread and into the rail, beside the draft it is about — so
    // "what am I agreeing to" is answered by what the founder is looking at rather than by a button
    // floating under a wall of markdown. The property is unchanged and the location is not.
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('Show me how fresh prices are');
    await page.getByTestId('composer-send').click();

    const rail = page.getByTestId('rail-draft');
    await expect(rail).toBeVisible();
    await expect(page.getByTestId('rail-draft-title')).toHaveText('Show how fresh each price is');
    // All four parts, from a fixture that actually has them. The first version of this test looked
    // at a draft with only a Scope heading, so Why and Done-when could not have failed (FB-153).
    for (const part of ['Why', 'Scope', 'Done when', 'Approval']) await expect(rail).toContainText(part);
    await expect(rail).toContainText('Prices look stale');
    await expect(rail).toContainText('Every price on the market page shows when it was read');
    await expect(page.getByTestId('rail-file')).toHaveText('File this');
    await expect(page.getByTestId('rail-change')).toBeVisible();
    await expect(rail).toContainText('Nothing is built until you press it.');
  });

  test('the rail shows exactly one state, never two', async ({ page }) => {
    // Two things on the table is two answers to "what am I about to press", which is the one
    // question this screen exists to answer.
    await page.goto('/venture/arca/composer');
    const states = ['rail-draft', 'rail-plan', 'rail-discussing', 'rail-filed', 'rail-empty'];
    const count = async () => {
      let n = 0;
      for (const s of states) n += await page.getByTestId(s).count();
      return n;
    };
    expect(await count()).toBe(1);

    await page.getByTestId('composer-input').fill('Show me how fresh prices are');
    await page.getByTestId('composer-send').click();
    await expect(page.getByTestId('rail-draft')).toBeVisible();
    expect(await count()).toBe(1);

    await page.screenshot({ path: 'e2e/__screenshots__/22-composer.png', fullPage: true });
  });

  test('arriving from a ticket shows that ticket, not a draft', async ({ page }) => {
    await page.goto('/venture/arca/composer?about=ARCA-1');
    await expect(page.getByTestId('rail-discussing')).toContainText('ARCA-1');
    await expect(page.getByTestId('rail-draft')).toHaveCount(0);
    // And a way back to where they came from, with its history.
    await expect(page.getByTestId('rail-back-to-ticket')).toBeVisible();
  });

  test('the rail fits a phone, below the conversation', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('Show me how fresh prices are');
    await page.getByTestId('composer-send').click();
    await expect(page.getByTestId('rail-draft')).toBeVisible();

    const m = await page.evaluate(() => {
      const y = (s: string) => document.querySelector(s)?.getBoundingClientRect().top ?? 0;
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        railBelowThread: y('[data-testid=rail-draft]') > y('[data-testid=composer-thread]'),
      };
    });
    expect(m.overflow).toBeLessThanOrEqual(0);
    // A founder on a phone reads the conversation, and the draft follows from it.
    expect(m.railBelowThread).toBe(true);
    await page.screenshot({ path: 'e2e/__screenshots__/22-mobile-composer.png', fullPage: true });
  });

  test('there is nothing to agree to until there is a draft', async ({ page }) => {
    // A button that sometimes means nothing teaches a founder to distrust it. The rail says so in
    // words rather than showing an empty form with a live press over it.
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('rail-file')).toHaveCount(0);
    await expect(page.getByTestId('rail-empty')).toBeVisible();
    await expect(page.getByTestId('rail-empty')).toContainText('the ticket takes shape here');
  });

  test('the thread is still there when the founder comes back', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-input').fill('Remember this one');
    await page.getByTestId('composer-send').click();
    await expect(page.getByTestId('composer-turn-1')).toBeVisible();

    await page.goto('/venture/arca');
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('composer-turn-0')).toContainText('Remember this one');
  });

  test('a format it cannot read is refused by name, with a way forward (FB-078)', async ({ page }) => {
    // "Unsupported file type" reads as a shrug; naming the format reads as a decision.
    await page.goto('/venture/arca/composer');
    // FB-084 reads .pptx now; `.ppt` is the OLD binary format and genuinely is not supported.
    await page.getByTestId('composer-file').setInputFiles({
      name: 'deck.ppt', mimeType: 'application/vnd.ms-powerpoint', buffer: Buffer.from('older'),
    });
    await expect(page.getByTestId('composer-error')).toContainText('an older slide deck');
    await expect(page.getByTestId('composer-error')).toContainText('Re-save it');
  });

  test('a recording is not told to export itself as a PDF (FB-084)', async ({ page }) => {
    // Nonsense advice for a video, and a founder given it learns the studio is not listening. There
    // is no ffmpeg and no transcription on a venture box, and the refusal says so.
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-file').setInputFiles({
      name: 'customer-call.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not really a video'),
    });
    await expect(page.getByTestId('composer-error')).toContainText('cannot listen');
    await expect(page.getByTestId('composer-error')).toContainText('transcript');
  });

  test('a PDF with no text layer is refused rather than deposited empty (FB-078)', async ({ page }) => {
    // The refusal that matters most. Filing an empty file under a confident name would teach the
    // venture brain that a 60-page market report contains nothing.
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-file').setInputFiles({
      name: 'scan.pdf', mimeType: 'application/pdf',
      // A one-page PDF whose only content is a filled rectangle — no text operators at all.
      buffer: Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
        + '2 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n'
        + '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
        + '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n'
        + '5 0 obj\n<< /Length 24 >>\nstream\n0.5 g 60 60 500 700 re f\nendstream\nendobj\n'
        + 'trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF',
      ),
    });
    await expect(page.getByTestId('composer-error')).toContainText('no readable text');
    await expect(page.getByTestId('composer-error')).toContainText('Nothing was saved');
    await expect(page.getByTestId('composer-doc')).toHaveCount(0);
  });

  test('a readable document says what was understood, not just that it attached (FB-078)', async ({ page }) => {
    // A silent "attached" on a 60-page report is indistinguishable from a failed extraction. Saying
    // the size back is how a founder catches the studio having read one page of sixty.
    await page.goto('/venture/arca/composer');
    await page.getByTestId('composer-file').setInputFiles({
      name: 'positioning.md', mimeType: 'text/markdown',
      buffer: Buffer.from('We win on trust because the numbers are ours and every one of them can be traced back to a source a collector already believes.'),
    });
    await expect(page.getByTestId('composer-doc')).toContainText('I read positioning.md');
    await expect(page.getByTestId('composer-doc')).toContainText('words');
  });

  test('nothing on the composer sends the founder to another product', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs.filter((h) => /chat\.|github\.com/.test(h))).toEqual([]);
  });
});
