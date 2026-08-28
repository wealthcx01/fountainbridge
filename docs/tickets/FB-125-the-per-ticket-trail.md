# FB-125 — The per-ticket trail (gap G1)

**Status:** Shipped in part · **Area:** Studio / provenance · **Depends on:** —

**Shipped in part:** the contract, the join and the read budget are done and tested. The live
`TrailSources` implementation — the adapters that actually read ActiveGraph, run reports, the PR and
the preview from GitHub and the venture box — is **not** built, and neither is the check against
ARCA's real tickets. Both belong with FB-130, which is the first thing that renders a trail and
therefore the first thing that can prove one against real data. Building adapters now, with nothing
rendering them, would be shipping something nobody has seen work.
**Design:** `docs/design/foundry-desk/` — screen 4, "Follow the change · the ActiveGraph trail".
**Gap:** G1. Studio-side only.

## Why this matters (for the founder)

A founder asks one question about any piece of work: *what actually happened to it?* Today the answer
is spread across four places, none of which they can reach — ActiveGraph events, run reports, the
repo's commits and checks, and the preview on the venture box.

The design puts it in one ordered list on the ticket:

```
21 Aug 10:42  Filed by you in the composer; this conversation is its source   read it →
22 Aug 09:02  Picked up by the Build lane on Arca's VM
22 Aug 12:14  3 commits on foundry/deck-share-link, +412 −38               diff on the VM ↗
22 Aug 12:20  Preview built and running from the VM                        see it running ↗
24 Aug        Finished; waiting on your approval since
```

with the line under it that is the whole point: *"Every hop is the same event ActiveGraph recorded:
nothing shown here can disagree with what ran."*

This ticket builds the join. FB-130 renders it.

## What is true today

Every hop exists; none of them are joined.

- **ActiveGraph events** — `lib/activegraph-log.ts`, keyed by approval id. `historyFor` joins them per
  *approval*, which is a narrower thing than per *ticket*: a ticket may have no approval at all.
- **Run reports** — `lib/runreports.ts`, one per lane wake, carrying `ticketsTouched`, outcome,
  `prUrl`, start and end. FB-123 made these cheap to read; that budget must not be spent again here.
- **Commits and checks** — the GitHub API, already reached through `lib/github.ts` and already listed
  per PR by `lib/attention.ts`.
- **The preview and the diff** — on the venture box, linked from the deploy config.

## Scope

One studio-side reader that, given a venture, a repo and a ticket id, returns the ordered trail.

- **Ordered by when each thing happened**, not by source. A trail assembled source-by-source reads as
  three lists stapled together and loses the only thing it is for.
- **Every hop resolvable.** A hop carries a link or it carries none; it never carries a dead one. `→`
  stays in the studio, `↗` leaves it (the VM diff, the running preview, the outbox).
- **Honest about absence.** A ticket with no lane run yet has a trail with one entry. That is a real
  answer and must render as one, not as an error and not as an empty box.
- **Signed events stay signed.** ActiveGraph hops come through the existing verification
  (`lib/provenance.ts`); an unattested event is not shown as though it were attested. If the trail
  cannot verify a hop it says so on that hop rather than dropping it silently.
- **Bounded reads,** per FB-083 and the lesson of FB-123: cost is a function of the trail's length,
  not of the venture's history. A test counts reads.

## The contract this adds (CLAUDE.md #7)

`Trail` is a **rendered entity**, so CLAUDE.md #7 applies: it is a contract type, and schemas win
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

1. Adds `schema/Trail.schema.json` here, in the same shape as its neighbours.
2. Mirrors the type, with a lock-step test.
3. Only then builds against it.

**Do not invent the shape in application code and reconcile later.** That is what the contracts rule
exists to prevent, and a shape that ships before its schema is a shape the schema then has to accept.
Publishing it upstream to bcap-contracts is FB-002's lane and does not block this.

## Out of scope

- Rendering. FB-130 owns the component and its copy.
- Any new event type. This joins what is written; it does not add a writer.
- Sell and Scale hops (a send's delivery, an ad's spend). Those arrive with FB-142 and G3; the
  interface should not make them awkward to add, and that is all this ticket owes them.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/trail.test.ts
make ticket-drift
```

Against real data, before review — ARCA has tickets in every state:

```bash
# a ticket with a full trail (filed → worked → PR → approved)
# a ticket filed but never picked up
# a ticket the lane gave up on (ARCA-047, 048, 063 are parked at the attempt limit)
```

## Acceptance criteria

- [x] Given a venture, repo and ticket id, one call returns the trail, ordered by time.
- [x] The join takes all four sources and orders them by time. The live adapters are FB-130's.
- [x] A ticket with no runs returns a one-entry trail, not an error and not an empty result.
- [x] A hop with no resolvable link carries no link — tested against empty, whitespace, relative,
      `javascript:` and `about:` hrefs. A label is never a URL.
- [x] An unverified hop is shown, and shown as unverified. `verified` is three-valued: null means
      signing does not apply, so a commit is not marked suspicious for not being signed.
- [x] Read count is bounded by the ticket's own events. A venture with 2000 runs and 400 approvals
      costs exactly what one with 20 and 10 costs, asserted by counting reads.
- [ ] Proven against ARCA's real tickets in three states. Needs the live adapters — FB-130.
- [x] `schema/Trail.schema.json` exists, the type is mirrored from it, and every trail the join can
      produce — including the empty one — is validated against it.
