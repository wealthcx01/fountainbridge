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
-- `force row level security` removes the **table owner's** exemption, and only that one. Two other
-- exemptions exist, are checked earlier, and are unconditional: being a **superuser**, and carrying
-- the **BYPASSRLS** attribute. A connection with either reads straight through every policy above,
-- silently, with no error and no log line.
--
-- Both are live here, and they are not the same thing:
--
--   * **In these tests**, PGlite connects as a genuine superuser. The first run of the isolation
--     suite passed every cross-venture query for that reason, which is how this was found.
--   * **On Supabase**, the default `postgres` user is deliberately NOT a superuser — but it does
--     carry `BYPASSRLS`, which Supabase's own row-level-security documentation states outright. So
--     FORCE buys nothing against it either, and `BYPASSRLS` cannot be stripped from `postgres`
--     because it is a reserved role. The connection string the dashboard offers first is precisely
--     the one RLS does not bind.
--
-- The answer is therefore not to constrain `postgres`; it is to connect as something else. A role
-- that is not a superuser, does not hold BYPASSRLS, and does not own these tables is subject to
-- plain RLS. FORCE stays as belt-and-braces for the day something connects as the owner by accident.
--
-- Verify the attributes actually landed, in every environment, before trusting any of this:
--
--   select rolname, rolsuper, rolbypassrls from pg_roles
--    where rolname in ('postgres', 'service_role', 'foundry_studio');
--
-- `foundry_studio` must show f / f. `postgres` will show rolbypassrls = t — that row is the entire
-- reason this section exists.
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
-- Tables added later must be granted too, or the studio silently loses a screen rather than failing
-- loudly. Default privileges cover what the ingest's role creates from here on.
alter default privileges in schema public grant select on tables to foundry_studio;

-- ## Connecting as it, on Railway
--
-- Two things that are easy to get wrong and produce very different failures:
--
--   * **Use the SHARED session pooler, port 5432.** Three endpoints exist and only one of them
--     answers on IPv4 without paying:
--
--       direct connection    db.<ref>.supabase.co        IPv6 only, unless the IPv4 add-on is bought
--       dedicated pooler                                 IPv6 only, same add-on
--       SHARED pooler        <region>.pooler.supabase.com IPv4 by default — no add-on
--
--     Measured on this project, 2026-09-02: `db.pzxdjfelojqvygcpnbvf.supabase.co` resolves to an
--     AAAA record and no A record at all. Railway has no outbound IPv6, so a direct string fails
--     there at runtime with ENETUNREACH while working perfectly from a developer machine that has
--     IPv6 — which is the worst shape of bug to ship, because it passes every local check.
--
--     The IPv4 add-on would fix the other two and is a paid extra we do not need.
--
--     Not the TRANSACTION pooler (port 6543) either: it is for serverless functions and does not
--     support prepared statements, which a long-running server wants.
--   * **Through the pooler the username carries the project ref after a dot** — `foundry_studio.<ref>`,
--     not `foundry_studio`. Supavisor reads the tenant from the part after the last dot. A plain
--     username authenticates against the wrong tenant rather than failing clearly.
--
-- For THIS project, found on 2026-09-02 by trying each region's shared pooler until one accepted the
-- tenant. The dashboard shows only the direct string and the pooler host is not derivable from it,
-- so it is written down here rather than looked up again:
--
--   host      aws-1-eu-west-1.pooler.supabase.com     (eu-west-1, Ireland — not London)
--   port      5432
--   user      foundry_studio.pzxdjfelojqvygcpnbvf
--   database  postgres
--
-- Verified through that host, not assumed: the role connects, RLS still binds it (scoped to arca it
-- sees only arca's rows; naming another venture by hand returns nothing), and writes are refused.
-- Pooling weakens none of it — which was the thing worth checking.
