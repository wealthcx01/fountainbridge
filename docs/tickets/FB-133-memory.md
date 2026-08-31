# FB-133 — Memory: what the venture knows

**Status:** Done · **Area:** Studio / knowledge · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 7; `screens/08-Memory.txt`.

## Why this matters (for the founder)

The composer reads what the venture knows before it drafts anything. A founder has no way to see what
that is, or to add to it. This screen is both: *"Everything you have handed over or your team has
learned. The composer reads all of it before it drafts anything."*

And the empty state is an invitation rather than a shrug: *"Nothing yet. Hand over what you already
have: research, notes, a deck. It becomes what Arca knows, and every ticket will cite it."*

## What is true today

`lib/knowledge.ts` reads the venture's knowledge; `lib/routines.ts` and `components/RoutinesView.tsx`
carry the routines (FB-047). The composer reads a document per message and forgets it (FB-078). D8
defines `context/` and `library/` in the venture repo.

## Scope

- Summary sentence, then a documents table: **Document / From / Added / Last used**.
- An "Add" control. **This was written expecting it to be honest rather than functional** — and it
  turned out FB-106 had already built the write path, so it is the real thing: the document is
  proposed for a human to accept, never written straight into the venture's records. What FB-140
  still owes is the rest of D8 (object storage for heavy files, indexing on write), not the button.
  A dead button is forbidden by the design contract; this one is not dead.
- "What happens without you asking" — the routines, with tone dots, from FB-047.
- "Last used" is a real citation or it is absent. An invented number here would undermine the one
  screen whose job is to say what the machine actually read.

## Out of scope

- The upload path, object storage and gbrain indexing on write — FB-140.
- Editing or deleting a document.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift   # design-lint fails on dead UI, which is the point here
```

## Acceptance criteria

- [x] The documents table renders the four columns, and the routines render with tone dots.
- [x] The empty state is the design's invitation, not a blank panel.
- [x] "Last used" shows a real citation or nothing at all — never a placeholder number. It is
      **nothing at all**, on every row, with the reason said in words under the table: no record
      exists anywhere of which documents a lane read while it worked. Filling it is **FB-156**.
- [x] The Add control works — FB-106 had already built it. `make design-lint` passes.

## What this added beyond the scope as written

**Where each document came from.** The design's `From` and `Added` columns had no data behind them:
the corpus loader read paths, text and sizes and nothing about history. Both are now read off the
record that wrote each document, in one aliased query per repository (capped at 60 paths, so the
cost does not grow with the corpus — FB-083's rule).

Two things fall out of doing it honestly:

- **"You" and "your composer" are different sources.** The studio's Add control and the composer's
  deposit tool leave different records. Attributing the machine's mid-conversation judgement to the
  founder is exactly the small lie this screen exists not to tell.
- **A document with a history says *Updated*, not *Added*.** The record we hold is the last change,
  and only when a path has exactly one change behind it is that also its arrival. Printing "Added"
  over the date of an edit would be the invented number this screen must refuse.
