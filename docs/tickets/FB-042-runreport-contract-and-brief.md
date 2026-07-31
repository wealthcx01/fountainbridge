# FB-042 — RunReport + Department contracts, studio read model, and the founder brief

**Status:** Shipped · **Phase:** 2/3 · **Depends on:** ~~bcap-contracts (FB-002 lane)~~ **unblocked 2026-07-31** for the
`RunReport` + `Department` types; FB-040 (lanes write RunReports) · **Repo:** fountainbridge (+
bcap-contracts) · **Branch:** `fb-042-runreport-contract-and-brief` · One ticket = one branch = one PR.

## Why this matters (for the founder)
You always see, in plain language, what the agents did, what's stuck and why, and a short daily brief
of your whole venture — so nothing ever fails silently and you're never surprised.

## Context
Lanes already write RunReports to the `foundry-state` ref (FB-040), but as ad-hoc JSON — there's no
contract and no studio read surface. This lands the typed contract (via the shared package) + the
studio surface, and applies meridian's `RunRecord` shape + auto-brief (`docs/ideas-from-meridian.md`).

## Scope
- **Contract (bcap-contracts / FB-002 lane):** a `RunReport` type — `{ ticket, lane, status:
  working|blocked|opened_pr|failed|idle, source: manual|autopilot|composer, summary, pr_url?, error?,
  startedAt, finishedAt, durationMs?, tokens?, costUsd? }` (the `source`/cost/token fields from
  meridian's `RunRecord`) + the `Department` type. Consumed here as generated TS.
- **Studio read model** (`lib/runreports.ts`) + a lane-activity strip: what the engine is doing/did/why
  it's stuck, in plain language (non-negotiable 10), reusing FB-008 staleness for "engine offline".
- **Founder brief** (meridian `plainBrief`): an auto-generated plain-language digest from RunReports +
  open PRs + pending approvals + lane staleness (+ budget risk once FB-054 lands).

## Out of scope
- The autonomous-lane mechanics (FB-040). Publishing the contract itself (that's the FB-002 lane's PR).

## Acceptance criteria
- [x] **`RunReport` + `Department` published and consumed here.** The blocker turned out not to be
      the work — FB-002 was finished and sitting unmerged in grassmarket #181 since 20 July. Rebased
      and merged, then **extended in #230 (FB-059)** because the published `RunOutcome`
      (`progress | no-useful-work | error`) could not express the states the lane reports: a lane
      that could not get past its own review, one waiting on the founder, and one that crashed are
      three different situations, and `error` for all three is the silent failure non-negotiable 10
      exists to prevent. Schemas vendored into `schema/`.
- [x] **The studio renders lane RunReports, reasons included, and says whether the engine is alive.**
      `lib/runreports.ts` reads the `foundry-state` ref across **every department repo**, and the
      strip renders what each lane did. A `blocked` run always carries its reason; when the lane
      recorded none, it says *that* rather than rendering an empty sentence.
- [x] **The engine's own state is reported, and "no lane yet" is distinguished from "offline".** The
      heartbeat is the only positive evidence a lane is alive. Its absence on a venture whose box was
      never provisioned is not a fault, and telling a founder their engine is down would be false.
- [x] **An auto-generated founder brief composes from live state** — `lib/brief.ts`, ordered by who
      is needed rather than by what is newest: approvals, then stops, then budget, then progress,
      then the engine. A brief that opens with "3 tickets moved" while a send sits unapproved is
      worse than no brief.

## Two things this deliberately refuses to do

**It does not compose a calm summary out of an unreadable picture.** An empty queue and an
unreachable box look identical from the read model, and only one of them is fine. Any failed read
sets `degraded`, and the brief leads with the fact that it is incomplete.

**It does not drop a record it cannot place.** A lane status the studio does not recognise surfaces
as blocked-with-a-reason; a record missing its required fields is skipped without taking the readable
ones beside it. Inventing a `progress` would be worse than an absence, because the founder would be
told something happened.

## Still open
- ⚠ **The lane still writes its own shape.** The reader accepts both, deliberately — a reader-first
  migration means the studio understands the reports already on the ref, and the box can change
  whenever it is convenient rather than on a flag day. The writer change is its own ticket and needs
  its own live verification.
- ❌ **The PR body is built from `tail -1` of the implement log**, so a ticket that asks the lane to
  "flag anything you could not establish" has nowhere to put it. The lane found this itself while
  working SELL-001 — its own coverage gate caught that the harness could not carry what the ticket
  required. Its own ticket.
- ❌ **No cost or token accounting.** meridian's `RunRecord` carries spend per run; the lane does not
  record it, so there is nothing to render and the contract field would be decoration.

## Verification
34 unit tests over the read model and the brief — both record shapes, the in-flight invariant in
both directions, an unrecognised status, an unparseable timestamp, ordering across department repos,
the capped list still reporting its true total, and every singular/plural in the brief. 6 Playwright
tests over the rendered strip and brief, with fixtures in **both** record shapes so the studio cannot
quietly lose the ability to read the legacy one. 365 tests, lint, typecheck, design contract.
