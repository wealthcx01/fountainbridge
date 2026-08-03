# FB-098 — Watch your ticket being worked

**Status:** Todo · **Phase:** 3 (this is the founder-experience ticket) · **Asked for by:** John,
2026-08-03 — *"the ticket then gets passed to our Claude Max in our VM, the ticket get's worked (we
should have some sort of simulator or loading bar for this), and then a message or notification that
the ticket has been worked, so the founder can review what has been done, versus what the ticket had
set out."* · **Repo:** fountainbridge (+ the lane's RunReport writer) ·
**Branch:** `fb-098-watch-your-ticket-being-worked` · One ticket = one branch = one PR (likely
split into sub-tickets at planning; this file holds the intent).

## The loop, as the founder should experience it

Today every piece of the loop exists and none of it is *visible as a loop*. A founder files a ticket
through the composer, and then — silence. The lane wakes on its five-minute timer, claims the
ticket, works it, opens a PR, writes RunReports; the founder discovers this only if they happen to
reload the right page at the right moment and read the LaneActivity panel like an engineer reading
logs. The walkthrough filed a real ticket and had no way to answer the founder's only question:
*"is anyone doing anything about it?"*

What John asked for, made concrete on the surfaces we have:

1. **Filed → visible immediately.** The ticket appears on the board in *To do* the moment the
   composer files it, marked "waiting for your team to pick it up".
2. **Claimed → alive.** When the lane flips it to *In progress* (it already edits the Status line),
   the ticket card shows a working state — who (which lane), since when, and a live-feeling
   indicator. Honesty rule: this is **evidence, not animation**. The card shows the lane's real
   heartbeat age ("your team last checked in 2 minutes ago") — never a fake progress bar counting
   to nothing. A progress bar that lies is the composer-says-it-filed bug (FB-062) wearing a
   costume.
3. **Worked → the founder is told.** When the lane's PR opens (or its RunReport lands), the studio
   surfaces a notice the founder cannot miss: the "Needs you" badge they already have, plus an
   entry at the top of the venture board — *"Your ticket ARCA-44 has been worked — review what was
   done."* No email/push in this ticket; the in-studio notice is the deliverable and the
   notification *channel* is a follow-on decision.
4. **Review = done-vs-intended.** The notice lands on the FB-064 work page, extended with the one
   thing it lacks: the originating ticket rendered **beside** the change, criteria as a checklist,
   so "what was asked" and "what the team says it did" sit in one view. Accept stays the existing
   FB-064 action.

## What makes this honest rather than theatrical

- Every state shown is derived from ground truth the studio already reads: ticket Status lines,
  the heartbeat, RunReports, PR state. The "simulator" John names is satisfied by truthful motion —
  heartbeat freshness, elapsed time, attempt count — not by an invented percentage.
- A ticket the lane **parked** (circuit breaker) enters the same pipeline: the notice says it was
  tried three times and needs a human. Silence is the only forbidden state (CLAUDE.md #10).
- Refresh cadence: the board already has `refresh`; this ticket adds polling on the venture board
  only while a ticket is in-flight, bounded by FB-083's request-budget discipline.

## Dependencies

FB-094 (merged — the studio can now actually see RunReports); FB-060 (structured hand-off) makes
the "worked" signal cleaner but is not a blocker; FB-097 (numbered tickets) makes the notices
nameable.

## Acceptance criteria

- [ ] Filing from the composer → the ticket is on the board, attributed, within one refresh.
- [ ] In-progress tickets show lane, elapsed time, and real heartbeat age — no synthetic progress.
- [ ] A worked ticket produces an unmissable in-studio notice linking to review.
- [ ] The review view shows the ticket's ask beside the delivered change.
- [ ] A parked ticket produces the same class of notice, saying so in plain language.
