# jstack — the Bruntsfield Method

**Working name:** jstack / jbrain (the founder-facing layer) over gstack / gbrain (the engine)
**Status:** Design doc for review · **Date:** 2026-07-27
**Reviewers:** Gary Tan, Cole Medin
**Companion docs:** `CLAUDE.md` (non-negotiables), `docs/fountainbridge-phased-plan.md` (D1–D8), `docs/research-gtm.md` (ActiveGraph, GTM)

> **A note on attribution, up front and honest.** This document fuses three lineages. Two of them — Cole Medin's Archon / PRP / RPIV work and Bruntsfield's own ActiveGraph gate — are drawn directly from primary material (Cole's workshops and our shipped code). The third — **Gary Tan's strategy-and-planning lens** — is represented from Gary's *public YC philosophy* (office hours, the 10-star product, CEO-mode planning), which we have already encoded into our **gstack** tooling (`/office-hours`, `/plan-ceo-review`). Gary does **not** appear in any of the source workshop recordings; those are entirely Cole Medin / Dynamous material. We are naming Gary as the author of the strategic lens we borrowed and baked into gstack, not attributing any workshop content to him. We wanted that clear on the first page so the framing is fair to review.

---

## 1. Purpose & principles

Bruntsfield Capital co-creates and runs ventures with AI agents. We already have a strong engine — the workshop stack (Claude Code, tmux lanes, **gstack** skills, **gbrain** memory), git as the source of truth, and an event-sourced approval gate (**ActiveGraph**). What we lack is a single, named, teachable *method*: one loop that a non-technical founder and a fleet of agents move through together, from idea to shipped-and-approved change.

The Bruntsfield Method is that loop. It is a deliberate fusion of three well-formed bodies of work:

- **Gary Tan (YC) — the strategy & planning lens.** Before anyone builds, someone has to ask whether we're building the right thing, and whether we're thinking big enough. Gary's YC contribution — office-hours forcing questions ("who is desperate for this?"), the *10-star product* thought experiment, and CEO-mode "think bigger" planning — is the front of our loop. It already lives in gstack as `/office-hours` and `/plan-ceo-review`. This is the *why* and *how ambitious* layer.

- **Cole Medin — the knowledge & task backbone.** Cole's **Archon** is a "knowledge and task management backbone for AI coding assistants" — an MCP server giving agents (a) a RAG knowledge base (crawl docs, upload business documents, code-example extraction, re-ranking / hybrid / contextual retrieval, stored in Supabase + pgvector) and (b) project/task management (a Kanban board, backlog → doing → review → done, real-time sync, priority ordering). Cole pairs this with the **PRP framework** (Product Requirement Prompt — the concept attributed to community member **Rasmus**): give the agent rich *context* (examples + documentation) plus *validation loops* before it builds. And Cole's **RPIV loop** — Research → Plan → Implement → Validate, GitHub-native (issues, branches, PRs) — is the execution spine. This is the *what context* and *what work, in what order* layer.

- **Bruntsfield — the ActiveGraph gate.** Every consequential/external action requires a recorded `approval.proposed` → `approval.granted` event before it executes. This is the durable, auditable form of the human checkpoint that Cole's community calls the "**Ralph loop**" `awaiting-human` gate (the Autonomous Co-Founder workshop's Slack approval step). Same shape; ours is event-sourced and per-venture. This is the *nothing-happens-without-a-human* layer.

**Principle:** these three are complementary, not competing. Gary decides *whether and how big*; Cole's stack decides *with what knowledge and in what task order*; ActiveGraph decides *whether it's allowed to happen*. The method is the choreography that runs all three without a technical founder ever seeing a terminal.

---

## 2. The engine vs. the brand — do **not** fork gstack/gbrain

**Recommendation: brand a thin founder-facing *layer*, do not fork the engine.**

gstack and gbrain are living tools — upgraded continuously (`/gstack-upgrade`, gbrain autopilot), shared across grassmarket, fountainbridge, and the wider portfolio. A hard fork ("jstack" as a divergent copy) would:

- **Double the maintenance surface.** Every gstack skill fix, every gbrain schema-pack update would have to be re-applied to the fork. Within a quarter the fork drifts, and we own two of everything.
- **Break the shared-substrate advantage.** The whole point of `bcap-contracts` and one workshop stack is that a venture is "just another manifest." A fork re-introduces per-venture divergence — exactly what venture-as-config exists to prevent.

Instead, **"jstack / jbrain / the Bruntsfield Method" is a naming and presentation layer** — a founder-facing vocabulary and a set of studio surfaces — over the *unchanged* gstack/gbrain engine:

- The founder sees "the Method," plain-language tickets, and an approve button. They never see `/plan-ceo-review` or `gbrain search`.
- Under the hood it is literally gstack skills and gbrain queries, upgraded on the normal cadence.
- "jstack" is thus a *brand and a workflow*, not a codebase. The engine stays singular; the founder experience is what carries our name.

This mirrors D6 exactly: *"Stack mirrors Cofounder's; branding is ours."* We brand the surface, not the substrate.

---

## 3. The loop, end to end

One named loop. Working name: **the Bruntsfield Loop** (RPIV, wrapped in strategy at the front and the gate at the back). A founder and the agents move through it together.

```
  ┌─ 0. FRAME ──────────────────────────────────────────────┐
  │  Founder describes the goal in plain language.          │
  │  gstack /office-hours + /plan-ceo-review interrogate it: │
  │  who's desperate for this? what's the 10-star version?   │  ← Gary Tan lens
  │  Output: a sharpened intent, right-sized.                │
  └──────────────────────────────┬──────────────────────────┘
                                 │
  ┌─ 1. RESEARCH ────────────────▼──────────────────────────┐
  │  Agent gathers context: gbrain (durable memory) +       │
  │  D8 context/library (brand kit, ICP, decks). Archon's    │  ← Cole: RAG / Archon
  │  RAG role is played by gbrain over the venture repo.     │
  └──────────────────────────────┬──────────────────────────┘
                                 │
  ┌─ 2. PLAN (PRP) ──────────────▼──────────────────────────┐
  │  gstack /plan writes a Product Requirement Prompt:       │
  │  context (examples + docs) + explicit validation gates.  │  ← Cole/Rasmus: PRP
  │  From the PRP, tasks are derived — each with acceptance   │
  │  criteria ("happy path, edge cases, errors, coverage").  │
  └──────────────────────────────┬──────────────────────────┘
                                 │
  ┌─ 3. TASKS ON THE BOARD ──────▼──────────────────────────┐
  │  Tasks land as tickets in docs/tickets/, surfaced as      │  ← Cole: Archon board
  │  studio lanes: backlog → doing → review → done.           │    ↔ studio lanes
  │  Clearing the agent's chat is safe: the board + PRP are   │
  │  all the context needed to resume.                        │
  └──────────────────────────────┬──────────────────────────┘
                                 │
  ┌─ 4. IMPLEMENT ───────────────▼──────────────────────────┐
  │  Agent works ONE ticket = ONE branch = ONE PR.           │  ← RPIV Implement
  │  gstack /review + /qa run before the PR opens.           │    + Bruntsfield rule
  └──────────────────────────────┬──────────────────────────┘
                                 │
  ┌─ 5. VALIDATE + GATE ─────────▼──────────────────────────┐
  │  Validation loops run (the PRP's gates). Then the item   │  ← RPIV Validate +
  │  enters the REVIEW column = the human gate. Engineering   │    Ralph gate =
  │  → PR review; external/high-risk → ActiveGraph            │    ActiveGraph + D7
  │  approval.proposed → approval.granted, routed by the D7   │
  │  approval matrix (founder / Bruntsfield / dual-approve).  │
  └──────────────────────────────┬──────────────────────────┘
                                 │
                        approved → DONE, merged by a human
                        (never self-merge — CLAUDE.md non-negotiable 2)
```

The loop is continuous: DONE feeds the next FRAME. The founder's touch-points are exactly two — **step 0 (describe it)** and **step 5 (approve it)**. Everything between is the engine.

---

## 4. The non-technical-founder layer (the key requirement)

**This is the load-bearing requirement of the whole method.** Every ticket the process emits must be **plain-language** and **approvable in under a minute by someone with no technical background**. If a founder needs to understand a diff to approve it, the method has failed.

Under the hood the ticket is a conventions-compliant `FB-XXX-slug.md` git ticket (one ticket = one branch = one PR). *On top* of it the studio renders a plain-language card. The two are the same object, presented at two altitudes.

### Plain-language ticket template (what the founder sees)

```
┌─────────────────────────────────────────────────────────────┐
│  ✦  Add a waitlist form to the landing page                 │
│                                                             │
│  WHAT THIS DOES FOR YOU                                      │
│  Visitors who aren't ready to buy can leave their email.    │
│  You get a list of interested people to follow up with —    │
│  the lawful, opt-in way we do outreach.                     │
│                                                             │
│  THE ONE THING TO APPROVE                                   │
│  Publish this form on thereset.com. It collects an email    │
│  and a first name. Nothing is sent to anyone yet.           │
│                                                             │
│  IF YOU SAY YES →  It goes live in ~2 minutes. You'll get   │
│                    a link to see it running.                 │
│  IF YOU SAY NO  →  Nothing changes. The work waits in your  │
│                    backlog; you can ask for edits.           │
│                                                             │
│  Who approves this: You (product-visible change · D7)        │
│  [ Approve ]   [ Not yet ]   [ See the detail ]             │
└─────────────────────────────────────────────────────────────┘
```

### How it maps onto the git ticket underneath

| Founder-facing field | Git ticket / system reality |
|---|---|
| Title (`✦ Add a waitlist form…`) | `FB-XXX` ticket title + branch `fb-XXX-waitlist-form` |
| "What this does for you" | Ticket **intent / rationale** section (business value) |
| "The one thing to approve" | The PR's actual change surface + blast-radius classification |
| "If you say yes" | Merge via GitHub API (engineering) or `approval.granted` event (external) |
| "If you say no" | Ticket stays in `backlog`/`review`; no merge, no ActiveGraph event fires |
| "Who approves this" | D7 approval matrix routing (founder / Bruntsfield / dual) |
| "See the detail" | Drops to the raw PR / ticket markdown — the *power path*, never required |

**Discipline:** the plain-language card is generated *from* the PRP and the ticket, not hand-written separately, so it can never drift from what actually ships. The "one thing to approve" must be genuinely one thing — if a change has two independent decisions in it, it is two tickets. This keeps the under-a-minute promise honest and keeps blast radius legible.

---

## 5. How it maps to what exists

The method is almost entirely a *renaming and choreography* of capabilities we already have. Nothing here asks us to build a second Archon or a second gbrain.

| Cole Medin / Archon concept | Bruntsfield equivalent (already built or planned) |
|---|---|
| Archon **Kanban board** (backlog → doing → review → done) | The studio's **lanes + attention queue** over `docs/tickets/` (FB-006, FB-007). Git is the board's store, not a separate DB. |
| Archon **RAG knowledge base** (crawl + upload, pgvector) | **gbrain** (per-venture, per-department partitions) + **D8 `context/` and `library/`** in the venture repo (brand kit, ICP, decks). Git is the source; gbrain indexes it. |
| **PRP** (Product Requirement Prompt: context + validation gates) | gstack **`/plan`** family (`/plan-ceo-review`, `/plan-eng-review`) — produces the plan with validation loops; tasks derive from it. |
| PRP task acceptance criteria ("happy path, edge cases, coverage") | Ticket scope + gstack **`/review`** and **`/qa`** gates run before every PR (CLAUDE.md non-negotiable 9). |
| Archon **"clear the chat, resume from the board"** | Same property here: the ticket files + the PRP are the durable context; a fresh agent session picks up from `docs/tickets/` state. |
| Archon **review column** = the human gate | **ActiveGraph** event-sourced approvals + the **D7 approval matrix**. External/high-risk actions gate on `approval.proposed` → `approval.granted`. |
| The **Ralph loop** `awaiting-human` Slack checkpoint | The same checkpoint, made **durable and auditable** — every gate crossing is a recorded event (the record PECR/GDPR accountability wants; D3). |
| Cole's **RPIV** (Research → Plan → Implement → Validate, GitHub-native) | Our loop *is* RPIV, GitHub-native by construction (git is the source of truth; one ticket = one branch = one PR). |
| Archon stack (React/Vite + shadcn + FastAPI + Supabase, MCP) | Our stack (Next.js + Railway + Supabase + GitHub API; gstack skills as the "MCP-equivalent" agent tools). Same managed shape (D6). |

The one honest gap: Archon ships a polished RAG-upload UI today; our RAG is gbrain + repo conventions, which is more auditable (git-backed) but less turnkey for a founder uploading a PDF. That is a studio-surface task, not an engine task (see open questions).

---

## 6. Adoption recommendation & open questions

### Pilot

Run the method end-to-end on a **low-stakes dogfood venture first — ARCA** (already the studio's fixture manifest, D5) — before pointing it at THE RESET's live surface. Concretely:

1. **Phase 3 alignment.** The method's founder layer *is* the Phase 3 "founder experience" scope (conversational composer, in-studio approvals, nothing-fails-silently). Adopt the plain-language ticket template (§4) as the concrete spec for the composer's output and the attention-queue card.
2. **One real loop on ARCA.** Take a single ARCA change through FRAME → … → GATE, producing a plain-language card a non-technical observer approves in under a minute. Measure: did they understand the "one thing to approve" without help?
3. **Then Reset.** Once the card format survives ARCA, run it on a real Reset marketing ticket (Phase 4a content is PR-gated and low-blast-radius — the safest live surface).
4. **Keep the engine singular.** Ship the layer as studio surfaces + naming, with zero forks of gstack/gbrain. Track it as normal FB tickets.

### Open questions to confirm with Gary and Cole

**For Cole:**
- Is our substitution — **gbrain + D8 repo conventions in place of Archon's RAG service** — a faithful realisation of the knowledge-backbone idea, or do we lose something material (e.g. the crawl-docs and PDF-upload founder ergonomics) by not running Archon itself? Would you recommend running Archon *alongside* gbrain for the founder-facing knowledge-upload UX specifically?
- Does our "review column = ActiveGraph event" mapping preserve the intent of the PRP validation loops, or are we collapsing two distinct gates (automated validation vs. human review) that you'd keep separate?
- PRP → task derivation: are we right that the PRP's task descriptions are "the closest thing to acceptance criteria," or do you gate on something stricter?

**For Gary:**
- We've placed your lens (office-hours forcing questions, the 10-star product, CEO-mode planning) at the **front** of the loop, encoded in gstack `/office-hours` and `/plan-ceo-review`. Is "strategy gates the loop's entry" the right altitude for it — or should the 10-star / think-bigger check also re-fire *mid-loop* when scope expansion becomes possible?
- The founder layer optimises for "approvable in under a minute." Does that under-a-minute compression risk hiding the strategic stakes of a decision from the founder — and if so, how would you want a genuinely strategic choice flagged differently from a routine one?

**For both / internal:**
- Naming: is **"jstack / the Bruntsfield Method"** the right founder-facing brand, given it is explicitly *not* a fork of gstack? We want the name to read as "a way of working," not "a different tool."
- Where exactly does the ActiveGraph gate design (FB-012 follow-on) need to land before the method's external-action legs (Phase 4b sends) can run through it?
