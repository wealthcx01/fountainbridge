# fountainbridge — Foundry Studio

The **Foundry Studio**: the vertical of Holy Corner through which Bruntsfield Capital's Foundry ventures are launched and run. A Cofounder-class founder dashboard on Bruntsfield's own substrate — the workshop (Claude Code lanes on per-venture VPSes), gstack roles, gbrain memory, tickets-as-git, PR + ActiveGraph approval gates.

**Parity target:** at least at par with cofounder.co, preferably better. Where we're structurally ahead: founders co-own their repos, VPS, and infrastructure from day one (SSH included) — no "graduation," no rented stack, stricter production defaults, and a human partner in the loop.

## Holy Corner map

| Vertical | Studio | Codename |
|---|---|---|
| Advisory | Advisory Studio | grassmarket |
| **Foundry** | **Foundry Studio** | **fountainbridge (this repo)** |
| Briefing | Briefing Studio | TBD |
| Equity | Equity Studio | TBD |

**Launch venture:** THE RESET — parked since 7 October 2026 until ARCA runs cleanly on the new setup, then started fresh on the new system (FB-010). **Test bed:** ARCA.

## Read first

1. `docs/fountainbridge-phased-plan.md` — decisions D1–D8, Phases 0–5 (v4)
2. `docs/cofounder-reference-index.md` — the competitive baseline, fully scraped
3. `docs/parity-critique.md` — honest scorecard vs Cofounder
4. `docs/research-gtm.md` — verified GTM findings + ratified architecture
5. `docs/tickets/` — FB-001…FB-012, one ticket = one branch = one PR

## Running it locally

Node 22 (what CI uses). From a fresh clone or an out-of-date one:

```bash
git checkout main && git pull        # start from what actually shipped
npm ci                               # not `npm install` — the lockfile is the contract
cp .env.example .env.local           # then fill it in; no secrets live in this repo
npm run dev                          # http://localhost:3000
```

Before opening a PR, run what CI runs — `npm run lint`, `npm run typecheck`, `npm test`. The
browser suite (`npm run test:e2e`) needs `npx playwright install chromium` once.

### Running against the real deployment

A local `.env.local` proves the code works. It does **not** prove the deployment works — that
distinction cost weeks of a broken composer (FB-087). To exercise the studio with the deployed
environment, without copying secrets onto disk:

```bash
railway run --service foundry-studio npm start
```

Signed in as an admin, `/api/readiness?probe=1` then reports, per venture, whether the studio can
actually reach that venture's box.

## Conventions

Tickets live in `docs/tickets/`; one ticket = one branch = one PR; nothing merges without a human yes — a founder's approval recorded in the studio, or John merging in GitHub — after CI is green and `/review` has passed (external actions still need their own recorded approval). gstack provides roles (/plan-ceo-review, /review, /qa, /ship, /retro); gbrain provides memory. Stack: Next.js + Vercel + Supabase, Google OAuth, grassmarket-aligned branding. See `CLAUDE.md`.

**Dependency order:** FB-001 ∥ FB-002 (bcap-contracts) → FB-003 → FB-004 ∥ FB-005 ∥ FB-011 → FB-006 → FB-007 ∥ FB-008 → FB-009 → FB-010 (retro → Phase 2 set). FB-012 ratified — Phase 4b tickets (FB-02x) to be drafted from `docs/research-gtm.md` §7.

- `docs/architecture-replan-2026-09.md` — **PROPOSAL, awaiting John's ruling.** D10–D13 and an amendment to D1: Claude Code as the workbench, a Foundry MCP server that proposes and never grants, ephemeral per-ticket build environments, skills our agents load, and memory split into state and event. Read it before starting anything in Phase 3.

- `docs/design-gaps-open.md` — the open design questions, written so a section can go straight to Claude Design. Five today: what the desk becomes once work happens in Claude Code, what an empty office looks like, whether a figure means an agent, two tokens that do not exist, and the ledger on a phone.

- `docs/what-john-needs-to-do.md` — the four things waiting on John, each with exact steps, what it unblocks, and how he will know it worked. Read this before asking him for anything.
