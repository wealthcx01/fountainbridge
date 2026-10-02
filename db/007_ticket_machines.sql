-- Temporary ticket machines: who may spend, what has been spent, and which machines exist (FB-239).
--
-- John ruled on 2026-10-02 that only the studio creates ticket machines, on Railway, and only for a
-- venture with a monthly budget he has approved. This is where the studio keeps the three facts that
-- ruling needs:
--
--   `machinestore.budget_proposals` — each monthly budget someone at Bruntsfield proposed, and
--                                     whether the budget approver approved it.
--   `machinestore.budgets` — each monthly budget the budget approver approved, with the studio's
--                            signature over it.
--   `machinestore.spend`   — how much each venture's machines may have cost so far this month.
--   `machinestore.runs`    — each machine the studio made: for which ticket, until when, and how it ended.
--
--   `machinestore` — a store. Derived from nothing. **Never drop this.** Losing `spend` resets the
--   month's count, which would let a venture spend its budget twice; losing `runs` hides machines the
--   clean-up job still needs to find (it also asks the provider, so a lost row cannot leak a machine
--   for long, but it should not have to).
--
-- ## Who can read it
--
-- The studio, scoped to one venture at a time by the same forced row-level security as every other
-- table here. A connection scoped to one venture can neither read nor spend another venture's budget,
-- and cannot see another venture's machines (CLAUDE.md #6, D1 as amended by D11). Proven against
-- real Postgres in `lib/__tests__/ticket-machines.test.ts`.
--
-- No foreign key to `ventures`, for 003's reason: a rebuild of the read model must not cascade into
-- a record of money.

create schema if not exists machinestore;

-- One row per proposed budget. Anyone at Bruntsfield may propose an amount for a venture; only the
-- budget approver (BUDGET_APPROVER_EMAIL, John) may approve it, signed in with Google on the studio's
-- budget page (`app/actions/machine-budget.ts`). `decision` is empty until then.
create table if not exists machinestore.budget_proposals (
  venture_id       text not null,
  proposal_id      text not null check (proposal_id ~ '^[a-f0-9]{16}$'),
  monthly_cents    integer not null check (monthly_cents >= 0 and monthly_cents <= 1000000),
  proposed_by      text not null,
  proposed_at      timestamptz not null,
  decision         text check (decision in ('granted')),
  decided_by       text,
  decided_at       timestamptz,
  primary key (venture_id, proposal_id)
);

-- One row per approval. A new amount is a new row; the newest row for a venture is the one in force.
-- Rows are never edited or deleted, so the history of who approved what stays readable. Setting the
-- amount to zero is how a budget is withdrawn.
--
-- A row counts only when it names a proposal that was approved for the same amount (the join in
-- `latestBudget`, lib/machine-store.ts) and its signature verifies. The studio's budget page is the
-- only code that writes one.
create table if not exists machinestore.budgets (
  venture_id       text not null,
  proposal_id      text not null,
  monthly_cents    integer not null check (monthly_cents >= 0 and monthly_cents <= 1000000),
  approver         text not null,
  approved_at      timestamptz not null,
  -- The HMAC from `machineBudgetAttestationFor` in lib/approval-attestation.ts. A row without a
  -- signature that verifies is ignored, so a row written by anything that does not hold the
  -- approval secret is worth nothing.
  attestation      text not null check (attestation ~ '^[0-9a-f]{64}$'),
  primary key (venture_id, approved_at),
  unique (venture_id, proposal_id)
);

-- What this month's machines may have cost, in millionths of a US dollar. Railway bills in dollars.
-- A machine is counted at its worst case when it is made, and brought down to its real running time
-- when it is removed — so the number is never lower than the truth. A bigint, because the largest
-- budget allowed ($10,000 a month) is 10,000,000,000 millionths, past what an integer holds.
create table if not exists machinestore.spend (
  venture_id   text not null,
  month        date not null,
  micro_usd    bigint not null default 0 check (micro_usd >= 0),
  primary key (venture_id, month)
);

create table if not exists machinestore.runs (
  venture_id     text not null,
  run_id         text not null check (run_id ~ '^[a-f0-9]{16}$'),
  ticket_slug    text not null,
  ticket_path    text not null,
  repo           text not null,
  provider       text not null,
  -- What the provider needs to find and remove the machine. Ids only, never a credential.
  machine        jsonb,
  -- What the worker is given when it asks for its work (non-secret settings only; credentials are
  -- looked up again at that moment and never stored here).
  settings       jsonb not null default '{}'::jsonb,
  reserved_micro bigint not null check (reserved_micro >= 0),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  started_at     timestamptz,
  finished_at    timestamptz,
  destroyed_at   timestamptz,
  -- creating | made | started | finished | failed
  state          text not null default 'creating',
  exit_code      integer,
  stage          text,
  skills         text,
  sessions       text,
  summary        text,
  primary key (venture_id, run_id)
);

alter table machinestore.budget_proposals enable row level security;
alter table machinestore.budgets enable row level security;
alter table machinestore.spend   enable row level security;
alter table machinestore.runs    enable row level security;
-- FORCE, for 001's reason: without it the table owner bypasses the policy.
alter table machinestore.budget_proposals force row level security;
alter table machinestore.budgets force row level security;
alter table machinestore.spend   force row level security;
alter table machinestore.runs    force row level security;

create policy budget_proposals_scoped on machinestore.budget_proposals
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));
create policy budgets_scoped on machinestore.budgets
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));
create policy spend_scoped on machinestore.spend
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));
create policy runs_scoped on machinestore.runs
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- Proposals: add one, read them, and record the decision on one (only the decision columns).
-- Budgets: add one, read them. Never rewrite or remove one — an approval that can be edited is not a
-- record of what was approved.
-- Spend: read and add to. Never remove — a count that can be wiped is not a limit.
-- Runs: the studio records and updates its own machines; it never deletes the record of one.
grant usage on schema machinestore to foundry_studio;
grant select, insert on machinestore.budget_proposals to foundry_studio;
grant update (decision, decided_by, decided_at) on machinestore.budget_proposals to foundry_studio;
grant select, insert on machinestore.budgets to foundry_studio;
grant select, insert, update on machinestore.spend to foundry_studio;
grant select, insert, update on machinestore.runs to foundry_studio;
