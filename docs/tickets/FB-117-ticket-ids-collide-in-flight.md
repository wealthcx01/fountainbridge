# FB-117 — Every ticket a founder files in one sitting gets the same number

**Status:** Todo · **Area:** Composer / ticket-filer · **Depends on:** —

## What happened

A founder dogfood run on 2026-08-23 asked the composer for an auction aggregator and — at the
founder's own request — to split it into a research ticket, three build tickets and a QA ticket. The
composer did exactly that. It filed five tickets, in order, with the dependency chain stated.

All five are called **ARCA-68**.

```
#58 foundry/auction-source-research      docs/tickets/ARCA-68-auction-source-research.md
#60 foundry/auction-feed-ingestion       docs/tickets/ARCA-68-auction-feed-ingestion.md
#61 foundry/auction-view-price-history   docs/tickets/ARCA-68-auction-view-price-history.md
#62 foundry/auction-in-app-notifications docs/tickets/ARCA-68-auction-in-app-notifications.md
#63 foundry/auction-aggregator-qa        docs/tickets/ARCA-68-auction-aggregator-qa.md
```

This is FB-097 again in a new shape. FB-097 fixed "everything is called `ARCA-NEW`" and its own
header says why that mattered: a shared short name is the entire point of an id, dependencies cannot
be declared without one, and the board sorts by it. None of that is fixed while five tickets filed in
one sitting share a number — it has only moved from a word to a digit.

## Why it happens

`deploy/librechat/ticket-mcp/stdio.mjs:137` allocates from `listTicketNames(base)` — the filenames on
the **default branch**. Each filing then commits to its own `foundry/<slug>` branch, which the default
branch never sees. So the backlog the allocator reads is frozen for as long as no ticket PR is merged,
and every ticket filed in that window is handed the same number. Five filings, five branches, one
read of one unchanged directory, one number.

The code already has a retry for this, and it is dead. `stdio.mjs:155-163` catches a failed write and
re-allocates, with a comment about "two filings picking the same number between the list and the
write". That retry can never fire: the writes are on **different branches**, so nothing collides at
the git level and no error is thrown. The mitigation assumed a shared destination the filer does not
use. Nothing was raised, and the composer reported all five as filed — which they were.

## What it costs

Not cosmetic, and not deferrable to merge time:

- **The dependency chain is unusable as data.** The composer stated the order correctly, but wrote it
  by title (`Depends on: Build: ingest live auction listings...`) because `Depends on: ARCA-68` would
  be ambiguous four ways. Prose dependencies cannot be resolved by the board or the lane.
- **Merging any one of them marks all five done.** `lib/tickets.ts:112` infers ticket status from PR
  state through `inferenceKey(repo, id)` (`lib/attention.ts:110`) — a `"<repo> <id>"` key. Five
  tickets share one key, so the research PR merging flips the whole set to `done` on the board while
  four of them have not been started.
- **A founder cannot name their own work.** "Approve ARCA-68" is ambiguous. This is the exact failure
  FB-097 was filed to end.
- **It is the normal path, not an edge case.** Splitting one ask into a runnable sequence is what the
  composer is *for*, and the more correctly it does that, the more ids it collides.

## Scope

- Allocate against every ticket in flight, not just the merged backlog: the union of `docs/tickets`
  on the default branch and on each open ticket branch.
- Replace the dead same-branch retry with one that can actually fire — re-read the union and take the
  next number when an allocation turns out to be taken.
- Keep re-filing the same slug idempotent: a revision keeps the number the founder was already told
  (the reason `existingTicketFile` exists — it stays checked first).
- Cover it in `ids.test.mjs`: five filings in a row, no merges, five distinct ids.
- Renumber the five ARCA tickets this run produced, so the set is usable rather than evidence.

## Out of scope

- No change to how ids are *formatted*, or to `withTicketId` / `ticketPath`.
- No cross-venture id namespace work — two repos in a venture sharing an id namespace is a separate
  known thing (`lib/tickets.ts:102`).
- Not the "the composer said `Before I file — nothing — say the word` and then filed without waiting"
  behaviour from the same run. Real, separate, and about the composer's prompt rather than the filer.

## Acceptance criteria

- [ ] Five tickets filed in one session, with nothing merged in between, get five distinct ids.
- [ ] A re-file of an already-filed slug still keeps its original id.
- [ ] The retry path is reachable and tested, or removed rather than left as decoration.
- [ ] The five ARCA-68 tickets are renumbered and their dependency lines reference real ids.
- [ ] Allocation stays bounded: one listing per open ticket branch, not per ticket in the backlog.
