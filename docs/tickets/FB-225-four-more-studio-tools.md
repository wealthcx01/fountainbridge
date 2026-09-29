# FB-225 — four more studio tools, and the one that still cannot exist

**Status:** Done · **Phase:** 3 · **Follows:** FB-200 · **Ruled by:** John, 2026-09-29 (D10) ·
One ticket = one branch = one PR.

## What this is

FB-200 designed eight tools and wired three. This wires four more, taking the surface to **seven of
eight**. `propose_approval` remains unwired on purpose.

**A correction worth recording.** The architecture replan (FB-224, D10) proposed "build the MCP server"
as new work. **It already existed** — FB-200 built it, including the exact "reads, files, proposes, never
grants" rule the replan argued for, with a forbidden-verb list and a test that enumerates the whole
surface. I should have found that before proposing it. What D10 actually rules is the *direction*, and
the work left was always the missing tools.

## What was added

| tool | kind | what it reuses, and why that matters |
|---|---|---|
| `what_happened` | read | The same `buildFeed` the activity screen uses. **A tool that answered differently from the screen would be FB-180's fault with a longer fuse** — that ticket found a summary composed from a different list than the rows, producing counts the rows did not show. |
| `budgets` | read | The same `rowReason` the desk shows, so a founder is never told two different things about their own money by two surfaces. |
| `venture_memory` | read | Lists what exists and **says plainly that it is not answering the question.** A confident answer from a filename match would be worse than a list. The real corpus search is FB-169. |
| `file_ticket` | write | `filePlan` — the same function the composer's confirm button calls. |

`filePlan` gained an optional `Actor`, passed to `requireVentureRepo`, which enforces `scopedTo` before
anything else. So a ticket naming one venture cannot file into another, whatever the arguments say.
Threaded through rather than given its own writer, because a second writer is the one that drifts — the
fault FB-140 caused with scanned and unscanned deposit paths.

### `file_ticket` carries FB-079's guidance, and a test asserts it

FB-200 warned that moving the door to Claude would quietly lose the studio's own advice about what makes
a good ticket, and that **"the quality of filed tickets drops without anyone noticing."** A tool
description is the only place that advice can travel, so it carries it: one piece of work, say what a
person will see change, say how anyone would know it worked, plain direct English, and ask the founder
rather than filing a guess.

Trimming any of that for brevity now fails a test. Checked by doing it.

## What still cannot exist, and why

`propose_approval` stays off the list. Proposals are written by the lane today and there is no single
function that writes one — so a tool would be a **second writer for the record that gates every external
action**, which is the worst possible place for drift. A tool a model can see and cannot use is a dead
control, the same fault FB-192 removed from the office when it hid Layout and Settings.

A test now asserts there is no `propose` tool at all. When a choke-point exists, that assertion is the
thing that has to change — which is the point.

## One thing the existing guard caught

`budgets` was first written as *"what this venture is allowed to spend"*, and the guard in
`lib/__tests__/mcp.test.ts` refused it: no tool description may carry `approve`, `grant`, `spend`,
`merge`, `deploy` or `send`. The guard is right and was not relaxed. **A description carrying that verb
reads as a tool that can do it**, and an absolute rule is the only kind that survives 23:00. It now says
"how much of each is used up" and "nothing here can commit money", which costs a little clarity and keeps
the rule whole.

## Acceptance criteria

- [x] Seven tools, and the enumeration test names all seven, so adding an eighth is a deliberate act.
- [x] No tool of kind `propose` exists, asserted rather than assumed.
- [x] `file_ticket` writes through `filePlan` with an actor, and `scopedTo` is enforced before anything
      else — a credential for one venture cannot file into another.
- [x] `what_happened` and `budgets` answer from the same functions the screens use.
- [x] `venture_memory` states that it lists rather than answers.
- [x] FB-079's ticket guidance is in `file_ticket`'s description and a test fails if it is trimmed.
- [x] Every guard verified by breaking it: adding a granting tool fails 4 tests; trimming the guidance
      fails 1.
- [x] 1,681 unit tests pass.

## Verification

No screen changed — this is a tool surface, not a page. Non-negotiable 11 does not apply, said here
rather than left blank.

**Not verified against a live client.** The tools are unit-tested and typed; nobody has yet pointed a
real Claude Code at this server and filed a ticket through it end to end. That is the next thing to do
and it needs a venture-scoped ticket issued from the studio — named here so it is not mistaken for done.
