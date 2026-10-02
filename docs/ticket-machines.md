# Ticket machines — one temporary machine per ticket (FB-239)

John's ruling of 2026-09-30: one machine and one character per ticket. His rulings of 2026-10-02 say
how: **on Railway**, **made only by the studio**, and **within a monthly budget per venture that he
approves once**. This page says how that works, what it costs, and exactly what switches it on.

**Nothing here has run against a real machine yet, and it is switched off.** The whole lifecycle is
proved against a stand-in provider and real Postgres in `lib/__tests__/machine-service.test.ts`.
Making a real machine costs money, so the first one waits for John (see "Switching it on").

## Who holds what

This is the part that matters most, because it is what keeps one venture out of another's.

- **The studio** holds the only provider token (Railway's), each venture's machine credentials, the
  secret that every machine key is made from, and the approval secret that signs budgets. Bruntsfield
  controls the studio.
- **A venture's own box** holds one key, `TICKET_MACHINE_LANE_KEY`. It can do two things with it: ask
  the studio for a machine for one of that venture's tickets, and ask how that machine is getting on.
  It cannot make, list or remove a machine. It holds no provider key.
- **Railway** holds, for each machine, only how to reach the studio and a token for that one run. No
  venture credential is ever stored at Railway.
- **The machine** uses its run token once, at start, to collect that venture's repository, ticket and
  two credentials from the studio, and once at the end to say how the run went. The token names one
  venture and one run, so it is no use for anything else, and it cannot collect the work twice.

## What happens to one ticket

1. The venture's box wakes, picks a ticket and checks its daily wake budget — exactly as today.
2. It asks the studio for a machine (`POST /api/machines`), naming the ticket.
3. The studio checks, in this order, and refuses with a plain sentence at the first "no":
   - the key is this venture's own;
   - the repository is one of this venture's, as its manifest says, and the ticket file exists there;
   - this venture has a monthly budget, signed with the approval secret, approved by a studio admin;
   - fewer than two of this venture's machines are working;
   - one more machine, counted at its worst case, still fits in this month's budget.
4. The studio makes a new Railway environment for the ticket, with one service in it, sized at 4
   processors and 8 GB, set never to restart, and starts it.
5. The machine fetches the lane at the studio's own version, collects its work, installs what the
   lane needs, fetches the one repository, and runs the same `supervisor.sh` the venture's box runs.
   That writes the run reports, with the guides it followed (FB-231), as it always has.
6. At the end — whatever the end is — the machine tells the studio how far it got. The studio records
   it and removes the machine. The venture's box, which has been asking every 30 seconds, reads the
   result and writes a run report if the run did not reach its end.

**A machine that fails while setting itself up is a failure.** The machine reports where it stopped
(setting up, working, or writing down which guides it used) and the last lines of what it was doing.
Only a run that reached the end of the lane counts as finished. Anything else becomes a run report
saying where it stopped and the last thing it said, so a founder reads *why*.

**A machine that was refused, or that could not be made, is not an attempt.** The ticket never ran,
so it does not count toward the three tries after which the lane parks a ticket, nor toward the day's
wakes. The founder is told why once a day, then on the heartbeat.

## Why a machine cannot be left running

Three separate things end a machine. Any one of them failing is not enough to leak one.

- **The studio removes it when the run ends.** If the request to make it failed after Railway had made
  it anyway, the studio finds that run's machine by its exact name and removes it — that one only.
- **The machine stops its own work** three minutes before its deadline, and reports that it was cut
  off.
- **The clean-up** (`POST /api/machines/reap`, called every ten minutes by a timer, and also run
  for a venture every time that venture asks for a machine) removes every machine that has ended or is
  past its deadline. It also asks Railway what exists, so a machine whose record was lost is removed
  once it is older than any machine may live. It only ever looks at environments whose name starts
  with `fw-`; the project's own environments are never touched.

So the longest a forgotten machine can live is its lifetime (150 minutes) plus ten minutes of grace
plus up to ten minutes until the clean-up next runs: about three hours.

## What one run costs

Railway's published container prices (read 2026-10-02): $0.000463 per processor per minute and
$0.000231 per GB of memory per minute. A ticket machine is 4 processors and 8 GB, and Railway is told
that limit, so it can never cost more than **$0.0037 a minute — about $0.22 an hour.**

- **A typical ticket** takes about an hour: about **$0.22**.
- **The worst case** — a run cut off at its deadline and removed by the clean-up job — is 160
  minutes: **$0.59**. Every machine is counted at that worst case when it is made, then brought down to
  the minutes it really ran when it is removed. So the month's count is never below the true bill.
- **A budget of $50 a month** covers about 225 typical tickets, or 84 worst-case ones. The lane's own
  wake budget is eight tickets a day, about 240 a month, so $50 is a real limit, not a formality.

Railway bills what a machine uses up to its limit, so the real bill is at most this and usually less.
The Claude usage for a ticket is the same as it is today, because the work is the same work.

## Switching it on

Every step needs John. None of it is done. The order matters: the clean-up and the budget exist
before the switch does.

**On Railway:**

1. **Make a project for ticket machines,** separate from the studio's own project. Note its project id
   (Project → Settings).
2. **Make a token** that can create and delete environments in that project (Account → Tokens; a
   workspace token if the project is in a team workspace). If you can, keep the ticket-machine project
   in a workspace of its own, so this token cannot reach the studio's own project.
3. **Set a usage limit or alert** on that workspace, so a fault in this code is never the only thing
   between a bug and a bill.

**On the studio's Railway service** (environment variables; never in this repository):

4. `RAILWAY_TICKET_MACHINE_TOKEN` — the token from step 2.
   `TICKET_MACHINE_RAILWAY_PROJECT` — the project id from step 1.
5. `TICKET_MACHINE_SECRET` — a random value of at least 32 characters. Every venture's lane key and
   every run token is made from it.
6. `STUDIO_PUBLIC_URL` — the studio's https address, which the machines call back to.
7. For each venture: `TICKET_MACHINE_GITHUB_TOKEN_<VENTURE>` (for ARCA, `..._ARCA`) — a GitHub token
   that can push to **that venture's repositories and no others** — and
   `TICKET_MACHINE_CLAUDE_TOKEN_<VENTURE>`. The studio hands a machine only its own venture's pair,
   and a test proves that; but if the GitHub token itself reaches other ventures' repositories, the
   isolation is only as narrow as the token (`docs/venture-github-token.md`).
8. Apply `db/007_ticket_machines.sql` to the studio's database, the same way the earlier files in `db/` were applied.

**Approve the monthly budget** (once per venture):

9. From a terminal with the studio's settings, for example
   `railway run node scripts/ticket-machines.mjs approve-budget arca 50 john@bruntsfield.capital`.
   It signs the amount with `FOUNDRY_APPROVAL_SECRET` and records it in the studio's database. Your
   address must be in `STUDIO_ADMIN_EMAILS`, or the studio will not accept the budget. Add `--dry-run`
   to see what would be recorded first. To change the amount, approve again; to stop all spending for
   a venture, approve `0`.

**The clean-up timer:**

10. Have something call `POST /api/machines/reap` every ten minutes with
    `Authorization: Bearer <key>`, where the key is printed by
    `railway run node scripts/ticket-machines.mjs reap-key` — the same kind of timer as the push
    check (a Railway cron service or a scheduled workflow).

**The switch:**

11. `TICKET_MACHINES=on` on the studio.
12. On the venture's own box: `TICKET_MACHINE_LANE_KEY` (printed by
    `node scripts/ticket-machines.mjs lane-key arca`) and `FOUNDRY_STUDIO_URL` in
    `/etc/foundry/credentials`, and `TICKET_MACHINES=on` in the lane's environment. Sync the lane
    files to the box with `scripts/sync-box.sh` first.

The first run should be watched by a person: an environment appears in the Railway project, a pull
request appears on the venture's repository, and the environment disappears. Until that has been
seen, this is a pipeline nobody has watched run.

## Hetzner, the second provider

The first version of this ticket built the machine on Hetzner. It is kept, behind the same four calls
(make, check, list, remove), in `lib/machine-hetzner.ts`, and used only when the studio has
`TICKET_MACHINE_PROVIDER=hetzner` and `HCLOUD_TOKEN`. The same rule holds: only the studio holds that
token. Its start-up script carries only the run's boot variables, never a credential.

## What is not done yet

- **No real machine has been made, and no Railway call has been sent.** The Railway code follows
  Railway's public guides and its published API schema, and is tested against a stand-in. The first
  real run will be its first test against the real thing.
- **The office cannot draw a worker on another machine.** It still draws characters from session files
  on the venture's own box (FB-231 item 3). The worker's sessions are brought back and added to the
  box's index, marked with the machine they ran on, so the record exists for when it is.
- **The running preview** waits on FB-230; the pull request link works as today.
- **The venture brain is not on the temporary machine.** The lane's research step falls back to
  reading the repository's files, and says so in its log.
- **The claim** — the git branch that stops two workers taking the same ticket — is made by the
  supervisor on the temporary machine rather than on the venture's box, as the ticket first asked. It
  is the same compare-and-set against GitHub either way, so it works across machines.
- **One ticket at a time per venture, still.** The venture's box holds its one-wake lock while it
  waits. The studio allows two machines per venture, so narrowing that lock is all that remains.
- **No screen for the budget.** John approves it with a command, not a button in the studio.
