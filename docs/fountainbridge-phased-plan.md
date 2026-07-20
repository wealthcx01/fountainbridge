# Fountainbridge — Phased Plan (v4)

**Project:** fountainbridge — the **Foundry Studio**: Bruntsfield Capital's founder-facing company-running platform for co-created ventures.
**Date:** 2026-07-20 · **Status:** v4 — v3 updated per John's ratification: THE RESET launches **in the studio** from v0; founder identity clarified as a **Bruntsfield-assigned venture-domain Google Workspace account**; outreach is **interest-based only** · **Companion docs:** `cofounder-reference-index.md`, `parity-critique.md`, `docs/research-gtm.md`, Tier 3 venture pack (`..\Tier3`)

**Founder identity, defined once:** wherever these docs say the founder's "Gmail," it means a **Google account on the venture's Workspace domain, assigned by Bruntsfield Capital and managed/run by the founder themselves** (e.g. `ross@thereset.com`) — never a personal consumer @gmail.com. One identity serves as: studio login (Google OAuth, D4), the founder's human mailbox, and the org-internal identity that makes Google's internal-app OAuth exemption apply cleanly (see `docs/research-gtm.md` §1). This resolves the v3 tension between "founders on their own Gmail" and the research findings — the founder's *own* account simply lives on venture infrastructure.

**Parity target (John):** Foundry Studio at least at par with cofounder.co, preferably better. The critique's verdict: substrate ahead, founder experience behind — v3's changes close the founder-experience gaps: a conversational composer and in-studio approvals as first-class Phase 3 scope, GTM split so content ships early, a context/library substrate, and a governance matrix (D7).

---

## 1. Where fountainbridge sits (the Holy Corner map)

**Holy Corner** is the core hub for Bruntsfield Capital and its four verticals. The main website is the landing page; each vertical gets its own login site behind Google OAuth:

| Vertical | Studio | Codename | Status |
|---|---|---|---|
| Advisory | Advisory Studio | **grassmarket** | In build (Loop 4–6) |
| Foundry | Foundry Studio | **fountainbridge** | This plan |
| Briefing | Briefing Studio | TBD (likely Beehiiv-backed) | Undefined |
| Equity | Equity Studio | TBD (Tier 3 / operating-system docs exist) | Undefined |

Fountainbridge is therefore **not** a Bruntsfield-wide operations dashboard (Holy Corner itself covers hub duties, and that project is already underway). Fountainbridge is the vertical studio through which Foundry ventures are launched and run — the Cofounder-equivalent surface, for our founders.

**Who it serves:** primarily B2C ventures we co-create — first signed venture is **THE RESET** (John + Ross; cross-border life design; concierge-first GTM, platform v0.1 as read-only client dashboard per its own deck). The venture pipeline is the Tier 3 pack (AFTERCARE, ANCHOR, BEACON, BESTOW, BRIDGE, CANON, CORNERSTONE, HARVEST, JOURNEYMAN, KNOT, SCALPEL, SEVERANCE, TENURE, THE RESET, TOOLBOX, YIELD). The studio must stay **generic enough** that a B2B motion (banks / wealth-product builds) can run through the same machinery later — venture-as-config, nothing Reset-specific in the core.

## 2. Operating decisions (v2 — incorporating review)

**D1 — One VPS per venture, from day one.** Each venture gets its own Hetzner VPS running the workshop stack (Claude Code, tmux lanes, gstack, gbrain). **Both the human founder and John get SSH access.** Isolation is physical; venture secrets never share a box. Provisioning is a runbook that becomes a script (FB-011).

**D2 — Git stays under Bruntsfield's existing GitHub.** Venture repos live in the existing org. **The human founder creates their own GitHub account** and is added as a collaborator; they can build to the repo directly. The repo is the source of truth — tickets as markdown in `docs/tickets/`, one ticket = one branch = one PR, dashboard reads/writes via the GitHub API. No new database of record for work.

**D3 — Gates: PRs for engineering; ActiveGraph for external actions; venture domains for sending (DECIDED — see `docs/research-gtm.md`).** Engineering keeps the proven gate (PR review, never-self-merge). External actions (email, social, CRM, payments) gate on **ActiveGraph** — its event-sourced `approval.proposed`/`approval.granted` log is exactly the audit record PECR/GDPR accountability wants. FB-012's verified findings overturned one v2 assumption: **agents never send from the founder's personal Gmail** (restricted-scope/CASA burden, weekly token death on unverified apps, ~500–2,000/day caps, founder's identity as blast radius). Sending runs on **venture-owned Google Workspace domains** (internal-app OAuth exemption; SPF/DKIM/DMARC from day one; outreach on a subdomain). The founder's Gmail remains their *login identity* for the studio (D4) and their human mailbox — nothing more. **Ratified stance (John): outreach is interest-based only — cold outreach is de-scoped entirely.** Agents email only people who have flagged interest (ad response, waitlist, signup, enquiry, event registration), which puts every send on consent / soft-opt-in ground under PECR and makes B2C email fully lawful. Sending streams split by type: **1:1 replies to flagged interest** go from the founder's venture address on the primary domain (agent-drafted, gated — these are personal emails and should look like it); **bulk/lifecycle/newsletter** goes from a dedicated subdomain (e.g. `mail.thereset.com`) so the apex domain's reputation is never exposed to volume sends. B2B partner outreach (corporate subscribers) stays lawful under the same gate with LIA/suppression discipline. LinkedIn is agent-drafted, human-sent only. Every send is a recorded approval event: recipient classification + interest source, lawful basis, suppression check, exact draft, approver, timestamp, sending identity.

**D4 — Contracts where studios meet Holy Corner.** `bcap-contracts` (Pydantic v2 + JSON Schema → TS) already spines grassmarket ↔ Holy Corner. Fountainbridge uses the same package for the entities its studio surfaces render (Venture, Lane, Ticket, Approval, Department, RunReport) so Holy Corner can later aggregate across studios without adapters. Nothing more ambitious than that — it's a shared type system, not a platform build.

**D5 (revised) — THE RESET launches in the studio; ARCA rides along as a fixture.** John's call: Reset does not wait in the workshop-only lane — it is the studio's launch venture from Phase 1 v0. This *is* still dogfooding: John is a Reset co-founder, so the first founder using the studio daily is us. ARCA remains a second manifest — useful as a lower-stakes fixture for testing scoping, parser tolerance, and breaking changes before they hit Reset's view. Holy Corner-style portfolio views stay out of scope (that's Holy Corner's job).

**D6 — Stack mirrors Cofounder's; branding is ours.** Next.js + Vercel + Supabase + GitHub (+ Stripe/Postmark when needed) — the same managed stack Cofounder builds on, so venture apps and the studio feel identical to operate and the Cofounder reference index maps 1:1 onto our build. Visual identity follows grassmarket / the main Bruntsfield website. Studio auth is **Google OAuth** (per the Holy Corner vertical-login pattern — founders sign in with the Gmail identity from D3).

**D7 — Governance: an approval matrix per venture.** Co-ownership means two humans with authority — the founder (product) and Bruntsfield (engineering/platform). Each venture manifest carries an approval matrix: founder approves product-visible changes; Bruntsfield approves platform/infra/security; **dual-approve** for the high-blast-radius list (migrations, auth, payments, secrets, external sends — mirroring Cofounder's own pre-ship review list). The studio's attention queue routes each item to the right approver(s).

**D8 — Venture context & library live in the venture repo.** Founder-supplied context (brand kit, ICP notes, decks, research) and agent outputs need a home every lane can read — Cofounder has Company Memory + Department Context + Library; gbrain alone doesn't cover it. Convention: `context/` (durable background, department-tagged) and `library/` (artifacts/outputs) in the venture repo, heavy binaries in object storage with pointers. Git stays the source of truth; gbrain indexes it.

## 3. Phases

### Phase 0 — Foundations

Scaffold the `fountainbridge` repo under the existing org with standard conventions (FB-001). Extend bcap-contracts with the studio entities, now including per-venture VPS binding, founder identity — GitHub login + Gmail — and the D7 approval matrix (FB-002). Define the venture manifest format and write two real manifests: **ARCA** (dogfood) and **the-reset** (draft, from its deck) (FB-003). Write the **venture VPS provisioning runbook** — Hetzner box, workshop install, SSH keys for founder + John, gbrain init — and script what's scriptable (FB-011). Kick off the D3 GTM research in parallel (FB-012).

**Venture delivery does not wait for the studio — and the studio does not wait for polish to carry Reset.** THE RESET's box is provisioned and its first lane ships during Phase 0 (FB-011); the moment studio v0 exists (Phase 1), Reset is *in it* — its lanes, tickets, and PRs are the studio's primary content from the first deploy. Its `marketing` repo (landing page, case-study posts — Reset's own GTM stage 1) is a lane like any other and starts just as early (Phase 4a machinery is just a repo + PR gate).

Exit: repo live, contracts published, Reset + ARCA manifests validate, The Reset's real VPS provisioned and its first lane shipping.

### Phase 1 — Foundry Studio v0 (read-only, THE RESET as launch venture)

The studio surface: Next.js app, Google OAuth with venture-scoped access (John sees all ventures; a founder's venture-domain account sees theirs), grassmarket-aligned branding (FB-005). Views over the **Reset and ARCA manifests** via the GitHub API: lanes + ticket queues parsed from `docs/tickets/` (FB-004 parser, FB-006 views), the **attention queue** of open PRs awaiting the human gate (FB-007), CI/lane-health + activity with staleness flags (FB-008). Mobile pass + Vercel deploy under a proper domain (FB-009). Exit: The Reset (and ARCA alongside) is run day-to-day through the studio — Ross's account sees Reset live (FB-010 dogfood week + retro drafts the Phase 2 set from evidence).

### Phase 2 — Write path + scheduler

Create/edit tickets from the studio (a form that commits conventions-compliant markdown to the venture repo — the `git push` handoff without a laptop), and the per-venture VPS scheduler: systemd timers waking lanes against their queues, standing orders, a "useful work?" pre-check before burning a session, RunReports written back for the studio to display. Closes "agents wake without SSH" — while D1 keeps SSH available to founder and John as the power path, not the required path. Scoped in detail by FB-010's retro.

### Phase 3 — Founder experience deepened (Reset already in the studio)

The Reset has been in the studio since Phase 1 (read-only) and gained the write path in Phase 2; this phase closes the founder-experience gap identified in the parity critique. Three items are first-class scope, not polish:

1. **Conversational composer** — the founder describes what they want in chat; an agent (gstack /plan-ceo-review behind the scenes) shapes it into a conventions-compliant ticket, plays it back in plain language, and files it on approval. Git remains the store; the conversation is the interface. This is Cofounder's core loop and the single most important parity feature.
2. **In-studio approvals** — attention-queue items carry a plain-language summary + Vercel preview link + Approve action (merge via GitHub API), routed per the D7 matrix (founder / Bruntsfield / dual). Reviewing on github.com becomes the power path, not the required path. ActiveGraph approvals join the same queue once FB-012's gate design lands.
3. **Nothing fails silently** — run reports, lane staleness, and failure states surfaced with plain-language "what happened / what we're doing" — a founder blocked at 22:00 must see *why* in the studio.

Plus: D8 `context/` + `library/` conventions live in the Reset repo (brand kit, ICP, decks readable by every lane); routine management surface v0 (see/pause/run-now on scheduled lanes, reading Phase 2's RunReport state). Exit: Ross files work, reviews previews, and approves through fountainbridge without touching tmux or github.com (but can SSH when he wants to — that's a feature).

### Phase 4 — GTM departments (split per the parity critique)

**4a — Content & site (no research dependency; can start alongside Phase 1).** Half of GTM is repo work with a PR gate, and the machinery exists today: a `marketing` repo per venture, gstack GTM role skills (/draft-campaign, /qa-copy — analogous to /review, /qa), producing exactly The Reset's stage-1 artifacts (landing page, case-study posts, SEO, decks, webinar collateral) through real CI on the venture's real domain. This is where we can be *better* than Cofounder early — their marketing output lands in a Library for review; ours ships through production discipline.

**4b — Interest-based sends (architecture decided in `docs/research-gtm.md` §7, ratified).** Agents work the venture's flagged-interest queue: ad responses, waitlist signups, enquiries. 1:1 replies drafted for the founder's venture address; lifecycle/bulk from the `mail.` subdomain; every send through the ActiveGraph gate with interest-source recorded. No cold outreach, no bought lists — the acquisition top-of-funnel is 4a content + ads driving opt-in, which is both the lawful path and The Reset's own deck's path. Then Ops/Finance connectors (Stripe reads free, mutations gated). gbrain partitions per venture per department.

Exit: THE RESET runs ≥2 non-engineering departments through the same queue-and-gate loop; nothing external leaves without a recorded human approval.

### Phase 5 — Foundry Studio public + repeatable

The **fountainbridge landing page** in Holy Corner's structure (main site → Foundry vertical → Google OAuth studio login), grassmarket-consistent branding. Provisioning script matures to venture-in-a-day. Generic-tenancy hardening for the B2B posture (a bank-sponsored wealth product is just a venture manifest with different connectors and gates). Operational metering per venture (usage visibility; billing rails only if Foundry economics demand). Exit: second venture (Tier 3 pick or B2B pilot) onboarded in under a day.

## 4. Cofounder feature → fountainbridge disposition (v2)

| Cofounder capability | Disposition | Where |
|---|---|---|
| Canvas / task board / attention queue | **Build** (thin, over git + gates) | P1–P3 |
| Plan mode | **Have** — gstack /plan-ceo-review | P3 composer |
| Engineering agent + PR gate + previews | **Have** — workshop per venture VPS | P0 runbook |
| Routines / scheduler | **Build** (per-venture systemd) | P2 |
| Departments + department context | **Build** — repos + gbrain partitions | P4 |
| Skills (SKILL.md, GitHub import) | **Have** — same format (gstack) | — |
| Approval policies on external actions | **Decided** — ActiveGraph event-sourced gate | P3–P4 |
| Agent email (Agentmail/Postmark) | **Decided** — venture Workspace domains, outreach subdomain, never founder's personal Gmail | P4b |
| MCP integrations | **Have** mechanism; connectors per department | P4 |
| Managed repos/hosting/DB per tenant | **Same stack** (GitHub org + Vercel + Supabase), runbook→script | P0, P5 |
| Domains/email infra in-app | **Defer** — manual per venture | later |
| Company Memory | **Have** — gbrain (per-venture) | — |
| Roadmap (guided founder journey) | **Defer** — Foundry partners are the roadmap | later |
| Incorporation (Ramp), inbox warming, SaaS billing | **Skip** — warming assessed in FB-012 as unproven-to-risky; authenticate + ramp instead | — |

## 5. Risks worth naming (brief)

**Founder SSH is a feature and a risk** — a founder with root on their VPS can break their workshop; the runbook needs a recovery path (snapshot/rebuild from script) so "reprovision" is cheap. **Gmail-based sending is the least-proven leg** — hence research before build; deliverability mistakes on a founder's personal identity are expensive to undo. **Shared Claude Max across ventures** — all lanes currently ride one subscription: usage ceilings as venture lanes multiply, and terms-of-service exposure where a personal subscription powers third-party commercial ventures; FB-011 adds an explicit check + per-venture cost line (the answer may be "fine for now," but it must be a decision, not a default). **Generic-vs-Reset tension:** THE RESET will pull the studio toward its specifics; the manifest boundary (venture-as-config) is the discipline. **Support commitment** stands: failure states surfaced in-studio from Phase 3. **Known blind spot:** app.cofounder.co itself (behind signup), the founder-guide PDF, and superoptimizers.cofounder.co are unscraped; reference index covers marketing + full docs. **Stale-file note:** ticket numbering kept stable to avoid orphaned files; FB-011/FB-012 additive.

## 6. Immediate next step

The planning pack is packaged as a push-ready git repo (`repo/` on the planning desk). Push it to `wealthcx01/fountainbridge` from PowerShell, then run the bootstrap prompt (`docs/bootstrap-prompt.md`) in a fresh tmux window — it pulls the repo and executes FB-001 through the normal gate. FB-002 (bcap-contracts) can run in parallel in its own lane.
