# FB-191 — the pocket title test fails when the page is not ready, and calls it a layout fault

**Status:** Done · **Phase:** 3 · **Found by:** FB-163's CI run, 2026-09-05

## What happened

The same commit ran the Playwright gate twice on 2026-09-05 — once on the push, once on the pull
request. The push run failed. The pull request run passed. Nothing changed between them.

The failure was one test:

```
✘ 288 [mobile] › e2e/pocket.spec.ts:122:3 › what the pocket studio contains (FB-160)
     › the venture is named before anything else, not after the prompt
   Error: expect(received).toBeLessThan(expected)
```

Re-running the failed job, with no code change, turned it green. So it is a flaky test, not a
defect in the pocket studio.

## Why it flakes

`e2e/pocket.spec.ts:122`:

```ts
const title = page.locator('.desk .pocket-0').first();
const banner = page.getByTestId('blocker-banner');
const titleY = (await title.boundingBox())?.y ?? 0;
const bannerY = (await banner.boundingBox())?.y ?? 0;
expect(titleY).toBeLessThan(bannerY);
```

`boundingBox()` returns `null` for an element it cannot measure, and `?? 0` turns that `null` into a
real-looking measurement of zero — a position at the very top of the page. That is exactly the value
that makes the assertion false. So the test reports that the venture is named *after* the prompt,
when the page is fine and nothing was measured at all.

That much was clear from reading it. **It was not the whole cause**, and the difference matters.

### What the first fix got wrong

The obvious repair is to wait for both elements to be visible before measuring. That was written,
and the test still failed twice in twenty runs.

So the test was run twenty-five times with the page's own numbers printed beside Playwright's.
Caught in the act, on the run that failed:

- Playwright's `boundingBox()` for the venture name returned **`null`**.
- The page's own `getBoundingClientRect()` for the same element, read a moment later, returned
  **y = 222**, in a laid-out flex container, with one stylesheet loaded.

The element was on the screen. It had a position. Playwright still could not measure it.

### The real cause

The desk is server-rendered, streamed (FB-157), and then hydrated. A locator that has been resolved
to a node measures *that* node — and if React replaces it during hydration, the handle is left
pointing at a node that is no longer in the document. A detached node has no box, so `boundingBox()`
answers `null`.

Waiting for visibility cannot fix this. The element **is** visible. It is simply a different element
a millisecond later.

This was already half-known. `e2e/pocket.spec.ts` carried the comment:

> Measure a settled page. The desk streams (FB-157), so a bounding box read the instant the shell
> arrives is a box for markup that is about to move.

The diagnosis was right and the remedy — waiting for visibility — does not cover the case where the
node is replaced rather than moved.

### The second fault, in the same place

Two positions read one after the other come from two different moments. If the page re-renders
between them, they describe two different layouts, and an ordering assertion can fail on a page that
was never out of order. Rarer than the first fault, same shape, and fixed by the same change.

## What was done

Two helpers in `e2e/helpers.ts`, and every measurement in the suite moved onto them.

**`boxOf(locator, name)`** — waits for the element, then retries the measurement for up to ten
seconds, so a node replaced by hydration is simply re-resolved and measured again. If there is still
no box, it fails by name and says so (CLAUDE.md #10). It never substitutes a number for a
measurement that did not happen.

**`inTopDownOrder([[name, locator], ...])`** — asserts that things appear down the page in the order
given. Every position is read inside one retried block, so they all come from the same render. The
failure message names what it found, in the reader's words:

> the page reads the blocker banner → the venture name, not the venture name → the blocker banner

Seven ordering assertions across five spec files moved onto it, replacing hand-rolled comparisons in
`pocket`, `activity`, `attention`, `work` (three) and `password-login`. Three size assertions moved
onto `boxOf`. After this, no spec file calls `boundingBox()` directly — the pattern cannot come back
by copy-and-paste, because there is nothing left to copy.

The `?? 0` is gone. So is `!` on a box that might be null.

## How we knew it was fixed

The failing case, isolated and run **100 times in a row** on an unchanged tree: 100 passes.

Before the change the same rig failed 2 in 25, twice over. The full suite is 280 passed, 12 skipped.

## Why this matters beyond one test

A required check that fails at random teaches people to press "re-run" instead of reading. The next
real failure gets re-run too. That is the second cost of a flake and the larger one.

There is a narrower lesson here as well. The first fix was reasoned from the code and was wrong —
`?? 0` was a real fault and not the cause. What found the cause was running the thing twenty times
and printing what the page actually said. The ticket asked for twenty runs as proof; it turned out
to be the diagnosis.
