# FB-181 — Memory lists repository scaffolding as founder knowledge, and shows an org login as a person

**Status:** Done · **Phase:** 3 · **Found by:** the FB-175 screen audit, 2026-09-02

## What is on the screen

Memory is the closest of the audited screens to its design — 1,570px against ~1,000px, the right
columns, and FB-156's `Last used` working (*"ARCA brand redesign · 2 September 2026"*). Three things
are wrong, and they compound.

**Five of the eleven "documents" are README files.**

```
context/ — what the lane should already know   John Gallagher  31 July 2026  581 bytes
library/ — what the work produced              John Gallagher  31 July 2026  363 bytes
context/ — what the lane should already know   John Gallagher  31 July 2026  572 bytes
library/ — what the work produced              John Gallagher  31 July 2026  366 bytes
library/ — venture artifacts + agent outputs   wealthcx01      29 July 2026  250 bytes
```

These are the scaffolding committed when the corpus directories were created. The screen's own
sentence is *"Everything you have handed over or your team has learned"* — a founder handed over none
of them. They are half the list.

**The same title appears twice, and nothing distinguishes them.** `context/README.md` exists in
`arca`, `arca-marketing` and `arca-ops`, so the rows are genuine and distinct — but the table shows
title, from, added and last-used, and never the surface. Two rows differing only by *581 bytes* and
*572 bytes* read as a bug. `docKey` already keys on repo *and* path for exactly this reason
(FB-133); the column that would make it visible is missing.

**`wealthcx01` is shown in a column headed "From", beside "John Gallagher".** That is the GitHub
organisation's login rendered where a person's name goes. `whoAdded` returns
`commit.authorName?.trim() || 'Your team'` — the author name is present and is the org, so the
fallback never fires.

## Why it matters

This screen answers *"is the thing I handed over actually being used?"*. Half its rows are files the
founder never handed over, two pairs look like duplicates, and one contributor is a company. Every
individual fact is true and the screen as a whole misleads — which is the failure this studio keeps
finding, one surface at a time.

## Scope

- Exclude `README.md` from the corpus listing, or mark it as scaffolding rather than as knowledge.
  Prefer excluding: a founder does not need to be told the directory has a readme.
- Show the surface on each row (`surfaceOf(repo)`), so three real files with one title read as three
  real files.
- Treat an organisation login as not-a-person in `whoAdded`. The venture's own org is known from the
  manifest, so this is a comparison rather than a guess.
- Check the same three against the design's Memory screen while in there — the audit measured this
  page but has not compared its layout row by row.

## Acceptance criteria

- [ ] No `README.md` appears as a document a founder handed over.
- [ ] Two documents sharing a title are distinguishable on the screen.
- [ ] No row names the GitHub organisation in the "From" column.
- [ ] A test pins each: a fixture with a README, one with a shared title across two repos, and one
      authored by the org.
