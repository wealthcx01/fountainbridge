# FB-170 — the studio has no database

**Status:** Open · **Phase:** 3 · **Blocks:** FB-171, FB-172, FB-174 · **Raised by:** John, 2026-09-02

## The fact

There is no database in this repository. Not an unused one, not a stub — `grep` for supabase,
postgres, prisma, drizzle, s3 or blob across the whole studio returns nothing. Every screen is
assembled by asking GitHub, live, on each page load. D6 names Supabase as the studio's data store
and it has never been created.

This is the single largest thing wrong with the studio.

## What it costs, measured

Content on screen, ARCA, production, 2026-09-01 after the FB-151/157/158/161/164 streaming work:

| screen | before | after |
| --- | --- | --- |
| handbook | 279ms | 248ms |
| tickets | 315ms | 304ms |
| the rail | 6,105ms | 2,078ms |
| memory | 5,080ms | 3,066ms |
| the desk | ~6,100ms | ~6,100ms |
| what happened | ~6,100ms | ~6,100ms |

Streaming moved *when* a founder sees something, not how long the work takes. The desk and the
activity feed still take six seconds because each is dozens of sequential round trips to a code host.

**This is not a web-app limitation.** The same reads from an Electron app or a native iOS client
take the same six seconds — the time is spent waiting on api.github.com, not on rendering. Changing
the client changes nothing. A read model changes everything.

## Why the absence keeps causing unrelated bugs

Every defect below has one root: the studio re-derives from a remote API what it should hold.

- **FB-161** — a directory listing silently capped at 1,000 entries, so every screen read a window of
  ARCA's history frozen on 31 August. Found only because a picture on the screen made it obvious.
- **FB-083** — request budgets exist as a hand-enforced rule because there is nowhere to put a
  cached fact.
- **FB-164** — liveness had to be re-derived from *filenames* to avoid reading file contents.
- **FB-162** — the state ref gains ~288 files a day, forever, because git is being used as a
  database by something that has none.

## Scope

**A read model, not a source of truth.** CLAUDE.md non-negotiable 1 stands: git remains the record
for tickets, approvals and run reports. This is a materialised view that can be thrown away and
rebuilt from git, so a corrupted or stale database is a performance problem and never a data-loss
one. That property is what makes it safe to add.

- Supabase (D6), Postgres. One schema per venture or a venture column with row-level security —
  **venture isolation stays server-side and absolute** (non-negotiable 6), and this is the highest
  risk the change introduces: today isolation is physical, and a shared database makes it logical.
  Whatever is chosen must be provable by a test that tries to read across ventures and fails.
- Ingest by webhook where GitHub offers one (push, pull_request, check_run), and a reconciling sweep
  for everything else. Never a poll-per-page-load.
- The read path swaps behind the existing `lib/*-load.ts` seams, which already inject their sources —
  the pure read models and every test stay as they are.
- Keep a `?fresh=1` escape that bypasses the cache and reads git directly, so a founder who suspects
  the studio is stale can prove it either way.

## Acceptance criteria

- [ ] The desk and `/venture/<id>/activity` render fully in under 800ms on production data.
- [ ] Deleting the entire database and rebuilding from git produces byte-identical screens.
- [ ] A test proves a session scoped to one venture cannot read another's rows, at the database.
- [ ] The number of GitHub requests per page load is bounded and does not grow with venture history.
- [ ] Nothing in the studio treats the database as authoritative over git.
