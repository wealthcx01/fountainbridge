# Ticket machines — one temporary machine per ticket (FB-239)

John's ruling: one machine and one character per ticket. This page says how that works, why it runs
on Hetzner, what it costs, and the three things that switch it on.

**Nothing here has run against a real machine yet.** The whole lifecycle is proved against a stand-in
provider in `deploy/lane/__tests__/machine-lib.test.mjs`. Making a real machine costs money and is an
external action, so the first real one waits for John (see "Switching it on").

## What happens to one ticket

1. The venture's own machine wakes, picks a ticket, and checks its budget — exactly as today.
2. If temporary machines are switched on, it checks two caps: how many temporary machines exist right
   now (asked of Hetzner, not remembered), and how much today's machines could cost at worst. If
   either is reached, the ticket waits and the founder's log says why.
3. It makes a new machine for that ticket. The machine carries labels saying it is a ticket machine,
   which venture and ticket it is for, and **the time by which it must be gone**.
4. It makes a fresh key that opens only that machine, and sends over only what the ticket needs: the
   lane's scripts, this venture's GitHub and Claude credentials, and the ticket's name. Nothing else
   from the venture's machine goes — not the approval keys, not the brain, not another venture's
   anything. The list of what may be sent is written out in `machine-lib.mjs` (`WORKER_ENV`).
5. The machine fetches the one repository, and runs the same `supervisor.sh` the venture's machine
   runs today. That writes the run reports, with the guides it followed (FB-231), as it always has.
6. The venture's machine reads back whether the run reached its end, which guides were used, and the
   list of sessions, then **destroys the machine**, whatever happened in between.

## Why a machine cannot be left running

Three separate things end a machine. Any one of them failing is not enough to leak one.

- **The run destroys it when it finishes or fails.** If the run crashes part way, the machine is still
  destroyed. If the request to make the machine failed after Hetzner had made it anyway, the run finds
  it by its label and destroys it.
- **The machine switches itself off** at its deadline, so work stops even if the venture's machine
  never comes back. Hetzner still charges for a switched-off machine, which is why this is not the
  only layer.
- **The clean-up job** (`foundry-ticket-reaper.timer`, every ten minutes) asks Hetzner for every
  ticket machine and destroys each one past its deadline. It asks Hetzner rather than a file, so it
  finds a machine whose run was killed outright. It only ever touches machines labelled as ticket
  machines; a venture's own machine has no such label and is never touched.

So the longest a forgotten machine can live is its lifetime (150 minutes) plus ten minutes of grace
plus up to ten minutes until the clean-up job next runs: about three hours.

## Why Hetzner, and not Railway

- **The venture machines are already on Hetzner** (D1, `scripts/provision-venture.sh`). A ticket
  machine is the same kind of machine in the same account, with the same set-up and the same safety
  baseline. Nothing new to sign up for.
- **The lane needs a whole machine.** It runs Claude Code, a browser for QA, the venture's own build
  and tests, and git with a push credential. Railway runs an app from a repository; it does not hand
  you a machine to run a worker on. Railway's per-pull-request environments (FB-228, FB-230) are where
  the *result* is shown, and that stays true — the worker opens the pull request, Railway builds the
  preview of it.
- **Railway's free VM is ruled out** by its own limits (three a day per address, 2 GB of memory,
  deleted after 24 hours) — FB-228 records this.
- **Hetzner charges by the hour and stops charging when the machine is deleted**, which is the right
  billing for something that lives two hours.

## What one run costs

The machine is a Hetzner **CX33**: 4 processors, 8 GB of memory. The 4 GB size the venture machines
use is too small — a Next.js build alone needs about 3 GB on this repository, before Claude Code and
the browser.

At the time of writing a CX33 costs roughly €5.50 a month, which is under one euro cent an hour.
**Check the live price on Hetzner before switching on;** this page was written without access to the
account, and the number is not a quote.

- **A typical ticket** takes about an hour of machine time: about **one to two euro cents**.
- **The worst case** — a run cut off at its deadline and only removed by the clean-up job — is three
  started hours. The budget counts every run at that worst case and an upper-bound price of
  €0.02 an hour, so **€0.06 a run** for budgeting.
- **The daily cap** defaults to **€1.00**, which allows about sixteen worst-case runs. The lane's own
  wake budget is eight tickets a day, so the cap is a backstop, not the usual limit.

The machine is the small cost. The Claude usage for a ticket is the same as it is today, because the
work is the same work.

## Switching it on

Three things, and all of them need John.

1. **A Hetzner API token** with read and write access, from the Hetzner project that holds the
   venture machines (Hetzner Console → the project → Security → API tokens). Put it on the venture's
   machine as `HCLOUD_TOKEN` in `/etc/foundry/credentials`, never in this repository.
2. **A spending cap you are happy with.** `TICKET_MACHINE_DAILY_CAP_EUR` (default 1.00) and
   `TICKET_MACHINE_MAX` (how many at once, default 2). It is also worth setting a budget alert on the
   Hetzner project itself, so a fault in this code cannot be the only thing standing between a bug and
   a bill.
3. **The switch:** `TICKET_MACHINES=on` in the lane's environment, and the clean-up timer enabled
   (`systemctl enable --now foundry-ticket-reaper.timer`). Install the timer **before** the switch,
   so the clean-up exists before the first machine does.

The first run should be watched by a person: a machine appears in the Hetzner console, a pull request
appears on the venture's repository, and the machine disappears. Until that has been seen, this is a
pipeline nobody has watched run.

## What is not done yet

- **The office cannot draw a worker on another machine.** It still draws characters from session files
  on the venture's own machine (FB-231 item 3). A ticket worked on a temporary machine will not appear
  in the office until that is built. The sessions are brought back and added to the venture's index,
  marked with the machine they ran on, so the record exists for when it is.
- **The venture brain is not on the temporary machine.** The lane's research step falls back to
  reading the repository's files, and says so in its log. The brain stays on the venture's machine,
  where it belongs.
- **The claim** — the git branch that stops two workers taking the same ticket — is made by the
  supervisor on the temporary machine rather than on the venture's machine. It is the same
  compare-and-set against GitHub either way, so it works across machines, but the ticket asked for it
  to stay put.
- **One ticket at a time per venture, still.** The venture's machine holds its one-wake lock for the
  whole run. Two tickets at once need that lock narrowed; the machines themselves are already separate.
- **The isolation test D11 requires.** The worker holds this venture's GitHub token, so it reaches
  exactly what that token reaches. Today that token is wider than one venture
  (`docs/venture-github-token.md`); a test that proves it cannot reach a second venture has to pass
  before this is switched on.
