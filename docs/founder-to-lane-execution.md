# Founder → Lane Execution — the engine behind the composer (FB-037 design)

**Status:** Design for review (CEO + eng) · **Date:** 2026-07-29 · **Phase:** 2 (keystone)
**Companion docs:** `jstack-bruntsfield-method.md` (the Bruntsfield Loop), `fountainbridge-phased-plan.md`
(D1–D8, Phases 2–4), `research-gtm.md` (§5 ActiveGraph gate, §7 GTM), `parity-critique.md` (§5 memory,
§7 routines). **Supersedes** the thin "wake a lane" scope in `docs/tickets/FB-037-*.md` — the ground
truth below shows the loop needs its engine built, not just a trigger.

> **This is the document that turns "a founder describes it" into "it's built, on the board, awaiting
> your yes."** It is design-first (non-negotiable 9): it decides the mechanism, then derives build
> tickets; it does not itself ship the engine.

---

## 0. Why this is bigger than a trigger — the ground truth (2026-07-29)

We built the founder **front door** (FB-033–036: a LibreChat composer that shapes + files tickets,
searches uploaded files, does web research, shows "what's in review", and remembers preferences).
Behind it, an audit found the **engine is design-only**:

| Piece the loop needs | State today | Evidence |
|---|---|---|
| Agent lane **runtime** on the venture box | **ABSENT** | ARCA's box runs only the LibreChat docker stack — no `claude`/`gstack`/`gbrain`/node/repo/tmux |
| Founder second brain in **git `context/`/`library/`** (D8) | **ABSENT** | neither `wealthcx01/arca` nor `modernisation-engine` has `context/` or `library/` |
| Composer knowledge ↔ **gbrain** | **FULLY SEPARATE** | founder uploads live in a LibreChat pgvector silo; the studio never calls gbrain |
| **ActiveGraph** gate (approval events) | **DESIGN-ONLY** | "Approval" is a read-model over open PRs (`lib/attention.ts`); no `approval.proposed/granted` emission |
| **Department** + **RunReport** entities | **ABSENT** | zero references in `lib/ app/ components/ tools/` |

So the composer can *file* a ticket (a real PR opens on the venture repo), but **nothing picks it up
and works it**, the founder's deposited knowledge **never reaches a lane**, and there is **no gate
runtime and no progress surface**. FB-037 builds that engine and closes the second-brain seam.

**The loop we are implementing is the Bruntsfield Loop** (`jstack-bruntsfield-method.md` §3):
`FRAME → RESEARCH → PLAN(PRP) → TASKS → IMPLEMENT → VALIDATE+GATE → DONE`. FRAME is built (the
composer). This design builds RESEARCH…GATE and writes DONE back to the founder.

---

## 1. Principles (inherited, non-negotiable)

1. **Git is the source of truth.** Tickets, context, library, and RunReports are files in the venture
   repo. The studio and the composer are views + write-paths, never competing stores.
2. **One ticket = one branch = one PR.** Lanes work exactly one ticket at a time on its own branch.
3. **Gates are absolute.** Engineering changes gate on PR review; external actions (email/social/CRM/
   payments/deploys) gate on a recorded ActiveGraph `approval.proposed → approval.granted`. **A lane
   never sends/deploys unbidden**, and never self-merges an external-effect change.
4. **Venture isolation is physical + server-side (D1/#6).** A lane runs on its venture's own box, as a
   venture identity, and can never reach another venture's data.
5. **No `--no-verify`; `/review` + `/qa` before every PR** (non-negotiable 9).
6. **Nothing fails silently (#10).** Every lane run writes a RunReport the studio surfaces in plain
   language — a founder blocked at 22:00 sees *why*.
7. **Two founder touchpoints only:** FRAME (describe it) and GATE (approve it). Everything between is
   the engine, and the engine is **the unchanged gstack/gbrain** — we brand the surface, not the
   substrate (`jstack-bruntsfield-method.md` §2).
8. **No `execute_code` on the founder surface** (John, explicit). Execution lives in the lanes.

---

## 2. The unified second brain (closes the FB-034/036 silo)

**Problem:** the founder's knowledge (uploaded decks, stated preferences) sits in LibreChat's pgvector
+ Mongo, which the lanes cannot read. D8 + the method doc require it in **git `context/`/`library/`,
indexed by gbrain**, so the *same* brain serves the composer and the lanes.

**Design — the composer becomes a write-path onto git, mirroring the ticket flow:**

```
Founder deposits a deck / states a preference in the composer
        │  (the ergonomic front door — FB-034/036 stay as the UX)
        ▼
A bridge commits it to the venture repo:
   context/<department>/<slug>.md         ← durable background (brand kit, ICP, decks-as-text, prefs)
   library/<department>/<artifact>        ← agent + founder artifacts (heavy binaries → object store + pointer)
        │  (git = source of truth, D8)
        ▼
gbrain indexes the venture repo  ───────►  BOTH the composer (RESEARCH) AND every lane read one brain
```

**Decisions to ratify:**
- **D8 layout:** adopt `context/` (department-tagged durable background) + `library/` (artifacts) at
  the venture repo root, per D8. Seed them in each venture repo (a small PR).
- **Deposit path:** the composer's file uploads + extracted preferences are **written to
  `context/`/`library/` as a PR** (the same gated write-path the ticket-filer already uses), *not*
  only into LibreChat's pgvector. LibreChat RAG/memory stay as the **fast founder-facing cache**; git
  is the durable, shared, auditable copy. (This answers the method doc's open question to Cole: run
  the polished upload UX *and* keep git/gbrain as the shared brain — bridge, don't fork.)
- **gbrain as Company Memory:** gbrain (per-venture, department-partitioned) is the durable memory the
  lanes query in RESEARCH; the studio may later surface it read-only ("what does the venture know?").
- **Sensitive-content guard:** the bridge never commits secrets/tokens (reuse the memory-extraction
  guardrail); binaries go to object storage with a pointer file (D8), never into git.

---

## 3. The lane runtime on the venture box (the missing engine)

D1 says each venture VPS runs the workshop stack; ARCA's box runs only LibreChat. FB-037 provisions
the runtime:

- **Install the workshop stack on the venture box** (extend `provision-venture.sh` / a new lane-setup
  script): Claude Code (`claude`), gstack skills, gbrain (per-venture source), node, tmux. A **clone
  of the venture repo** with a deploy key.
- **Lane identity + auth:** the lane acts as a **venture GitHub identity** (a machine account or a
  fine-grained deploy token scoped to that one repo) — never John's account, never cross-venture. The
  Anthropic key is the venture's (or the shared Max with the FB-011 cost/ToS check — an open question,
  see §9).
- **Isolation:** one box per venture (D1) means the runtime physically cannot see another venture. The
  lane's token is single-repo scoped as defence-in-depth.
- **Cost/rate reality (parity-critique §8):** each running lane consumes model budget. The scheduler
  (below) has a **"useful work?" pre-check** so a wake doesn't burn a session on nothing, and a
  per-venture budget ceiling.

---

## 4. The trigger — how a filed ticket wakes a lane

Aligned to Phase 2 ("systemd timers waking lanes against their queues"):

- **Mechanism:** a **systemd timer** on the venture box wakes a supervisor on an interval (e.g. every
  few minutes). The supervisor lists `docs/tickets/` on the repo's default branch (via the local
  clone + `git fetch`) for tickets in a **workable state** (`Status: Todo`/`Ready`, not `Blocked`,
  not already owned).
- **"Useful work?" pre-check** (parity-critique §7, Cofounder routines): before spawning a lane, the
  supervisor confirms there is genuinely a ready ticket with no unmet dependency — else it goes back
  to sleep and writes a one-line "nothing to do" RunReport (cheap, no model session).
- **Claim (the sole atomic lock):** the supervisor's **first** action is to create the work branch —
  `POST /repos/.../git/refs` for `refs/heads/fb-XXX-slug`. GitHub returns **422 if it already exists**,
  which is a real compare-and-swap serialized by the git server: the branch's existence *is* the lock,
  no separate state, ~zero race window. (A `Status: In progress` commit is **not** usable as the lock —
  it would have to land on the branch-protected default branch, which the lane token cannot push. Do
  not use it.) The lane writes a **lease** (owner + heartbeat timestamp) into the engine-state channel
  (§6) alongside the claim.
- **Crash recovery (non-negotiable 10 — no permanently-stuck ticket):** a claimed branch with **no open
  PR and a stale lease** (heartbeat older than N intervals) is **reclaimed** on a later wake — else a
  reboot mid-ticket would orphan the branch and the pre-check would skip that ticket forever, silently.
  The reclaim decides resume-vs-restart for the half-done branch (idempotency: the loop re-plans from
  the ticket + any commits already on the branch). The realistic race here is **not** two boxes (D1 =
  one VPS, one supervisor) but a timer wake overlapping a still-running previous run — prevented for
  free by a `systemd` `Type=oneshot` unit that stays active while running (a new wake won't start).
- **Why a timer, not a webhook:** the box is behind Caddy with no inbound app port; a pull-based timer
  needs no public endpoint, matches D1, and is trivially reliable. (A future studio "run now" button
  can touch a sentinel the timer honours — the power path, not the required path.)

---

## 5. The execution loop (RESEARCH → PLAN → IMPLEMENT → VALIDATE+GATE)

Once a lane claims a ticket, it runs the Bruntsfield Loop on the box:

1. **RESEARCH** — gbrain over the venture repo (`context/`/`library/` + prior tickets/PRs) gathers the
   background the ticket needs. This is where §2's unified brain pays off: the founder's deposited
   context is *here*.
2. **PLAN (PRP)** — gstack `/plan` (and `/plan-ceo-review` for large/ambiguous asks) writes a Product
   Requirement Prompt: context + explicit validation gates + acceptance criteria. Derived from the
   ticket's scope.
3. **IMPLEMENT** — the lane does the work on `foundry/<slug>` (or `fb-xxx-<slug>`): one ticket = one
   branch = one PR. `/review` (incl. adversarial) + `/qa` run **before** the PR opens (non-negotiable
   9). No `--no-verify`.
4. **VALIDATE + GATE** — CI runs. Then the item enters the human gate:
   - **Engineering change →** PR review (merge-on-green + `/review`, CLAUDE.md #2). Merged by a human/
     the lane's own `/review` pass per the D7 matrix — never a bypass of the external gate.
   - **External-effect change (send/deploy/CRM/payment) →** a recorded **ActiveGraph
     `approval.proposed`** with the §5-of-research-gtm payload; nothing executes until
     `approval.granted`. Routed by the **D7 approval matrix** (founder / Bruntsfield / dual).
5. **DONE → RunReport** — the lane writes a RunReport (see §6) and the studio surfaces it. DONE feeds
   the next FRAME.

**The founder sees two things only:** the plain-language card at FRAME (composer) and the
plain-language approval card at GATE (studio attention queue, per `jstack-bruntsfield-method.md` §4).

---

## 6. RunReports — nothing fails silently, and the founder sees progress

- **What:** a `RunReport` bcap-contracts entity (FB-002 lane) — `{ ticket, lane, started, finished,
  status: working|blocked|opened_pr|failed, summary (plain language), pr_url?, error? }`.
- **The engine-state channel (resolves the branch-protection collision, F5):** claim/lease/RunReport
  are **engine state, not product code** — they must be low-latency and cannot route through the
  protected default branch's PR+CI gate. So they live on a **dedicated `foundry-state` ref/branch**
  (relaxed protection) that the lane's deploy token may **push directly** and the studio reads via the
  GitHub API — *not* `library/` on `main`. Git stays the store (no new DB); the state channel is just a
  ref the product build never merges from. (This is the one place we deliberately allow a direct push —
  it carries no product code, only engine telemetry + the claim lease.)
- **Surface:** the studio gains a RunReport read model (`lib/runreports.ts`) + a lane-activity strip:
  "what the engine is doing / did / why it's stuck", in plain language (#10). This also gives the
  Phase 2/§7-parity **routines management** surface its state to read.
- **Blocked/failed** reports are first-class: a founder blocked at 22:00 sees the reason and the
  proposed next step, not silence.

---

## 7. Department-generic — the same loop sells and scales (not just builds)

**This is the sell/scale half John flagged.** The loop above must be **department-agnostic** so it
carries GTM work, not only engineering — that is Cofounder parity, and where we can be *better*:

- **Departments = repos + gbrain partitions** (plan §4, D8 department-tagging). A venture has an
  engineering repo and a **`marketing` repo**; `context/`/`library/` are department-tagged.
- **4a Content/site (no external gate):** a marketing ticket ("add a waitlist page", "draft 3 case
  studies") runs the *identical* claim→plan→implement→PR loop, gated on **PR review + real CI on the
  venture's real domain**. Cofounder's marketing lands in a review Library; **ours ships through
  production discipline** (plan §4a — our early edge).
- **4b Interest-based sends (external gate):** a send ticket runs the loop but its VALIDATE+GATE step
  is an **ActiveGraph `approval.proposed`** carrying the research-gtm §5 record (recipient PECR
  classification, lawful basis, suppression check, frozen draft, sending identity). Nothing sends
  without `approval.granted`. This makes every send **defensible to a regulator** — compliance as a
  feature, which a bank counterparty (B2B motion) will diligence (research-gtm §6).
- **The composer already reaches here:** the founder can describe a marketing need; the composer files
  a `marketing` ticket; the lane works it; the gate routes to the founder. **One loop, all
  departments** — build, content, and (gated) sends.

Sell/scale parity therefore falls out of making the FB-037 loop generic + implementing the ActiveGraph
gate — not a separate machine. Phase 4's GTM tickets become "point the same loop at the marketing
repo".

---

## 8. Safety, isolation, and the gates — STRUCTURAL, not behavioural

The gate must hold even if a lane hallucinates or a prompt is adversarial. So it rests on **what the
lane physically cannot do**, never on "the lane won't":

- **The lane box holds NO send/deploy/payment credentials (non-negotiable).** Repo-write is the *only*
  power on the box. Postmark/Google-Workspace/Railway/Stripe creds **do not exist** on the venture lane
  box, so a runaway lane has nothing to send or deploy *with*. (This is stronger than the single-repo
  token — that stops repo reach; this stops external reach.)
- **A separate gated executor performs external actions.** The thing that actually sends/deploys after
  a human grant is a **distinct component** (on the studio/Railway side, or a dedicated executor),
  holding those creds, that runs *only* on a verified `approval.granted`. The lane proposes; the
  executor (never the lane) acts. **This executor is a named build ticket (part of FB-044) — it is the
  safety keystone and must be designed, not assumed.**
- **Grants are un-forgeable by the lane.** The lane token can write `approval.proposed`, but
  `approval.granted` lives on a path/ref the lane token **cannot push** (a protected `foundry-approvals`
  ref or the studio repo), written only by a human/studio identity. The executor **verifies the grant's
  committer is a human approver per the D7 matrix** — a git author/signature check, not "a file
  exists." File-in-repo alone is not the guarantee; author identity is.
- **Blast-radius is classified deterministically, not self-labelled.** Whether a change is sensitive is
  derived from **the diff's paths + the ticket's department** (any diff touching `auth/`, `payments/`,
  migration dirs, secrets, or any *send* ticket → sensitive), *regardless* of any label — so the
  composer or lane cannot mislabel a sensitive change into full-auto (F7). Sensitive → **stop-at-PLAN**
  for a founder go-ahead, then the normal GATE. (Touchpoint note reconciling §1.7: a sensitive ticket
  legitimately has *two* founder touches — the stop-at-PLAN go-ahead and the final GATE; low-risk
  tickets keep the two-touch FRAME+GATE promise. The "two touchpoints" ideal is the *floor*, raised
  deliberately for high-blast-radius work.)
- **Isolation (D1/#6):** lane on the venture box only; single-repo-scoped token; no cross-venture reach
  (physically enforced by one box per venture).
- **Merge policy (CLAUDE.md #2):** engineering PRs merge on green + `/review`; the D7 matrix decides who
  approves which change class as founders onboard; high-blast-radius = dual-approve.
- **Loud failure (#10):** any lane error → a `failed` RunReport with a plain-language reason; the
  supervisor never swallows an exception.
- **No `execute_code` on the founder chat surface;** the lane (not the composer) is where code runs.

---

## 9. Decisions (resolved in CEO + eng review, 2026-07-29)

Build approach + posture: **box-native lanes, phased** (CEO review) — install gstack/gbrain on the
venture VPS; systemd-timer supervisor runs the gstack RPIV loop. Reviewed in **selective-expansion**
posture; E1/E2/E3 below accepted into the roadmap.

1. **Trigger cadence + budget — RECOMMENDED default, ⚠ one business call flagged for John.** systemd
   wakes every ~5 min; the "useful work?" pre-check must find a ready, unblocked, unclaimed ticket or
   it no-ops (no model session). A per-venture **daily budget ceiling** caps spend. **FLAGGED (not
   design-blocking, decide at FB-039 provisioning):** shared Claude Max vs a per-venture Anthropic key,
   and the ToS/cost check (parity-critique §8) — John's business/ToS call; the design works either way.
2. **Lane identity — DECIDED:** a **fine-grained per-repo deploy token** (least privilege) for the
   lane's writes, not a broad machine account. Single-repo scope backstops the D1 isolation in code.
3. **ActiveGraph scope for v1 — DECIDED:** a **minimal git-backed `approval.proposed/granted` event
   record** now (files in the venture repo, read by the attention queue), so the gate is *real* for the
   spike; the full event-sourced ActiveGraph runtime lands with Phase 4b sends. (FB-044.)
4. **Second-brain bridge — DECIDED:** the composer commits to `context/`/`library/` only when the
   founder **marks a file "for the venture"** (not every ephemeral upload); git is the source of truth
   and gbrain the query layer, so the LibreChat pgvector is treated as a **fast cache that defers to
   git** on conflict (re-index from git wins). (FB-043.)
5. **Autonomy bound — DECIDED:** **full-auto for low-blast-radius/labelled tickets; stop-at-PLAN**
   (founder's go required) for anything touching **auth, payments, sends, migrations, or secrets** —
   mirroring the D7 dual-approve list. A lane can never fire `approval.granted`, send, or deploy (#4).
6. **Studio surfaces — DECIDED (expanded):** the RunReport strip **and** the in-studio approve card
   ship as part of this roadmap (E1 accepted), not deferred.

### Accepted expansions (selective-expansion cherry-picks, 2026-07-29)

- **E1 — In-studio approvals + preview (ACCEPTED).** The GATE step renders in the studio attention
  queue as a plain-language card + preview link + **Approve** button (merge via API / grant the event),
  routed by D7 — the founder never reviews on github.com. Closes the parity-critique's #1 approval gap.
  → **FB-046.**
- **E2 — Compliance-as-a-feature in the approval card (ACCEPTED).** For external-send approvals, the
  card surfaces the PECR recipient classification + lawful basis + suppression-check + frozen draft
  (research-gtm §5/§6) — every send visibly defensible to a regulator. A concrete edge over Cofounder
  for the B2B/bank motion. → folds into **FB-044** (the gate) + **FB-046** (the card).
- **E3 — Lanes propose routines (ACCEPTED).** A lane can propose a standing order (e.g. "weekly: work
  the flagged-interest queue") as a ticket the founder approves/pauses/runs-now from the studio,
  reading RunReport state — the Phase-2 scheduler as a founder-grade product, not an invisible cron.
  → **FB-047.**

---

## 10. Phased build (derived from this design — each its own ticket = branch = PR)

FB-037 itself ships **this design + a thin spike** (below). The engine is built by derived tickets:

- **FB-037 (this):** the design (this doc) + a **thin spike** on ARCA's box — install the lane runtime,
  seed `context/`/`library/`, and prove **one trivial ticket**: timer wakes → claims → runs a minimal
  loop → opens a PR → writes a RunReport the studio can read. Gated; nothing external sent.
- **FB-039 — venture lane runtime provisioning** (workshop stack + repo clone + lane identity on the box;
  **no send/deploy creds on the box**, §8; provisions the `marketing` repo + clone too, for FB-045).
- **FB-040 — the supervisor + systemd trigger + "useful work?" pre-check + the claim/lease/recovery
  quartet** (branch-create CAS lock, lease + stale-reclaim, circuit breaker, budget cap — the real work).
- **FB-041 — the execution loop wrapper** (RESEARCH→PLAN→IMPLEMENT→VALIDATE via gstack, one ticket=one PR;
  strict-parse gate + deterministic blast-radius classification + stop-at-PLAN routing).
- **FB-042 — RunReport contract + engine-state channel + studio read model + lane-activity strip.**
  **Depends on the `bcap-contracts` lane (FB-002) publishing the `RunReport` + `Department` types** —
  cross-repo dependency; FB-042 is blocked until they ship (§0 audit: those entities are absent today).
- **FB-043 — the second-brain bridge** (composer deposit → private `context/`/`library/` PR with a
  secret/PII scan → gbrain index; the pgvector↔git sync per §10b).
- **FB-044 — minimal ActiveGraph gate + the gated executor** (git-backed `approval.proposed/granted`
  events on a lane-unwritable ref + D7 routing; **the separate executor that holds send/deploy creds and
  acts only on a human-authored grant** — the §8 safety keystone; carries the E2 compliance record —
  PECR classification, lawful basis, suppression check, frozen draft).
- **FB-045 — department-generic pass** (point the loop at a `marketing` repo; 4a content ticket runs it).
- **FB-046 — in-studio approvals + preview (E1/E2 surface):** the attention queue renders each GATE item
  as a founder-grade approve card (plain-language summary + preview link + Approve → merge/grant via
  API), routed by D7; for sends it shows the E2 compliance record. Closes the #1 approval parity gap.
- **FB-047 — agent-proposed routines (E3):** a lane can propose a standing order as a ticket; the
  founder approves/pauses/runs-now from the studio, reading RunReport state.

Ordering: FB-039 → FB-040 → FB-041 → FB-042 (engine) ∥ FB-043 (brain) → FB-044 (gate) → FB-045 (GTM)
→ FB-046 (approve UI) ∥ FB-047 (routines). Phase 4b sends build on FB-044's gate. Each derived ticket
carries its own scope + acceptance criteria.

## 10a. Failure modes + observability (nothing fails silently, #10)

Every failure below has a **named trigger, a containment, and a visible signal** (a RunReport the
studio surfaces — never a silent swallow).

| # | Failure | Trigger | Containment | Visible signal |
|---|---|---|---|---|
| F1 | **Double-work race** | two timer wakes claim one ticket | **atomic claim = create the branch `foundry/<slug>` first**; GitHub `refs` POST returns `422` if it exists → that wake yields (the branch *is* the lock; no separate state) | second wake writes a "already owned" debug line, no RunReport spam |
| F2 | **Runaway / budget burn** | a lane loops or a ticket is unworkable | per-venture **daily budget ceiling** + the "useful work?" pre-check + **max N attempts per ticket** (then `blocked` RunReport, stop retrying) | `blocked` RunReport with the reason; budget-ceiling hit → an "engine paused, budget" report |
| F3 | **Gate bypass** (the cardinal risk) | a lane tries to send/deploy/grant | **structural, not behavioural:** the lane's token has **repo-write only — no email/deploy/payment/secret creds exist on the box for it to use.** `approval.granted` is a studio human action; the lane can only *write* an `approval.proposed` file | any external-effect ticket stops at `approval.proposed`; the studio shows it awaiting a human |
| F4 | **Bad/oversized PR** | lane produces low-quality work | `/review` + `/qa` run **before** the PR opens; the human merge gate (merge-on-green + `/review`) is the backstop; **no self-merge of external-effect changes** | the RunReport + the PR itself; CI red blocks merge |
| F5 | **Cross-venture reach** | a lane touches another venture | **physical (one box per venture, D1)** + single-repo-scoped token — the box holds only this venture's repo + token, so it is structurally impossible, not policed | n/a (cannot occur) |
| F6 | **Silent engine death** | supervisor crash / box reboot | `systemd` `Restart=on-failure`; an **idle heartbeat RunReport** every wake ("alive, nothing to do") | the studio flags "engine offline" via staleness (reuse FB-008 lane-health) when heartbeats stop |
| F7 | **RunReport write fails** | `git push` of the report fails | retry with backoff; if still failing, the supervisor logs loudly + a local sentinel the next wake surfaces | "couldn't report progress" state; never a silent gap |
| F8 | **Second-brain leak/stale** | bridge commits a founder file | **secret/token guard** rejects sensitive content pre-commit; binaries → object store + pointer (never git); **git wins on conflict** — pgvector re-indexes from git, so the cache can never diverge durably | rejected deposits tell the founder why (plain language) |

**Observability is scope, not afterthought:** the RunReport contract (FB-042) + the idle heartbeat +
the studio lane-activity strip together mean a founder (or John) can always answer "what is the engine
doing, and is it stuck?" in plain language. The gate's `approval.proposed` files are the audit trail.

## 10b. Additional mechanisms (surfaced by eng review, 2026-07-29)

- **Machine-readable ticket fields are a precondition for lane-workability (F6).** The pre-check and the
  autonomy router cannot run on prose. A ticket is only *lane-workable* if it carries enforced fields:
  `Status` (enum: Todo/Ready/In progress/Blocked/Done), `depends_on` (IDs), `department`, and a derived
  `blast_radius`. These are enforced by the **FB-028 plain-language template + a strict-parse gate**
  (stricter than FB-004's tolerance-first reader, which is right for *rendering* but not for *dispatch*).
  A ticket that does not strict-parse is **surfaced as blocked, never silently skipped.**
- **Circuit breaker + budget is a design dependency, not just a business call (F8).** The loop caps
  attempts: after **N failed attempts** a ticket is parked `Blocked` with a RunReport + exponential
  backoff + a persistent claim so it does not re-wake every interval. Separately: a **per-venture daily
  budget ceiling requires the per-venture Anthropic API key** — the shared-Max path has *no* programmatic
  per-venture spend cap, so §9.1's "business call" also gates the containment story. If Max is chosen,
  the degradation must be a local wake-count / token-estimate cap (weaker), stated explicitly.
- **Deposit safety: private repos + a real secret/PII scan (F9).** Venture repos are **private**
  (reconcile with the org's public-repo stance — founder material must never land in a public repo).
  The second-brain bridge runs a **secret/PII scan on the deposit PR** (not the memory-extraction text
  guard, which only sees extracted preferences) — a dragged-in deck or `.env` must be caught before it
  enters git history. Binaries never enter git → object store (name it at build time, e.g. the venture's
  Supabase storage / S3 bucket) + a pointer file.
- **The pgvector↔git sync is a real mechanism, not an assertion (F10).** "Git wins on conflict" needs a
  trigger: a **post-merge hook on `context/`/`library/` re-embeds the changed paths** into gbrain (and
  LibreChat's store), keyed by **stable slug + content hash** for dedup/versioning. Simplest durable
  option to evaluate at FB-043: make LibreChat's founder-facing store **read gbrain** rather than keep a
  second silo at all, so there is one brain by construction.
- **Alternative explicitly weighed (F13):** a **central scheduler on the long-running studio (D6)
  dispatching to boxes over outbound SSH** (D1 already grants SSH) would centralise the claim store,
  budget ledger, and liveness view — the exact quartet (claim/lease/budget/liveness) that is the real
  work here. We keep **box-native systemd** (chosen in review — D1 fit, no inbound port, engine stays on
  the venture's own substrate), but acknowledge the claim/lease/recovery/budget mechanisms are the hard
  part *either way*, and FB-040 must build them carefully rather than assume the timer makes them free.

## 11. Acceptance criteria (for FB-037 the ticket)

- [ ] This design has passed `/plan-ceo-review` + `/plan-eng-review`, decisions recorded.
- [ ] A spike on ARCA's box shows: a ticket wakes a lane, is claimed, a minimal loop runs, a PR opens,
      and a **RunReport is written back that the studio can surface** — one trivial case, gated,
      nothing external sent.
- [ ] `context/` + `library/` seeded in the ARCA repo; the spike lane reads from gbrain over them.
- [ ] The derived build tickets (FB-039…045) are drafted from the approved design.

## Verification
`/plan-ceo-review` + `/plan-eng-review` on this doc; `/review` + CI on the spike. External gate intact
throughout — the spike opens a PR / writes a report; it never merges or sends.

---

## GSTACK REVIEW REPORT

| Run | Lens | Status | Key output |
|---|---|---|---|
| Ground-truth audit | infra investigation (subagent) | done | engine is design-only (no lane runtime, ActiveGraph design-only, no context/library, LibreChat↔gbrain siloed) — grounds the whole doc |
| CEO review | strategy / scope (interactive) | done | approach = **box-native lanes, phased**; posture = **selective expansion**; **E1/E2/E3 accepted**; §9 decisions recorded |
| Eng review | architecture / adversarial (subagent) | done → **fixed** | 5/10 as-written; 3× P0 + 8× P1 — **all folded into the design** (§4, §6, §8, §10a/b, §10) |

**Eng findings and disposition (all addressed):**
- **P0 F1 — claim primitive** (infeasible status-commit option): FIXED §4 — branch-create CAS is the *sole* lock.
- **P0 F3 — lane could forge its own grant**: FIXED §8 — grants on a lane-unwritable ref + executor verifies human committer.
- **P0 F4 — send/deploy creds on the box**: FIXED §8 — **no send/deploy creds on the box**; a separate gated executor (FB-044) acts on grants.
- **P1 F2 — no lease/recovery**: FIXED §4 — lease + stale-reclaim + systemd `Type=oneshot`.
- **P1 F5 — branch-protection collides with git-state**: FIXED §6 — dedicated direct-push `foundry-state` ref.
- **P1 F6 — Status/deps/dept/blast-radius not machine-readable**: FIXED §10b — strict-parse gate as a lane-workable precondition.
- **P1 F7 — self-labelled blast-radius**: FIXED §8 — deterministic path-derived classification.
- **P1 F8 — no circuit breaker; budget uncapped on Max**: FIXED §10b — max-N-attempts + budget-is-a-design-dependency on the per-venture key.
- **P1 F9 — unguarded secret/PII on deposits**: FIXED §10b — private repos + real secret/PII scan on the deposit PR.
- **P1 F10 — pgvector↔git sync asserted not designed**: FIXED §10b — post-merge re-embed keyed by slug+hash (or read-gbrain-directly).
- **P2 F11/F12/F13 — liveness, ordering deps, weighed alternative**: FIXED §10a/§10 (bcap-contracts + marketing-repo deps) / §10b (SSH-scheduler weighed).

**VERDICT: DIRECTION APPROVED, design revised to build-ready.** The CEO-approved direction + §9
decisions stand; the eng review's mechanism gaps (claim/lease/recovery, structural gate + named
executor, engine-state channel) are now specified in the doc. FB-039 (provisioning) and FB-043 (brain
bridge) can start; FB-040/042/044 are now buildable with the folded fixes — subject to (a) the
bcap-contracts `RunReport`/`Department` types shipping for FB-042, and (b) the one unresolved business
call below, which gates the containment story (not the design).

**UNRESOLVED DECISIONS:**
- **Shared Claude Max vs a per-venture Anthropic key** (decide at FB-039 provisioning): the design works
  either way, but the per-venture **daily budget ceiling / circuit-breaker containment** (§10b, F8) is
  only programmatically enforceable on a per-venture key — on shared Max it degrades to a weaker local
  wake-count cap. This is John's business/ToS call (parity-critique §8), not an engineering default.
