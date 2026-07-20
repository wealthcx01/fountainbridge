# FB-001 — Complete fountainbridge repo scaffold

**Phase:** 0 · **Depends on:** — (repo pre-created from the planning-pack push) · **Repo:** fountainbridge
**Branch:** `fb-001-scaffold` · One ticket = one branch = one PR.

## Context
Fountainbridge is the **Foundry Studio** — the vertical of Holy Corner through which Foundry ventures are launched and run (see `docs/fountainbridge-phased-plan.md` v4). The repo was created by pushing the Cowork planning pack (README, draft CLAUDE.md, docs/, docs/tickets/). This ticket completes the scaffold so every subsequent ticket flows through the normal lane process.

## Scope
- Review/finalize the **draft `CLAUDE.md`** against grassmarket's pattern: project purpose, conventions, ticket process, never-self-merge rule, relationship to Holy Corner and bcap-contracts, stack decision (D6: Next.js + Vercel + Supabase, grassmarket-aligned branding, Google OAuth).
- Verify `docs/tickets/` seeded correctly (FB-001…FB-012) and README links resolve.
- gstack skill pack installed/configured; gbrain wired for the new lane.
- CI workflow: lint + typecheck + test on PR (app arrives in FB-005; CI passes trivially until then).
- Branch protection on `main`: PR required, CI required, no self-merge.

## Out of scope
Any application code; Vercel/deploy config (FB-009); venture VPS provisioning (FB-011).

## Acceptance criteria
- [ ] CLAUDE.md finalized; CI green on the scaffold PR; branch protection verified by attempting (and being refused) a direct push to `main`.
- [ ] New tmux lane `fountainbridge` operational in the workshop.

## Verification
/review + /qa per gstack; screenshot of branch-protection settings attached to PR.
