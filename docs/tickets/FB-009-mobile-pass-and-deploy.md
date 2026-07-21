# FB-009 — Mobile-usable pass + Railway deploy

> D6 amended 2026-07-21 (this PR): deploy target is **Railway**, not Vercel. See the phased plan's D6 note.

**Phase:** 1 · **Depends on:** FB-006, FB-007, FB-008 · **Repo:** fountainbridge
**Branch:** `fb-009-mobile-deploy` · One ticket = one branch = one PR.

## Context
Phase 1's exit criterion is running ARCA's day through the studio — from the iPhone as much as the laptop. Deploy target per D6 (as amended) is **Railway** — a long-running host that fits the studio's in-memory caches and matches the venture VPS operational model; domain slots into the Holy Corner vertical pattern.

## Scope
- Responsive pass over all views (shell, lanes/tickets, attention, activity): thumb-reachable nav, readable ticket drawers, attention queue as the mobile landing view.
- Playwright mobile-viewport UI-gate screenshots added to the gallery.
- Production deploy on Railway; domain per the Holy Corner vertical-login pattern (agree the exact subdomain in PR — e.g. foundry.<main-domain> — consistent with how grassmarket's login site is exposed); HTTPS; Google OAuth callback updated.
- Uptime check (simple external ping monitor) so the pane of glass itself can't die silently.

## Out of scope
PWA/push notifications; the public Foundry landing page (Phase 5).

## Acceptance criteria
- [ ] All views usable at 390×844 (screenshots in gallery); Lighthouse mobile ≥ 90 accessibility.
- [ ] Live on Railway behind Google OAuth at the agreed domain; uptime monitor green.
- [ ] Phase 1 exit test: one full working morning of ARCA run from phone only, gaps logged as tickets.

## Verification
/review + /qa + UI-gate gallery (desktop + mobile).
