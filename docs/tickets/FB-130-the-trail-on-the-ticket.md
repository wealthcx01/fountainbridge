# FB-130 — The trail, rendered on the ticket

**Status:** Todo · **Area:** Studio / tickets · **Depends on:** FB-125, FB-129
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

- [ ] The trail renders in time order with the design's copy and the closing sentence.
- [ ] Every `↗` opens something real; every `→` stays in the studio. A test asserts no dead link renders.
- [ ] An unverified hop says so; it is neither hidden nor shown as verified.
- [ ] A one-entry trail renders as one entry, not as an error or an empty box.
- [ ] Checked by eye against ARCA's real tickets in three states before the PR is opened.
