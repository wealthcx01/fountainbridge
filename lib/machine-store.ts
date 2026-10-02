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

export async function latestBudget(q: Querier): Promise<BudgetRow | null> {
  const { rows } = await q.query<BudgetRow>(
    'select venture_id, monthly_cents, approver, approved_at, attestation from machinestore.budgets order by approved_at desc limit 1',
  );
  return rows[0] ?? null;
}

export async function recordBudget(q: Querier, row: BudgetRow): Promise<void> {
  await q.query(
    'insert into machinestore.budgets (venture_id, monthly_cents, approver, approved_at, attestation) values ($1, $2, $3, $4, $5)',
    [row.venture_id, row.monthly_cents, row.approver, row.approved_at, row.attestation],
  );
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
 */
export async function claimStart(q: Querier, runId: string, at: Date): Promise<boolean> {
  const { rows } = await q.query<{ run_id: string }>(
    `update machinestore.runs set started_at = $2, state = 'started'
       where run_id = $1 and started_at is null and state = 'made' returning run_id`,
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
