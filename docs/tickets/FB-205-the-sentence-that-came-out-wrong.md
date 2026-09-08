# FB-205 — "Daily your team budget reached"

**Status:** Done
**Found:** 2026-09-08, on production, reading the desk during FB-203 item 9.

## What a founder sees

On ARCA's desk right now, under "What your team did":

> Stopped on ARCA-061-saved-card-lists-not-persisting and needs you: **Daily your team budget
> reached** — parked until tomorrow.

That is not a sentence. It is the most repeated line in ARCA's whole history — the venture has 3,459
runs and they all say this — so it is very likely the single line a founder has read most often in
this studio.

## Where it comes from

The venture's box writes its own account of the run: *"Daily lane budget reached — parked until
tomorrow."* FB-103 rewrites machine words into founder words before rendering, and one of its rules
is:

```ts
[/\b(?:agent )?lanes?\b/gi, 'your team'],
```

`lane` here is used **attributively** — it is describing the budget, not naming a thing that acted.
Substituting a noun phrase into that slot gives "Daily your team budget reached". The rule is right
about *"the lane stopped"* and wrong about *"lane budget"*, and it cannot tell the two apart.

## Why this is its own ticket

FB-203's item 9 rebuilt the section this appears in. This is not that: it is a defect in
`lib/glossary.ts`, it affects every surface that calls `inFounderWords`, and fixing it inside item 9's
branch would have been scope creep (CLAUDE.md #3).

## Scope

1. Handle the attributive case in `MACHINE_NAMES`. *"lane budget"* → *"your team's budget"*, and the
   same for any other noun the box puts after `lane` (`lane run`, `lane state`). A possessive is the
   grammar that actually fits, and it keeps the sentence's meaning.
2. ~~Do **not** widen this into a rewrite of the box's vocabulary.~~ **Amended while doing the work,
   and the original line was wrong.** It conflated two different things. *"The studio must not put
   words in the machine's mouth"* is about rewriting a run's account **at runtime**, and that still
   holds. It is not an argument for leaving broken English in a sentence **we write ourselves**:
   `deploy/lane/run-once.sh` is our file, and CLAUDE.md #12 binds every word rendered in the studio
   "on this repo and on every venture box." Patching our own sentence downstream forever, instead of
   writing it correctly once, is the worse outcome. Both halves are fixed.
3. A unit test per shape, driven by the real strings on ARCA's state ref rather than invented ones.
4. Sweep the other `inFounderWords` callers for the same shape and fix what it finds.

## Done — 2026-09-08

**Three broken shapes, not one.** Reading every summary the box actually writes turned up two more
beside the one that was reported:

| the box wrote | a founder read |
| --- | --- |
| `Daily lane budget reached — parked until tomorrow.` | **"Daily your team budget reached"** |
| `...not signed by the studio — a lane cannot forge it` | **"a your team cannot forge it"** |
| `Lane awake — nothing to work right now.` | **"Your team awake"**, which is not a sentence |

Two others — *"The lane tried this 3 times…"* and *"The lane planned it but paused…"* — were already
right, because the article makes them substitutable.

**Fixed at both ends.**

- **The source.** All five run-report summaries in `deploy/lane/run-once.sh` and the executor's
  attestation reason now say "your team" themselves, so a new report needs no rewriting at all. This
  reaches ARCA when its box next takes a lane deploy; it is not live there yet.
- **The rewriter,** for the history, which never changes: ARCA has 3,461 reports on its state ref
  saying the old words and they will still be there in a year. `MACHINE_PHRASES` handles the three
  shapes as whole phrases, before the bare-name rules.

**Why a phrase table and not a cleverer rule.** No regular expression can tell *"lane budget"* — a
lane describing a budget — from *"lane arca-build stopped"* — a lane that acted. The difference is
what part of speech the next word is, and a rewriter that guessed would be wrong on a venture whose
repository happened to be called `budget`. An explicit table is honest here for a reason the general
case does not have: **we write the box**, so these sentences are enumerable.

**Tests.** Six unit tests built from the exact strings, including one asserting that the sentences the
box writes *now* pass through unchanged — if that ever stopped being true, the source and the rewriter
would have started fighting over one sentence. Plus a browser test over the whole rendered desk and
activity page, on both the broken output and the machine's own vocabulary, because the fault was in a
rewriter every surface calls and the next one to quote a run would have inherited it.
