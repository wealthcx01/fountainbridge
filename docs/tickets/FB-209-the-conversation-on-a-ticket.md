# FB-209 — the conversation on a ticket has nowhere to be read

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-05) ·
**Branch:** `fb-209-the-conversation-on-a-ticket` · One ticket = one branch = one PR.


> **Prior art, from FB-220 (block/buzz, declined 2026-09-25, revised 2026-09-29).** Buzz makes a code
> branch into a room, so the conversation, the review and the decision live together and the room *is*
> the record of why the code exists. That is one answer to both this ticket and FB-184. Worth reading
> before choosing where a ticket's conversation lives: the branch is a candidate owner, not just the
> ticket. We are not taking Buzz; we are taking the shape of its answer.
## What was found

> `appendToThread` / `readThread` exist and the MCP tool `comment_on_ticket` writes to them. **No
> screen renders the conversation on a ticket.** This is G1 in Backend Gaps closing on the backend
> and not the front.

## Why it matters

A founder can be talked to and cannot read it. The MCP server lets Claude — or the founder from
Claude chat — leave a comment on a ticket; the write path works and the record is real. On the
studio, the ticket detail shows the body, the decision and the trail, and no sign that anything was
ever said.

That is a promise the studio is already keeping in one direction only, which is the shape of fault
non-negotiable 10 exists for: work happened and nothing surfaced it.

## Scope

- Below the ticket body and **above the decision**: the thread as dated rows — *who · said* — in the
  same row shape the rest of the studio now uses.
- One input, which appends through the existing `appendToThread`.
- An empty thread says what it is for, not "no comments" (FB-066's rule).
- Nothing new is stored: this renders what `readThread` already returns.

## Out of scope

- Notifying anyone that a comment was left. Nothing external without a recorded approval
  (non-negotiable 4), and a founder reading their own ticket is not external.
- Threading, editing or deleting a comment. Append-only, like the record it is.

## Acceptance criteria

- [x] A comment written by `comment_on_ticket` is readable on that ticket in the studio.
- [x] A founder can add one from the ticket, and it lands in the same thread.
- [x] An empty thread reads as an invitation, not as an error.
- [x] The thread is above the decision, because it is context for it.
