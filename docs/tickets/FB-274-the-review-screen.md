# FB-274 — The Review screen

**Status:** Todo · **Kind:** medium · **Budget:** $25 · **Rough date:** 3 November 2026 · **Pilot step:** 3 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

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

- [ ] Journeys 4 and 5 in `harness/END-TO-END.md` pass against a test copy.
- [ ] The screen is looked at beside the canvas at 1440×1000 and 393×851, with heights recorded.
- [ ] No dollar figure, "What to do next" line or Archon link reaches a founder's browser.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

Changing the desk's layout.
