# CLAUDE.md — fountainbridge (Foundry Studio)

Fountainbridge is the **Foundry Studio** — Bruntsfield Capital's founder-facing platform for launching and running co-created ventures (a Cofounder-class founder dashboard on our own substrate). It is one vertical of **Holy Corner** (the Bruntsfield hub); **grassmarket** (Advisory Studio) is the sibling that already consumes the shared contracts. Ventures are **configured, never hard-coded**: everything venture-specific lives in `ventures/*.yaml` manifests validated against **bcap-contracts** (Pydantic v2 + JSON Schema → generated TS types). Git is the source of truth for work items — the studio is a view + write-path over `docs/tickets/` via the GitHub API, not a separate database of record.

Launch venture: **the-reset** (B2C; in the studio from Phase 1 v0). Fixture venture: **arca**. Parity target (John): at least at par with cofounder.co, preferably better — the substrate is ahead, and the phased plan closes the founder-experience gap.

## Normative documents (read before any studio work)

- `docs/fountainbridge-phased-plan.md` — v4. **Decisions D1–D8 are binding** until amended by PR. Phases 0–5.
- `docs/parity-critique.md` — honest scorecard vs Cofounder; what "behind" means and where it is fixed.
- `docs/research-gtm.md` — FB-012, **ratified**. The GTM architecture (interest-based sends, venture Workspace domains, ActiveGraph gate). Governs all of Phase 4b.
- `docs/cofounder-reference-index.md` — the competitive baseline, fully scraped.
- `docs/tickets/` — FB-001…FB-012. One ticket = one branch = one PR.

Where the plan and a ticket disagree, the ticket's **scope** section wins for what ships in that PR; the plan wins on intent. Decisions change only by PR to the plan.

## Non-negotiables

1. **One ticket = one branch = one PR.** Tickets are markdown in `docs/tickets/` (`FB-XXX-slug.md`); branch names are `fb-XXX-slug`. Work only the ticket on the branch.
2. **Never merge.** This lane opens PRs and stops. Humans merge per the venture approval matrix (D7). No exceptions — including "trivial" changes. `main` is branch-protected server-side: PR required, CI required, no self-merge.
3. **Respect ticket scope.** Discovered work becomes a new ticket file in the PR or a follow-up — never scope creep into the current PR.
4. **Gates are absolute.** Engineering changes gate on PR review; external actions (email, social, CRM, payments) gate on **ActiveGraph** approval events. Nothing external ever executes without a recorded human approval (`approval.proposed` → `approval.granted`).
5. **Venture-as-config.** Nothing venture-specific lives in the studio core. A venture is a manifest; the studio must stay generic enough that a B2B motion (bank-sponsored wealth product) is "just another manifest."
6. **Venture isolation is server-side.** One VPS per venture (D1); a venture-scoped session must **never** fetch another venture's data — enforced server-side, never in the UI.
7. **Contracts through bcap-contracts.** Every rendered entity (Venture, Lane, Ticket, Approval, Department, RunReport) is a bcap-contracts type. Schema changes happen there (FB-002), consumed here as generated TS types. Schemas win on conflict.
8. **No secrets in the repo.** Venture secrets live on the venture's box / deployment env — never in this repo, tickets, or gbrain. No credentials in code.
9. **Built with gstack; gates never bypassed.** `/plan-ceo-review` before large/ambiguous work, `/review` (staff-engineer audit) + `/qa` before every PR, `/ship` to finalize, `/retro` at phase close-outs. No `--no-verify`.
10. **Fail loud, surface everything.** A founder blocked at 22:00 must see *why* in the studio — run reports, lane staleness, and failure states are surfaced in plain language, never swallowed.

## Stack (Decision D6)

- **App:** Next.js (App Router) + TypeScript, mirroring Cofounder's managed stack so venture apps and the studio feel identical to operate. **Arrives in FB-005** — until then this repo is docs + tickets + CI scaffold only.
- **Hosting / data:** **Railway** + Supabase. Deploy config lands in FB-009. *(D6 amended 2026-07-21, PR FB-009: Vercel → Railway — the studio's in-memory read-caches want a long-running server, and ventures already run on Hetzner VPS, D1. See the phased plan's D6 note.)*
- **Auth:** **Google OAuth** (the Holy Corner vertical-login pattern). Venture scoping keys off `founder.workspace_email` in the manifest — a Bruntsfield-assigned venture-domain Google Workspace account (e.g. `ross@thereset.com`), **never** a personal `@gmail.com`. John's account → all ventures; a founder's account → their venture only.
- **Contracts:** `bcap-contracts` (Pydantic v2 + JSON Schema → TS), the same package grassmarket consumes.
- **Source of truth:** GitHub API over the venture repos' `docs/tickets/` — no separate DB of record.
- **Branding:** grassmarket / main Bruntsfield site design tokens — **do not invent a theme**; pull the existing tokens.
- **CI:** lint + typecheck + test, plus a Playwright UI-gate (screenshot gallery per PR) once the app exists — mirroring the portfolio-wide CI pattern.

## Architecture spine

- **Git is the source of truth for work items.** The studio renders `docs/tickets/` from venture repos via the GitHub API. The dashboard is a view + write-path onto git, never a competing store.
- **Contracts through bcap-contracts** for every rendered entity. See non-negotiable 7.
- **Venture isolation** is physical (one VPS per venture, D1) and enforced server-side (non-negotiable 6).
- **Governance (D7):** each manifest carries an approval matrix — founder approves product-visible changes, Bruntsfield approves platform/infra/security, **dual-approve** for high-blast-radius (migrations, auth, payments, secrets, external sends). The attention queue routes each item to the right approver(s).
- **Context & library (D8):** `context/` (durable background, department-tagged) and `library/` (artifacts/outputs) live in the *venture* repo; heavy binaries in object storage with pointers. gbrain indexes git.

## Layout

```
fountainbridge/
├── CLAUDE.md                 # this file — the non-negotiables
├── README.md                 # read order + conventions
├── docs/
│   ├── fountainbridge-phased-plan.md   # v4, D1–D8 (normative)
│   ├── parity-critique.md              # scorecard vs Cofounder
│   ├── research-gtm.md                 # FB-012, ratified (Phase 4b)
│   ├── cofounder-reference-index.md    # competitive baseline
│   └── tickets/                        # FB-XXX-slug.md
├── .github/workflows/ci.yml  # lint + typecheck + test (trivially green until FB-005)
├── ventures/                 # one YAML per venture (FB-003): the-reset, arca, example
└── src/ (or app/)            # Next.js studio app — arrives FB-005
```

`ventures/` and the app do not exist yet — FB-003 and FB-005 create them. Do not fabricate them ahead of their tickets.

## Build sequence (phases — see the phased plan)

0. **Foundations.** Repo scaffold + CI + branch protection (FB-001), bcap-contracts entities (FB-002, in that repo's lane), venture manifest format + the-reset/arca manifests (FB-003), VPS provisioning runbook→script (FB-011), GTM research (FB-012, ratified).
1. **Studio v0 (read-only).** Next.js shell + Google OAuth venture-scoped (FB-005), ticket parser (FB-004), lanes/tickets view (FB-006), attention queue of open PRs (FB-007), CI/activity (FB-008), mobile + Vercel deploy (FB-009), dogfood week + retro → Phase 2 set (FB-010).
2. **Write path + per-venture scheduler.** Create/edit tickets from the studio; systemd timers waking lanes, RunReports written back. Scoped by FB-010's retro.
3. **Founder experience.** Conversational composer, in-studio approvals, nothing-fails-silently, D8 context/library.
4. **GTM departments.** 4a content/site (PR-gated, no research dependency); 4b interest-based sends (`docs/research-gtm.md` §7, ActiveGraph-gated).
5. **Public + repeatable.** Foundry landing page in Holy Corner; provisioning matures to venture-in-a-day; generic-tenancy hardening for the B2B posture.

**Dependency order:** FB-001 ∥ FB-002 → FB-003 → FB-004 ∥ FB-005 ∥ FB-011 → FB-006 → FB-007 ∥ FB-008 → FB-009 → FB-010. FB-012 ratified; Phase 4b tickets (FB-02x) drafted from the research doc §7.

## Memory

gbrain is wired for this lane; record decisions and cross-session context there, partitioned per venture where venture-specific. The lane-opening note (`fountainbridge-lane-opening`) holds purpose, D1–D8, ventures, and the dependency order.

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up and synced on this machine. The agent should prefer gbrain
over Grep when the question is semantic or when you don't know the exact
identifier yet.

**This worktree is pinned to a worktree-scoped code source** via the
`.gbrain-source` file in the repo root (kubectl-style context).
`gbrain code-def`, `code-refs`, `code-callers`, `code-callees`, `search`, and
`query` from anywhere under this worktree route to that source by default —
no `--source` flag needed (gbrain >= 0.41.38.0; on older gbrain the call-graph
commands need `--source "$(cat .gbrain-source)"`). Conductor sibling worktrees
of the same repo each have their own pin and their own indexed pages, so
semantic results match the code on disk here.

Call-graph queries (`code-callers`/`code-callees`) also need the graph to be
built first — run `/sync-gbrain --dream` (or `--full`) if they return
`count: 0`. This only works if this source's gbrain schema pack extracts code
symbols; on a non-code-aware pack `--dream` completes but the graph stays empty
and reports a WARN. `code-def`/`code-refs` need the same extraction.

Two indexed corpora available via the `gbrain` CLI:
- This worktree's code (auto-pinned via `.gbrain-source`).
- `~/.gstack/` curated memory (registered as `gstack-brain-<user>` source via
  the existing federation pipeline).

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-brain-<user>`

Grep is still right for known exact strings, regex, multiline patterns, and
file globs. Run `/sync-gbrain` after meaningful code changes; for ongoing
auto-sync across all worktrees, run `gbrain autopilot --install` once per
machine — gbrain's daemon handles incremental refresh on a schedule.

Safety: don't run `/sync-gbrain` while `gbrain autopilot` is active — the
orchestrator refuses destructive source ops when it detects a running autopilot
to avoid racing it (#1734). Prefer registering user repos with `gbrain sources
add --path <dir>` (no `--url`): URL-managed sources can auto-reclone, and the
sync code walk for them requires an explicit `--allow-reclone` opt-in.

<!-- gstack-gbrain-search-guidance:end -->

## Current state

Phase 0. FB-001 (this scaffold) in progress. Next in this lane after FB-001 merges: **FB-003** (FB-002 runs in parallel in the bcap-contracts lane). Ask before deviating from the dependency order.
