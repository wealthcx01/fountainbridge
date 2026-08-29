# FB-130 — The trail, rendered on the ticket

**Status:** Done · **Area:** Studio / tickets · **Depends on:** FB-125, FB-129
**Design:** `docs/design/foundry-desk/` — screen 4, "Follow the change · the ActiveGraph trail".

## Why this matters (for the founder)

FB-125 joins the events. This is where a founder reads them, and it is the sentence the whole studio
rests on: *"Every hop is the same event ActiveGraph recorded: nothing shown here can disagree with
what ran."*

A founder who can follow one ticket from their own words to a running preview stops having to trust
the machine. That is the difference between a dashboard and a record.

## Scope

- The ordered trail on the ticket detail, per the design's rows: filed → picked up → commits → checks
  → preview → waiting → approved or sent.
- **`→` stays in the studio, `↗` leaves it.** The design is consistent about this and a founder learns
  it in one screen; breaking it costs more than the two characters saved.
- The "filed by you in the composer; this conversation is its source · read it →" hop links to the
  thread (FB-126) once it exists, and says the transcript is not kept until then. It never links nowhere.
- A hop FB-125 marked unverified renders as unverified, in words a founder can act on.
- A trail with one entry renders as a trail with one entry.

## Out of scope

- The join itself (FB-125), and any new event.
- Sell and Scale hops — they arrive with FB-142 and G3.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift
```

By eye against ARCA, on three real tickets: one fully worked, one filed-not-started, one parked at the
attempt limit.

## Acceptance criteria

- [x] The trail renders in time order with the design's copy and the closing sentence — with one
      deviation, recorded below.
- [x] Every `↗` opens something real; every `→` stays in the studio. A test asserts no dead link renders.
- [x] An unverified hop says so; it is neither hidden nor shown as verified.
- [x] A one-entry trail renders as one entry, not as an error or an empty box.
- [ ] Checked by eye against ARCA's real tickets in three states. — *checked against the
      fixtures in three states (three hops, one hop, two hops) before the PR; against ARCA's real
      backlog only after it deploys, since that is the only place the real data is.*


## One deliberate deviation from the design

The design writes the heading as **"Follow the change · the ActiveGraph trail"** and the claim as
*"Every hop is the same event **ActiveGraph** recorded"*. The copy contract forbids the product name
in founder-facing text (`lib/glossary.ts`, enforced by `make copy-lint`), and the gate refused both.

The gate is right. ActiveGraph is a system a founder has no reason to have heard of, and the
sentence's force comes from what it promises rather than from what the system is called. So the claim
is kept and the name is not:

> Every step here is the record your studio wrote as it happened: nothing shown can disagree with
> what ran.

The design says copy is contractual, so this is a real deviation rather than a detail — flagged here
so it can be overruled in one line if the name is wanted.

## What building it turned up

**`readEvents` drops what does not verify.** The trail's whole contract is that an unverified hop is
shown *as unverified* — hiding something that happened is the other way of lying about it. So the
parse and the verification now live in one place and each caller decides: the approval history still
shows only what verifies, and the trail shows everything with its verdict. Its `refused` count is
unchanged, which three existing tests were there to insist on and did.

**The trail printed "Work started on " with nothing after the preposition** — the attention queue
carries no branch name. On the one surface whose entire claim is that nothing on it can be wrong
about what ran, a hop that reads as though a word went missing is worse than most bugs. The branch
was already in the GraphQL query and thrown away, like the head commit before it.
