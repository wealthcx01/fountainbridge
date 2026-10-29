-- The presses on the factory's cards (FB-276).
--
-- A press is a button pressed on a card in the studio: Stop, Send back, Accept, Approve, Reject,
-- Try again or Split it. The studio checks who pressed and keeps the press here. It never calls
-- Archon or GitHub for a factory card. The planning box collects the press through its door
-- (`POST /api/factory`, kind `collect`, the format in `docs/factory-cards.md`), runs it through the
-- same code as a tap on Telegram, and sends back what happened (kind `press-result`). A tap made on
-- Telegram is reported the same way (kind `answered-elsewhere`) and kept here as a row of its own,
-- so the studio's card shows it too.
--
--   `factorystore.presses` — one row per press. Never deleted by the studio: it is the record of
--                            who decided what.
--
-- ## Who can read it
--
-- The same forced row-level security as `cards`: a connection scoped to one venture cannot read,
-- add or change another venture's presses (CLAUDE.md #6). Proven against real Postgres in
-- `lib/__tests__/press-store.test.ts`.
--
-- The box collects across every venture, but nothing here opens a way around that rule. The door
-- asks each venture in the manifests in turn, each inside its own scope (`withVenture`), and puts
-- the answers together itself. So there is no setting, role or function that sees two ventures'
-- presses at once, and a connection scoped to no venture still sees none.
--
-- ## Who may press what (PRD, "Who may press what")
--
-- A founder may press Stop, Send back and Accept. Accept is their sign-off and settles nothing.
-- Only John may Approve, Reject, Try again and Split it. The studio checks this before it writes
-- anything (`lib/press.ts`); `presses_john_only` below is the second wall, so a founder's Approve
-- cannot be written even by a fault in that code. `by_john` is set by the studio's server from
-- `STUDIO_ADMIN_EMAILS`, never by what a browser sends.
--
-- ## The first press wins
--
-- Every press but a sign-off settles the card. Once one stands (not answered yet, or answered
-- "done"), every later one is out of date. `lib/press.ts` locks the card's row while it checks, and
-- `presses_one_standing` makes a second standing press impossible to write even if two arrive at
-- the same moment. A press the box answered "out-of-date" or "refused" did nothing, so it no longer
-- stands. Presses are counted per version of the work (`seen_head_sha`): when the factory sends a
-- new version of the card, it needs a new decision.
--
-- Written so that loading it twice changes nothing.

create table if not exists factorystore.presses (
  -- What the box names the press by when it answers.
  id             uuid primary key default gen_random_uuid(),
  -- The order presses were written in, for two made in the same instant. Never shown.
  seq            bigint generated always as identity,
  venture_id     text not null,
  repo           text not null,
  number         integer not null,
  action         text not null check (action in ('stop', 'send-back', 'accept', 'approve', 'reject', 'try-again', 'split')),
  -- The address the presser signed in with, in lower case. For a tap on Telegram, John's.
  by_email       text not null check (length(by_email) between 1 and 320),
  -- Whether the presser is John (`STUDIO_ADMIN_EMAILS`). Set by the studio's server only.
  by_john        boolean not null,
  -- `studio` for a press made here; `telegram` for one the box reports from Telegram.
  source         text not null default 'studio' check (source in ('studio', 'telegram')),
  -- Send back's note, or the notes that went with an Accept. Pins name their picture and their spot
  -- ("1. On the "after" picture, on a phone, 82% across and 41% down: ...", `noteFrom`).
  note           text not null default '' check (length(note) <= 4000),
  -- The version of the work the presser was shown: the card's `head_sha` when they pressed.
  seen_head_sha  text not null default '',
  pressed_at     timestamptz not null default now(),
  -- When the box collected it. Empty until then.
  collected_at   timestamptz,
  -- The box's answer: what happened, a sentence saying so, and when.
  outcome        text check (outcome in ('done', 'out-of-date', 'refused')),
  message        text check (length(message) <= 1000),
  answered_at    timestamptz,
  foreign key (venture_id, repo, number) references factorystore.cards (venture_id, repo, number) on delete cascade,
  constraint presses_john_only check (by_john or action in ('stop', 'send-back', 'accept')),
  -- A sign-off is a founder's. John's Accept is his Approve.
  constraint presses_signoff_is_founders check (not (by_john and action = 'accept')),
  -- An answer is all three parts or none of them.
  constraint presses_answer_whole check (
    (outcome is null and message is null and answered_at is null)
    or (outcome is not null and message is not null and answered_at is not null)
  ),
  -- A tap on Telegram is John's, and arrives already done or not done: the box has nothing to collect.
  constraint presses_telegram_answered check (source = 'studio' or (by_john and collected_at is not null and outcome is not null))
);

-- The first press wins: one standing press per version of a card. A Telegram tap is not counted
-- here, because it is reported after Archon acted, and a studio press made before the box heard of
-- it must still be kept so the box can answer it "out-of-date".
create unique index if not exists presses_one_standing
  on factorystore.presses (venture_id, repo, number, seen_head_sha)
  where source = 'studio' and action <> 'accept' and (outcome is null or outcome = 'done');

-- A founder signs off a version once.
create unique index if not exists presses_one_signoff
  on factorystore.presses (venture_id, repo, number, seen_head_sha, by_email)
  where action = 'accept';

-- The same tap on Telegram, reported twice, is one row.
create unique index if not exists presses_telegram_once
  on factorystore.presses (venture_id, repo, number, action, pressed_at)
  where source = 'telegram';

-- What the box has not collected yet, oldest first.
create index if not exists presses_waiting
  on factorystore.presses (pressed_at)
  where collected_at is null;

alter table factorystore.presses enable row level security;
-- FORCE, for 001's reason: without it the table owner bypasses the policy.
alter table factorystore.presses force row level security;

drop policy if exists presses_scoped on factorystore.presses;
create policy presses_scoped on factorystore.presses
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- Add a press and read them. Change only what the box adds later: when it collected the press, and
-- its answer. Never who pressed, what, or when; never delete one.
grant select, insert on factorystore.presses to foundry_studio;
grant update (collected_at, outcome, message, answered_at) on factorystore.presses to foundry_studio;
