# FB-206 — a finding on the box reaches the studio, not only a log

**Status:** Done · **Phase:** 3 · **Raised by:** FB-176, which built the scanner and stopped short of
this · **Branch:** `fb-206-a-box-finding-reaches-the-studio`


## What shipped

- **Where the record lives:** `health/secret-scan.json` on the venture's `foundry-state` ref, beside
  the run reports but not one of them. It holds when the scan ran, how many credentials it found, and
  for each one the file, the line and what kind of thing it looks like. Never the value.
- **The box writes it every time**, clean or not. The timer now runs `secret-scan.mjs --publish`. If
  the write fails, the scan says so in the journal and exits 3, so a clean box that could not report
  is still a failed unit.
- **The admin ledger shows it**, under the footnotes, one line per venture: a credential found (red,
  with the files), clean and recent (green), clean but more than two days old (amber — "the scanner
  may have stopped"), or never reported (grey — "not the same as clean").
- **Nowhere else reads it.** A test fails if any file other than the ledger page imports the reader.

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

- [x] A planted token on a box appears on the admin ledger, naming the file and what kind of thing it
      is, and never the value. *(Proven on a copy of a box: the real script, run as the timer runs it,
      sends a record with the file and kind and no value, and the ledger renders that record. Seen on
      ARCA's real box on 2026-10-02 — see "Proven on ARCA" below.)*
- [x] A clean scan is distinguishable from a scan that has not run, and the ledger says which.
- [x] A founder signed into their own venture cannot see any of it.
- [x] The studio's other screens do not pay a read for it.
- [x] A box that has never run the scanner reads as "not reported", not as "clean".

## Proven on ARCA (2026-10-02)

John approved the deploy. The scanner and its unit were copied to ARCA's box (old versions backed up
under `/opt/foundry/lane/state/backup-fb206-20261002T121857`). The first real scan was clean.

Then a clearly fake GitHub token was planted in `/var/log/foundry/fb206-planted-test.txt` and the scan
run. The record on ARCA's `foundry-state` ref named the file, line 2, and "a GitHub fine-grained
token", with no value. The admin ledger, built from `main` and reading ARCA's real record, showed ARCA
red with that file and line, at 1,263px (1440×1000) and 2,530px (393×851). The fake file was then
deleted and the box scanned again: clean. The scan now runs daily on ARCA.
