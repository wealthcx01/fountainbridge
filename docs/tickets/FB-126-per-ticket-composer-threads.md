# FB-126 — Per-ticket composer threads, server-side (gap G4)

**Status:** Shipped in part · **Area:** Composer / venture repo · **Depends on:** —

**Shipped in part.** The contract, the store and the two server actions are done and tested: a
thread lives on `foundry-state`, survives the tab, is scoped server-side, and refuses every way of
reaching another venture's conversation.

**Not built:** the file-revision action, the one-way migration of an existing `localStorage`
transcript, and wiring `components/Composer.tsx` to read and write threads instead of the browser.
All three are coupled to the surface that calls them, which is **FB-131** (the composer rails) — and
building a revision action with nothing rendering it is the "shipping something nobody has seen work"
failure that cost FB-119 three attempts. Same judgement as FB-125's adapters, for the same reason.
**Design:** `docs/design/foundry-desk/` — screen 5, the `ctxOn` rail: "The ticket under discussion".
**Gap:** G4. Studio plus venture repo.

## Why this matters (for the founder)

Every ticket in the design carries **"Discuss in the composer →"**. A founder reads what their team
proposes, disagrees with one line, says so in their own words, and the change files as a revision the
lane picks up — without leaving the studio and without writing a ticket themselves.

Today that conversation would be lost. Composer transcripts live in the browser's localStorage
(FB-065, deliberately, until this ticket). Close the tab and the reasoning behind a revision is gone,
which means the trail on the ticket can never answer *why* it changed.

The design's own line: *"Agreed changes file as a revision the lane picks up; the trail records this
conversation as its source."* That sentence is only true with this built.

## What is true today

- `?about=<ticket>` already seeds the composer with a ticket (FB-105).
- There is exactly one gated write path from the composer — the ticket-filer MCP tool — and it opens
  a PR. Nothing else writes.
- Transcripts are `localStorage`, per venture, per FB-065.
- D8 defines `context/` in the venture repo as the home for durable background.

## Scope

- **Threads on the server, keyed by ticket**, on the venture repo's `foundry-state` ref.

  **Not `context/`, and the first draft of this ticket was wrong to say so.** `context/` is *reviewed*
  content: the deposit tool writes it on a branch and opens a pull request a human merges, which is
  right for a durable fact and absurd for a live transcript — a pull request per message. What a
  thread actually is is machine-written venture state that the studio and the lanes both read, and
  `foundry-state` is already exactly that: `approvals/`, `prps/` and `runreports/` all live there,
  written directly, no review. Threads join them under `threads/`.

  D8 is unaffected. It governs `context/` and `library/`, which is durable background and artifacts —
  a transcript is neither until a founder decides it is, and that decision is a deposit.
- **A file-revision action.** Agreed changes update the ticket on its own branch and record the thread
  as the source, so FB-125's trail can cite it (`read it →` on the "filed by you" hop).
- **Migration from localStorage is one-way and lossy, and must say so.** A founder's existing local
  transcript is in one browser; it is not silently discarded and not silently uploaded. Offer it, once,
  in words.
- **The gate does not move.** Nothing files without an explicit press (FB-119's two shapes). A thread
  is a conversation; a revision is a filing, and only the second needs the founder's word.
- **Venture isolation holds** (CLAUDE.md #6): a thread lives in its venture's repo and a session
  scoped to one venture can never read another's.

## The contract this adds (CLAUDE.md #7)

`Thread` is a **rendered entity**, so CLAUDE.md #7 applies: it is a contract type, and schemas win
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

1. Adds `schema/Thread.schema.json` here, in the same shape as its neighbours.
2. Mirrors the type, with a lock-step test.
3. Only then builds against it.

**Do not invent the shape in application code and reconcile later.** That is what the contracts rule
exists to prevent, and a shape that ships before its schema is a shape the schema then has to accept.
Publishing it upstream to bcap-contracts is FB-002's lane and does not block this.

## Out of scope

- The composer's rails and their layout — FB-131.
- Plan objects, where one conversation becomes N tickets — FB-127.
- Any change to what the composer may write. One gated write path, still.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/threads.test.ts app/actions/__tests__/file-revision.test.ts
make ticket-drift
```

On the ARCA box, before review — the FB-119 rule, since this touches the composer:

```
# open a real ticket in the composer, disagree with one line, file the revision
# confirm: the ticket's branch shows the revision, and the thread is in context/ on the venture repo
```

## Acceptance criteria

- [x] A composer thread opened about a ticket survives a browser close and a different machine.
- [x] Threads live on the venture repo's `foundry-state` ref under `threads/<repo>/<id>.json`,
      beside `approvals/`, `prps/` and `runreports/` — readable by the venture's agents, written
      without a pull request. **Not `context/`**; see Scope for why the first draft was wrong.
- [ ] A revision filed from a thread lands on the ticket's own branch and records the thread as its
      source. **With FB-131.**
- [ ] FB-125's trail can cite the conversation on the ticket's "filed" hop. **With FB-130.**
- [ ] An existing localStorage transcript is offered for migration in plain words, once, and never
      moved without a press. **With FB-131**, which owns the surface that would offer it.
- [x] Appending to a thread files nothing — no pull request, no ticket change, no lane instruction.
      Asserted by a test on the write paths, not by a comment.
- [x] A session scoped to one venture cannot read another venture's threads, and a repo the venture
      does not declare is refused. Both asserted.
- [ ] Driven end to end on the ARCA box. **With FB-131**, when there is a surface to drive.
- [ ] `schema/Thread.schema.json` exists, the type is mirrored from it, and a test holds the two in lock-step — before anything is built against it.
