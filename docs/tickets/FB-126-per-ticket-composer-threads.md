# FB-126 — Per-ticket composer threads, server-side (gap G4)

**Status:** Todo · **Area:** Composer / venture repo · **Depends on:** —
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

- **Threads on the server, keyed by ticket**, in the venture repo's `context/` per D8. A thread is
  readable by the agents that plan from it, which is the point: the composer already reads what the
  venture knows before drafting.
- **A file-revision action.** Agreed changes update the ticket on its own branch and record the thread
  as the source, so FB-125's trail can cite it (`read it →` on the "filed by you" hop).
- **Migration from localStorage is one-way and lossy, and must say so.** A founder's existing local
  transcript is in one browser; it is not silently discarded and not silently uploaded. Offer it, once,
  in words.
- **The gate does not move.** Nothing files without an explicit press (FB-119's two shapes). A thread
  is a conversation; a revision is a filing, and only the second needs the founder's word.
- **Venture isolation holds** (CLAUDE.md #6): a thread lives in its venture's repo and a session
  scoped to one venture can never read another's.

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

- [ ] A composer thread opened about a ticket survives a browser close and a different machine.
- [ ] Threads live in the venture repo under `context/`, per D8, and are readable by the venture's agents.
- [ ] A revision filed from a thread lands on the ticket's own branch and records the thread as its source.
- [ ] FB-125's trail can cite the conversation on the ticket's "filed" hop.
- [ ] An existing localStorage transcript is offered for migration in plain words, once, and never
      moved without a press.
- [ ] Nothing files without an explicit press, asserted by a test.
- [ ] A session scoped to one venture cannot read another venture's threads, asserted by a test.
- [ ] Driven end to end on the ARCA box before the PR is opened.
