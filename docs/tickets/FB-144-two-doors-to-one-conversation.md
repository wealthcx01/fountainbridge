# FB-144 — Two doors to one conversation: what the studio composer is for, and what LibreChat is for

**Status:** Todo · **Area:** Composer / research + decision · **Depends on:** —
**Output:** a decision memo and a ticket set. **This ticket writes no product code.**

## The question

A founder can describe what they want and watch it become a ticket their team builds. That is the
structured path, and it works. But some work is not one ask: reading a PRD and arguing with it,
exploring three approaches before choosing, uploading a deck and asking what is weak about it,
iterating on copy for an hour.

**How does a founder do the loose, exploratory work — and have it come out as structure?**

Today there are two doors and no stated relationship between them:

| | The studio composer | LibreChat, on the box |
| --- | --- | --- |
| Where | `/venture/[id]/composer` | `chat.<venture>.bruntsfield.capital` |
| Built by | FB-065, ours | LibreChat 0.8.7, upstream |
| Reached from | a venture or a ticket (`?about=`) | a link in the studio |
| Transcript | the browser (FB-065), moving to `context/` (FB-126) | Mongo, on the box |
| Can take a PDF or a deck | **no** | **yes** |
| Files a ticket | yes | yes — same MCP tool |
| Model choice, RAG, long threads | no | yes |

A founder who needs to upload a deck must use the second door. Nothing tells them that, and when they
do, the conversation is in a different history from every other conversation about their venture.

## What is already settled, and must not be re-litigated

**FB-065 chose the architecture and proved it on the box.** The studio's conversation surface is built
on LibreChat's supported **Agents API** (`/api/agents/v1/chat/completions`), not its internals.
LibreChat stays as the engine and as the fallback. Three findings from that ticket are load-bearing
here and were confirmed, not assumed:

- **File upload is not on the Agents API.** LibreChat's `/api/files` is `requireJwtAuth`-only, and the
  studio deliberately holds no JWT secret for the box. This is the single hardest asymmetry.
- **There is no conversation id to thread by.** The API rejects one it did not issue and never returns
  the one it generates, so the studio carries the transcript itself.
- **Tool calls are visible; tool results are not** — FB-106's open criterion. A founder sees "Used 2
  tools" and never what came back, which matters most in exactly the exploratory work this ticket is about.

This ticket does not reopen any of that. It answers the question FB-065 explicitly left: *"LibreChat
stays as the engine, and as the fallback while this is proven"* — and nobody has since said what the
fallback is **for**.

## Why this needs research before a plan

Three things are genuinely unknown, and guessing any of them would produce a ticket set we throw away:

1. **Does a founder actually need the second door once FB-140 lands?** G9 gives the studio a persistent
   upload path into the venture repo. If a deck can be handed over from Memory and the composer reads
   it from there, the file-upload asymmetry may close without touching LibreChat at all. That would be
   the cheapest possible answer and it should be tested before anything else is designed.
2. **What does "going deeper" actually mean in practice?** Nobody has watched a founder do it. The one
   dogfood run we have (2026-08-23) was a structured ask that produced five tickets — the composer's
   strength, not its edge. We have never observed the loose case.
3. **Can the two histories be one?** LibreChat's conversations are in Mongo on the box; FB-126 puts the
   studio's in `context/`. Two records of the same venture's thinking is the thing D8 exists to
   prevent. Whether they can be joined, mirrored, or whether one should simply stop existing, is a real
   architectural question with three plausible answers.

## What to research

- **Drive the loose case, on the ARCA box, as a founder.** Upload a real document, argue with it,
  change direction twice, and try to land it as a ticket set. Record where each door helps and where
  it gets in the way. This is the same method that found FB-117, FB-119 and FB-121 — running it beats
  reading it, and no amount of design will substitute.
- **Test the FB-140 hypothesis:** with a persistent upload path, does the studio composer cover the
  exploratory case on its own?
- **Establish what LibreChat gives that the Agents API cannot** — model choice, RAG over uploads,
  conversation branching, long context — and which of those a founder would actually miss.
- **Check the ground under `?about=` (FB-105) and threads (FB-126)**: whether a LibreChat conversation
  can carry a ticket reference at all, and what it would take.
- **Ask gbrain what we already decided.** FB-025, FB-033, FB-036, FB-065, FB-073, FB-078, FB-084 and
  FB-106 are all on this ground. The answer may already be half-written.

## What to produce

1. **A decision memo** — `docs/decision-composer-and-librechat.md`, in the shape of the two written for
   G3 and G10: what is being decided, what holds either way, the options with honest costs, and a
   recommendation. The plausible answers are at least: *one door* (retire LibreChat for founders,
   keep it for operators), *two doors with a stated rule* (and the rule written into the product, not
   a wiki), or *one door with an escape hatch* (the studio composer can hand a thread to LibreChat and
   take it back).
2. **The ticket set that follows**, written to the standard of FB-124…FB-142 — validation gates, and
   box-proof before merge for anything touching the composer.
3. **A plain answer to the founder-facing question**: how do I vibe-code with structure, and where do I
   go when one ask is not enough? If the memo cannot answer that in three sentences a founder would
   understand, it is not finished.

## Out of scope

- Building any of it. This ticket ends with a memo and a ticket set.
- Re-choosing the Agents API. FB-065 settled it, confirmed on the box.
- Retiring LibreChat. That is a possible *outcome* of the memo, not an assumption going in — it is the
  engine behind the studio surface either way, and this is about which door a **founder** uses.

## Dependency worth stating

**FB-131 (the composer rails) should not merge before this memo is agreed.** FB-131 builds the studio
composer's five rail states from the design; if this research concludes the exploratory case belongs
somewhere else, or that a sixth state is needed to hand off to LibreChat, FB-131's shape changes. The
design work in FB-131 is not wasted either way, but its scope should be confirmed against this
memo before it is built.

## Validation gates

This ticket produces documents, so its gates are about honesty rather than tests:

```bash
make ticket-drift        # the ticket set it produces must parse and its ids must be contiguous
```

- Every claim about what LibreChat can or cannot do is **confirmed on the ARCA box**, with the command
  or the observation recorded. FB-065's three findings are the standard: each was verified before it
  was relied on, and one of them (no file upload) overturned the plan.
- The founder-facing answer is written in a founder's language and tested against one: read it to
  someone who does not know what an Agents API is.

## Acceptance criteria

- [ ] The loose, exploratory case has been driven end to end on the ARCA box, as a founder, with what
      happened recorded — not reasoned about.
- [ ] The FB-140 hypothesis is tested: whether a persistent upload path closes the file asymmetry.
- [ ] `docs/decision-composer-and-librechat.md` exists, states the options with honest costs, and
      recommends one.
- [ ] It answers, in three sentences a founder would understand: how to vibe-code with structure, and
      where to go when one ask is not enough.
- [ ] A ticket set follows from the recommendation, to the standard of FB-124…FB-142.
- [ ] Every claim about LibreChat's behaviour is confirmed on the box, with the evidence recorded.
- [ ] FB-131's scope is confirmed or revised against the memo before it is built.
