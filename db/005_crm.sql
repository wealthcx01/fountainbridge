-- The Sell pipeline: the people a venture is talking to, and where each conversation stands (FB-234).
--
-- ## Why this lives in the database and not in git
--
-- Everything else the studio keeps in Postgres is a copy of something git already holds. This is not,
-- and that is deliberate. John ruled on it on 2026-10-01, and the reasons are written in FB-234:
--
--   * **A person can ask to be forgotten.** Here that is one `delete`. In git it is rewriting history
--     in every clone, which is not something anyone can promise. That is the deciding reason.
--   * **Contacts and deals are not work items.** FB-170's rule — nothing treats the database as
--     authoritative over git — is about tickets, which a founder must be able to take with them. No
--     lane has ever written a contact to git, so there is nothing here for the database to compete with.
--   * **One database, not two.** `crm.cli` would have brought its own SQLite file with no row-level
--     policy. These tables get the isolation every other table here already has.
--
-- ## Isolation is enforced here, by the same rule as 001
--
-- Every table carries `venture_id`. Row-level security is enabled AND forced, and every policy compares
-- `venture_id` with the per-transaction `app.venture_id` that `withVenture` (lib/db.ts) sets. A
-- connection that names no venture sees nothing. Each policy also has a `with check`, so a row cannot
-- be WRITTEN into another venture's pipeline either — reading is not the only way to cross over.
--
-- ## And links cannot cross ventures
--
-- A deal points at a contact; an activity points at a contact and maybe a deal. If those links were
-- plain `id` references, a bug could attach ARCA's deal to the-reset's contact, and the policy above
-- would happily hide half of the result rather than refuse it. So every link is a pair —
-- `(venture_id, contact_id)` — referencing the pair on the other table. **The database refuses a link
-- to another venture's row**, whatever the application does.
--
-- Needs PostgreSQL 15 or later for `on delete set null (column)`. Supabase and PGlite both are.

create table if not exists crm_companies (
  venture_id  text not null references ventures(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  website     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (venture_id, id)
);

create table if not exists crm_contacts (
  venture_id  text not null references ventures(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  email       text,
  title       text,
  company_id  uuid,
  -- How warm the conversation is, as the founder or the Sell lane judges it. Three values, because a
  -- founder reads it at a glance and a scale of ten is a number nobody sets the same way twice.
  temperature text not null default 'cold' check (temperature in ('cold', 'warm', 'hot')),
  -- "Not now": taken off the founder's list on purpose until this time, rather than left to go stale
  -- on it. Null means not snoozed.
  snoozed_until timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (venture_id, id),
  -- Losing a company does not lose the person who worked there.
  foreign key (venture_id, company_id)
    references crm_companies (venture_id, id) on delete set null (company_id)
);

-- One conversation that could end in a sale.
--
-- The stages are FB-235's, in order. `won` and `lost` are end states ON the pipeline, because a sale
-- needs somewhere to finish — a pipeline whose rows can never leave it only ever grows.
create table if not exists crm_deals (
  venture_id  text not null references ventures(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  title       text not null check (length(btrim(title)) > 0),
  contact_id  uuid,
  company_id  uuid,
  stage       text not null default 'added'
    check (stage in ('added', 'contacted', 'meeting', 'proposal', 'follow_up', 'won', 'lost')),
  -- Money in minor units (pence, cents), with its currency. Both or neither: an amount with no
  -- currency is a number nobody can read, and the summary refuses to add it up.
  value_minor bigint check (value_minor is null or value_minor >= 0),
  currency    text check (currency is null or currency ~ '^[A-Z]{3}$'),
  -- The chance this closes, as a whole percentage. Optional, because a guess the founder never made is
  -- worse than a blank — the summary says what it needs rather than inventing one.
  probability smallint check (probability is null or probability between 0 and 100),
  -- What has to happen next, and by when. A date rather than a time: "follow up Thursday".
  next_step     text,
  next_step_due date,
  stage_changed_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (venture_id, id),
  constraint crm_deals_value_has_currency check ((value_minor is null) = (currency is null)),
  foreign key (venture_id, contact_id)
    references crm_contacts (venture_id, id) on delete set null (contact_id),
  foreign key (venture_id, company_id)
    references crm_companies (venture_id, id) on delete set null (company_id)
);

-- What happened with a person: a message in, a message out, a call, a meeting, a note.
--
-- **Recording that a message went is not sending one.** Nothing in this schema, and nothing that reads
-- it, sends anything. A send is an external action and waits on a recorded approval (non-negotiable 4);
-- the Sell lane writes an `email_out` row only after that approval has been carried out.
create table if not exists crm_activities (
  venture_id  text not null references ventures(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  contact_id  uuid not null,
  deal_id     uuid,
  kind        text not null check (kind in ('email_in', 'email_out', 'call', 'meeting', 'note')),
  -- One line on what was said or done, in plain words. Not the whole message: the message stays in the
  -- mailbox it arrived in, and this is the pointer a founder reads.
  summary     text not null check (length(btrim(summary)) > 0),
  occurred_at timestamptz not null,
  -- A message from them that the founder has not answered yet. Only meaningful on `email_in`.
  awaiting_reply boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (venture_id, id),
  constraint crm_activities_reply_is_inbound check (not awaiting_reply or kind = 'email_in'),
  -- "Forget me" removes what they said as well as who they are.
  foreign key (venture_id, contact_id)
    references crm_contacts (venture_id, id) on delete cascade,
  foreign key (venture_id, deal_id)
    references crm_deals (venture_id, id) on delete set null (deal_id)
);

-- The pipeline's reads: every open deal for a venture by stage, and each person's latest activity.
create index if not exists crm_deals_by_stage on crm_deals (venture_id, stage);
create index if not exists crm_activities_latest on crm_activities (venture_id, contact_id, occurred_at desc);

alter table crm_companies  enable row level security;
alter table crm_contacts   enable row level security;
alter table crm_deals      enable row level security;
alter table crm_activities enable row level security;
-- FORCE, for the reason 001 gives: without it the table owner bypasses every policy below.
alter table crm_companies  force row level security;
alter table crm_contacts   force row level security;
alter table crm_deals      force row level security;
alter table crm_activities force row level security;

create policy crm_companies_scoped on crm_companies
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));
create policy crm_contacts_scoped on crm_contacts
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));
create policy crm_deals_scoped on crm_deals
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));
create policy crm_activities_scoped on crm_activities
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- ## What the studio's role may do here, and why it is more than 001 allows
--
-- 001 made `foundry_studio` read-only because everything it read was a copy of git. This is not a copy:
-- it is the record. So the studio may add and change rows, and it may DELETE them — because deleting a
-- person is the whole reason this is a database. A role that could not delete could not honour
-- "forget me", which would make the store worse than git at the one thing it was chosen for.
--
-- Every one of those writes is still bound by the policies above, to one venture at a time.
grant select, insert, update, delete on crm_companies, crm_contacts, crm_deals, crm_activities
  to foundry_studio;
