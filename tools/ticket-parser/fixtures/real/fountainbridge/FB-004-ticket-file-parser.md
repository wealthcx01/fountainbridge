# FB-004 — Ticket-file parser: docs/tickets markdown → Ticket contract

**Phase:** 1 · **Depends on:** FB-002 · **Repo:** fountainbridge
**Branch:** `fb-004-ticket-parser` · One ticket = one branch = one PR.

## Context
Decision D2: the venture repo is the source of truth; the studio is a view over `docs/tickets/` markdown. That requires a robust parser from the workshop's ticket convention to the `Ticket` contract — tolerant of the real variation in existing tickets (~75 on grassmarket, plus ARCA's), not just the ideal template. Founders (via their own GitHub accounts) will also hand-write tickets, so tolerance matters even more.

## Scope
- TypeScript library parsing a ticket markdown file → `Ticket` (bcap-contracts TS type): id, title, phase, depends_on, status, branch, body.
- Status derivation: front-matter/heading fields where present; hook for PR-based inference (open PR referencing the id → `pr-open`; merged → `done` — inference itself lands in FB-007).
- Fixture suite drawn from real tickets across ≥2 existing repos (grassmarket + ARCA), copied into `fixtures/`.
- Graceful degradation: a malformed ticket parses to a `Ticket` with warnings, never a crash — imperfect tickets are shown flagged, never hidden.

## Out of scope
GitHub fetching (FB-006); writing tickets (Phase 2).

## Acceptance criteria
- [ ] ≥90% of sampled real tickets parse with zero warnings; 100% parse without throwing.
- [ ] Unit tests cover: canonical template, missing fields, odd headings, non-ticket markdown in the directory.

## Verification
/review + /qa; parser run against grassmarket's and ARCA's full docs/tickets/ with a summary table (parsed/warnings/errors) attached to PR.
