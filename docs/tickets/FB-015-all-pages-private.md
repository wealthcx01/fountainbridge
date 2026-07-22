# FB-015 — Make all Foundry pages private (revert public landing)

**Phase:** 1 · **Depends on:** FB-005, FB-013 · **Repo:** fountainbridge
**Branch:** `fb-015-all-pages-private` · One ticket = one branch = one PR.

## Context
John's call (2026-07-22): **no Foundry page is public.** FB-013 made `/` and `/playbook` reachable
without a session; this reverts that. Everything sits behind Google login. The educational/story
content (playbook, and the pages from FB-016/017/018) becomes **founder-facing, post-login** — a
reference surface inside the studio, not a public marketing site.

## Scope
- Remove the public-path exception in `auth.ts` (`/` and `/playbook*` no longer public); every route
  except `/login`, `/api/auth`, `/api/health` requires a session.
- `/` for a signed-out visitor → redirect to `/login` (no landing shown signed out). Signed-in → the
  studio home.
- Playbook + content pages move behind login (linked from the studio nav / home).
- Admin account keeps the all-ventures view (John); founders stay one-venture-scoped (FB-005 authz,
  unchanged).

## Out of scope
Removing the content itself (FB-013's playbook stays — it just goes private).

## Acceptance criteria
- [ ] No route serves content to a signed-out visitor except `/login` and `/api/health` (Playwright:
      signed-out `/`, `/playbook`, `/playbook/[slug]` all redirect to `/login`).
- [ ] Signed-in users can still reach the playbook + content pages.
- [ ] Venture scoping intact (founder sees only their venture; admin sees all).

## Verification
/review + /qa + UI-gate.
