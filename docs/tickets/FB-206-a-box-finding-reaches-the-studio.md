# FB-206 — a finding on the box reaches the studio, not only a log

**Status:** filed · **Phase:** 3 · **Raised by:** FB-176, which built the scanner and stopped short of
this · **Branch:** `fb-206-a-box-finding-reaches-the-studio`

## What is missing

FB-176 gave every venture box a credential scanner. It runs daily on a timer, it exits non-zero when
it finds a token outside its one home, and it names the file and the line.

**Nobody sees it.** The finding lands in `journalctl` on a box nobody logs into. That is the shape of
failure CLAUDE.md #10 exists to forbid: the studio knows something is wrong and says so only where no
one is looking.

It is the one acceptance criterion FB-176 did not meet, and it is named there rather than quietly
dropped.

## Why it is its own ticket

It is not more scanning. It is a **reporting path from a venture box to the studio**, and there is
currently only one: run reports on the `foundry-state` ref. A scan finding is not a run report — it is
a fact about the box's health, not about a piece of work — so putting it there would either overload
that record's meaning or need a second kind of record beside it.

That decision, the write, the read and the render are a piece of work. Bolting them onto the end of
FB-176 would have been the half-done version of exactly the thing FB-176 is about.

## Scope

1. **Decide where a box health record lives.** The likely answer is a second file on the same
   `foundry-state` ref (`health/secret-scan.json`), written by the timer, holding *only* the finding
   shape the scanner already produces: path, line, kind. **Never the value** — `deploy/foundry/secret-scan.mjs`
   is careful about this and the record must be too, because a record is more permanent than a log.
2. **The box writes it** on every scan, clean or not. A record that only appears when something is
   wrong cannot be told from a scanner that has stopped running.
3. **The studio reads it on the admin ledger**, not on the rail and not on the desk. FB-164 is the
   reason: a read added to the rail is a read on every screen under every venture, and that cost the
   studio about six seconds a page the last time. The ledger is one admin-only screen.
4. **A founder does not see it.** A credential on their box is Bruntsfield's operational failure, and
   it is not something they can act on. Same rule as the budget on `/api/health` (FB-083).
5. **Say when the scan last ran.** A finding of "nothing" that is three weeks old is not reassurance,
   and the ledger must be able to tell the two apart.

## Out of scope

- Alerting anywhere outside the studio (email, Slack). Nothing external without a recorded approval
  (non-negotiable 4), and the ledger is where an operator already looks.
- Widening what the scanner looks for. `lib/secrets.ts` is the one definition and the drift test keeps
  the three copies together.

## Acceptance criteria

- [ ] A planted token on a box appears on the admin ledger, naming the file and what kind of thing it
      is, and never the value.
- [ ] A clean scan is distinguishable from a scan that has not run, and the ledger says which.
- [ ] A founder signed into their own venture cannot see any of it.
- [ ] The studio's other screens do not pay a read for it.
- [ ] A box that has never run the scanner reads as "not reported", not as "clean".
