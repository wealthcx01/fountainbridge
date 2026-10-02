import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { ActiveGraphEvent } from '../activegraph';
import { approveBudget, budgetOverview, parseDollars, proposeBudget, type BudgetDeps } from '../machine-budget';
import { latestBudget, openProposals, type Querier } from '../machine-store';
import { budgetApprover, verifyBudget } from '../ticket-machines';
import type { VentureSummary } from '../ventures';

/**
 * Who may propose and who may approve a monthly budget for temporary machines (FB-239).
 *
 * John ruled on 2026-10-02 that he approves each venture's monthly budget once. After review, the
 * command-line path that signed a budget with any approver typed in was removed: a budget is now
 * proposed and approved on the studio's budget page, signed in with Google, and only the address in
 * BUDGET_APPROVER_EMAIL may approve. These tests drive the rules with real Postgres (the studio's own
 * role, row-level security on) and a stand-in for the ActiveGraph record.
 */
const SQL = ['001_read_model.sql', '007_ticket_machines.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

const JOHN = 'john@bruntsfield.capital';
const OPS = 'ops@bruntsfield.capital';
const FOUNDER = 'founder@arca.example';
const T0 = Date.parse('2026-10-02T09:00:00Z');

const VENTURES = [
  { id: 'arca', name: 'ARCA', repos: ['arca'], departments: [] },
  { id: 'the-reset', name: 'THE RESET', repos: ['the-reset'], departments: [] },
] as unknown as VentureSummary[];

let db: PGlite;
let events: Array<Omit<ActiveGraphEvent, 'attestation'>>;
let recordFails: string | null;
let ids: string[];
let deps: BudgetDeps;

async function as<T>(v: string, fn: (q: Querier) => Promise<T>): Promise<T> {
  await db.exec('begin');
  await db.query('select set_config($1, $2, true)', ['app.venture_id', v]);
  try {
    const out = await fn(db as unknown as Querier);
    await db.exec('commit');
    return out;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

beforeEach(async () => {
  db = await PGlite.create();
  await db.exec(SQL);
  await db.exec('set role foundry_studio');
  events = [];
  recordFails = null;
  ids = ['00000000000000a1', '00000000000000a2', '00000000000000a3'];
  deps = {
    env: { STUDIO_ADMIN_EMAILS: `${JOHN}, ${OPS}`, BUDGET_APPROVER_EMAIL: JOHN, FOUNDRY_APPROVAL_SECRET: 'the-approval-secret' },
    ventures: VENTURES,
    withVenture: as,
    record: async (event) => {
      if (recordFails) return { ok: false, reason: recordFails };
      events.push(event);
      return { ok: true };
    },
    now: () => T0,
    newId: () => ids.shift()!,
  };
});

const inForce = async (v: string) =>
  verifyBudget(await as(v, (q) => latestBudget(q)), v, deps.env.FOUNDRY_APPROVAL_SECRET, budgetApprover(deps.env));

describe('proposing a budget', () => {
  it('anyone at Bruntsfield may propose; it is stored and recorded as approval.proposed, and does not count yet', async () => {
    const r = await proposeBudget(deps, OPS, 'arca', '40');
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/\$40\.00 a month for ARCA.*once john@bruntsfield\.capital approves/) });
    expect(await as('arca', (q) => openProposals(q))).toMatchObject([{ proposal_id: '00000000000000a1', monthly_cents: 4000, proposed_by: OPS }]);
    expect(events).toEqual([expect.objectContaining({
      seq: 1, type: 'approval.proposed', venture: 'arca', repo: 'arca', id: 'machine-budget-00000000000000a1',
      actor: { kind: 'human', id: OPS }, data: { kind: 'machine-budget', monthly_cents: '4000' },
    })]);
    expect((await inForce('arca')).ok).toBe(false);
  });

  it('a founder cannot propose one', async () => {
    const r = await proposeBudget(deps, FOUNDER, 'arca', '40');
    expect(r.ok).toBe(false);
    expect(await as('arca', (q) => openProposals(q))).toEqual([]);
    expect(events).toEqual([]);
  });

  it('when the record cannot be written, nothing is proposed', async () => {
    recordFails = 'the record could not be written to GitHub';
    const r = await proposeBudget(deps, OPS, 'arca', '40');
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/nothing was proposed/) });
    expect(await as('arca', (q) => openProposals(q))).toEqual([]);
  });

  it('reads amounts the way a person types them, up to $10,000', () => {
    expect(parseDollars('40')).toBe(4000);
    expect(parseDollars('$37.50')).toBe(3750);
    expect(parseDollars('0')).toBe(0);
    expect(parseDollars('10000')).toBe(1_000_000);
    expect(parseDollars('10000.01')).toBeNull();
    expect(parseDollars('forty')).toBeNull();
    expect(parseDollars('-5')).toBeNull();
  });
});

describe('approving a budget', () => {
  beforeEach(async () => {
    expect((await proposeBudget(deps, OPS, 'arca', '40')).ok).toBe(true);
  });

  it('the budget approver approves it: it counts, and approval.granted follows approval.proposed', async () => {
    const r = await approveBudget(deps, JOHN, 'arca', '00000000000000a1');
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/Approved: \$40\.00 a month/) });
    expect(await inForce('arca')).toEqual({ ok: true, monthlyCents: 4000, approver: JOHN });
    expect(events.map((e) => [e.seq, e.type, e.actor.id])).toEqual([
      [1, 'approval.proposed', OPS],
      [2, 'approval.granted', JOHN],
    ]);
    expect(events[1]).toMatchObject({ id: 'machine-budget-00000000000000a1', venture: 'arca' });
    expect(await as('arca', (q) => openProposals(q))).toEqual([]);
  });

  it('another studio admin cannot approve it — being an admin is not enough', async () => {
    const r = await approveBudget(deps, OPS, 'arca', '00000000000000a1');
    expect(r).toMatchObject({ ok: false, message: `Only ${JOHN} can approve a budget for temporary machines.` });
    expect((await inForce('arca')).ok).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('the approver\'s address is compared without regard to case, as Google may send it', async () => {
    expect((await approveBudget(deps, 'John@Bruntsfield.Capital', 'arca', '00000000000000a1')).ok).toBe(true);
    expect((await inForce('arca')).ok).toBe(true);
  });

  it('with no budget approver set, nobody can approve', async () => {
    deps.env = { ...deps.env, BUDGET_APPROVER_EMAIL: '' };
    expect((await approveBudget(deps, JOHN, 'arca', '00000000000000a1')).message).toMatch(/no budget approver set/);
    expect((await inForce('arca')).ok).toBe(false);
  });

  it('when the record cannot be written, nothing is approved, and the proposal is still waiting', async () => {
    recordFails = 'the record could not be written to GitHub';
    const r = await approveBudget(deps, JOHN, 'arca', '00000000000000a1');
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/was not approved/) });
    expect((await inForce('arca')).ok).toBe(false);
    expect(await as('arca', (q) => openProposals(q))).toHaveLength(1);
  });

  it('a proposal is approved once', async () => {
    expect((await approveBudget(deps, JOHN, 'arca', '00000000000000a1')).ok).toBe(true);
    expect(await approveBudget(deps, JOHN, 'arca', '00000000000000a1')).toMatchObject({ ok: false, message: 'That proposal has already been approved.' });
  });

  it('a proposal for one venture cannot be approved as another\'s', async () => {
    expect(await approveBudget(deps, JOHN, 'the-reset', '00000000000000a1')).toMatchObject({ ok: false, message: 'That proposal no longer exists.' });
    expect((await inForce('the-reset')).ok).toBe(false);
  });

  it('the page shows the budget in force, the month\'s spend and what is waiting', async () => {
    await approveBudget(deps, JOHN, 'arca', '00000000000000a1');
    await proposeBudget(deps, OPS, 'arca', '60');
    const [arca, reset] = await budgetOverview(deps);
    expect(arca).toMatchObject({ ventureId: 'arca', inForce: { monthlyCents: 4000, approver: JOHN }, spentMicroUsd: 0 });
    expect(arca.open).toMatchObject([{ proposal_id: '00000000000000a2', monthly_cents: 6000 }]);
    expect(reset).toMatchObject({ ventureId: 'the-reset', inForce: null, open: [] });
  });
});
