-- The factory's cards, their pictures, and when the planning box last reported (FB-275).
--
-- The planning box sends these through the studio's door (`app/api/factory/route.ts`, the format in
-- `docs/factory-cards.md`):
--
--   `factorystore.cards`      — one card per pull request: where the work stands, the parts anyone
--                               may read, and the parts only John may read.
--   `factorystore.pictures`   — the before and after screenshots of that pull request, as bytes. They
--                               live here and nowhere else: never in git, because this repository is
--                               public, and never on the studio's disk.
--   `factorystore.heartbeats` — when the box last reported. It holds no venture's data.
--
--   `factorystore` — a store. The box sends a card again whenever it changes, so a lost row comes
--   back with the next one; but a lost picture does not, so **never drop this**.
--
-- ## Who can read it
--
-- Cards and pictures: the studio, scoped to one venture at a time by the same forced row-level
-- security as every other table here. A connection scoped to one venture cannot read, add or change
-- another venture's cards or pictures (CLAUDE.md #6). Proven against real Postgres in
-- `lib/__tests__/card-store.test.ts`.
--
-- The venture is never something the box says. The door works it out from the card's repository and
-- the manifests' `repos`, and writes it through the connection's own scope.
--
-- No foreign key to `ventures`, for 003's reason: a rebuild of the read model must not cascade into
-- a founder's pictures.
--
-- Written so that loading it twice changes nothing.

create schema if not exists factorystore;

create table if not exists factorystore.cards (
  venture_id   text not null,
  -- The repository as the manifests name it (`arca`), and the pull request's number in it.
  repo         text not null check (repo ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  number       integer not null check (number > 0),
  -- The box's own name for the run that made this card, if it gave one. For John and the box only.
  run_id       text check (run_id is null or length(run_id) <= 100),
  state        text not null check (state in ('finished', 'stuck', 'sent-back', 'done', 'failed', 'needs-you')),
  -- When the box made this version of the card. An older version never replaces a newer one.
  sent_at      timestamptz not null,
  received_at  timestamptz not null default now(),
  -- The version of the work the card is about. Pictures of any other version are removed.
  head_sha     text not null default '',
  -- The pull request's preview, already checked to be a preview address (`lib/preview-check.ts`).
  -- Opened again before it is drawn as a link.
  preview_url  text,
  -- The parts anyone looking at this venture may read: the names in `PLAIN_PARTS`, lib/review.ts.
  plain        jsonb not null,
  -- Everything else the card carried: costs, "What to do next", links to the run. John's alone.
  -- Never sent to a founder's browser (`reviewFor`, lib/review.ts).
  for_john     jsonb not null default '{}'::jsonb,
  primary key (venture_id, repo, number)
);

create table if not exists factorystore.pictures (
  venture_id   text not null,
  repo         text not null,
  number       integer not null,
  name         text not null check (name in ('before-computer', 'after-computer', 'before-phone', 'after-phone')),
  head_sha     text not null,
  width        integer not null check (width between 1 and 10000),
  height       integer not null check (height between 1 and 50000),
  taken_at     timestamptz not null,
  -- A PNG, checked by its first bytes at the door. At most 4 MB.
  bytes        bytea not null check (octet_length(bytes) between 1 and 4194304),
  received_at  timestamptz not null default now(),
  primary key (venture_id, repo, number, name),
  foreign key (venture_id, repo, number) references factorystore.cards (venture_id, repo, number) on delete cascade
);

-- One row per box. The time is the box's own, from its signed request; `received_at` is the studio's.
create table if not exists factorystore.heartbeats (
  box          text primary key check (box ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  reported_at  timestamptz not null,
  received_at  timestamptz not null default now()
);

alter table factorystore.cards      enable row level security;
alter table factorystore.pictures   enable row level security;
alter table factorystore.heartbeats enable row level security;
-- FORCE, for 001's reason: without it the table owner bypasses the policy.
alter table factorystore.cards      force row level security;
alter table factorystore.pictures   force row level security;
alter table factorystore.heartbeats force row level security;

drop policy if exists cards_scoped on factorystore.cards;
create policy cards_scoped on factorystore.cards
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

drop policy if exists pictures_scoped on factorystore.pictures;
create policy pictures_scoped on factorystore.pictures
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- The box's last report belongs to no venture, so no venture's scope is needed to read or write it.
-- Row-level security is still on, so the rule is written down here rather than left to a default.
drop policy if exists heartbeats_open on factorystore.heartbeats;
create policy heartbeats_open on factorystore.heartbeats
  using (true)
  with check (true);

-- Cards: add one, read them, and replace one with a newer version. Never delete one.
-- Pictures: add, read and replace one; delete the pictures of a version the card is no longer about.
-- Heartbeats: add and update the one row per box.
grant usage on schema factorystore to foundry_studio;
grant select, insert, update on factorystore.cards to foundry_studio;
grant select, insert, update, delete on factorystore.pictures to foundry_studio;
grant select, insert, update on factorystore.heartbeats to foundry_studio;
