# FB-267 — Approve an Archon plan from the studio

**Status:** Blocked until FB-266 is done · **Phase:** 3 · **Kind:** a medium build · **Raised by:**
the October re-baseline (section 5, ticket 5), filed 2026-10-21 at John's request · One ticket = one
branch = one PR.

## Why

Archon's `bruntsfield-ticket` pauses after planning and waits for a person to approve the plan.
Today only John can do that, in Archon's own dashboard, which founders can't reach and shouldn't
need to. FB-183's rule is one place to decide. For a venture's ticket, that place is the studio.

## What to build

1. **The plan on the ticket's page.** When a venture ticket's run is paused at its approval card,
   the ticket's page shows the plan's plain-English section (the five headings the house workflow
   writes), and two buttons: approve, or refuse with a reason.
2. **Routed by the D7 matrix.** A plan that changes what the founder sees goes to the founder; a
   platform plan goes to Bruntsfield; a high-blast-radius plan needs both. The plan's own scope
   decides which, using the venture manifest's approval matrix.
3. **The answer goes back to Archon** through its approve or reject command (or the API
   equivalent), from the server, never from the browser.
4. **The decision is recorded** in the studio's signed record, as approvals and refusals are today.
5. **An Archon approval only ever approves work in a branch.** It must never send, spend or deploy.
   Those still need the studio's own signed approval (non-negotiable 4). Write a test that proves
   approving a plan grants nothing external.

## Acceptance

- [ ] A paused venture run's plan shows on the ticket's page, to the right approver only.
- [ ] Approve and refuse reach Archon; the run continues or stops accordingly.
- [ ] Each decision is in the signed record and in "What happened".
- [ ] The test proves a plan approval grants no external action.
- [ ] Screens looked at, beside the design, at both sizes (non-negotiable 11).

## Out of scope

- Showing runs on the desk (FB-266, which this needs).
- Editing a plan from the studio. Refuse with a reason instead.
