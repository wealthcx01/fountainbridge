# FB-103 — Plain English is a mechanism, not a hope

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"the copy and the language
used is too complicated. I understand it stems from gbrain/gstack/activegraph/meridian… we need a
mechanism for the copy communicated to be in clear, descriptive and simple english."* ·
**Repo:** fountainbridge · **Branch:** `fb-103-plain-english-is-a-mechanism-not-a-hope` ·
One ticket = one branch = one PR.

## The insight in the ask

John did not ask for better copy. He asked for a **mechanism** — because the studio has already
fixed its copy several times (FB-024, FB-063, FB-068, FB-100) and it keeps regressing, for a
structural reason: the platform is built out of systems with engineer names (ActiveGraph, gbrain,
lanes, RunReports, gates), and every new surface inherits their vocabulary by default. A rubric
nobody runs is a document; that is exactly why the design contract became `design-lint` (FB-057).
Copy needs the same treatment.

## What ships

**1. The vocabulary contract.** One file (`lib/glossary.ts` already exists and grows into this):
every founder-facing term the studio is ALLOWED to use, each with its plain meaning — the same
list the FB-101 Handbook chapter teaches. One term per concept: the thing that does the work is
**"your team"** everywhere (never lane, agent, engine, or Claude in founder surfaces), introduced
once on the board ("Your team — AI working on this venture's own machine").

**2. The copy lint.** `scripts/copy-lint.mjs`, run in CI beside design-lint, over founder-facing
strings in `app/` and `components/`: a banned-word list (lane, repo, PR, merge, RunReport,
ActiveGraph, gbrain, ref, branch, parser, fixture, heartbeat…) with per-line opt-out comments for
admin-only surfaces, which must name the reason. Like design-lint, deliberately narrow: it catches
the specific drift this studio suffers, and stays quiet otherwise.

**3. The sweep.** Run the lint, fix what it finds once, and leave CI holding the line. Known
offenders from John's walk: the surfaces cards' wordiness, "non-ticket files skipped",
"automatic checks" phrasing (goes to plain words + a Handbook link, FB-101), machine-voiced
stopped-reports quoted verbatim into the brief.

## Explicitly NOT here

- The brief's aggregation logic (FB-104) — this ticket is about words, that one about content.
- Renaming internal code identifiers. The mechanism polices what founders READ, not the code.

## Acceptance criteria

- [ ] CI fails when a founder-facing string uses a banned engineering term without a reasoned
      opt-out.
- [ ] "Your team" is the single name for the working machinery on every founder surface, and it
      is introduced before first use.
- [ ] The glossary and the Handbook chapter (FB-101) agree word for word.
- [ ] The sweep's diff is reviewed screen-by-screen in the e2e gallery.
