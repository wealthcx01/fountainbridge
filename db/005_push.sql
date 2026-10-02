-- Where a founder's phone subscriptions live (FB-141).
--
-- ## Why this is its own schema, beside `docstore` and not in the read model
--
-- `001_read_model.sql` is a cache: every row there is derived from git and can be dropped and
-- rebuilt. A push subscription is derived from nothing. A phone hands it over once, when the founder
-- says yes, and if it is lost the founder silently stops being told they are the blocker — with
-- nothing on any screen saying so. So it gets 003's guarantee, said out loud:
--
--   `pushstore` — a store. Derived from nothing. **Never drop this.**
--
-- It is not venture repo content either (D8): a subscription is a per-device secret, and anything
-- committed to git is in its history forever.
--
-- ## Who can read it
--
-- The studio, scoped to one venture at a time by the same row-level security as every other table
-- here. A subscription saved under one venture can never be read while the connection is scoped to
-- another, so one venture's push can never be sent to a phone that only subscribed to a different
-- one (CLAUDE.md #6). Proven against real Postgres in `lib/__tests__/push-store.test.ts`.
--
-- No foreign key to `ventures`, for 003's reason: a rebuild of the read model must not cascade into
-- a founder's phone.

create schema if not exists pushstore;

-- One row per phone, per venture. The same phone subscribed to two ventures is two rows, and each is
-- only ever visible under its own venture.
create table if not exists pushstore.subscriptions (
  venture_id  text not null,
  -- Who said yes. Kept so an admin can see whose phone this is; never used to decide who is sent
  -- what — the venture scope does that.
  email       text not null,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  primary key (venture_id, endpoint),
  -- Checked here as well as in `lib/webpush.ts`: the server POSTs to this URL.
  constraint subscriptions_endpoint_is_https check (endpoint ~ '^https://')
);

-- What was waiting the last time the studio looked, per venture. This is what turns a count into a
-- TRANSITION: "zero last time, something now" is the one moment a phone buzzes. Without it every
-- check would be a first look, and a first look never buzzes.
create table if not exists pushstore.queue_watch (
  venture_id  text primary key,
  waiting     integer not null check (waiting >= 0),
  seen_at     timestamptz not null default now()
);

alter table pushstore.subscriptions enable row level security;
alter table pushstore.queue_watch   enable row level security;
-- FORCE, for 001's reason: without it the table owner bypasses the policy.
alter table pushstore.subscriptions force row level security;
alter table pushstore.queue_watch   force row level security;

create policy subscriptions_scoped on pushstore.subscriptions
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

create policy queue_watch_scoped on pushstore.queue_watch
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- The studio may add a phone, read the phones, and remove one — removing is how "turn it off" works,
-- and how a phone that has unsubscribed itself is cleared. It may not rewrite one.
grant usage on schema pushstore to foundry_studio;
grant select, insert, delete on pushstore.subscriptions to foundry_studio;
grant select, insert, update on pushstore.queue_watch to foundry_studio;
