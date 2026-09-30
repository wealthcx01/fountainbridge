# FB-237 — memory is state or event, and a script writes the date

**Status:** filed · **Phase:** 3 · **Ruled by:** John, 2026-09-29 (D13) · **Related:** FB-222 ·
One ticket = one branch = one PR.

## The problem, in one sentence

**A model's instinct is to add, never to replace** — so a knowledge base grows contradictions instead of
correcting them, and after a few months it answers confidently and wrongly.

We already have the symptom. This week a ticket said "filed" after its work had shipped, **twice**. The
venture corpus will rot the same way and faster, because a lane writes to it unattended.

## The rule

Every fact is one of two things:

- **State** — one current value that changes: a price, a status, an owner, a date. Find the matching line and
  **replace** it. Never add a second line about the same subject.
- **Event** — a thing that happened. **Append** to the log. Never edit or delete an existing entry.

> *If unsure, append to the Log and say so. A missing state update is recoverable; a rewritten history is
> not.*

## The finding that makes this a ticket and not a sentence

From the second-brain-rot workshop, measured on a real system:

> *"Date every entry" was followed **10% of the time as a prompt** and **94.7% of the time once a script
> added the date** after the run. Anything that must happen every time needs a mechanism, not a sentence.*

**That is our own Playwright lesson in someone else's words.** Ours was advisory, a red one merged itself,
and FB-124 shipped a studio with two navigations and a 250px rail on a phone. A rule without a mechanism is
a suggestion.

So this ticket is four things and only the first is words.

## Scope

1. **The rule**, in the instructions the lane reads when it writes to `context/` or `library/`.
2. **A script that stamps the date**, from the git diff, after every write. Not a request that the model
   remember.
3. **An append-only check on the log.** In a log's diff, a removed line is a bug: red plus green means a line
   was rewritten rather than added. That is mechanically checkable and needs no judgement.
4. **A golden set of questions about the venture whose answers we already know**, run periodically. The
   workshop's own set went from 16/26 to 23/26 after their fix. **Without this, "the memory is good" is an
   opinion.**

## Out of scope

- gbrain's internals. This is about what is written into the venture's own files; gbrain indexes them.
- FB-222's fire budget. That is about how often something is *said*; this is about how it is *stored*. Both
  are needed and they are not the same ticket.
- Rewriting the corpus that exists. The rule applies going forward; a separate pass can clean history once
  the mechanism stops it getting worse.

## Acceptance criteria

- [ ] The state-or-event rule is in the lane's instructions, in plain words.
- [ ] Every new entry carries a date, and the date is applied by a script rather than by the model. Proved by
      writing without a date and watching the script add it.
- [ ] A rewritten log line fails a check. Proved by rewriting one.
- [ ] A golden question set exists with known answers, and its score is recorded so the next score can be
      compared to it.
- [ ] The first score is written down even if it is bad. **A baseline nobody likes is still a baseline.**

## Verification

The mechanism is the verification: turn each one off and watch the thing it prevents happen. A rule that has
only ever been followed voluntarily has not been tested — which is the entire point of this ticket.
