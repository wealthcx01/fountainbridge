# Fountainbridge re-baseline — October 2026

**Written:** 7 October 2026, against `main` at `3809939`. **Kind:** a status report and a proposal.
It changes no code and decides nothing by itself. Every recommendation here waits on John.

**Why now.** The factory changed under this project this week. On 6 October, Archon became the
engine that works tickets across all thirteen Bruntsfield repositories, and Cowgate became the repo
that runs the factory. Fountainbridge was planned before either existed. This document looks at
fountainbridge fresh, with that in mind.

Each section starts with a plain-English part. The technical detail is underneath it, marked.

---

## The short version

1. **The studio works.** I built it from `main`, ran it against ARCA's real data, and looked at
   every main screen on a laptop-sized and a phone-sized window. The desk, Tickets, What happened,
   Memory, the Handbook and the composer all load and read correctly. Nothing scrolls sideways on
   a phone.

2. **The bottleneck is not the software. It is decisions.** ARCA has **11 decisions waiting on its
   founder. The oldest has waited 68 days.** The studio's own team has six pieces of ARCA work
   finished and waiting for approval, one of them since 27 August. More features will not fix
   that. Making decisions quick to take, and measuring how long they take, will.

3. **The plan's launch venture never launched.** The plan says THE RESET is "in the studio from
   day one". It has no repository, no machine and no founder signed in. Its manifest still says
   `draft`. ARCA is the only real venture, and its founder is John. So the studio has been built
   for founders, but it has had one user, who is also the person building it.

4. **Two engines are now working ARCA's tickets.** The studio's own "lane" (scripts on ARCA's
   machine that wake every five minutes) has merged 40 pieces of ARCA work since August. Since
   yesterday, Archon has merged two more, from the planning box. Neither knows about the other.
   That needs one owner.

5. **Archon should do the engine work. Fountainbridge should be what a founder sees and decides
   on.** Archon is better at running a ticket the same way every time, and the factory already
   runs it. Fountainbridge is better at the parts a founder touches: the desk, the decisions, the
   record of approvals, and keeping each venture's data apart. The proposal in section 4 draws
   that line.

6. **Of 50 tickets reviewed, 34 should close.** FB-001 to FB-030 are almost all finished and only
   lack a status line. Of the 20 open tickets, 9 should stay, 4 need rewriting in the light of
   Archon, 2 should merge into others, and 5 should close.

### What John has to decide

These are in order of how much they unblock.

1. **Spend 20 minutes on ARCA's 11 waiting decisions.** Approve, refuse, or withdraw each one. No
   ticket can replace this. Until the queue moves, every new feature adds to a pile nobody reads.
2. **Who works venture tickets from now on: Archon, or the studio's own lane?** I recommend Archon,
   after one short head-to-head (ticket 1 in section 5).
3. **THE RESET: start it, or park it on paper.** If it starts, it is the first real outside
   founder, and that is the most valuable test this studio can have. If it is parked, the plan
   should say so, and "venture-as-config" should be proved with a second venture another way.
4. **Which merge rule binds.** This repo's `CLAUDE.md` says a pull request merges itself once its
   checks are green and it has been reviewed. Cowgate's manual says a lane never merges its own
   pull request and John merges. Both cannot be true. This document's own pull request follows
   Cowgate's rule and is left for John.

---

## 1. What exists today and actually works

### In plain words

**The studio is a website a founder signs into.** It shows their venture as one page, "the desk":
what is waiting on them, what their team did, and what is stuck. From there they can read any
piece of work, approve it or refuse it with a reason, tell the studio what they want in plain
English, and see what their venture "knows" — the documents their team reads before it works.

**Behind the website, each venture has its own machine.** ARCA's machine runs the team: a set of
scripts that wake every five minutes, pick up one ticket, plan it, build it, check it, review it
and open it for the founder's approval. The same machine keeps the venture's memory and its
record of approvals.

I ran the studio and looked at it. Here is what a founder sees today on ARCA.

- **The desk** says, in one sentence, what ARCA is, that 11 decisions are waiting, that the team
  is on 16 moving tickets, and that £0 of the £5,800 monthly budget is spent. Two boxes at the top
  say "You are the blocker on 11 items; the oldest has waited 68 days" and "3 tickets are stuck and
  need a human". It reads clearly. It is about the length the design asked for.
- **Tickets** lists all 87 of ARCA's tickets, split into "Needs you", "Underway" and "Done and
  stopped". Selecting one shows what it is for, what approving it would reach and cost, a button to
  approve it, a button to refuse it with a reason, and a link to see the work running.
- **What happened** tells the last two weeks as one line per piece of work, in plain English.
- **Memory** lists the five documents ARCA's team reads, who added each one, and which piece of
  work last used it.
- **The composer** is a text box: "Tell the studio what you want". It also takes a voice note.
- **On a phone**, every screen becomes one column, with nothing cut off and nothing scrolling
  sideways.

**What is not real yet**, and the studio says so honestly on the screen:

- **The office** (little figures at desks showing who is working) is a stand-in picture. The live
  version is "being connected".
- **Sell** ("Who you are selling to") has nowhere to store a pipeline yet.
- **Scale** shows Meta ads, but ARCA has no ad account, so the page shows a clearly labelled
  made-up example.
- **Nothing runs on a schedule.** The "what happens without you asking" list is empty.
- **The "Build" budget is "not set".** The machine-per-ticket feature that needs it is built and
  switched off.

**What I did not check.** I did not compare these screens against the Claude Design prototype this
time, because nothing on a screen changed. The last side-by-side readings, screen by screen, are in
`docs/design-conformance.md`. I did not sign in to production. I ran the same code locally against
the same data, which this repo's own method says is equivalent (see below).

### Technical detail

**How it was run.** `npm run build` on `main` at `3809939` under a 3 GB memory cap, then
`npm run start` on port 3200 with `GITHUB_TOKEN="$(gh auth token)"`, both `E2E_TEST_LOGIN`
variables set, signed in as `arca.founder@bruntsfield.capital`. Measured with
`scripts/measure-on-real-data.mjs`, which records each page's height and sideways overflow and
prints where it landed. Every reading landed on the route asked for. The server was stopped
afterwards.

**Heights, ARCA's real data, signed in as the founder:**

| screen | design (from the scorecard) | desktop 1440×1000 | phone 393×851 | last recorded |
| --- | --- | --- | --- | --- |
| The desk | ~1,900px | 1,848px | 2,258px | 1,689 / 2,175 (30 Sep) |
| Tickets | 1,090px | 1,446px * | 1,830px | 1,325 / 1,600 |
| What happened | ~1,000px | 1,038px | 2,200px | 1,236 / 2,547 |
| Memory | ~1,000px | 1,186px | 2,219px | 1,096 / 1,988 |
| Handbook | 1,000px | 1,000px | 1,581px | 1,096 / 1,581 |
| Composer | ~1,000px | 1,000px | 1,195px | 1,096 / 1,142 |
| Sell | — | 1,000px | 1,014px | — |
| Scale (Meta ads) | — | 1,274px | 2,046px | — |

No screen scrolls sideways at either size. \* The Tickets reading was flagged by the script: the
selected ticket's history says "Part of this history could not be read". That is likely because a
local run has no database; on production it may be complete. Sell's "not set up" message has the
same likely cause: the Sell database (`db/005`) is one of the switches waiting on John.

**Three small things seen in the pictures**, none worth a ticket on its own yet:

- The first item in "Needs you" is labelled "Decision 11 of 11", where 1 of 11 would be expected.
- On Sell, Scale and the composer, the left-hand menu highlights "The desk", not the page you are on.
- The desk has grown 159px since 30 September. It is still under the design's height.

**A finding about this machine.** The repo's `CLAUDE.md` and Cowgate's manual both say Chromium
cannot run on the planning box. It can. The browser's missing system libraries were already
extracted to `~/.local/pw-libs/` by an earlier session. Running Playwright with
`LD_LIBRARY_PATH=/home/dev/.local/pw-libs/usr/lib/x86_64-linux-gnu` works. That means the
Playwright UI gate could run on this box before a push, not only in CI.

**State of the deployment and checks.** Production (`foundry-studio-production-4a73.up.railway.app`)
answers, and sends signed-out visitors to the sign-in page as it should. Its deploy status on
`main` is green. The last four CI runs on `main` passed. There are no open pull requests in this
repo.

**State of ARCA's two engines, from GitHub:**

- The studio's lane (branches named `foundry/…`) has merged **40** pull requests into ARCA, the
  last on 2 October. It has **5 open**, waiting on the founder: ARCA-068, 070, 071, 072 (2–3
  October) and ARCA-069 (27 August). A sixth open pull request, #88, is from 2 September.
- Archon's house workflow (`bruntsfield-ticket`) has merged pull requests #100 to #104 into ARCA
  on 6–7 October, including ARCA-075 and ARCA-077. Its first run on ARCA-075 failed after 37
  minutes and about $18.60, because the review step edited files and the work drifted out of its
  approved scope. Cowgate fixed both, and the next runs merged. That run is written up in
  Cowgate's `docs/runs/2026-10-06-arca-075-f47156df/`.
- **The studio already shows Archon's work.** ARCA-075 and ARCA-077 appear on "What happened",
  because the studio reads git and does not care who wrote the commit. That is the
  "git is the record" decision (D2) paying off.

---

## 2. The vision, from the repo's own documents

**Fountainbridge is the Foundry Studio**: the place where a founder runs a company that Bruntsfield
Capital builds with them. It is one of four "studios" under Holy Corner, Bruntsfield's hub. The
Advisory Studio (grassmarket) is its sibling.

**The promise to a founder** is that they only ever do four things: say what they want, watch it
get picked up, decide when asked, and see what happened. Everything else is Bruntsfield's plumbing.
The bar is "at least as good as cofounder.co, preferably better".

**Where it is meant to be better than Cofounder:** the founder owns their code, their machine and
their infrastructure from the first day. There is no "graduation" and no rented stack. A human
partner at Bruntsfield is in the loop. Production standards are stricter.

**The rules that make it trustworthy:**

- **Git is the record.** A venture's work is a folder of plain tickets in its own repository. The
  studio is a window onto that folder, and a way to write to it. It is not a second database.
- **Nothing leaves the company without a human's recorded "yes".** No email, post, payment or
  deploy goes out without a signed approval. That rule has no switch.
- **Each venture is kept apart.** One venture's founder can never see another's data. This is
  enforced on the server, not by hiding things on the screen.
- **A venture is a settings file, not code.** The studio must stay general enough that a very
  different business (for example, a bank's wealth product) is just another settings file.
- **Plain English everywhere** a founder reads.

**The plan, in phases:** foundations (done); a read-only studio (done); writing tickets and waking
the team on a timer (done); the founder experience — the composer, approvals in the studio, and
"nothing fails silently" (largely done); departments beyond engineering — Sell and Scale (begun);
and finally a public front door and a new venture set up in under a day (not begun).

**How the vision moved in September.** John's re-plan (`docs/architecture-replan-2026-09.md`,
ruled on 29 September) changed four things:

- **D10.** A founder's own Claude becomes the workbench. The studio becomes the ledger, reached
  through a "Foundry" tool server that can read, file and propose, but **never grant** an approval.
  The desk becomes read-mostly.
- **D11.** Work on each ticket can run on a temporary machine made for that ticket. Each venture's
  permanent machine keeps only what holds state: approvals, memory, the office, the composer.
- **D12.** Agents load shared skills rather than us writing our own.
- **D13.** Memory is either a current fact (replace it) or an event (append it), and a script, not
  a sentence, enforces the date on every entry.

**One honest gap between the vision and today:** the plan's first two phases end with "THE RESET is
run day-to-day through the studio" and "Ross's account sees Reset live". Neither happened. Every
later phase assumed it had.

*Sources: `README.md`, `CLAUDE.md`, `docs/fountainbridge-phased-plan.md` (v4, D1–D9),
`docs/architecture-replan-2026-09.md` (D10–D13), `docs/founder-journey.md`,
`docs/parity-critique.md`.*

---

## 3. Every ticket: keep, rewrite, merge or close

### In plain words

I read FB-001 to FB-030 and the 20 tickets still open (the same list as Cowgate's `QUEUE.md`).

- **FB-001 to FB-030** were the first month's plan. 29 of them are finished. Their files just never
  got a status line, so they look open. They should be marked closed. One, FB-010 (the founder
  dogfood week), never happened and should be rewritten.
- **Of the 20 open tickets**, 9 should stay as they are, 4 should be rewritten because Archon
  changes them, 2 should be folded into other tickets, and 5 should close.

Closing a ticket here means: set its status to say what happened, so nobody works it by mistake. It
does not delete anything.

### FB-001 to FB-030

Evidence for "finished" is that the thing it asked for is in the repository or on screen, named in
brackets.

- **FB-001** scaffold the repo — **close**. Done in July (CI, `CLAUDE.md`, tickets folder).
- **FB-002** studio types in bcap-contracts — **close**. Done; vendored at bcap-contracts 0.1.0 and
  validated in `tools/manifest-validate`.
- **FB-003** venture manifests — **close**. Done (`ventures/arca.yaml` active, `the-reset.yaml`
  draft).
- **FB-004** ticket parser — **close**. Done (`tools/ticket-parser`, run by `make parse-tickets`).
- **FB-005** Next.js shell and Google sign-in — **close**. Done; it is the studio.
- **FB-006** lanes and tickets view — **close**. Done; it became the Tickets screen.
- **FB-007** attention queue — **close**. Done; it became "Needs you".
- **FB-008** CI health and activity feed — **close**. Done; it became "What happened".
- **FB-009** phone pass and Railway deploy — **close**. Done; production runs on Railway and every
  screen fits a phone.
- **FB-010** a dogfood week on THE RESET, then a retro — **rewrite**. It never ran, because THE
  RESET never started. Rewrite it as "the first outside founder", tied to John's decision on THE
  RESET (section 5, ticket 10).
- **FB-011** venture machine provisioning — **close**. Done (`scripts/provision-venture.sh`,
  `docs/provisioning.md`). Future machines are Cowgate's runner image (CG-0001).
- **FB-012** GTM and approval-gate research — **close**. Done and ratified (`docs/research-gtm.md`).
- **FB-013** Foundry playbook — **close**. Done (`/playbook`).
- **FB-014** founder identity on the shared Bruntsfield Workspace — **close**. Done; D3 amended.
- **FB-015** make every page private — **close**. Done; signed-out visitors go to sign-in.
- **FB-016** Foundry story pages — **close**. Done (`/foundry`).
- **FB-017** "How the Foundry works" pages — **close**. Done (`/how-it-works`). If Archon replaces
  the lane, these pages need a refresh; that belongs to ticket 6 in section 5.
- **FB-018** deep playbook on two frameworks — **close**. Done (`content/playbook`).
- **FB-019** ARCA ready for dogfooding — **close**. Done; ARCA renders with real data.
- **FB-020** GitHub App sign-in for repo reads — **close**. Done (`lib/github.ts` supports both a
  token and the App).
- **FB-021** empty boards ("repository not found") — **close**. Done.
- **FB-022** strip DRAFT banners — **close**. Done, with a guard.
- **FB-023** handbook reading pages — **close**. Done (`/handbook`).
- **FB-024** plain-language labels — **close**. Done; `copy-lint` now enforces the vocabulary.
- **FB-025** the conversational composer (LibreChat) — **close**. Shipped. What it becomes next is
  the question in FB-144, not here.
- **FB-026** approvals inside the studio — **close**. Delivered by later tickets (FB-046, FB-064,
  FB-183): the "Make it part of my product" and "Refuse, and say why" buttons are on screen.
- **FB-027** motion with Rive — **close**. Never started, and polish is not the constraint. Grassmarket
  has its own Rive ticket (GRS-0206) if the house style wants it later.
- **FB-028** the Bruntsfield method and a ticket template — **close**. The method is written
  (`docs/jstack-bruntsfield-method.md`). The template's job is now done by the `write-ticket` skill
  and Cowgate's plain-English check on every plan.
- **FB-029** the Modernisation Engine pipeline — **close here**. It is a different venture's product
  and depends on an Archon version that no longer exists. If it is still wanted, it belongs in that
  venture's own repository (the venture was onboarded by FB-031).
- **FB-030** put ARCA's tickets on its main branch — **close**. Done; the studio shows 87 ARCA
  tickets.

### The 20 open tickets

**Keep (9).** Each is still true and still useful after Archon.

- **FB-159** nothing records how long a decision took — **keep, and do it soon.** The real
  bottleneck is decision time (68 days), and the studio cannot measure it.
- **FB-164** the studio re-reads everything from GitHub on every page load — **keep.** Screens are
  still slow to finish loading; take FB-154 into it (below).
- **FB-209** the conversation on a ticket has nowhere to be read — **keep.** Small, raised by the
  design review, and a half-built branch already exists (`fb-209-the-conversation-on-a-ticket`).
- **FB-212** routines on Memory are cards, not rows — **keep.** Small design fix.
- **FB-215** the admin ledger cannot be read on a phone — **keep.** Small, visible, and its test
  passes while the screen is wrong.
- **FB-233** a launch video a founder can post — **keep, parked.** Its own rule says wait until
  there is a product worth announcing. Nothing to do.
- **FB-237** memory is a current fact or an event, and a script writes the date — **keep.** It is
  about a venture's own memory (`context/`), which stays fountainbridge's job whatever runs the
  tickets.
- **FB-262** "10 minutes ago" wraps onto two lines — **keep.** Tiny.
- **FB-263** ticket ids with a hyphen in the prefix are misread — **keep, low priority.** It only
  bites once THE RESET exists.

**Rewrite (4).** Archon changes what each should ask for.

- **FB-264** investigate Archon — **rewrite.** Archon is no longer a candidate; the factory adopted
  it on 6 October and it has already merged ARCA work. The question left is narrower: should
  Archon replace the studio's own lane on venture machines? Rewrite it as a short head-to-head on
  data that now exists (section 5, ticket 1).
- **FB-144** two doors to one conversation — **rewrite.** D10 has been ruled, and Archon adds a third
  door (its own chat and, soon, Telegram). Rewrite it as the memo D10 asked for: Claude Code is the
  workbench, the composer is the plain front door, Archon is the engine, and an approval is signed
  in none of them.
- **FB-201** a cofounder that notices — **rewrite.** The idea is right: an agent that wakes, reads,
  notices and proposes, and can never send, spend or merge. Archon can now run that on a schedule.
  Rewrite it so the noticing is an Archon workflow that can only write proposals, and the studio
  keeps the founder-facing "dial". A half-built branch exists (`fb-201-a-cofounder-that-notices`).
- **FB-222** what we have not taken from Cole Medin — **rewrite.** Archon is Cole Medin's own
  project, so we are now taking his ideas wholesale. Of the four "takes": take 2 (rewrite the
  lane's 41 "do not" instructions) moves to Cowgate's house workflow prompts if the lane retires;
  take 3 (a composer with no tools) folds into the FB-144 rewrite; take 4 (fix the system, not the
  bug) is already how we work. What is left is take 1, the "fire budget" (a rule for how often the
  studio may say the same thing), plus the ideas document. See section 4.

**Merge (2).**

- **FB-111** one name for the approval record — **merge into FB-171.** FB-171 replaces our
  home-made approval record with the real ActiveGraph package. When that cut-over happens, the name
  clash disappears, so naming belongs in that cut-over and not in a separate cross-repo rename.
- **FB-154** approvals are read whole on every ticket click — **merge into FB-164.** It is one
  symptom of the same cause: no stored read model.

**Close (5).**

- **FB-166** the composer does not record what it reads — **close.** Under D10 the composer becomes
  the plain front door, not the main workbench. The cost (a new service holding a write token) is
  not worth it for a surface being demoted. John chose "do it properly" on 2 September, before D10;
  if he still wants it, it reopens.
- **FB-172** the graph on screen — **close for now.** It needs FB-171's switch to real ActiveGraph,
  which is built but off. Reopen when that is on and a founder asks for it.
- **FB-221** TypeSafe's Jev — **close.** Its deliverable was a verdict (decline), and the verdict is
  recorded in the plan as D9.
- **FB-228** temporary per-ticket environments — **close.** Its first gap (ARCA had no preview
  environments) was fixed by FB-230; ARCA tickets now link to a running preview. Its second gap
  (work each ticket on its own machine) became FB-239, which now overlaps Cowgate (section 4).
- **FB-238** read `duet-agent` before the tool server grows — **close.** The question it guarded
  (which agent harness do we build on?) has been answered for the whole factory: Archon.

---

## 4. How Archon and Cowgate change the plan

### In plain words

**Archon** is a program that runs a written-down process for AI coding: plan, wait for a person to
approve the plan, build, run the checks, review, open the work for approval. It does it the same
way every time, each ticket in its own copy of the code. **Cowgate** is the repo that runs the
factory: it holds Archon's house process (`bruntsfield-ticket`), the rules for secrets, the plan
for temporary Railway machines, the spending caps, and the event log.

**Fountainbridge already built most of that itself**, for venture machines: a 2,900-line set of
shell scripts that plan, build, check, review and open a pull request every five minutes; a plan
for one temporary machine per ticket (FB-239, built and switched off); and its own budget and
approval records. That was right when nothing else existed. Now the factory has one engine, and
keeping a second one means fixing every lesson twice.

**So the proposal is a clean split:**

- **Leave the engine to Archon.** Running a ticket from plan to pull request, each ticket in its own
  worktree, the plan-approval pause, and the run history.
- **Leave the machinery to Cowgate.** The image a runner starts from, which secrets it gets, making
  and destroying Railway machines, and the caps on how many run and what they spend.
- **Fountainbridge keeps what a founder sees and what must never be lost.** The desk and every
  founder screen. The signed record of approvals for anything that leaves the company. Keeping each
  venture's data apart. The venture's memory. The Foundry tool server. Budgets as a founder and
  John see them. And plain English on top of all of it.
- **Fountainbridge builds a thin layer on top of Archon** so a founder never has to see Archon: their
  team's runs appear on the desk and in the office, and when Archon pauses for a plan approval on a
  venture ticket, the founder approves it in the studio.

**Why not just let founders use Archon's own dashboard?** Three reasons. It is reachable only on
Bruntsfield's private network and only John can sign in. It shows raw technical data in its
approval box (Cowgate's manual records this as an Archon display bug). And an Archon approval is a
pause in a running program, not a signed record. Our rule that nothing leaves the company without a
recorded human "yes" needs the signed record, and that stays ours.

**One rule must survive the move.** Archon's approval may only ever approve *work in a branch*. It
must never be what sends an email, spends money or deploys. Those still go through the studio's
signed approval, exactly as now.

### Technical detail

#### Adopt (take as it is)

- **Archon as the engine for venture tickets**, through the house workflow `bruntsfield-ticket`,
  pinned at v0.11.1, telemetry off, worktree mode only. Subject to the head-to-head in ticket 1.
- **The house workflow's guards**, which are better than the lane's: Claude starts with no GitHub
  credentials so it cannot push or merge however a command is spelled; the repo's own `## Checks`
  are run as commands, never guessed; a scope guard after implementing; a per-run budget; the
  five-part plain-English plan (`house-plain-check`) before any approval.
- **`factory-log` events** (`ticket.started`, `pr.opened` and so on) as the factory-side record of a
  run. This repo already logs to it.
- **Cowgate's runner image, secrets manifest and governor** (CG-0001, CG-0002, CG-0006) in place of
  any fountainbridge equivalent.

#### Build on top (fountainbridge's new work)

- **Archon runs on the desk.** The office and "What happened" read Archon's run state (its API on
  the box, or the `factory-log` events) so "your team is working on ARCA-077 now" is true whichever
  engine did the work. Today Archon's work only shows once it is merged.
- **Plan approval from the studio.** When a `bruntsfield-ticket` run on a venture pauses at its
  approval gate, the studio shows the plan on the ticket's page and the founder approves or refuses
  there. The studio then calls `archon workflow respond` (or the API equivalent). This keeps
  FB-183's rule of one place to decide. It also needs D7's matrix: product-visible plans go to the
  founder, platform plans to Bruntsfield.
- **Venture isolation across Archon.** One Archon serves all thirteen repos on the planning box.
  That is fine for Bruntsfield's own repos and **not** fine for founder-facing data. The studio must
  only ever show a founder the runs for their own venture's repositories, checked on the server,
  with a test that tries to read across ventures and fails (the FB-170 pattern). FB-264's original
  text said "one Archon per venture, never one serving several"; if founders ever reach Archon
  directly, that rule applies.
- **The "noticing" cofounder (FB-201) as a scheduled Archon workflow** that can only write
  proposals, with the studio's admin dial deciding what it may look at and how often.

#### Leave to Archon and Cowgate (fountainbridge stops building it)

- **The venture lane** (`deploy/lane/run-once.sh`, `supervisor.sh`, `foundry-lib.sh` and friends,
  37 files) — retired on ARCA's machine once ticket 1 says so. ARCA's machine keeps the brain, the
  office, the composer and the approval record (the D11 split, unchanged).
- **FB-239's per-ticket Railway machines.** The studio built a Railway provider, a budget store and a
  machine service, switched off. Cowgate's CG-0003 (provision and teardown) and CG-0006 (caps) are
  the same thing for the whole factory. Keep only what is fountainbridge-specific — the check that a
  machine gets one venture's credentials and no other's, and the budget John approves — and hand the
  rest to Cowgate. Do not switch FB-239 on as it is.
- **The lane's own run loop fixes.** FB-251 (a plan re-planned every five minutes for five weeks)
  is the kind of bug a written workflow with a stopping rule does not have.

#### FB-264, FB-228 and FB-222, folded in

- **FB-264** asked "adopt, borrow or leave?". The factory answered "adopt" for itself. What remains
  is the venture-machine question, and much of its evidence now exists: Archon's first ARCA run
  (failed, 37 minutes, about $18.60, fixed in CG-0010) and its later merged runs, against the lane's
  40 merged pull requests and its known faults. Its original warnings all still hold and are carried
  into the split above: the approval gate stays ours, venture isolation, telemetry off, a pinned
  version, and "a switch has to beat the lane on the same tickets, not on paper".
- **FB-228** found that per-PR previews already work and the real gap was running each ticket on
  its own machine. Previews on ARCA now work (FB-230). The machine part is Cowgate's runner work.
  The isolation test it required still applies, now to Cowgate runners carrying venture
  credentials.
- **FB-222** recorded the hold-out critic: the lane's review step is a fresh session that cannot see
  how the builder reasoned. **Archon must keep that property.** In `bruntsfield-ticket`, review
  should stay a separate session from implement; that is worth one line in Cowgate's workflow and
  one check in its tests. Take 2 (41 "do not" instructions in the lane's prompts) only matters if
  the lane survives; the same audit should be run on the house workflow's prompts instead. Take 1,
  the fire budget, stays a studio rule and becomes its own small ticket.

#### Cost to keep in mind

- **The planning box is small** (7.6 GB of memory). Archon runs two at a time there today. Running
  every venture's tickets on it is not possible until Cowgate's Railway runners exist (CG-0001 to
  CG-0004). Until then, ARCA's machine has spare capacity the planning box does not. That is an
  argument for moving ARCA to Archon only once runners exist, or for running Archon on ARCA's own
  machine as an interim. Ticket 1 should answer which.
- **Archon is young and changes fast.** Upgrades are their own Cowgate ticket. Two quirks are
  already worked around (Cowgate's manual, "Archon on this box").

---

## 5. The next 10 tickets, in order

Each would be its own ticket file, branch and pull request. None is filed yet; this document
proposes them for John to accept, change or reorder.

1. **FB-264, rewritten: should Archon replace the lane on venture machines?** Put the lane and
   Archon side by side on ARCA, using the runs that already exist plus two more small ARCA tickets.
   Compare whether each finished, how long it took, what it cost, and whether the work passed review
   first time. End with a one-page recommendation and, if it is "yes", where Archon runs for ARCA
   until Cowgate's runners exist. *Small; decides tickets 4, 5 and 6.*

2. **FB-159: record how long each decision waits.** Store when something starts waiting on a founder
   and when it is decided. Show "the middle decision took N days" on the admin ledger. *Small; it
   measures the one thing actually holding ARCA back.*

3. **New: a decision that has waited too long gets a way out.** After a set number of days (a
   setting, not hard-coded), a waiting item on the desk offers "withdraw it" as well as approve or
   refuse, and says why it is offered. Withdrawing is recorded, never silent. *Small; it lets a
   founder clear a 68-day pile in one sitting.*

4. **New: Archon's runs show on the desk.** The office and "What happened" show a venture's Archon
   runs as "your team is working on…", for that venture's repositories only, checked on the server,
   with a cross-venture test that must fail to read. *Medium.*

5. **New: approve an Archon plan from the studio.** A paused `bruntsfield-ticket` run on a venture
   shows its plan on the ticket's page; the founder approves or refuses there; the studio passes the
   answer back to Archon. Routed by the D7 matrix. Approving a plan never approves an external
   action. *Medium; depends on 4.*

6. **New: move ARCA's ticket work from the lane to Archon** (only if ticket 1 says so). Stop the
   lane timer, keep the brain, office, composer and approval record on ARCA's machine, refresh the
   "How the Foundry works" pages, and mark the lane scripts retired. *Medium; depends on 1, 4, 5.*

7. **New: hand FB-239's machines to Cowgate.** Write down the seam: Cowgate makes and destroys
   runners and enforces caps; the studio keeps the per-venture credential check, the isolation test
   and the budget John approves. Remove the studio's duplicate Railway provider once Cowgate's
   CG-0003 works. *Small to write, medium to finish; needs Cowgate.*

8. **FB-144, rewritten: one memo for the doors.** Claude Code is the workbench, the composer is the
   plain front door, Archon is the engine, and an approval is signed only in the studio. Decide
   whether the LibreChat door on each venture machine stays. *Small; a document.*

9. **FB-164 (with FB-154): stop re-reading GitHub on every page load.** Keep a stored, refreshed
   view of each venture's tickets, approvals and reports so screens finish loading in about a
   second, not six to eight. *Large; the main speed work left.*

10. **FB-010, rewritten: the first outside founder.** Either start THE RESET properly — repository,
    machine, Ross signed in, a week of real use, a written retro — or record that it is parked and
    pick another venture to prove the studio works for someone who is not John. *Depends on John's
    decision; the most important test the studio has not had.*

**After these:** FB-201 rewritten (the noticing cofounder, on Archon), FB-222's fire budget, FB-237
(memory facts and events), and the small screen fixes FB-209, FB-212, FB-215 and FB-262, each
whenever a gap opens.

---

## How this was checked

- **Tickets:** every file in `docs/tickets/` with no "Done", "Shipped" or "Superseded" status line,
  which gives exactly FB-001 to FB-030 plus the 20 listed in Cowgate's `QUEUE.md`. For FB-001 to
  FB-030, "finished" was checked against the repository (files, routes, scripts) and git history,
  not taken from the ticket text.
- **Archon and Cowgate:** Cowgate's `OPS.md`, tickets CG-0001 to CG-0012 and its first-run record;
  the Archon CLI on this box (v0.11.1); and ARCA's pull requests on GitHub.
- **The studio:** built and run locally from `main` against ARCA's real data, signed in as the
  founder, at 1440×1000 and 393×851, with the screenshots read. Production checked for an answer and
  a green deploy only. Not compared against the design prototype, because no screen changed.
- **Nothing was changed** other than adding this file. No ticket status was edited; the verdicts
  above are proposals.
