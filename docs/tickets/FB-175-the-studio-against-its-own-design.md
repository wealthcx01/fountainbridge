# FB-175 — the studio, checked screen by screen against its own design

**Status:** Done · **Phase:** 3 · **Raised by:** John, 2026-09-02

> **Done:** the audit itself. Nine screens rendered on both sides in a real browser, at desktop and
> phone, and looked at. The scorecard is `docs/design-conformance.md` and can be re-run.
>
> **Filed from it:** FB-178 (the desk, since fixed), FB-180 (What happened), FB-181 (Memory),
> FB-185 (Tickets, now the worst screen at 6–8× its design), and updated numbers on FB-160 (the
> pocket studio).
>
> **Matching, leave alone:** the Composer, a Handbook chapter, and the Handbook on desktop.
>
> **Both gaps closed 2026-09-30.** Sign in *was* compared, by FB-189 — which this ticket's own
> admission caused to be filed, so the note above was stale rather than wrong. And the Handbook's
> phone height is explained: nine chapters, stacked one per row on a phone where desktop lays them in
> a grid. A list of nine things is taller in one column than in three. Not a fault.
>
> **And the whole sweep was re-run on real data**, which was not possible when this ticket was
> written. Every screen, signed in as ARCA's founder over its own 79 tickets and 9,889 run reports.
> The table is in `docs/design-conformance.md`. It found one real divergence: **FB-242**.

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

- [x] Every design screen has a recorded verdict: matches / differs (with the difference named) /
      explained. The current table is the 2026-09-30 real-data sweep in `docs/design-conformance.md`.
- [x] Both viewports covered. 1440×1000 and 393×851, every screen.
- [x] Each real divergence has its own ticket. From the first pass: FB-178, FB-180, FB-181, FB-185,
      FB-160. From the re-run: **FB-242**.
- [x] The scorecard lives in `docs/` and states the date and the commit it was taken against.

## What the re-run changed about the method

The first pass could only be done by hand against production, which is why it was never repeated and
why two of its own gaps sat open for four weeks.

It is now one command. `scripts/measure-on-real-data.mjs` signs in as the founder, walks every route
at both viewports, records the height and whether anything scrolls sideways, and **says where it
landed** — so a reading taken on a redirect announces itself instead of being written down. FB-178
established why this works at all: git is the source of truth, so a local build with a real token
reads exactly what production reads.

Two of its guards earned their keep immediately on this run: it caught that `/attention` redirects to
Tickets (by FB-129's design, not a fault) and that a ticket screen says out loud when part of its
history could not be read (correct behaviour, and the sentence "What happened" should be borrowing).

## What the re-run found

**FB-242.** "What happened" shows one row over 9,889 run reports and tells the founder that
everything ARCA did began this morning. Every automated gate was green. The page renders, in the
right order, with correct data — correct about the twenty reports it read, and wrong about the
venture.

That is the third time that sentence has been written in this repo, and it is the argument for this
ticket existing.
