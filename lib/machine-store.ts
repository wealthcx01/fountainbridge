/**
 * The studio's record of ticket machines: budgets, spend and runs (FB-239, `db/007_ticket_machines.sql`).
 *
 * Every function here takes a connection already scoped to one venture (`withVenture`), so each one
 * can only ever see and change that venture's rows — the database enforces it, not this file.
 */
import type { BudgetRow, RunSettings } from './ticket-machines';

/** The one method these functions need. `pg`'s client and PGlite both have it. */
export interface Querier {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * The budget in force: the newest one recorded. Null when there is none, or when the newest one
 * does not name a proposal that was approved for the same amount — a budget row written by anything
 * but the studio's budget page has no such proposal behind it, and counts for nothing.
 */
export async function latestBudget(q: Querier): Promise<BudgetRow | null> {
  const { rows } = await q.query<BudgetRow & { proposal_ok: boolean }>(
    `select b.venture_id, b.proposal_id, b.monthly_cents, b.approver, b.approved_at, b.attestation,
            (p.proposal_id is not null) as proposal_ok
       from machinestore.budgets b
       left join machinestore.budget_proposals p
         on p.venture_id = b.venture_id and p.proposal_id = b.proposal_id
        and p.decision = 'granted' and p.monthly_cents = b.monthly_cents
       order by b.approved_at desc limit 1`,
  );
  const row = rows[0];
  if (!row || !row.proposal_ok) return null;
  const { proposal_ok: _ok, ...budget } = row;
  return budget;
}

export async function recordBudget(q: Querier, row: BudgetRow): Promise<void> {
  await q.query(
    'insert into machinestore.budgets (venture_id, proposal_id, monthly_cents, approver, approved_at, attestation) values ($1, $2, $3, $4, $5, $6)',
    [row.venture_id, row.proposal_id, row.monthly_cents, row.approver, row.approved_at, row.attestation],
  );
}

export interface ProposalRow {
  venture_id: string;
  proposal_id: string;
  monthly_cents: number;
  proposed_by: string;
  proposed_at: Date;
  decision: 'granted' | null;
  decided_by: string | null;
  decided_at: Date | null;
}

export async function recordProposal(q: Querier, row: Pick<ProposalRow, 'venture_id' | 'proposal_id' | 'monthly_cents' | 'proposed_by' | 'proposed_at'>): Promise<void> {
  await q.query(
    'insert into machinestore.budget_proposals (venture_id, proposal_id, monthly_cents, proposed_by, proposed_at) values ($1, $2, $3, $4, $5)',
    [row.venture_id, row.proposal_id, row.monthly_cents, row.proposed_by, row.proposed_at.toISOString()],
  );
}

export async function getProposal(q: Querier, proposalId: string): Promise<ProposalRow | null> {
  const { rows } = await q.query<ProposalRow>('select * from machinestore.budget_proposals where proposal_id = $1', [proposalId]);
  return rows[0] ? normaliseProposal(rows[0]) : null;
}

/** Proposals nobody has approved yet, newest first. */
export async function openProposals(q: Querier): Promise<ProposalRow[]> {
  const { rows } = await q.query<ProposalRow>('select * from machinestore.budget_proposals where decision is null order by proposed_at desc');
  return rows.map(normaliseProposal);
}

/**
 * Mark a proposal approved, once. Returns false when it was already decided, so two clicks — or two
 * tabs — cannot record two budgets from one proposal.
 */
export async function decideProposal(q: Querier, proposalId: string, by: string, at: Date): Promise<boolean> {
  const { rows } = await q.query<{ proposal_id: string }>(
    `update machinestore.budget_proposals set decision = 'granted', decided_by = $2, decided_at = $3
       where proposal_id = $1 and decision is null returning proposal_id`,
    [proposalId, by, at.toISOString()],
  );
  return rows.length === 1;
}

function normaliseProposal(r: ProposalRow): ProposalRow {
  return {
    ...r,
    monthly_cents: Number(r.monthly_cents),
    proposed_at: new Date(r.proposed_at),
    decided_at: r.decided_at ? new Date(r.decided_at) : null,
  };
}

export async function spentIn(q: Querier, month: string): Promise<number> {
  const { rows } = await q.query<{ micro_usd: number }>('select micro_usd from machinestore.spend where month = $1', [month]);
  return Number(rows[0]?.micro_usd ?? 0);
}

/**
 * Count a machine against the month before it is made. Locks the venture's row for the month, so two
 * requests at once cannot both squeeze under the cap. Returns false, and changes nothing, when one
 * more would pass it.
 */
export async function reserve(q: Querier, ventureId: string, month: string, microUsd: number, capMicroUsd: number): Promise<boolean> {
  await q.query(
    'insert into machinestore.spend (venture_id, month, micro_usd) values ($1, $2, 0) on conflict (venture_id, month) do nothing',
    [ventureId, month],
  );
  const { rows } = await q.query<{ micro_usd: number }>(
    'select micro_usd from machinestore.spend where month = $1 for update',
    [month],
  );
  const spent = Number(rows[0]?.micro_usd ?? 0);
  if (spent + microUsd > capMicroUsd) return false;
  await q.query('update machinestore.spend set micro_usd = micro_usd + $2 where month = $1', [month, microUsd]);
  return true;
}

/** Correct a month's count once a machine's real running time is known. Never below zero. */
export async function adjust(q: Querier, month: string, deltaMicroUsd: number): Promise<void> {
  await q.query('update machinestore.spend set micro_usd = greatest(0, micro_usd + $2) where month = $1', [month, deltaMicroUsd]);
}

export interface RunRow {
  venture_id: string;
  run_id: string;
  ticket_slug: string;
  ticket_path: string;
  repo: string;
  provider: string;
  machine: { id: string; name: string; ref: Record<string, string> } | null;
  settings: RunSettings;
  reserved_micro: number;
  created_at: Date;
  expires_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  destroyed_at: Date | null;
  state: 'creating' | 'made' | 'started' | 'finished' | 'failed';
  exit_code: number | null;
  stage: string | null;
  skills: string | null;
  sessions: string | null;
  summary: string | null;
}

export async function insertRun(q: Querier, r: {
  ventureId: string; runId: string; settings: RunSettings; provider: string; reservedMicro: number; createdAt: Date; expiresAt: Date;
}): Promise<void> {
  await q.query(
    `insert into machinestore.runs (venture_id, run_id, ticket_slug, ticket_path, repo, provider, settings, reserved_micro, created_at, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [r.ventureId, r.runId, r.settings.slug, r.settings.ticketPath, r.settings.repo, r.provider, JSON.stringify(r.settings),
      r.reservedMicro, r.createdAt.toISOString(), r.expiresAt.toISOString()],
  );
}

export async function getRun(q: Querier, runId: string): Promise<RunRow | null> {
  const { rows } = await q.query<RunRow>('select * from machinestore.runs where run_id = $1', [runId]);
  return rows[0] ? normalise(rows[0]) : null;
}

/** Every machine of this venture's that has not been removed yet. */
export async function liveRuns(q: Querier): Promise<RunRow[]> {
  const { rows } = await q.query<RunRow>('select * from machinestore.runs where destroyed_at is null order by created_at');
  return rows.map(normalise);
}

const COLUMNS = new Set(['machine', 'state', 'started_at', 'finished_at', 'destroyed_at', 'exit_code', 'stage', 'skills', 'sessions', 'summary']);

/** Update named columns of one run. Column names come from this list only, never from a caller's data. */
export async function updateRun(q: Querier, runId: string, patch: Partial<Record<string, unknown>>): Promise<void> {
  const keys = Object.keys(patch).filter((k) => COLUMNS.has(k));
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => {
    const v = patch[k];
    if (k === 'machine') return v === null ? null : JSON.stringify(v);
    return v instanceof Date ? v.toISOString() : v;
  });
  await q.query(`update machinestore.runs set ${sets} where run_id = $1`, [runId, ...values]);
}

/**
 * Mark a run started, once. Returns false when it was already started — a run token is good for
 * collecting the work exactly one time.
 *
 * `creating` is accepted as well as `made`: a machine can boot and ask for its work before the
 * provider's reply reaches the studio, and refusing it then would fail a run that is fine.
 */
export async function claimStart(q: Querier, runId: string, at: Date): Promise<boolean> {
  const { rows } = await q.query<{ run_id: string }>(
    `update machinestore.runs set started_at = $2, state = 'started'
       where run_id = $1 and started_at is null and state in ('creating', 'made') returning run_id`,
    [runId, at.toISOString()],
  );
  return rows.length === 1;
}

/**
 * Record the provider's answer: which machine this run has. The state moves to `made` only if the
 * machine has not already started (see `claimStart`) or ended, so a fast machine is not set back.
 */
export async function recordMade(q: Querier, runId: string, machine: { id: string; name: string; ref: Record<string, string> }): Promise<void> {
  await q.query(
    `update machinestore.runs set machine = $2,
            state = case when state = 'creating' then 'made' else state end
       where run_id = $1`,
    [runId, JSON.stringify(machine)],
  );
}

/**
 * Record that a run's machine has been removed. Returns true only for the caller that recorded it
 * first. Three things can remove a machine at about the same time — the studio after a run ends, the
 * lane's status check, and the clean-up job — and only the first may give the unused money back to
 * the month, or the month's count falls below the real bill.
 */
export async function markDestroyed(q: Querier, runId: string, at: Date): Promise<boolean> {
  const { rows } = await q.query<{ run_id: string }>(
    'update machinestore.runs set destroyed_at = $2 where run_id = $1 and destroyed_at is null returning run_id',
    [runId, at.toISOString()],
  );
  return rows.length === 1;
}

function normalise(r: RunRow): RunRow {
  const date = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string));
  const json = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;
  return {
    ...r,
    machine: r.machine === null ? null : json(r.machine),
    settings: json(r.settings),
    reserved_micro: Number(r.reserved_micro),
    created_at: date(r.created_at) as Date,
    expires_at: date(r.expires_at) as Date,
    started_at: date(r.started_at),
    finished_at: date(r.finished_at),
    destroyed_at: date(r.destroyed_at),
  };
}
