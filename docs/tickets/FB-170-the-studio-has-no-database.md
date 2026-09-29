# FB-170 — the studio has no database

**Status:** Shipped in part · **Phase:** 3 · **Blocks:** FB-171, FB-172, FB-174 · **Raised by:** John, 2026-09-02

> **Slice 1 (done):** the schema and the isolation guarantee, proven against real Postgres. No
> production wiring and no read path swapped — deliberately, because both need a Supabase project
> that does not exist yet.
>
> **No longer blocked (corrected 2026-09-09).** The Supabase project exists, the schema is applied,
> and `lib/db.ts` connects to it through the shared session pooler. `db/002_documents.sql` and
> `db/003_document_bytes.sql` landed on top of it. This line still said "blocked on John" a week
> after that, and it was read as a live blocker when John asked what was outstanding — a ticket that
> lies about who is holding it up wastes exactly the person it names.
>
> **What is actually left is the read model**, which is the reason this ticket exists. The database
> is connected but only `lib/document-store.ts` uses it. `lib/venture-reads.ts` still rebuilds every
> screen from GitHub on each load, so the six-second pages this ticket was raised about are
> unchanged. Nothing blocks that work.
>
> **The finding worth carrying forward:** `force row level security` binds the table *owner* but not
> a **superuser**, which reads straight through every policy with no error and no log line. The first
> run of the isolation suite passed every cross-venture query for exactly that reason. In production
> the same mistake is using Supabase's default `postgres` user — the connection string its dashboard
> offers first. The studio connects as `foundry_studio`, which has `select` and nothing else.

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

## Slice 2 (this PR): the run-report read model

The desk's six seconds were never rendering and never the listing. They are the **file reads**:
rendering twenty rows opens `limit × READ_MARGIN` = 60 report files, and each one is an HTTP request
to a code host at roughly 100ms.

`lib/runreports-cache.ts` wraps the GitHub source with a Postgres cache and `db/004_run_reports_cache.sql`
adds the table.

**Why a cache is safe here, when a cache usually is not.** A run report is written once and never
changed — the lane names it `<slug>-YYYYMMDDTHHMMSSZ.json`, so a second report is a second file rather
than an edit. The rows are immutable, so an entry can never be stale, only absent, and absent falls
through to git. That is also why the studio is granted `insert` and withheld `update` and `delete`:
the worst a bug can do is fail to fill the cache.

**The heartbeat is deliberately not cached.** `_heartbeat.json` is the one file a lane overwrites in
place. Caching it would pin the first version the studio ever saw and report a stopped machine as
running — the exact failure non-negotiable 10 forbids, arriving through an optimisation.

**Every database error is a cache miss.** A studio whose cache is unreachable must be slow, not
broken.

### What was measured, and what was not

**Measured — the request count, which is the mechanism:**

| | requests per page load |
| --- | --- |
| before | **61** (60 report files + the beacon) |
| after, warm cache | **1** |
| after, cold cache | 61, and it warms itself |

Invariant with history: 1,773 reports and 10,000 reports cost the same. Locked in CI by
`lib/__tests__/runreports-cache.test.ts` — if a later change asks per file again, those numbers move
and the test fails.

**NOT measured — the wall-clock 800ms criterion.** Being explicit rather than implying it was checked:

- Production requires a signed-in founder session. Every unauthenticated request lands on `/login`:
  `/venture/arca` → `200 in 180ms` at `.../login?callbackUrl=...`. Timing that would have been the
  FB-151 mistake again, and was caught only by printing the landing URL beside the reading.
- Locally there is no way to run the real path: `GITHUB_TOKEN` in `.env.local` is **present but
  empty**, and no database URL is configured.

So this slice ships a mechanism whose saving is counted and bounded, with the wall-clock claim
**unverified**. The criterion below stays unticked until a signed-in reading exists.

### Two vacuous tests found by breaking the code on purpose

Both would have shipped green and proved nothing:

1. The filename-to-timestamp test **retyped the SQL into its own body**, so it asserted that a
   hand-copied snippet sorted correctly. Replacing the shipped expression with `case when false`
   changed nothing. Fixed by exporting `WRITTEN_AT_FROM_NAME` and importing it.
2. Even then it stayed green, because the fixture array was **already in the expected output order** —
   so it could not tell sorting from insertion order. Fixed by shuffling the fixture.

Only after both fixes does the mutation turn the test red. This is the fourth and fifth instance of
the pattern in `a-test-that-cannot-fail`; the check that finds it is always the same one — delete the
fix and watch the test go red.

## Acceptance criteria

- [ ] The desk and `/venture/<id>/activity` render fully in under 800ms on production data.
      *(STILL UNVERIFIED after slice 2. Needs a signed-in production session, or a local
      `GITHUB_TOKEN` + database URL. See "what was measured, and what was not".)*
- [ ] Deleting the entire database and rebuilding from git produces byte-identical screens.
- [x] A test proves a session scoped to one venture cannot read another's rows, at the database.
      *(FB-174, 2026-09-07: proven twice — against PGlite in `lib/__tests__/read-model.test.ts` and
      `documents-read-model.test.ts`, and against the hosted project as `foundry_studio` itself,
      which is the role the studio connects as and which does not have `rolbypassrls`. A count is
      covered too: "how many documents does the-reset hold" is a fact about another venture.)*
- [x] The number of GitHub requests per page load is bounded and does not grow with venture history.
      *(Slice 2: 61 -> 1 warm; identical at 1,773 and 10,000 reports. Counted in CI.)*
- [ ] Nothing in the studio treats the database as authoritative over git.
