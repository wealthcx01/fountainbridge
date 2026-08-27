# FB-125 — The per-ticket trail (gap G1)

**Status:** Todo · **Area:** Studio / provenance · **Depends on:** —
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

`Trail` is a **rendered entity**, and CLAUDE.md #7 is unambiguous: every rendered entity is a
bcap-contracts type, schemas win on conflict, and the change happens **in that repo** (FB-002), not
here. None of the first-draft tickets said this and all three of the new entities need it.

How the studio consumes contracts today, so this is not guessed: types are **hand-mirrored** with the
vendored schema beside them — see `tools/ticket-parser/src/types.ts`, whose header says exactly that
and whose `test/schema.test.ts` enforces lock-step.

So this ticket carries a cross-repo dependency:

1. Add `Trail` to bcap-contracts, in that lane.
2. Vendor the schema here and mirror the type, with a test holding them in lock-step.
3. Only then build against it.

**Do not invent the shape here and reconcile later.** That is the thing the contracts rule exists to
prevent, and a shape that ships before the schema is a shape the schema then has to accept.

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

- [ ] Given a venture, repo and ticket id, one call returns the trail, ordered by time.
- [ ] The trail joins all four sources: ActiveGraph events, run reports, commits/checks, preview/diff links.
- [ ] A ticket with no runs returns a one-entry trail, not an error and not an empty result.
- [ ] A hop with no resolvable link carries no link. There is a test that no hop can render a dead one.
- [ ] An ActiveGraph hop that fails verification is shown as unverified, not dropped and not shown as verified.
- [ ] Read count is bounded by trail length, asserted by a test that gives the source far more history
      than the trail needs — the FB-123 shape.
- [ ] Proven against ARCA's real tickets in three states: fully worked, filed-not-started, and parked.
- [ ] `Trail` exists in bcap-contracts, is vendored and mirrored here, and a test holds the two in lock-step — before anything is built against it.
