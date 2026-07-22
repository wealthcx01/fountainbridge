# FB-019 — ARCA dogfood readiness

**Phase:** 1 · **Depends on:** FB-005, FB-006, FB-007, FB-008 · **Repo:** fountainbridge
**Branch:** `fb-019-arca-dogfood` · One ticket = one branch = one PR.

## Context
FB-010 is the dogfood week + retro. To dogfood **ARCA** through the studio, the studio has to show
ARCA's *real* work. Today it can't: no GitHub read token is set on the deploy, and the ARCA repo has
no `docs/tickets/` queue. This ticket makes ARCA renderable and worth looking at, so the week
produces real signal.

## Scope (what makes ARCA visible in the studio)
1. **GitHub read access on the deploy** — set `GITHUB_TOKEN` (org-scoped read; a PAT for v0 or a
   GitHub App token) as a Railway var on production so the studio can read the `wealthcx01/arca`
   repo. Without it, arca renders empty/error.
2. **Seed an ARCA ticket backlog** — add a starter set of real `docs/tickets/*.md` to the `arca` repo
   (its actual near-term work), so the studio's lanes/tickets view has a live queue and the parser is
   exercised on real tickets.
3. **Run ARCA work through the lane process** — do ARCA development as one-ticket-one-branch-one-PR so
   the attention queue (open PRs) and activity/CI-health feeds show real data. Either on ARCA's own
   VPS (via FB-011) or as normal dev against the repo — decide per (below).
4. **Verify** the studio renders ARCA end to end: lanes, grouped ticket queues, the attention queue of
   open PRs, CI health + activity, staleness — all reflecting reality.

## Decisions for John
- **GitHub token:** provide/authorize an org-scoped read token (or approve using an existing one). A
  dedicated read-only PAT or a GitHub App is cleaner than a personal token.
- **Where ARCA runs:** its own Hetzner VPS + lane now (FB-011 live provisioning), or dev happens
  off-box for the dogfood week. The studio reads git either way; the VPS matters for agents-wake-
  without-SSH (Phase 2), not for viewing.

## Out of scope
The scheduler / agents-wake-without-SSH (Phase 2). THE RESET's box (its own track).

## Acceptance criteria
- [ ] `GITHUB_TOKEN` set; the studio reads `wealthcx01/arca` (no auth/rate errors on spot-check).
- [ ] ARCA has a real ticket queue; the studio renders its lanes + grouped tickets accurately.
- [ ] At least one ARCA PR flows through and appears in the attention queue; activity/health reflect it.

## Verification
/review + /qa; a short spot-check note (studio vs. `ls docs/tickets/` for arca) in the PR.
