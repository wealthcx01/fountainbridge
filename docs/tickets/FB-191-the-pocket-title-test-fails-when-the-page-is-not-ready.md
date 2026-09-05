# FB-191 — the pocket title test fails when the page is not ready, and calls it a layout fault

**Status:** Open · **Phase:** 3 · **Found by:** FB-163's CI run, 2026-09-05

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

Neither element is waited for. `boundingBox()` returns `null` for an element that is not laid out
yet, and `?? 0` turns that `null` into a real-looking measurement of zero.

Two ways that ends badly:

- Both are still null. The assertion becomes `0 < 0`, which is false.
- The title has rendered and the banner has not. The assertion becomes `140 < 0`, which is false.

In both cases the test reports that the venture is named *after* the prompt. The page is fine. The
test measured nothing and treated nothing as a position at the top of the screen.

`?? 0` is the whole fault. It converts "I could not measure this" into "I measured this at zero",
and zero is exactly the value that makes the assertion fail.

## What to do

Wait for both elements before measuring, and fail loudly if a box is missing rather than
substituting a number for it (CLAUDE.md #10):

```ts
const title = page.locator('.desk .pocket-0').first();
const banner = page.getByTestId('blocker-banner');
await expect(title).toBeVisible();
await expect(banner).toBeVisible();
const titleBox = await title.boundingBox();
const bannerBox = await banner.boundingBox();
expect(titleBox, 'the venture title has no box').not.toBeNull();
expect(bannerBox, 'the blocker banner has no box').not.toBeNull();
expect(titleBox!.y).toBeLessThan(bannerBox!.y);
```

Then check the rest of the suite for the same shape. `?? 0` after a `boundingBox()` is the pattern
to search for; anywhere it appears, a missing element is being read as a position.

## How we will know it is fixed

The gate goes green on a re-run without a re-run being needed. Concretely: run the mobile project
twenty times in a row on an unchanged tree and get twenty passes.

## Why this matters beyond one test

A required check that fails at random teaches people to press "re-run" instead of reading. The next
real failure gets re-run too. This is the second cost of the flake and the larger one.
