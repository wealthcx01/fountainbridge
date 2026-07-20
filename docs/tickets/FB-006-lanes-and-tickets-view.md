# FB-006 — Venture lanes & tickets view (read-only)

**Phase:** 1 · **Depends on:** FB-003, FB-004, FB-005 · **Repo:** fountainbridge
**Branch:** `fb-006-lanes-tickets-view` · One ticket = one branch = one PR.

## Context
The first real pane of glass, venture-scoped: for a venture in the manifest (**launch venture: the-reset; fixture: arca**), show its lanes and each lane's ticket queue, parsed live from `docs/tickets/` via the GitHub API.

## Scope
- Venture home → per-lane ticket queues, grouped by status (todo / in-progress / pr-open / done-recent).
- Data path: manifest (FB-003) → GitHub contents API for `docs/tickets/` → parser (FB-004) → `Ticket[]`; server-side caching (~2 min TTL) + manual refresh.
- Ticket detail drawer: rendered markdown body, link to the file on GitHub, dependency links between tickets.
- Parser warnings surfaced inline (imperfect tickets shown flagged, never hidden).
- Empty/error states: repo unreachable, no tickets dir, rate-limited.
- Venture scoping enforced end-to-end: a founder-scoped session can never fetch another venture's repo data (server-side check, not just UI).

## Out of scope
PR/CI data (FB-007/008); ticket creation or editing (Phase 2).

## Acceptance criteria
- [ ] The Reset and ARCA both render from their real manifests; queues match reality on spot-check (side-by-side with `ls docs/tickets/` in PR).
- [ ] Cold load under 3s, warm cache under 500ms (measured, numbers in PR).
- [ ] Scoping test: founder session requesting a non-owned venture gets 403 (Playwright covered).
- [ ] Playwright coverage of venture → lane → ticket drawer path; UI-gate screenshots.

## Verification
/review + /qa + UI-gate gallery.
