# FB-166 — the composer does not record what it reads

**Status:** Open · **Phase:** 3 · **Split from:** FB-156

> **Decided 2026-09-02 by John: option 2 — do it properly with proper write access.** Not the MCP
> tool (option 1), whose record would be as complete as the model's memory of calling it, and not by
> giving the read-only bridge a credential (option 3). A separate recorder holds the token; the
> bridge stays read-only by construction, which is the property it was built for.

## What is missing

FB-156 made `Last used` real: the lane records which of the founder's documents went into each piece
of work, and the Memory screen names the work and links to it. It records the **lane's** reading
only. The composer reads the corpus too — every time it answers the founder it may pull context and
library pages through the brain bridge — and none of that reaches the record.

So a document the founder discusses with the composer every week, and which no lane has happened to
retrieve, shows a dash that says *nothing has read this yet*. That is a true statement about the
lane and a false one about the venture, on the screen whose entire job is to say what was read.

## Why it was not done in FB-156

The composer reaches the brain through `deploy/lane/brain-bridge.mjs`, which is **read-only by
construction** — its own header says so, and the design is deliberate: it spawns gbrain with a fixed
argv so no caller, least of all the composer, can turn a query into a write. Recording a reading is a
write to the venture's state ref, which needs a GitHub token the bridge does not have and should not
casually be given. Handing a write credential to the one service built to have none is a decision
about the security posture, not a detail to slip into a ticket about a table column.

FB-156 did the half that costs nothing: the bridge now returns `shown` — the slugs the caller was
actually handed, as distinct from what the index returned. Whoever records has the fact ready.

## Scope

Decide **who writes**, then build it. The options, and what each costs:

1. **The deposit MCP server writes it.** It already holds a token and already writes to the venture
   repo (`deploy/librechat/deposit-mcp`). The composer would call a second tool after a query. Cheap;
   depends on the model remembering to call it, which makes the record incomplete in a way nothing
   surfaces — the worst property for this particular record to have.
2. **A small recorder beside the bridge**, taking `shown` from the bridge's response and holding the
   token itself. Keeps the bridge read-only. One more service on the box.
3. **The bridge writes, and stops being read-only.** Simplest, and gives up a property that was
   argued for on purpose. If this is chosen, it should be argued for in the PR, not assumed.

**Option 2 is the decision.** The recorder takes `shown` from the bridge's response, holds its own
narrowly-scoped write credential, and appends to `readings.json` the way the lane does. The bridge's
fixed-argv, no-write contract is untouched.

The studio side needs nothing: `lib/readings.ts` already carries
`kind: 'conversation'`, and `workHref` already declines to invent a destination for a conversation
that has no page.

## Acceptance criteria

- [ ] A composer conversation that reads a corpus document leaves that document's entry in
      `readings.json` naming the conversation.
- [ ] The bridge's read-only property is either preserved, or given up explicitly in the PR body
      with the reasoning.
- [ ] `Last used` distinguishes a document read by a lane from one read in conversation.
- [ ] A test proves the record is written from what the composer was SHOWN, not from what the index
      returned — the same guard `digestWithPages` exists for.
