# FB-149 — "Needs you" counts one thing in the rail and another on the desk

**Status:** Shipped in part · **Area:** Studio / attention · **Depends on:** FB-129

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
      True for a founder. Not yet for an admin: their header leads to the cross-venture page,
      which lists finished work only, so it can say 4 over a desk that says 10.
- [x] The destination lists external actions awaiting the gate as well as finished work.
- [x] A test asserts the badge and its destination's own count cannot differ.
      *(`lib/__tests__/needs-you.test.ts` runs the rail's own loader over the UI gate's fixtures and
      compares it with the Tickets filter's count; `e2e/desk.spec.ts` compares the badge, the desk's
      sentence and the filter on the rendered screens.)*


## Progress, 2026-08-28 — half of it, with FB-129

FB-129 built the Tickets screen and pointed the rail's "Needs you" row at it, so the badge and its
destination now count the same things: **finished work waiting on the founder**, including work with
no ticket file. An e2e asserts they cannot differ.

What is still true: the desk's summary sentence and its amber banner also count **external actions
awaiting the gate**, and the Tickets screen does not list those. So the desk can say 8 while the rail
and the Tickets filter say 4.

What remains is therefore smaller and clearer than when this was filed: **put external actions on the
Tickets screen**, as their own kind of row with their own decision panel (Reaches / Costs / Proven is
already the shape they want — it was written for them). Then one count covers everything and every
surface reads it.


## Finished, 2026-10-01

**What changed.** There is now one rule for which sends wait on a founder, in `lib/needs-you.ts`:
a send waits on them when it is **proposed** (nothing has happened yet), **failed** (it was tried and
did not go) or **unverified** (a record says it was approved and the studio cannot say by whom).
Every place that counts asks that one rule: the rail's badge, the desk's sentence, its amber banner,
the desk's "Waiting on you" list, the cross-venture ledger, and the Tickets screen.

**What a founder sees.** The Tickets screen's "Needs you" list now shows sends as well as finished
work, first, each labelled as something leaving the company. Opening one does not offer an approve
button: it says the send is decided on its own page and links there. That keeps FB-183's rule — one
place to sign — and `one-signing-surface.test.ts` still passes.

**The phone, which the first draft missed.** On a phone the rail is hidden, and the "Needs you" a
founder sees is the one in the header at the top of every page. It counted finished work across
every venture and led to the cross-venture page, so ARCA's founder read 4 there over a desk saying 10.
A founder has one venture, so the header now leads to that venture's "Needs you" list and states the
rail's own number. Someone who can see several ventures (an admin) keeps the cross-venture page and
its count, because no one venture's list is the right place to send them.

**What it looks like.** Read on ARCA's real data as its founder: every place says 9 (ARCA has no send
waiting today). On the UI gate's fixtures, which do hold sends: every place says 10. The readings and
heights are in `docs/design-conformance.md`.

**Two smaller differences this also closed.** The desk's sentence counted only proposed sends, while
the desk's own list showed failed and unverified ones too; and the ledger counted only proposed ones.
Both now agree with the list.

## Found in review (2026-10-02)

- The desk's summary said "nothing has been sent" about every waiting send. Once failed and
  unverified sends counted too, that was false: an unverified send was carried out. The summary, the
  amber banner and the Tickets detail now say what is true for each state.
- A test compared the shared count with the rail, which uses the same count, so it could never fail.
  It now reads the desk and Tickets pages themselves; breaking either one turns it red.

**Shipped in part:** an admin's "Needs you" header leads to the cross-venture page, which does not
list sends yet, so for an admin the header and the desk can still differ.
