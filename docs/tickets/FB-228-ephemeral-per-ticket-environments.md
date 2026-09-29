# FB-228 — ephemeral per-ticket environments: most of it already exists, and the gap is one setting

**Status:** filed · **Phase:** 3 · **Ruled by:** John, 2026-09-29 (D11, amending D1) ·
One ticket = one branch = one PR.

## Why this ships no code

**Because the mechanism already exists and works.** Checked against the live Railway account and the
GitHub API on 2026-09-29, not from the documentation. Writing a provisioning system here would repeat the
mistake FB-225 records: D10 proposed "build the MCP server" when FB-200 had already built it.

What is actually missing is a **setting on a paid project** and one larger piece of work. Both are named
below, and the setting needs John because it costs money.

## What is already true, verified

**For this repo, per-PR ephemeral environments work end to end.**

| step | evidence |
|---|---|
| An environment is created per pull request | `fountainbridge-pr-289` existed while PR 289 was open |
| It is torn down when the PR merges | Six PRs merged on 2026-09-29; only the open one had an environment |
| The app's URL is published | PR 282's commit status: `Success - foundry-studio-fountainbridge-pr-282.up.railway.app` |
| The studio extracts it correctly | `previewUrlFrom` reads the hostname out of the **description** |
| A console link is refused | `target_url` on that status is `railway.com/project/...` and is ignored |
| The trail renders it | `lib/trail.ts` builds a `preview` hop: *"A preview built and is running"* → "see it running" |

`previewUrlFrom` is already tested against all of those real shapes, including a cancelled deployment
(`state: error`) and a console-only status. **There is no defect in this chain.**

### One thing worth knowing about GitHub

Railway publishes the preview **three** ways and only one is usable:

- a **commit status** whose *description* carries the app hostname — this is the one that works;
- a **GitHub deployment** whose `environment_url` is the Railway **console**;
- a `target_url` on the status, also the console.

`lib/work.ts` already documents this and rejects the console links, because *"'see it running' that opens
a deployment dashboard is a broken promise on the one control meant to let a founder judge what they
cannot read."* That is right and should not be softened.

This is the third GitHub system this project has had to tell apart. The memory note
`github-two-check-systems` covers statuses versus check runs; deployments are a third, and the same rule
applies: reading one and assuming it is the whole picture produces both false red and false green.

## What is actually missing

### 1. Venture projects have no preview environments at all

`arca` on Railway has **one environment: `production`.** No staging, no per-PR environments.

So an ARCA ticket's trail can never show "see it running", because no preview is ever built. The studio's
own repository gets previews; the venture a founder is actually watching does not. **This is the whole
reason a founder cannot see their own work running**, and it is not a code problem.

**Needs John:** enabling PR environments on the venture's Railway project. It is a setting, and it costs
money per environment, so it is a spend decision rather than a configuration one.

### 2. The lane still works tickets on the persistent box

This is the part of D11 that is real engineering rather than a setting, and the part that delivers what
John asked for.

Today: `foundry-lane.timer` fires every five minutes on the venture's own machine, `run-once.sh` claims
one workable ticket, and `supervisor.sh` runs the whole loop **in place** — plan, implement, validate,
review, qa. One wake already equals one ticket, which is why this maps cleanly.

Proposed: the claim stays on the persistent spine (it is a branch-create compare-and-set in git, which
already works across machines), and the **work** happens in an environment that exists only for that
ticket and is destroyed after.

What that buys, in order of value:

- **No contamination between tickets.** Today ticket B inherits whatever ticket A left on disk.
- **A preview per ticket**, which is FB-184's "one link to where you can see the result".
- **Nothing accumulating.** ARCA is at 83% disk after six weeks, because every wake leaves something.
- **Parallelism.** Two tickets at once, instead of the lock in `run-once.sh` that exists because a wake
  outlasts the five-minute timer.

What stays on the persistent spine, and why each cannot be ephemeral:

| stays | why |
|---|---|
| the approval record | must never be lost; FB-071/FB-072 put it where the lane cannot author it |
| the venture brain | re-indexing cost 415 files and 160 seconds on this repo — per ticket is absurd |
| the office socket | a founder watching needs something to watch between wakes |
| the composer | the plain door for a founder who never opens Claude Code (D10) |

### 3. The isolation test D11 requires, before any of it ships

D11 says it explicitly: today isolation is **physical**, and this makes part of it **logical**. That is
the same risk FB-170 introduced with a shared database and answered with a test that tries to read across
ventures and fails against the real instance.

**The same test is required here before this ships, not after.** An ephemeral worker holds a credential;
that credential must reach exactly one venture, and a test must prove it cannot reach a second.

## On the free VM, since it was the starting point

`railway.com/free-vm` offers 2 vCPU and 2 GB, ready in about 1.4 seconds, with `ssh railway.new`. It is
genuinely impressive and it is the wrong tool here, on its own published limits:

- **3 boxes per IP per day.** A lane working five tickets a day exhausts it before lunch.
- **2 GB of memory.** ARCA uses ~1.9 GB *at rest* running the lane, gbrain, the composer and the office.
- **Deleted after 24 hours** unless claimed.
- A shared AI budget per IP, and IPv4 only.

The paid ephemeral environments have none of those limits, are already enabled on this repo, and already
do the job. **Take the shape, not the product.**

## Also found: `railway.json` stops working on 2026-12-01

The CLI now warns that Config as Code is deprecated: *"Existing files keep working until 2026-12-01.
Prefer Infrastructure as Code (`.railway/railway.ts`)."*

We have a `railway.json`. That is a hard deadline two months out on the studio's own deploy configuration,
and it is unrelated to this ticket. **Filed separately rather than folded in here** — discovered work
becomes its own ticket (non-negotiable 3).

## Scope

1. This document: what exists, what is missing, what each missing piece needs.
2. Nothing else. No provisioning code, because the provisioning exists.

## Out of scope

- Enabling PR environments on any venture project. That is a spend decision for John, and it is item 1
  above.
- Moving the lane into an ephemeral environment. That is item 2, and it is its own ticket once item 1 is
  settled — there is no point isolating the work before there is an environment to isolate it into.
- The isolation test. It belongs to item 2's ticket and must land before it does.
- The `railway.json` deprecation. Its own ticket.
- Any change to `previewUrlFrom`. It is correct and tested; the input it needs simply never arrives for a
  venture.

## Acceptance criteria

- [x] Every claim about what already works is backed by something checked on the live account or the
      GitHub API on 2026-09-29, with the evidence named.
- [x] States plainly that the preview chain has **no defect**, so nobody rewrites it looking for one.
- [x] Names the three GitHub systems Railway publishes to, and which one is usable.
- [x] Separates what needs a spend decision from what needs engineering.
- [x] Records why the free VM is the wrong mechanism using its own published numbers.
- [x] The `railway.json` deadline is recorded and explicitly not folded into this ticket.

## Verification

Documents only. No screen changed, so non-negotiable 11 does not apply — said rather than left blank.

**No Railway infrastructure was created, changed or destroyed.** Everything here came from reading:
`railway list`, `railway status --json`, and the GitHub deployments and statuses APIs. Creating an
environment costs money and is a deploy, which gates on a recorded approval (non-negotiable 4).
