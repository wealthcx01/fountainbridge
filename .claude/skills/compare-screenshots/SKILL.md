---
name: compare-screenshots
description: Measure and compare screenshots of this studio — against the Claude Design artifact, against a previous capture, or on their own. Use before any pull request that touches a screen (non-negotiable 11), when judging whether a screen matches its design, when a capture looks wrong, or when deciding whether a frame is flat, empty or badly framed.
---

# Compare screenshots

Adapted from `visual/compare-screenshots` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).
The framing is theirs and it is the reason this exists.

## The one thing to understand first

**Decide which image is _less wrong_ against what the screen should show — not whether it matches the
design.** The design is an earlier attempt and it can be wrong too. Treat both images as candidates
measured against a target you establish yourself.

**The numbers locate where images differ. They never decide which is right.** No percentage means
"correct". FB-124 shipped a studio with two navigations and a 250px rail on a 393px phone, and it would
have scored well against the previous screenshot — because the previous screenshot had them too.

This is why non-negotiable 11 still ends with *look at both*. This makes looking cheaper and better
aimed. It does not replace it, and a run of this tool is **not** a substitute for a person seeing the
picture.

## Why this exists at all

Thirty tickets shipped with every automated gate green — lint, types, 1,459 unit tests, 250 browser
tests — while the founder's desk was **9,908px tall against a design of ~1,900**, half of it finished
work nobody needed to see, and another screen was printing the same sentence twenty times. Every test
was correct. The screen was unusable anyway.

Height is the cheap proxy that finds it; the picture confirms what the problem is.

## How to run it

**One capture at a time, no counterpart.** Do this first — arguing about a difference between two broken
captures wastes everyone's time.

```bash
CANDIDATE_DIR=e2e/__screenshots__ node scripts/visual-parity-diff.mjs
```

**A pair, by filename.**

```bash
REFERENCE_DIR=design-shots CANDIDATE_DIR=e2e/__screenshots__ \
  OUT_DIR=visual-diff node scripts/visual-parity-diff.mjs
```

`OUT_DIR` gets a side-by-side and a difference heatmap per pair, plus `reading.md` and `metrics.json`.

## The workflow for non-negotiable 11

1. **Say what the screen should show, before looking at any number.** One or two concrete sentences:
   what the founder is here to do, what must be visible without scrolling, what must not be there. This
   — not the design — is ground truth.
2. **Capture both sides comparably.** Same viewport (1440×1000 desktop and 393×851 phone), same route,
   same signed-in venture, same data. The live side is **production**, signed in as the venture's
   founder, because fixtures are small and every fault this rule exists to catch only appears at real
   size: ARCA's 73 tickets, its 1,773 run reports.
   The design is the Claude Design artifact named in CLAUDE.md #11 — open it with Playwright, press
   "Continue with Google", and click the rail's labels to reach each screen.
3. **Run the tool.** Read `reading.md`.
4. **Look at the pictures.** Both of them, as pictures.
5. **Record the reading in `docs/design-conformance.md`** and the height in the pull request.

## When the right answer is not clear — stop

If there are competing valid readings, or it is a taste call, or it is a product-intent question only
John can settle: **stop and ask.** Show the comparison. Write it up as a design gap for Claude Design.

Do not quietly default to the design to avoid asking — that bakes in whatever the design got wrong. And
do not default to the current screen either.

## What each number means

| number | what it tells you |
|---|---|
| `stdevLuma` and `flat` | Whether the capture actually got the page. A failed render is one flat colour, and a flat capture passes every test that only checks a file exists. |
| `coverage` | How much of the frame is drawn on. Near zero on a page that should show something means an empty frame. |
| `lastContentRow` | How tall the page really is, as opposed to how tall the capture is. |
| `trailingEmptyRows` | Empty pixels below the content. Over 600 — about one screen of nothing — is flagged. The **fraction** alone is not enough: a 720px error page is 44% empty and completely fine. |
| `differingFraction` | How far a pair is apart. Not a score. |
| `sizesDiffer` + `heightRatio` | Usually the most interesting result in a run. A ratio far from 1 *is* the finding. |

**Known limit:** a frame more than half ink reports the ink as background, so its coverage reads near
zero. Every capture in this repo is 2–5% content, so it does not bite — a genuinely dense screen would
need a different background rule.

## What it will not do

- It will not pass or fail anything, and it is **not a CI gate**. The Playwright UI gate is the required
  check; this is a measuring instrument for a person.
- It will not tell you a screen is correct. "Nothing measurable looks wrong" is not the same as right,
  and it says so.
- It will not compare across viewports. A desktop capture and a phone capture are different scenes.
