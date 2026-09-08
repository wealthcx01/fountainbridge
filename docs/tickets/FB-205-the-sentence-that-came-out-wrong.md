# FB-205 — "Daily your team budget reached"

**Status:** filed
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
2. Do **not** widen this into a rewrite of the box's vocabulary. The box's sentence is the machine's
   own account and FB-103 is explicit that the studio must not put words in its mouth.
3. A unit test per shape, driven by the real strings on ARCA's state ref rather than invented ones.
   The one in production today is `Daily lane budget reached — parked until tomorrow.`
4. Sweep the other `inFounderWords` callers for the same shape and fix what it finds.

## Done when

A founder reads a whole sentence, every substitution has a test built from a string a box actually
wrote, and `copy-lint` is still clean.
