# FB-132 — What happened

**Status:** Todo · **Area:** Studio / activity · **Depends on:** FB-124
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

## Scope

- A live summary sentence, then dated, tone-dotted sentences, newest first.
- **The founder's own decisions appear here**, the moment they are made — approvals and refusals from
  ActiveGraph, alongside what the lanes did. Today they are missing, and a founder cannot see their own
  yes in the record.
- Failures and refusals stay, with their state. Nothing is filtered for tidiness.
- The read budget stays bounded (FB-123). Adding a second source must not reintroduce a read per row.

## Out of scope

- Sends and spend as events — FB-142 and G3.
- Any new writer. This reads what is recorded.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/runreports.test.ts    # the read budget must hold
make design-lint && make ticket-drift
```

## Acceptance criteria

- [ ] Summary sentence, then dated tone-dotted sentences, newest first.
- [ ] A founder's approval or refusal appears in the feed immediately after they make it.
- [ ] Failed and refused items remain visible with their state.
- [ ] Reads stay bounded by what is rendered, asserted by a test with far more history than the page shows.
