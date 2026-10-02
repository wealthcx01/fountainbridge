-- How many seconds of voice notes each venture has had transcribed today (FB-173).
--
-- John, 2026-10-02: voice transcription is paid per minute and gets a daily cap. This is the count
-- the cap is checked against. It holds a number per venture per day and nothing else — never a
-- recording, never a transcript — so the studio still keeps nothing a founder said.
--
--   `voicestore` — a store. Derived from nothing; losing it only resets today's count.
--
-- Scoped to one venture at a time by the same row-level security as every other table here, so one
-- venture's notes can never use up another's allowance (CLAUDE.md #6). Proven against real Postgres
-- in `lib/__tests__/voice-cap.test.ts`.

create schema if not exists voicestore;

create table if not exists voicestore.usage (
  venture_id  text not null,
  day         date not null,
  seconds     integer not null default 0 check (seconds >= 0),
  primary key (venture_id, day)
);

alter table voicestore.usage enable row level security;
-- FORCE, for 001's reason: without it the table owner bypasses the policy.
alter table voicestore.usage force row level security;

create policy usage_scoped on voicestore.usage
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- The studio may read today's count and add to it. It may not delete one: a count that can be wiped
-- is not a limit.
grant usage on schema voicestore to foundry_studio;
grant select, insert, update on voicestore.usage to foundry_studio;
