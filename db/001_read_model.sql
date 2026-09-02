-- The studio's read model (FB-170).
--
-- ## This is a CACHE, and that is the whole safety argument
--
-- Git remains the source of truth for work items (CLAUDE.md non-negotiable 1). Every row here is
-- derived from a git ref and can be dropped and rebuilt. That property is what makes it safe to add
-- a database to a product whose entire premise is that git is the record: a corrupt or stale table
-- is a performance problem, never a lost ticket. Nothing writes here that is not also written to git
-- first, and nothing reads here that could not fall back to reading git.
--
-- ## Isolation is the risk this change introduces, so it is enforced by the database
--
-- Today a venture's isolation is physical: one VPS per venture (D1), and the studio simply cannot
-- fetch another venture's data because it holds no credential for it. A shared database makes that
-- isolation LOGICAL, which is a real reduction in guarantee and the thing most likely to be got
-- wrong quietly.
--
-- So it is not left to the application. Every table carries `venture_id`, row-level security is
-- enabled AND forced, and the policy compares against `app.venture_id` — a setting the server sets
-- per request and a browser cannot influence. FORCE matters: without it the table owner bypasses
-- every policy, and the owner is exactly who the application connects as.

create table if not exists ventures (
  id          text primary key,
  name        text not null,
  updated_at  timestamptz not null default now()
);

-- One row per run report on a venture's `foundry-state` ref.
--
-- The natural key is (venture, repo, filename): the lane names reports
-- `<slug>-YYYYMMDDTHHMMSSZ.json` and overwrites exactly one, `_heartbeat.json`. So an upsert on this
-- key is idempotent for history and self-correcting for the beacon, which is precisely the two
-- behaviours the ref has.
create table if not exists run_reports (
  venture_id  text not null references ventures(id) on delete cascade,
  repo        text not null,
  name        text not null,
  -- Parsed from the FILENAME, not from the payload. FB-177: the lane's timestamp is fixed-width,
  -- zero-padded UTC, and it is what "newest" has to mean — sorting the filenames themselves sorts
  -- by slug, which is how the desk came to show reports from five weeks earlier.
  written_at  timestamptz,
  -- The lane's record, verbatim. Stored whole rather than shredded into columns because
  -- `fromLaneRecord` is the one place that knows how to read it, it already tolerates both the
  -- lane's original vocabulary and the bcap-contracts shape (FB-042), and a schema that parsed the
  -- payload here would be a second parser to keep in step with the first.
  payload     jsonb not null,
  synced_at   timestamptz not null default now(),
  primary key (venture_id, repo, name)
);

-- The desk's query, and the only one this table exists to serve: the newest N for a venture,
-- across every surface. Nulls last, because an undateable report is not the newest anything.
create index if not exists run_reports_newest
  on run_reports (venture_id, written_at desc nulls last);

alter table ventures    enable row level security;
alter table run_reports enable row level security;
-- FORCE, not merely ENABLE: without it the table owner — which is who the studio connects as —
-- bypasses every policy below, and the isolation would be decorative.
alter table ventures    force row level security;
alter table run_reports force row level security;

-- `current_setting(..., true)` returns NULL rather than raising when the setting is absent, so a
-- connection that has not declared a venture sees NOTHING. Failing closed is the only acceptable
-- default here: a bug that forgets to set the scope must show an empty screen, never another
-- founder's venture.
create policy ventures_scoped on ventures
  using (id = current_setting('app.venture_id', true));

create policy run_reports_scoped on run_reports
  using (venture_id = current_setting('app.venture_id', true));

-- ## The studio connects as THIS role, and never as the owner
--
-- `force row level security` binds the table owner. It does **not** bind a superuser, or any role
-- with BYPASSRLS — those ignore every policy above silently, with no error and no log line. So the
-- policies are only worth anything if the application's connection is neither.
--
-- This was not a theoretical precaution: the first run of the isolation test passed every query
-- across every venture, because PGlite connects as `postgres` and a superuser reads straight through
-- RLS. In production the equivalent mistake is using Supabase's default `postgres` user, which is
-- exactly the connection string its dashboard hands you first.
--
-- `nologin` because the credential is granted separately per environment; the role is the grant
-- surface, not an account.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'foundry_studio') then
    create role foundry_studio nologin;
  end if;
end $$;

grant usage on schema public to foundry_studio;
-- Read-only by construction on the read path. The ingest runs under its own credential; the web
-- process has no business writing to a cache it can rebuild, and a studio that cannot write cannot
-- corrupt the thing every screen reads.
grant select on ventures, run_reports to foundry_studio;
