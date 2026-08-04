# FB-103 — Plain English is a mechanism, not a hope

**Status:** Done · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"the copy and the language
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

- [x] CI fails when a founder-facing string uses a banned engineering term without a reasoned
      opt-out. — `make copy-lint`, CI job "Plain English".
- [x] "Your team" is the single name for the working machinery on every founder surface, and it
      is introduced before first use. — `TEAM_TITLE`/`TEAM_INTRO` in `lib/glossary.ts`, rendered on
      the board directly under the venture's name: the brief immediately below it is the first thing
      that uses the name, so the introduction has to sit above the brief rather than in the activity
      panel further down.
- [x] The glossary and the Handbook chapter (FB-101) agree word for word. — pinned by
      `lib/__tests__/glossary.test.ts`, which fails if a term in `VOCABULARY` is not taught in
      `content/handbook/09-using-your-studio.md`.
- [x] The sweep's diff is reviewed screen-by-screen in the e2e gallery.

## What shipped

`scripts/copy-lint.mjs` + `make copy-lint` + the CI job "Plain English"; `VOCABULARY`, `TEAM_TITLE`,
`TEAM_INTRO` and `inFounderWords` in `lib/glossary.ts`; `lib/__tests__/glossary.test.ts` (15 cases —
glossary ↔ Handbook, and the runtime translation) and `scripts/__tests__/copy-lint.test.mjs` (20
cases, half of them "stays quiet about code"). The first run found **45 violations across 10 files**;
all 45 are fixed or carry a reasoned opt-out, and the sweep's edits are words only — no behaviour
moved.

One offender no linter can reach: a stopped run's reason is written by the venture's own machine, in
the machine's vocabulary, and the brief quotes it verbatim — so the board introduced "your team" at
the top and said "The lane tried this 3 times" four lines below. `inFounderWords` (lib/glossary.ts)
translates the actor's names in quoted machine text and nothing else; the reason itself is passed
through whole, because the reason is the point (non-negotiable 10).

The sweep's other named offenders: the working machinery had four names (lane, agent, engine, and in one
string the model's own) and now has one; the surfaces card no longer shows a repo slug; the lane
header no longer carries "· 8 non-ticket files skipped" (`lane.skipped` is still counted — giving it
an admin home stays FB-100's item 4); the activity badges read "accepted / checks failed / change";
the ticket drawer's "View on GitHub" is "See where this is written down"; and the two lane-error
next steps lead with the founder's sentence, keeping FB-021's exact repair instruction after it,
labelled "For Bruntsfield" — the only opt-outs outside the admin-only repository-health strip.

## Two boundaries, chosen deliberately

- **`content/` is not linted.** The Handbook and "How the Foundry works" are where the studio
  explains its own machinery and maps studio words to git words on purpose. A linter over them would
  ban the one place that mapping is allowed to exist.
- **It reads sentences and phrases, not single words.** `'merged'` alone is indistinguishable from an
  id at this resolution, so one-word labels remain a judgement for review. Anything with two words in
  it is the linter's problem.
