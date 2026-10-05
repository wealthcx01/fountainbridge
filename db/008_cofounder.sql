-- The cofounder's settings, and the switch that stops it everywhere (FB-201).
--
-- John asked for the limits on the studio's always-on cofounder to be "settings that I manage in the
-- admin view". These two tables are where the admin view keeps them.
--
--   `cofounder.settings` — one row each time someone changes a venture's settings. The newest row for
--                          a venture is the one in force. Rows are never edited or deleted, so who
--                          turned it on, and when, stays readable.
--   `cofounder.stops`    — one row each time someone presses the studio-wide stop or lifts it. The
--                          newest row decides. Same reason for keeping every row.
--
--   `cofounder` — a store. Derived from nothing. Losing it puts every venture back to the defaults,
--   which are OFF — so the worst a lost table can do is make the cofounder silent, never louder.
--
-- ## What is deliberately NOT here
--
-- Nothing in either table can let the cofounder send, spend, merge, deploy or approve. That floor is
-- in the code (`lib/cofounder.ts`, `FLOOR` and `mayCarryOut`) and has no switch. `settings` is read
-- through `normaliseSettings`, which drops any field it does not know, so a row that says
-- `"allowSending": true` is ignored rather than obeyed.
--
-- ## Who can read it
--
-- `settings` is scoped to one venture at a time by the same forced row-level security as every other
-- table here (CLAUDE.md #6). `stops` has no venture — it is one switch for the whole studio — so it
-- has no venture policy. It holds a yes or no, who pressed it and when; nothing about any venture.
-- Proven against real Postgres in `lib/__tests__/cofounder-store.test.ts`.

create schema if not exists cofounder;

create table if not exists cofounder.settings (
  venture_id  text not null,
  set_at      timestamptz not null,
  set_by      text not null,
  settings    jsonb not null,
  primary key (venture_id, set_at)
);

create table if not exists cofounder.stops (
  set_at      timestamptz not null primary key,
  set_by      text not null,
  stopped     boolean not null
);

alter table cofounder.settings enable row level security;
-- FORCE, for 001's reason: without it the table owner bypasses the policy.
alter table cofounder.settings force row level security;

create policy settings_scoped on cofounder.settings
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- Add a row and read rows. Never rewrite or remove one: a record of who changed a limit that can be
-- edited is not a record.
grant usage on schema cofounder to foundry_studio;
grant select, insert on cofounder.settings to foundry_studio;
grant select, insert on cofounder.stops to foundry_studio;
