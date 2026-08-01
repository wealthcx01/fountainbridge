# FB-074 — The header covers the words you are reading — **it does not**

**Status:** Closed — not a defect · **Phase:** 3 · **Repo:** fountainbridge ·
**Branch:** `fb-074-the-header-covers-what-you-are-reading` · One ticket = one branch = one PR.

## What this ticket claimed
That on a long page the studio header is drawn over the text, and that the line it covered was the
most useful sentence in a composer reply — the one saying the founder's problem was already known.

## It is not true, and here is the measurement
Checked before changing anything, by asking the browser rather than by looking at a picture. A real
viewport, scrolled to the middle of the longest page in the studio, comparing every text element's
box against the header's:

```json
{ "position": "sticky", "barTop": 0, "barBottom": 60,
  "background": "rgb(247, 246, 242)", "zIndex": "50",
  "covered": [] }
```

`covered: []`. Nothing is behind the header. It is `position: sticky` with an opaque background, so
it occupies its space in the document and content scrolls underneath it — which is what every sticky
header on the web does, and is not a defect.

## What I actually saw
A **full-page screenshot artifact**. Playwright's `fullPage: true` stitches a tall image out of a
scrolling page, and it renders a sticky element at the position it occupied while scrolling — so the
header appears *in the middle of the image*, drawn over text that is perfectly readable in a real
browser.

I read the artifact as a defect and wrote 800 words about it, including a paragraph on how it proved
the test suite was structurally blind. The suite was fine. I was looking at a picture of something
that does not happen.

## The one thing here that is real
**The screenshot gallery misleads every reviewer, on every long page.** That matters more than it
sounds, because this ticket's own argument was that someone should *look* at the screenshots — and if
the screenshots show phantom overlaps, a reviewer either learns to ignore them or files tickets like
this one.

Two small things are worth doing, and neither is what this ticket asked for:

- Note the artifact where reviewers will meet it, so the next person does not spend an afternoon on
  it. (Done here, and in the design contract.)
- Add `scroll-margin-top` to headings equal to the header's height. There is no in-page anchor in the
  studio today — the only `scrollIntoView` targets the page bottom, which cannot land under a top bar
  — so this fixes nothing now. It is cheap insurance for the first time someone adds an anchor, and
  it is honest to say it is insurance rather than a fix.

## Acceptance criteria
- [x] Measured, with the result recorded, rather than judged from an image.
- [x] The claim is withdrawn in the ticket rather than quietly dropped.
- [x] The screenshot artifact is documented where a reviewer will meet it.
- [x] `scroll-margin-top` added as insurance, described as insurance.

## The lesson, corrected
The original lesson was "the UI gate cannot see whether a person can read the page, so look at the
screenshots". That still holds.

The lesson it needs alongside it is the one this ticket got wrong: **a screenshot is evidence about a
screenshot.** Before treating it as evidence about the product, ask the browser. It took one probe
and forty seconds to find out that nothing was covered, after eight hundred words asserting that
something was.
