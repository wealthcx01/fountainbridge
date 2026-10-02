# FB-239 — one machine per agent per ticket, with the skills it used on the record

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-30 — *"should it not be one temp VM on
railway per pixel agent, per ticket that is being worked, with the right skills files loaded to tackle the
ticket? and we should be able to see what skills each worker used"* · **Depends on:** FB-228, FB-231 ·
One ticket = one branch = one PR.

**Shipped in part:** the studio can make, hand work to, and remove a temporary Railway machine for one ticket, within a monthly budget John approves on the studio's budget page, and venture isolation is tested — but it is switched off, no real machine has ever been made, no real budget has been recorded, the office cannot yet draw a worker on one (FB-231 item 3), and the running preview waits on FB-230. Switching it on needs John (`docs/ticket-machines.md`, "Switching it on").

## Where this stands

Two pull requests carry this ticket's history.

- **PR #296** landed the ruling only: a character in the office means a piece of work, and the
  helpers a worker starts are never drawn. It closed design gap 3.
- **PR #350** builds the machine. Its first version put the machine on Hetzner and had each venture's
  own box make it. An independent review found that unsafe — the box would have held a key able to
  reach every venture's server — and found that a machine failing during set-up was reported as a
  success. John then ruled on how it must work (below), and PR #350 was reworked to those rulings.
  A second review found that a machine's unused money could be given back twice, that a supervisor
  dying early was still reported as a success, that the studio took the lane's word for a
  department's gate, and that nothing proved who approved a budget. All four were fixed in PR #350
  before it merged; the PR's "Fixed after review" section lists each.

This ticket was first written to be built last, after the preview link (FB-228, FB-230) and an
office that can see a worker off the box (FB-231). The machine itself does not need either, so it is
built now and **left switched off**. The office and the preview are still needed before it is worth
switching on for a founder, and they are listed below as what is left.

## RULED by John, 2026-10-02: Railway, only the studio makes machines, a monthly budget per venture

John gave these three rulings in the lead's working session on 2026-10-02. They were not written
anywhere else first, so this ticket and `docs/fountainbridge-phased-plan.md` are where they are
recorded.

1. **Provider: Railway.** Each ticket's temporary machine runs on Railway, as John first asked and as
   D11 in `docs/architecture-replan-2026-09.md` says. The Hetzner code stays as a second provider
   behind the same interface, off unless chosen.
2. **Only the studio creates machines.** No venture's machine or box ever holds a provider key that
   could touch another venture (D1, non-negotiable 6). The studio, which Bruntsfield controls, holds
   the one provider token and makes and removes machines. A venture's lane may only *ask* the studio
   for a machine for one of its own tickets; the studio checks, on the server, that the request is
   from that venture and for that venture's ticket, and gives the machine only that venture's
   credentials. The request endpoint is treated as a public endpoint and checks everything itself.
   The cross-venture isolation test D11 requires is part of this ruling.
3. **Spending: a monthly cap per venture that John approves once.** The studio refuses to make a
   machine unless the venture has a monthly budget John approved, recorded as a signed approval the
   studio can verify and a lane cannot forge. Spend so far this month is kept per venture in the
   studio's database, under the same forced row-level security as every other table. At the cap no
   machine is made and the founder is told plainly. No per-ticket click.

   **How John approves it** (settled in review, 2026-10-02): through the studio's existing approval
   pattern, not a command. Anyone at Bruntsfield proposes an amount on the budget page
   (`/admin/machine-budgets`); John, signed in with Google, approves it there. Only the address in
   `BUDGET_APPROVER_EMAIL` can approve — not any admin. The studio records `approval.proposed` and
   `approval.granted` in its ActiveGraph record, and stores nothing if that record cannot be written.

The phased plan's D1 now carries these rulings as an amendment (`docs/fountainbridge-phased-plan.md`).

## RULED by John, 2026-09-30: one machine and one character per ticket, helpers invisible

*"one machine and one character per ticket, helpers invisible."*

So a character means **a piece of work**, not an agent and not a department. A wake that spawns eight
subagents shows **one** character, because eight would make the room a picture of how the runtime
parallelised rather than of what the company is doing — the objection FB-218 raised.

- **The unit is the ticket.** One temporary machine, one character, one preview link, one entry in the
  record. Anything the worker spawns inside itself is its own business and is never drawn.
- **FB-218's bound still has to hold.** A character appears while its ticket is being worked and is gone
  when it stops.
- **This closed design gap 3** (`docs/design-gaps-open.md`): a figure means a piece of work.

## What was built (PR #350, reworked 2026-10-02)

When a venture's lane picks a ticket and temporary machines are switched on, the lane asks the studio
for a machine. The studio checks the request, the venture's budget and the month's spend, makes a
Railway environment for that one ticket, and starts it. The machine collects that venture's work from
the studio once, runs the same `supervisor.sh` the venture's box runs, tells the studio how far it got,
and is removed. How it works, what it costs and how to switch it on are in `docs/ticket-machines.md`.

| file | what it does |
| --- | --- |
| `lib/ticket-machines.ts` | the rules: costs, keys, what a lane may ask, what a machine is given, how a run ended |
| `lib/machine-service.ts` | the five things the studio answers: ask, check, collect, finish, clean up |
| `lib/machine-store.ts`, `db/007_ticket_machines.sql` | budget proposals, budgets, this month's spend and each machine, per venture |
| `lib/machine-budget.ts`, `app/actions/machine-budget.ts` | proposing and approving a monthly budget, and the record of each |
| `app/admin/machine-budgets/page.tsx`, `components/MachineBudgetControls.tsx` | the budget page, for Bruntsfield only |
| `lib/machine-railway.ts` | Railway: one environment and one service per ticket |
| `lib/machine-hetzner.ts` | Hetzner, the second provider, off unless chosen |
| `app/api/machines/…` | the endpoints, each checking its own key |
| `scripts/ticket-machines.mjs` | John's commands: print a lane key, print the clean-up key (no budget command, on purpose) |
| `deploy/lane/ticket-machine.mjs` | the venture box asks the studio and waits |
| `deploy/lane/worker-run.sh`, `worker-call.mjs` | what runs on the machine, and how it talks to the studio |

**Tested without a real machine.** 27 tests drive the studio's endpoints against real Postgres and a
stand-in provider: a whole run; venture A can never get a machine with venture B's credentials or for
B's ticket, nor read or end B's run; a budget a lane wrote itself, one approved by an admin who is not
the budget approver, or one moved from another venture is refused; at the cap nothing is made; a
machine removed by two callers at once gives its money back once; a machine that fails while setting
itself up, one that stops without a word, and one that runs out of time are all failures with a
reason; a lost create reply removes this run's machine and only this one; a machine that boots before
the studio hears back is not refused. 12 more test the budget page's rules: who may propose, that only
the budget approver may approve, and that nothing is stored when the record cannot be written. More
tests cover the store's isolation, both providers' requests, the venture box's side, the machine's
side (including `worker-run.sh` run for real against a stand-in studio and a stand-in supervisor), and
what counts as a wake or an attempt.

## The shape John is describing

One ticket, one temporary machine, one character in the office, the right skills loaded for that kind of
work, and afterwards a link to the result and a record of what the worker used. It makes the office an
honest picture of the company rather than of the runtime, stops tickets contaminating each other, and
answers "what is happening right now" with something a founder can look at.

## Scope

1. ~~The lane's claim stays on the persistent machine.~~ **Changed in PR #350:** the claim (a git
   branch-create compare-and-set) is made by the supervisor on the temporary machine. It is the same
   operation against GitHub either way, so it still stops two workers taking one ticket, but it no
   longer happens on the persistent machine.
2. The **work** moves to a machine that exists only for that ticket, then is removed. **Built, off.**
3. Skills are chosen by the ticket's kind and the choice is **recorded**. The worker runs the same
   supervisor, which records the guides it followed (FB-231); they come back to the studio and the box.
4. The office draws one character for that worker, live, and it disappears when the work ends.
   **Not started** (FB-231 item 3).
5. The ticket's trail carries the preview link and the skills used. **Preview waits on FB-230.**

## What stays on the persistent machine, and why each cannot move

| stays | why |
|---|---|
| the approval record | must never be lost; FB-071 and FB-072 put it where the lane cannot author it |
| the venture brain | re-indexing cost 415 files and 160 seconds here — per ticket is absurd |
| the office socket | a founder watching needs something to watch between wakes |
| the composer | the plain door for a founder who never opens Claude Code (D10) |

## Out of scope

- FB-228, FB-230 and FB-231. This depends on them; it does not contain them.
- The free Railway VM. Its own published limits rule it out: three machines per address per day, 2 GB of
  memory where ARCA uses 1.9 GB at rest, deleted after 24 hours. Ticket machines use Railway's ordinary
  paid environments instead.

## Acceptance criteria

- [ ] A ticket is worked on a machine that did not exist before it and does not exist after. **Built
      and proved against a stand-in provider; switched off; no real machine has been made.** Met when
      one real ticket has been watched going through.
- [ ] Its character appears in the office while it works and is gone when it stops — and an empty office
      still means nothing is running. **Not started.** Needs FB-231 item 3; the worker's sessions are
      already brought back and added to the venture's index, marked with the machine.
- [ ] The founder can click through to the result. The pull request link works as today; the running
      preview still waits on FB-230.
- [ ] The trail says which skills the worker used, in words, without the founder needing to know what a
      skill is. **In code, not yet seen:** the worker runs the same `write_runreport`, which reads its
      own transcripts (FB-231). Unverified until a real run.
- [ ] Two tickets can be worked at once without either seeing the other's files. **Each ticket gets its
      own Railway environment, and the studio allows two per venture**, but the venture box's one-wake
      lock still allows one ticket at a time.
- [x] Nothing in the four persistent things above moved. The approval record, the brain, the office
      socket and the composer stay on the venture's machine; none is sent to a worker.
- [x] The cross-venture isolation test D11 requires lands **before** this ships. It covers the
      provider token (no venture ever holds one) as well as the credentials a machine receives:
      venture A can never get a machine with venture B's credentials or for B's ticket
      (`lib/__tests__/machine-service.test.ts`). It is only as narrow as each venture's GitHub token,
      which John sets per venture when he switches this on.
- [x] A machine that fails while setting itself up is reported as a failure, with a run report saying
      where it stopped — and so is a supervisor that stops before writing down how the ticket ended.
      A machine that was refused or could not be made is not counted as an attempt.
- [x] No machine is made without a monthly budget John approved, and none past it (John, 2026-10-02).
      Proved against real Postgres and a stand-in record: only the budget approver's approval, made on
      the budget page and recorded in ActiveGraph, counts, and a machine's unused money is given back
      once. Not yet used on the real studio.

## Verification

The office is a screen, so non-negotiable 11 applies in full when item 4 is built. This pull request
adds one screen, the budget page, which is for Bruntsfield and not a founder. The design artifact has
no budget screen to compare it with; it was rendered at 1440×1000 and 393×851 and looked at, and its
heights are in `docs/design-conformance.md`. The real verification is watching one real ticket go through: an environment
appears on Railway, work happens, a link works, the environment goes. Anything less is a pipeline
nobody has seen run.
