# FB-274 — The Review screen

**Status:** Done · **Kind:** medium · **Budget:** $25 · **Rough date:** 3 November 2026 · **Pilot step:** 3 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

**Shipped in part:** the screen, its presses and its tests are built. Three parts of journeys 4 and 5
wait on later steps: the stand-in factory collecting the press (FB-276 and cowgate CG-0066), real
pictures from the planning box (cowgate CG-0065, kept by FB-275), and a card that opens the screen
(FB-277). Until then a press is recorded in the test copy's state folder, and the pictures are test
drawings.

## Why

A founder needs one place to see a finished piece of work and decide on it, without reading code.
Its design is ready: the Review screen in the "Studios, aligned" Claude Design canvas, in the
Bruntsfield Studios design system (John, 28 October).

## What to do

Build the Review screen exactly as the canvas draws it. It opens from a finished card and has:

- a live preview link, from the pull request's Railway preview environment;
- before and after screenshots, at 1440×1000 and 393×851;
- a plain-English summary, taken from the plan's "What this does";
- feedback placed on a screenshot or on the page, which becomes "Send back with a note";
- Accept and Send back, from the Decision component (FB-273).

Until the card store lands (FB-275), the screen reads the test fixtures. A founder sees only their
own venture's work; John sees all.

## Done when

- [x] Journeys 4 and 5 in `harness/END-TO-END.md` pass against a test copy, up to what the
  stand-in factory checks (see "Shipped in part" above).
- [x] The screen is looked at beside the canvas at 1440×1000 and 393×851, with heights recorded.
- [x] No dollar figure, "What to do next" line or Archon link reaches a founder's browser.
- [x] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

Changing the desk's layout.

## What shipped

The Review screen is at `/venture/<id>/review/<place>/<number>`, drawn in the Bruntsfield Studios
design system (`components/ReviewScreen.tsx`, and the `bs-` and `rv-` styles at the end of
`app/globals.css`, set only inside `.bs-root`, so no other screen changes).

- **What a founder sees:** the summary, a preview link (only when the studio opened it), four
  pictures (before and after, computer and phone), what changed, and "Follow the change".
- **Notes:** click or tap a spot on any picture to pin a note there, or write one about the whole
  thing. Every pin names its picture and its spot in the note that goes with the press.
- **Presses:** Accept and Send back come from `components/Decision.tsx`, as a fourth look, `review`.
  A founder's Accept is their sign-off ("Signed off by you", "Waiting for John"); only John's makes
  it part of the product. Notes go with either press.
- **John's parts:** what the run cost, its "What to do next" line and the link to the run are given
  to the screen only for John. `reviewFor` in `lib/review.ts` builds the screen's data from a list of
  named parts, and also drops any sentence with a dollar figure, "What to do next" or "Archon" from a
  founder's copy.
- **Isolation:** the page, and the picture route beside it, check the venture on the server. Another
  venture's card gets the same answer as one that does not exist.
- **Until FB-275:** cards are read from `e2e/fixtures/review`, in the test rig only. A press on a
  card in a test copy is written as one line to `presses.jsonl` in its state folder, and never
  reaches GitHub. The first press that settles a card wins; a later one is told "This card is out of
  date".

