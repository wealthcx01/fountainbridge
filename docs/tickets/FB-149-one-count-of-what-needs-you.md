# FB-149 — "Needs you" counts one thing in the rail and another on the desk

**Status:** Todo · **Area:** Studio / attention · **Depends on:** FB-129

## What happens

Two things wait on a founder, and only one of them is counted everywhere:

- **Finished work** — open pull requests. The rail's badge counts these; `/attention` lists these.
- **External actions awaiting the gate** — a send, a spend, an email. The desk's summary sentence and
  its amber banner count these too, because the desk shows them.

So on a venture with 4 of each, the desk says *8 decisions wait on you* and the rail badge says *4*.
Both are true about what they name and neither is wrong, but a founder reads two numbers for one
question.

FB-128 deliberately did **not** close this by widening the badge. The badge's row goes to
`/attention`, which lists open work and nothing else — a badge saying 8 over a page whose own count
says 4 is the FB-099 badge/destination mismatch one level up, which is worse than the two numbers.

## Why it waits for FB-129

FB-129 turns "Needs you" from a link to a cross-venture page into a **filter on Tickets**, which can
show both kinds. Until there is a destination that can list an external action, widening the count
has nowhere to land.

## Scope

- One count, `waitingOnFounder`, used by the rail badge, the desk summary, the desk banner and the
  destination the badge links to.
- The destination lists both kinds, distinguishably — a read and a decision with a consequence want
  different things from a founder.

## Acceptance criteria

- [ ] The badge, the desk's sentence, the banner and the destination page all state the same number.
- [ ] The destination lists external actions awaiting the gate as well as finished work.
- [ ] A test asserts the badge and its destination's own count cannot differ.
