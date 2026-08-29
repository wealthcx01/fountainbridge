# FB-132 — What happened

**Status:** Done · **Area:** Studio / activity · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 6; `screens/07-What_happened.txt`.

## Why this matters (for the founder)

One place where everything the venture did is written down, newest first, in sentences rather than
records. The design's line is the standard it has to meet: *"Sent, failed, refused: it stays here with
its state. Your decisions appear the moment you make them."*

A log that quietly drops failures is worse than no log, because it teaches a founder that silence
means nothing happened.

## What is true today

`/activity` renders run reports through `describeRun`, and `lib/activity-summary.ts` opens with a
paragraph (FB-108). FB-123 made the reads cheap. Approvals and refusals are recorded in ActiveGraph
but do not appear in this feed.

**A scope change nobody flagged on the first draft:** `/activity` is **cross-venture** today —
`loadAccessibleHealth` spans every venture the viewer can reach. The design puts "What happened"
inside a venture's rail, showing that venture's events. So this route becomes venture-scoped, moving
to `/venture/[id]/activity` (FB-124 does the move and the redirect). For an admin that is a
narrowing, and the all-ventures view they lose is the admin ledger's job (FB-136) rather than this
screen's.

## Scope

- A live summary sentence, then dated, tone-dotted sentences, newest first.
- **The founder's own decisions appear here**, the moment they are made — approvals and refusals from
  ActiveGraph, alongside what the lanes did. Today they are missing, and a founder cannot see their own
  yes in the record.
- Failures and refusals stay, with their state. Nothing is filtered for tidiness.
- The read budget stays bounded (FB-123). Adding a second source must not reintroduce a read per row.

## Out of scope

- Sends and spend as events — FB-142 and G3.
- A cross-venture feed. That was this route's old behaviour and is now the admin ledger's (FB-136).
- Any new writer. This reads what is recorded.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/runreports.test.ts    # the read budget must hold
make design-lint && make ticket-drift
```

## Acceptance criteria

- [x] The feed is venture-scoped, and a founder cannot see another venture's events through it.
- [x] Summary sentence, then dated tone-dotted sentences, newest first.
- [x] A founder's approval or refusal appears in the feed immediately after they make it.
- [x] Failed and refused items remain visible with their state.
- [x] Reads stay bounded by what is rendered, asserted by a test with far more history than the page shows.


## What shipped

**The shim is gone.** `/venture/[id]/activity` was `export default ActivityPage` — the cross-venture
route, rendered inside a venture's shell. It is a real page now, scoped server-side before any read.

**The founder's own decisions are in the record**, which is the part that was missing. They come out
of the same `loadApprovals` the desk reads — no per-row read, no second source of truth about what
was decided. `proposed` is deliberately absent: it belongs in the queue, where a founder acts on it,
and putting it in a history would say something was done when the point is that it was not.

**Nothing is filtered for tidiness.** A failed send, a lane that gave up, and a grant the studio did
not issue all keep their entry and their tone. The last is the one nobody wants and everybody needs.

**The narrowing left something standing.** Scoping this screen takes the portfolio view away from
John. `/activity` still exists and is linked from here for admins only, until FB-136 gives it a
proper home — taking a view away and replacing it with nothing would have been the worse trade.

**Undateable entries are dropped, never stamped with now.** The same rule the trail follows: a
history whose times are invented is not a history.
