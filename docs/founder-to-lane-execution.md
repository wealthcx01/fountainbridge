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
- **Claim:** the supervisor marks the ticket owned (a lightweight lock — a branch `foundry/<slug>`
  existing, or a `Status: In progress` commit) so two wakes never double-work a ticket.
- **Why a timer, not a webhook:** the box is behind Caddy with no inbound app port; a pull-based timer
  needs no public endpoint, matches D1, and is trivially reliable. (A future studio "run now" button
  can touch a sentinel file the timer honours — the power path, not the required path.)

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
  status: working|blocked|opened_pr|failed, summary (plain language), pr_url?, error? }` — written by
  the lane **back into the venture repo** (e.g. `library/runreports/<ticket>-<ts>.json`, git = source
  of truth) so the studio renders it with the existing GitHub-read path (no new DB).
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

## 8. Safety, isolation, and the gates (explicit)

- **Isolation (D1/#6):** lane on the venture box only; single-repo-scoped token; no cross-venture reach
  (physically enforced).
- **External gate never bypassed (#4):** the lane can open a PR and *propose* an approval; it can never
  fire `approval.granted`, send, or deploy. Grant is a human act.
- **Merge policy (CLAUDE.md #2):** engineering PRs merge on green + `/review`; the D7 matrix decides who
  approves which change class as founders onboard. High-blast-radius (migrations/auth/payments/secrets/
  external sends) = dual-approve.
- **Loud failure (#10):** any lane error → a `failed` RunReport with a plain-language reason; the
  supervisor never swallows an exception.
- **No `execute_code` on the founder chat surface;** the lane (not the composer) is where code runs.

---

## 9. Open questions (for CEO + eng review)

1. **Trigger cadence + budget:** systemd interval, the "useful work?" pre-check strictness, and the
   per-venture model budget ceiling. Shared Claude Max vs per-venture key + the ToS/cost check
   (parity-critique §8, FB-011) — decide before lanes run continuously.
2. **Lane identity:** a per-venture machine GitHub account vs a fine-grained per-repo deploy token for
   the lane's writes (least privilege vs operational simplicity).
3. **ActiveGraph scope for v1:** implement the full event-sourced gate now, or a minimal
   `approval.proposed/granted` record (git-backed, like RunReports) that the attention queue reads —
   with the full ActiveGraph runtime deferred to Phase 4b? (Recommendation: minimal git-backed events
   now so the gate is *real* for the spike; full runtime when sends land.)
4. **Second-brain bridge depth:** does the composer commit *every* upload to `context/`, or only when
   the founder marks it "for the venture"? How do we de-dupe LibreChat pgvector vs gbrain so the
   founder isn't answered from stale cache?
5. **Autonomy bound:** how much does a lane do per wake — one ticket end-to-end, or stop at PLAN for a
   founder's go on anything non-trivial? (Recommendation: full auto for low-blast-radius/labelled
   tickets; stop-at-plan for anything touching auth/payments/sends/migrations.)
6. **Studio surfaces:** RunReport strip + in-studio approve button (Phase 3 items #2/#3) — build with
   FB-037 or as fast-follow tickets?

---

## 10. Phased build (derived from this design — each its own ticket = branch = PR)

FB-037 itself ships **this design + a thin spike** (below). The engine is built by derived tickets:

- **FB-037 (this):** the design (this doc) + a **thin spike** on ARCA's box — install the lane runtime,
  seed `context/`/`library/`, and prove **one trivial ticket**: timer wakes → claims → runs a minimal
  loop → opens a PR → writes a RunReport the studio can read. Gated; nothing external sent.
- **FB-039 — venture lane runtime provisioning** (workshop stack + repo clone + lane identity on the box).
- **FB-040 — the supervisor + systemd trigger + "useful work?" pre-check + claim/lock.**
- **FB-041 — the execution loop wrapper** (RESEARCH→PLAN→IMPLEMENT→VALIDATE via gstack, one ticket=one PR).
- **FB-042 — RunReport contract (FB-002 lane) + studio read model + lane-activity strip.**
- **FB-043 — the second-brain bridge** (composer deposit → `context/`/`library/` PR → gbrain index).
- **FB-044 — minimal ActiveGraph gate** (git-backed `approval.proposed/granted` events + D7 routing in
  the attention queue).
- **FB-045 — department-generic pass** (point the loop at a `marketing` repo; 4a content ticket runs it).

Ordering: FB-039 → FB-040 → FB-041 → FB-042 (engine) ∥ FB-043 (brain) → FB-044 (gate) → FB-045 (GTM).
Phase 4b sends build on FB-044's gate. Each derived ticket carries its own scope + acceptance criteria.

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
