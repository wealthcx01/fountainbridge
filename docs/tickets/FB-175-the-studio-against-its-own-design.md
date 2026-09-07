# FB-175 — the studio, checked screen by screen against its own design

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-02

> **Done:** the audit itself. Nine screens rendered on both sides in a real browser, at desktop and
> phone, and looked at. The scorecard is `docs/design-conformance.md` and can be re-run.
>
> **Filed from it:** FB-178 (the desk, since fixed), FB-180 (What happened), FB-181 (Memory),
> FB-185 (Tickets, now the worst screen at 6–8× its design), and updated numbers on FB-160 (the
> pocket studio).
>
> **Matching, leave alone:** the Composer, a Handbook chapter, and the Handbook on desktop.
>
> **Not done:** Sign in was never compared — the one screen a founder sees before they trust
> anything. And the Handbook is 1,782px on a phone against 1,096px on desktop, which is unexplained.

## Why

John: *"we still seem a long way off — click through all the links."*

Every screen the design specifies exists in the studio. Extracted from the design artifact, the
headings are: Sign in · Admin · Day one · The desk (The office / What the engine did / Waiting on you
/ The company by surface) · Tickets · a ticket · Composer · What happened · What Arca knows (+ What
happens without you asking) · Handbook · a chapter · The pocket studio.

So the gap is not missing screens. It is that **nothing has ever compared them side by side.** The
studio has been built ticket by ticket, each PR verified against its own ticket's scope, and a
hundred small divergences from a design are individually invisible and collectively the difference
between "the screens exist" and "this is the product."

That is exactly the failure mode this repo keeps hitting: every gate green, and the thing on screen
not right. FB-124 shipped two navigations past 1,050 tests.

## Scope

A conformance pass, and it is an audit before it is a fix.

- Render each design screen and the live studio screen at 1440×1000 and 393×851, side by side, and
  write down every difference: layout, order, spacing, type, colour, copy, and controls that exist in
  one and not the other.
- **Copy is in scope and is the most likely thing to have drifted.** The design's words are specific
  ("Nothing is built until you press it", "Nothing on the table", "The Build agent walks to its desk;
  watch the office"). Where the studio deliberately departs — `copy-lint` forbids "agent" in founder
  vocabulary, and FB-143 removed "Good morning" because the studio cannot know the reader's time of
  day — that departure is correct and must be **recorded as a decision**, not silently reverted.
- Produce one ticket per genuine divergence rather than one enormous fix. A hundred-file PR that
  touches every screen cannot be reviewed and cannot be reverted.
- The output is a scorecard, in the repo, that can be re-run.

## Not in scope

Rebuilding anything. This ticket produces the list; the list produces the tickets.

## Acceptance criteria

- [ ] Every design screen has a recorded verdict: matches / differs (with the difference named) /
      deliberately departs (with the reason).
- [ ] Both viewports covered.
- [ ] Each real divergence has its own ticket.
- [ ] The scorecard lives in `docs/` and states the date and the commit it was taken against.
