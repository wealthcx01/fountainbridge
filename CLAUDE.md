# CLAUDE.md — fountainbridge (Foundry Studio)

> DRAFT seeded from the Cowork planning session 2026-07-20. FB-001 finalizes this file against grassmarket's CLAUDE.md pattern — keep structure aligned with that file.

## What this project is

Fountainbridge is the **Foundry Studio** — Bruntsfield Capital's founder-facing platform for launching and running co-created ventures (Cofounder-class dashboard on our own substrate). It is one vertical of **Holy Corner** (the Bruntsfield hub); grassmarket is the Advisory Studio sibling. Ventures are configured, never hard-coded: everything venture-specific lives in `ventures/*.yaml` manifests validated against **bcap-contracts** (Pydantic v2 + JSON Schema → TS types).

Launch venture: **the-reset**. Fixture venture: **arca**. First read: `docs/fountainbridge-phased-plan.md` (v4 — decisions D1–D8 are binding until amended by PR).

## Non-negotiable conventions

- **One ticket = one branch = one PR.** Tickets are markdown in `docs/tickets/` (FB-XXX-slug.md). Branch names: `fb-XXX-slug`.
- **Never merge.** This lane opens PRs and stops. Humans merge per the venture approval matrix (D7). No exceptions, including "trivial" changes.
- **Respect ticket scope.** Work only the ticket on the branch. Discovered work → new ticket file in the PR or a follow-up, never scope creep.
- **Gates:** engineering changes gate on PR review; external actions (email, social, CRM, payments) gate on ActiveGraph approval events. Nothing external ever executes without a recorded human approval.
- **Roles:** use gstack — /plan-ceo-review before large/ambiguous work, /review (staff-engineer audit) + /qa before every PR, /ship to finalize, /retro at phase close-outs.
- **Memory:** gbrain is wired for this lane; record decisions and cross-session context there, partitioned per venture where venture-specific.

## Stack (Decision D6)

Next.js + Vercel + Supabase + GitHub API. Auth: **Google OAuth** — venture scoping keys off `founder.workspace_email` in the manifest (a Bruntsfield-assigned venture-domain Workspace account, never personal @gmail.com). Branding: grassmarket / main Bruntsfield site design tokens — do not invent a theme. CI: lint + typecheck + test + Playwright UI-gate (screenshot gallery per PR), mirroring the portfolio-wide CI pattern.

## Architecture spine

- **Git is the source of truth for work items.** The studio renders `docs/tickets/` from venture repos via the GitHub API — no separate database of record. The dashboard is a view + write-path onto git.
- **Contracts through bcap-contracts** for every rendered entity (Venture, Lane, Ticket, Approval, Department, RunReport). Schema changes happen there (see FB-002), consumed here as generated TS types.
- **Venture isolation:** one VPS per venture (founder + John have SSH); venture-scoped sessions must never fetch another venture's data — enforce server-side, not in UI.
- **Security:** venture secrets live on the venture's box / deployment env, never in this repo. No credentials in code, tickets, or gbrain.

## Current state

Phase 0. Active tickets in `docs/tickets/` — FB-001 (this scaffold), FB-002 (bcap-contracts, runs in that repo's lane), FB-003 (manifests) next. GTM architecture is decided and ratified (`docs/research-gtm.md`) — no cold outreach, interest-based sends only, venture Workspace domains.
