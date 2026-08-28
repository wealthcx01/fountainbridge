# FB-127 — A PRD becomes a ticket set (gap G5)

**Status:** Done · **Area:** Composer / filing · **Depends on:** FB-126
**Design:** `docs/design/foundry-desk/` — screen 5, the `planOn` rail: "The plan, taking shape".
**Gap:** G5. Studio plus git.

## Why this matters (for the founder)

This is the highest-leverage thing a founder can do in the studio, and today it is impossible.

A founder arrives with a PRD, a deck, a page of notes. In the design they hand it over and watch it
become **N draft tickets in dependency order**, smallest shippable first, each line struck or kept,
filed as one set on one press. The desk's chip says it out loud: *"Break the data room PRD into tickets."*

Today they would file one ticket, then another, then another, describing the same document from memory
each time — and the dogfood run of 2026-08-23 is the evidence: the composer *can* split an ask into
research → build → QA correctly, and it took a founder explicitly asking, then approving, then the
filer handing out the same id five times (FB-117).

## What is true today

- `depends_on` exists in the ticket schema and the parser, and the board renders dependency chips.
- The composer can already produce a correct set when asked — proven live, and the tickets it wrote
  cited real sources and flagged a real terms-of-service risk.
- Filing is **one ticket per call**, one branch per ticket, one PR per ticket. Five tickets meant five
  branches and five PRs, and until FB-117 they all had the same id.
- `release-plan.ts` is a *different* plan — releasing a held lane (FB-122). The names collide; this
  ticket must not reuse that vocabulary.

## Scope

- **A plan draft type in the composer**, distinct from a ticket draft: N tickets, ordered by dependency,
  each with the per-line Strike / Keep the design shows.
- **Batch filing: one branch, N ticket files, one PR.** Not N PRs. The set is one decision and lands as
  one, which is also what makes the ids allocate correctly in one pass (FB-117) and at one width (FB-118).
- **Source citations back into the PRD.** Each ticket says which section of the founder's document it
  came from, so a founder can check the machine did not invent a requirement.
- **Dependency order is real, not decorative.** The filed set's `depends_on` must be resolvable and
  acyclic, and the board must be able to render the chain while none of them are merged.
- **Nothing files without one explicit press.** "File all N" is the press; before it, nothing exists.
- **A struck line is gone, not hidden.** If a founder strikes a ticket it is not filed, and the
  remaining set's dependencies are recomputed rather than left pointing at nothing.

## The contract this adds (CLAUDE.md #7)

`PlanDraft` is a **rendered entity**, so CLAUDE.md #7 applies: it is a contract type, and schemas win
on conflict.

**Where that contract lives, checked rather than assumed.** The first draft of this ticket said "add
it to bcap-contracts, in that lane". That repo is not reachable from this account — the org has
`grassmarket` and `bcap-lseg` and no contracts repo — so a ticket blocking on a lane nobody here can
open would have blocked on nothing.

What actually exists is the pattern already in use: schemas are **vendored in this repo** under
`schema/` (`Venture`, `Department`, `RunReport`, `Ticket`, "pinned to bcap-contracts 0.1.0"), with the
type hand-mirrored beside them and a test holding the two in lock-step —
`tools/ticket-parser/test/schema.test.ts` is the worked example.

So this ticket:

1. Adds `schema/PlanDraft.schema.json` here, in the same shape as its neighbours.
2. Mirrors the type, with a lock-step test.
3. Only then builds against it.

**Do not invent the shape in application code and reconcile later.** That is what the contracts rule
exists to prevent, and a shape that ships before its schema is a shape the schema then has to accept.
Publishing it upstream to bcap-contracts is FB-002's lane and does not block this.

## Out of scope

- The composer rail's layout — FB-131.
- Reading the PRD itself. The composer already reads a document per message (FB-078); persisting it is
  FB-140 (G9).
- Editing a filed set. Revision is FB-126's path, per ticket.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/plan-draft.test.ts app/actions/__tests__/file-plan.test.ts
make ticket-drift
```

On the ARCA box before review, with a real document:

```
# hand over a PRD, get N tickets in dependency order, strike one, file the rest
# confirm: ONE branch, ONE PR, N ticket files, N DISTINCT ids at the backlog's width,
#          depends_on resolves across the unmerged set, and the struck one is absent
```

## Acceptance criteria

- [ ] One conversation produces N draft tickets in dependency order, smallest shippable first.
- [ ] Each draft cites the section of the founder's document it came from.
- [ ] A struck line is not filed, and the remaining set's dependencies are recomputed — no ticket is
      left depending on something that was never filed.
- [ ] "File all N" produces **one branch, one PR, N ticket files**.
- [ ] The N ids are distinct and match the backlog's width (FB-117, FB-118), asserted by a test.
- [ ] `depends_on` across the filed set is acyclic and resolvable while every ticket is still unmerged.
- [ ] Nothing is filed without the explicit press, asserted by a test.
- [ ] Driven end to end on the ARCA box with a real document before the PR is opened.
- [ ] `schema/PlanDraft.schema.json` exists, the type is mirrored from it, and a test holds the two in lock-step — before anything is built against it.
