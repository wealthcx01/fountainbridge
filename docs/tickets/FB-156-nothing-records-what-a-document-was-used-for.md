# FB-156 — Nothing records what a document was used for

**Status:** Shipped (lane) · **Area:** Studio / knowledge · **Depends on:** FB-133

> **What shipped, and what did not.** The lane's reading is recorded and `Last used` is real: it
> names the piece of work and links to it, and a document nothing has read says so in words distinct
> from a venture that keeps no record. The **composer's** reading is not recorded — its brain bridge
> is read-only by construction and giving it a write credential is a posture decision, not a detail.
> Split to **FB-166**. Proven end to end on the ARCA box on 2026-09-02: a real gbrain query wrote a
> real `readings.json` to `wealthcx01/arca`'s `foundry-state` ref.
>
> Found on the way: **FB-165** — every corpus page's department has been read off a slug shape gbrain
> does not emit, so the D8 department partition has never applied. A Build lane can retrieve Sell's
> private context.

## What is missing

FB-133 built the Memory screen the design asks for, and one of its four columns is empty on every
row. **Last used** has no source: a document goes into `context/`, a lane reads it while it works,
and nothing anywhere writes down that it did. The studio cannot say whether a founder's upload was
ever opened.

That column was left empty on purpose — a plausible date there would be an invented number on the
one screen whose entire job is to say what the machine actually read, and this studio has shipped
that class of defect before. But empty is a placeholder for a real answer, not the answer.

## Why it matters (for the founder)

The Memory screen's promise is *"the composer reads all of it before it drafts anything."* A founder
has no way to check that. The screen currently proves the studio **holds** their work; the question
they actually have is whether it is **used**. Without that, handing over a document is still an act
of faith — which is the same problem FB-106 was opened to solve one level up.

It is also the citation half of the design's empty-state promise: *"every ticket will cite it."*
FB-133 could not ship that sentence, because it is not true yet.

## Scope

- A record of use, written where the reading happens: the lane and the composer both note which
  corpus paths went into a piece of work. Beside the run reports on the venture's state records, so
  a document's use and the report of the work are one story (the FB-047 argument).
- `Last used` reads that record and shows the piece of work it was used for — a link, not a bare
  date. "Used in ARCA-071" is a citation; "3 days ago" is a number.
- Absent stays absent. A document nothing has read yet shows a dash, and the note under the table
  changes from "nothing records this" to "nothing has read this one yet" — which are different
  facts and must not become the same sentence.

## Out of scope

- Ranking documents by use, or pruning what is unused. Knowing is the whole of this ticket.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run && npx playwright test
make design-lint && make copy-lint && make ticket-drift
```

## Acceptance criteria

- [ ] A lane run that reads a corpus document records which paths it read.
- [ ] `Last used` shows the work a document was used for, and links to it.
- [ ] A document nothing has read shows a dash, and the note says which of the two absences it is.
- [ ] The note FB-133 put under the table ("nothing yet records…") is gone, because it is no longer
      true. A test asserts it is gone rather than asserting the replacement is absent.
