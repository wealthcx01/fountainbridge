import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { attestationFor, machineBudgetAttestationFor, refusalAttestationFor } from '../approval-attestation';
import {
  BOOT_COMMAND, MACHINE, bootVariables, costForMicroUsd, dollars, finishSummary, laneKeyFor, machineName,
  microUsdPerMinute, monthOf, parseFinish, parseMachineRequest, reapKeyFor, runTokenFor, verifyBudget,
  workerEnv, worstCaseMicroUsd, type BudgetRow,
} from '../ticket-machines';
import {
  adjust, decideProposal, insertRun, latestBudget, markDestroyed, recordBudget, recordProposal, reserve, spentIn, type Querier,
} from '../machine-store';
import type { VentureSummary } from '../ventures';
// @ts-expect-error — a plain .mjs script with no type declarations
import { laneKey, reapKey } from '../../scripts/ticket-machines.mjs';

const ARCA = {
  id: 'arca', repos: ['arca'],
  departments: [
    { id: 'build', repo: 'arca', gate: 'pr' },
    { id: 'sell', repo: 'arca-sell', gate: 'activegraph' },
  ],
} as unknown as VentureSummary;

const P1 = '0123456789abcdef';
const JOHN = 'john@bruntsfield.capital';

describe('the keys John\'s script makes are the ones the studio checks', () => {
  it('lane keys and the reap key are identical in the studio and in scripts/ticket-machines.mjs', () => {
    expect(laneKeyFor('s'.repeat(32), 'arca')).toBe(laneKey('s'.repeat(32), 'arca'));
    expect(reapKeyFor('s'.repeat(32))).toBe(reapKey('s'.repeat(32)));
  });

  it('the script cannot approve a budget: that is done on the studio\'s budget page only', () => {
    let status = 0;
    let said = '';
    try {
      execFileSync('node', ['scripts/ticket-machines.mjs', 'approve-budget', 'arca', '40', JOHN], {
        env: { ...process.env, FOUNDRY_APPROVAL_SECRET: 's', DATABASE_URL: 'postgres://nowhere.invalid/x' }, stdio: 'pipe',
      });
    } catch (e) {
      status = (e as { status: number }).status;
      said = String((e as { stderr: Buffer }).stderr);
    }
    expect(status).toBe(2);
    expect(said).toMatch(/budget page/);
  });

  it('a budget signature binds its proposal, so it cannot be moved to another', () => {
    const a = machineBudgetAttestationFor('arca', P1, 4000, 'John@Bruntsfield.Capital', '2026-10-02T09:00:00.000Z', 'test-secret');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(machineBudgetAttestationFor('arca', P1, 4000, JOHN, '2026-10-02T09:00:00.000Z', 'test-secret'));
    expect(a).not.toBe(machineBudgetAttestationFor('arca', 'fedcba9876543210', 4000, JOHN, '2026-10-02T09:00:00.000Z', 'test-secret'));
  });

  it('a budget can never be read as an approval to send, or a refusal', () => {
    const budget = machineBudgetAttestationFor('arca', P1, 4000, 'j@x.com', 't', 's');
    expect(budget).not.toBe(attestationFor('arca', '4000', 't', 'j@x.com', 's'));
    expect(budget).not.toBe(refusalAttestationFor('arca', '4000', 't', 'j@x.com', 's', 't', ''));
  });

  it('a lane key and a run token are different things, per venture and per run', () => {
    const s = 'k'.repeat(40);
    expect(laneKeyFor(s, 'arca')).not.toBe(laneKeyFor(s, 'the-reset'));
    expect(runTokenFor(s, 'arca', 'aaaaaaaaaaaaaaa1')).not.toBe(runTokenFor(s, 'the-reset', 'aaaaaaaaaaaaaaa1'));
    expect(runTokenFor(s, 'arca', 'aaaaaaaaaaaaaaa1')).not.toBe(runTokenFor(s, 'arca', 'aaaaaaaaaaaaaaa2'));
  });

  it('only the budget approver\'s signed budget counts — not any admin, and not with no approver set', () => {
    const signed = (approver: string, cents = 3750): BudgetRow => ({
      venture_id: 'arca', proposal_id: P1, monthly_cents: cents, approver, approved_at: '2026-10-02T09:00:00.000Z',
      attestation: machineBudgetAttestationFor('arca', P1, cents, approver, '2026-10-02T09:00:00.000Z', 's'),
    });
    expect(verifyBudget(signed(JOHN), 'arca', 's', JOHN)).toEqual({ ok: true, monthlyCents: 3750, approver: JOHN });
    // Another admin, correctly signed: still not a budget, because only the approver may approve.
    expect(verifyBudget(signed('ops@bruntsfield.capital'), 'arca', 's', JOHN).ok).toBe(false);
    expect(verifyBudget(signed(JOHN), 'arca', 's', null).ok).toBe(false);
    expect(verifyBudget(signed(JOHN), 'arca', 'another-secret', JOHN).ok).toBe(false);
    expect(verifyBudget(signed(JOHN), 'the-reset', 's', JOHN).ok).toBe(false);
    expect(verifyBudget({ ...signed(JOHN), proposal_id: 'fedcba9876543210' }, 'arca', 's', JOHN).ok).toBe(false);
    expect(verifyBudget(signed(JOHN, 0), 'arca', 's', JOHN)).toMatchObject({ ok: false, reason: expect.stringMatching(/withdrawn/) });
  });
});

describe('what a machine costs', () => {
  it('uses Railway\'s published per-minute prices for 4 vCPU and 8 GB', () => {
    expect(microUsdPerMinute()).toBe(4 * 463 + 8 * 231);
    expect(dollars(worstCaseMicroUsd())).toBe('$0.59');
    expect(dollars(costForMicroUsd(0, 60 * 60_000))).toBe('$0.22');
  });

  it('charges whole started minutes, at least one', () => {
    expect(costForMicroUsd(0, 0)).toBe(microUsdPerMinute());
    expect(costForMicroUsd(0, 60_001)).toBe(2 * microUsdPerMinute());
  });

  it('months are UTC months', () => {
    expect(monthOf(Date.parse('2026-10-31T23:59:59Z'))).toBe('2026-10-01');
    expect(monthOf(Date.parse('2026-11-01T00:00:00Z'))).toBe('2026-11-01');
  });
});

describe('reading a lane\'s request, trusting none of it', () => {
  const good = { venture: 'arca', repo: 'arca', ticketPath: 'docs/tickets/ARCA-061-x.md', slug: 'ARCA-061-x' };
  const read = (patch: Record<string, unknown>) => parseMachineRequest({ ...good, ...patch }, ARCA, 'wealthcx01');

  it('accepts a ticket in one of the venture\'s own repositories', () => {
    expect(read({})).toMatchObject({ ok: true, req: { repo: 'wealthcx01/arca', gate: 'pr', department: 'build', baseBranch: 'main' } });
    expect(read({ repo: 'wealthcx01/arca-sell' })).toMatchObject({ ok: true, req: { department: 'sell', gate: 'activegraph' } });
  });

  it('takes the department and its gate from the manifest, never from the lane', () => {
    // A Sell ticket asked for as if it were ordinary engineering work: the manifest's gate wins.
    const r = read({ repo: 'arca-sell', department: 'sell', gate: 'pr', requireProposal: false });
    expect(r).toMatchObject({ ok: true, req: { department: 'sell', gate: 'activegraph', requireProposal: false } });
    expect(read({ repo: 'arca-sell', requireProposal: true })).toMatchObject({ ok: true, req: { gate: 'activegraph', requireProposal: true } });
    // In a `pr` department nothing stops at a proposal, whatever the lane says — as on the box.
    expect(read({ gate: 'activegraph', requireProposal: true })).toMatchObject({ ok: true, req: { gate: 'pr', requireProposal: false } });
  });

  it.each([
    ['another venture\'s repository', { repo: 'the-reset' }],
    ['a repository with the same name in another organisation', { repo: 'someone/arca' }],
    ['a path that climbs out of the ticket folder', { ticketPath: 'docs/tickets/../../etc/passwd.md', slug: '..' }],
    ['a file outside the ticket folder', { ticketPath: 'deploy/lane/run-once.sh', slug: 'run-once' }],
    ['a name that does not match its file', { slug: 'ARCA-999' }],
    ['a branch that climbs', { baseBranch: '../main' }],
    ['a branch with a space', { baseBranch: 'main; rm -rf /' }],
    ['a department that does not own the repository', { department: 'sell' }],
    ['a setting that is not a number', { tunables: { PLAN_TIMEOUT: '600; curl evil' } }],
    ['another venture named in the body', { venture: 'the-reset' }],
  ])('refuses %s', (_why, patch) => {
    expect(read(patch).ok).toBe(false);
  });

  it('ignores settings it does not know, so a request cannot smuggle a variable to the machine', () => {
    const r = read({ tunables: { TICKET_GITHUB_TOKEN: 'mine', PLAN_TIMEOUT: '600' } });
    expect(r.ok && r.req.tunables).toEqual({ PLAN_TIMEOUT: '600' });
  });
});

describe('what the provider and the machine are given', () => {
  it('the boot command fetches the lane and runs worker-run.sh, with no single quote to break a wrapper', () => {
    expect(BOOT_COMMAND).toContain('deploy/lane/worker-run.sh');
    expect(BOOT_COMMAND).not.toContain("'");
  });

  it('the provider\'s variables name how to reach the studio, and no credential', () => {
    const v = bootVariables({ studioUrl: 'https://studio.example/', ventureId: 'arca', runId: 'r', runToken: 't', laneRef: 'abc', laneSource: 'https://x', expiresAtMs: 2000 });
    expect(Object.keys(v).sort()).toEqual(['FOUNDRY_EXPIRES_AT', 'FOUNDRY_LANE_REF', 'FOUNDRY_LANE_SOURCE', 'FOUNDRY_RUN_ID', 'FOUNDRY_RUN_TOKEN', 'FOUNDRY_STUDIO_URL', 'FOUNDRY_VENTURE']);
    expect(v.FOUNDRY_STUDIO_URL).toBe('https://studio.example');
  });

  it('the worker\'s environment is the run\'s settings plus exactly two credentials', () => {
    const env = workerEnv('arca', {
      repo: 'wealthcx01/arca', baseBranch: 'main', ticketPath: 'docs/tickets/A.md', slug: 'A', department: 'build',
      gate: 'pr', requireProposal: false, stateRef: null, tunables: { PLAN_TIMEOUT: '600' },
    }, { github: 'g', claude: 'c' });
    expect(env).toEqual({
      REPO: 'wealthcx01/arca', BASE_BRANCH: 'main', LANE_ID: 'arca', LANE_DEPARTMENT: 'build', LANE_GATE: 'pr',
      LANE_REQUIRE_PROPOSAL: '0', PLAN_TIMEOUT: '600', TICKET_SLUG: 'A', TICKET_PATH: 'docs/tickets/A.md',
      TICKET_GITHUB_TOKEN: 'g', CLAUDE_CODE_OAUTH_TOKEN: 'c',
    });
  });

  it('a machine name says what it is for and starts with the prefix the provider lists by', () => {
    expect(machineName('arca', 'ARCA-061-price-feed', 'aaaaaaaaaaaaaaa1')).toBe('fw-arca-arca-061-price-feed-aaaaaaaaaaaaaaa1');
  });
});

describe('how a run ended', () => {
  it('only a run that reached its end is a success', () => {
    for (const stage of ['setup', 'work', 'report']) {
      expect(finishSummary(parseFinish({ exit: 0, stage })!).ok, stage).toBe(false);
    }
    expect(finishSummary(parseFinish({ exit: 1, stage: 'done' })!).ok).toBe(true);
  });

  it('an unknown stage counts as set-up, never as done', () => {
    expect(parseFinish({ exit: 0, stage: 'finished-honest' })!.stage).toBe('setup');
  });

  it('refuses a result with no exit code', () => {
    expect(parseFinish({ stage: 'done' })).toBeNull();
    expect(parseFinish('{"exit":0}')).toBeNull();
  });

  it('keeps only well-formed guide names', () => {
    expect(parseFinish({ exit: 0, stage: 'done', skills: 'review $(rm -rf) qa' })!.skills).toEqual(['review', 'qa']);
  });
});

describe('the store, against real Postgres with the studio\'s own role', () => {
  const SQL = ['001_read_model.sql', '007_ticket_machines.sql'].map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

  async function fresh() {
    const db = await PGlite.create();
    await db.exec(SQL);
    await db.exec('set role foundry_studio');
    const as = async <T>(v: string, fn: (q: Querier) => Promise<T>) => {
      await db.exec('begin');
      await db.query('select set_config($1, $2, true)', ['app.venture_id', v]);
      try { const out = await fn(db as unknown as Querier); await db.exec('commit'); return out; } catch (e) { await db.exec('rollback'); throw e; }
    };
    return { db, as };
  }
  const row = (v: string, proposal = P1) => ({ venture_id: v, proposal_id: proposal, monthly_cents: 4000, approver: 'j@x.com', approved_at: '2026-10-02T09:00:00.000Z', attestation: 'a'.repeat(64) });
  const AT = new Date('2026-10-02T08:00:00Z');
  /** A proposal, approved, and the budget recorded from it — the order the budget page writes them in. */
  async function granted(as: Awaited<ReturnType<typeof fresh>>['as'], v: string) {
    await as(v, async (q) => {
      await recordProposal(q, { venture_id: v, proposal_id: P1, monthly_cents: 4000, proposed_by: 'ops@x.com', proposed_at: AT });
      await decideProposal(q, P1, 'j@x.com', AT);
      await recordBudget(q, row(v));
    });
  }

  it('a budget with no approved proposal behind it is no budget', async () => {
    const { as } = await fresh();
    // Written straight into the table, as a command line could: nothing approved it.
    await as('arca', (q) => recordBudget(q, row('arca')));
    expect(await as('arca', (q) => latestBudget(q))).toBeNull();
    // A proposal for a different amount does not make it count either.
    await as('arca', async (q) => {
      await recordProposal(q, { venture_id: 'arca', proposal_id: P1, monthly_cents: 9000, proposed_by: 'ops@x.com', proposed_at: AT });
      await decideProposal(q, P1, 'j@x.com', AT);
    });
    expect(await as('arca', (q) => latestBudget(q))).toBeNull();
  });

  it('a proposal is approved once; a second approval changes nothing', async () => {
    const { as } = await fresh();
    await as('arca', (q) => recordProposal(q, { venture_id: 'arca', proposal_id: P1, monthly_cents: 4000, proposed_by: 'ops@x.com', proposed_at: AT }));
    expect(await as('arca', (q) => decideProposal(q, P1, 'j@x.com', AT))).toBe(true);
    expect(await as('arca', (q) => decideProposal(q, P1, 'j@x.com', AT))).toBe(false);
  });

  it('one venture can never see another\'s budget or spend', async () => {
    const { as } = await fresh();
    await granted(as, 'arca');
    await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 500, 10_000));
    expect(await as('arca', (q) => latestBudget(q))).toMatchObject({ venture_id: 'arca', proposal_id: P1, monthly_cents: 4000 });
    expect(await as('the-reset', (q) => latestBudget(q))).toBeNull();
    expect(await as('the-reset', (q) => spentIn(q, '2026-10-01'))).toBe(0);
    expect(await as('arca', (q) => spentIn(q, '2026-10-01'))).toBe(500);
  });

  it('one venture cannot write a budget under another\'s name', async () => {
    const { as } = await fresh();
    await expect(as('arca', (q) => recordBudget(q, row('the-reset')))).rejects.toThrow(/row-level security/);
  });

  it('the studio can neither rewrite nor delete a budget, nor wipe a month\'s spend', async () => {
    const { as } = await fresh();
    await granted(as, 'arca');
    await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 500, 10_000));
    await expect(as('arca', (q) => q.query('update machinestore.budgets set monthly_cents = 999999'))).rejects.toThrow(/permission denied/);
    await expect(as('arca', (q) => q.query('delete from machinestore.budgets'))).rejects.toThrow(/permission denied/);
    await expect(as('arca', (q) => q.query('update machinestore.budget_proposals set monthly_cents = 999999'))).rejects.toThrow(/permission denied/);
    await expect(as('arca', (q) => q.query('delete from machinestore.budget_proposals'))).rejects.toThrow(/permission denied/);
    await expect(as('arca', (q) => q.query('delete from machinestore.spend'))).rejects.toThrow(/permission denied/);
    await expect(as('arca', (q) => q.query('delete from machinestore.runs'))).rejects.toThrow(/permission denied/);
  });

  it('a reservation that would pass the cap changes nothing; a correction never goes below zero', async () => {
    const { as } = await fresh();
    expect(await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 6_000, 10_000))).toBe(true);
    expect(await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 6_000, 10_000))).toBe(false);
    expect(await as('arca', (q) => spentIn(q, '2026-10-01'))).toBe(6_000);
    await as('arca', (q) => adjust(q, '2026-10-01', -50_000));
    expect(await as('arca', (q) => spentIn(q, '2026-10-01'))).toBe(0);
  });

  it('the month\'s count holds the largest budget allowed ($10,000), past what an integer column can', async () => {
    const { as } = await fresh();
    const cap = 1_000_000 * 10_000;
    expect(await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 3_000_000_000, cap))).toBe(true);
    expect(await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 3_000_000_000, cap))).toBe(true);
    expect(await as('arca', (q) => spentIn(q, '2026-10-01'))).toBe(6_000_000_000);
  });

  it('a machine\'s removal is recorded once, however many callers race to record it', async () => {
    const { as } = await fresh();
    await as('arca', (q) => insertRun(q, {
      ventureId: 'arca', runId: 'aaaaaaaaaaaaaaa1', provider: 'railway', reservedMicro: 100, createdAt: AT, expiresAt: AT,
      settings: { repo: 'wealthcx01/arca', baseBranch: 'main', ticketPath: 'docs/tickets/A.md', slug: 'A', department: 'build', gate: 'pr', requireProposal: false, stateRef: null, tunables: {} },
    }));
    expect(await as('arca', (q) => markDestroyed(q, 'aaaaaaaaaaaaaaa1', AT))).toBe(true);
    expect(await as('arca', (q) => markDestroyed(q, 'aaaaaaaaaaaaaaa1', AT))).toBe(false);
  });

  it('row-level security is forced on every table, so not even the owner reads through it', async () => {
    const { db } = await fresh();
    await db.exec('reset role');
    for (const t of ['budget_proposals', 'budgets', 'spend', 'runs']) {
      const { rows } = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `select relrowsecurity, relforcerowsecurity from pg_class where oid = 'machinestore.${t}'::regclass`);
      expect(rows[0], t).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    }
  });

  it('MACHINE is the size the cost is counted at', () => {
    expect(MACHINE).toMatchObject({ vcpus: 4, memoryGb: 8 });
  });
});
