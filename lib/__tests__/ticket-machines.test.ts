import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { attestationFor, machineBudgetAttestationFor, refusalAttestationFor } from '../approval-attestation';
import {
  BOOT_COMMAND, MACHINE, bootVariables, costForMicroUsd, dollars, finishSummary, laneKeyFor, machineName,
  microUsdPerMinute, monthOf, parseFinish, parseMachineRequest, reapKeyFor, runTokenFor, verifyBudget,
  workerEnv, worstCaseMicroUsd,
} from '../ticket-machines';
import { adjust, latestBudget, recordBudget, reserve, spentIn, type Querier } from '../machine-store';
import type { VentureSummary } from '../ventures';
// @ts-expect-error — a plain .mjs script with no type declarations
import { budgetAttestation, budgetRow, laneKey, reapKey } from '../../scripts/ticket-machines.mjs';

const ARCA = { id: 'arca', repos: ['arca'], departments: [{ id: 'sell', repo: 'arca-sell' }] } as unknown as VentureSummary;

describe('the signatures John\'s script makes are the ones the studio checks', () => {
  it('pins a known budget vector, identical in the studio and in scripts/ticket-machines.mjs', () => {
    const v = machineBudgetAttestationFor('arca', 4000, 'John@Bruntsfield.Capital', '2026-10-02T09:00:00.000Z', 'test-secret');
    expect(v).toBe(budgetAttestation('arca', 4000, 'john@bruntsfield.capital', '2026-10-02T09:00:00.000Z', 'test-secret'));
    expect(v).toMatch(/^[0-9a-f]{64}$/);
    expect(laneKeyFor('s'.repeat(32), 'arca')).toBe(laneKey('s'.repeat(32), 'arca'));
    expect(reapKeyFor('s'.repeat(32))).toBe(reapKey('s'.repeat(32)));
  });

  it('a budget can never be read as an approval to send, or a refusal', () => {
    const budget = machineBudgetAttestationFor('arca', 4000, 'j@x.com', 't', 's');
    expect(budget).not.toBe(attestationFor('arca', '4000', 't', 'j@x.com', 's'));
    expect(budget).not.toBe(refusalAttestationFor('arca', '4000', 't', 'j@x.com', 's', 't', ''));
  });

  it('a lane key and a run token are different things, per venture and per run', () => {
    const s = 'k'.repeat(40);
    expect(laneKeyFor(s, 'arca')).not.toBe(laneKeyFor(s, 'the-reset'));
    expect(runTokenFor(s, 'arca', 'aaaaaaaaaaaaaaa1')).not.toBe(runTokenFor(s, 'the-reset', 'aaaaaaaaaaaaaaa1'));
    expect(runTokenFor(s, 'arca', 'aaaaaaaaaaaaaaa1')).not.toBe(runTokenFor(s, 'arca', 'aaaaaaaaaaaaaaa2'));
  });

  it('the script refuses a budget it cannot sign or read, in words', () => {
    expect(budgetRow({ venture: 'arca', dollars: '40', approver: 'john@b.c', secret: '' }).error).toMatch(/FOUNDRY_APPROVAL_SECRET/);
    expect(budgetRow({ venture: 'Arca!', dollars: '40', approver: 'john@b.c', secret: 's' }).error).toMatch(/not a venture id/);
    expect(budgetRow({ venture: 'arca', dollars: 'forty', approver: 'john@b.c', secret: 's' }).error).toMatch(/dollars/);
    const ok = budgetRow({ venture: 'arca', dollars: '37.50', approver: 'John@B.C', secret: 's', now: Date.parse('2026-10-02T09:00:00Z') });
    expect(ok.row).toMatchObject({ monthly_cents: 3750, approver: 'john@b.c', approved_at: '2026-10-02T09:00:00.000Z' });
    expect(verifyBudget(ok.row, 'arca', 's', ['john@b.c'])).toEqual({ ok: true, monthlyCents: 3750, approver: 'john@b.c' });
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
    expect(read({ repo: 'wealthcx01/arca-sell' })).toMatchObject({ ok: true });
  });

  it.each([
    ['another venture\'s repository', { repo: 'the-reset' }],
    ['a repository with the same name in another organisation', { repo: 'someone/arca' }],
    ['a path that climbs out of the ticket folder', { ticketPath: 'docs/tickets/../../etc/passwd.md', slug: '..' }],
    ['a file outside the ticket folder', { ticketPath: 'deploy/lane/run-once.sh', slug: 'run-once' }],
    ['a name that does not match its file', { slug: 'ARCA-999' }],
    ['a branch that climbs', { baseBranch: '../main' }],
    ['a branch with a space', { baseBranch: 'main; rm -rf /' }],
    ['a gate nobody knows', { gate: 'none' }],
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
  const row = (v: string) => ({ venture_id: v, monthly_cents: 4000, approver: 'j@x.com', approved_at: '2026-10-02T09:00:00.000Z', attestation: 'a'.repeat(64) });

  it('one venture can never see another\'s budget or spend', async () => {
    const { as } = await fresh();
    await as('arca', (q) => recordBudget(q, row('arca')));
    await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 500, 10_000));
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
    await as('arca', (q) => recordBudget(q, row('arca')));
    await as('arca', (q) => reserve(q, 'arca', '2026-10-01', 500, 10_000));
    await expect(as('arca', (q) => q.query('update machinestore.budgets set monthly_cents = 999999'))).rejects.toThrow(/permission denied/);
    await expect(as('arca', (q) => q.query('delete from machinestore.budgets'))).rejects.toThrow(/permission denied/);
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

  it('row-level security is forced on every table, so not even the owner reads through it', async () => {
    const { db } = await fresh();
    await db.exec('reset role');
    for (const t of ['budgets', 'spend', 'runs']) {
      const { rows } = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `select relrowsecurity, relforcerowsecurity from pg_class where oid = 'machinestore.${t}'::regclass`);
      expect(rows[0], t).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    }
  });

  it('MACHINE is the size the cost is counted at', () => {
    expect(MACHINE).toMatchObject({ vcpus: 4, memoryGb: 8 });
  });
});
