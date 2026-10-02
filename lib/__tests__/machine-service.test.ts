import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { machineBudgetAttestationFor } from '../approval-attestation';
import type { Machine, MachineProvider, MachineSpec, MachineState } from '../machine-provider';
import { finishRun, reapAll, removeAfterFinish, requestMachine, runStatus, startRun, type MachineDeps } from '../machine-service';
import { recordBudget, spentIn, type Querier } from '../machine-store';
import { MACHINE, costForMicroUsd, laneKeyFor, monthOf, reapKeyFor, runTokenFor, worstCaseMicroUsd } from '../ticket-machines';
import type { VentureSummary } from '../ventures';

/**
 * The studio's ticket-machine endpoints, end to end (FB-239; John's rulings of 2026-10-02).
 *
 * Real Postgres (PGlite) with the studio's own role, so row-level security is really in force; a
 * stand-in provider that behaves like a cloud account (machines exist until removed); and nothing
 * that touches a network.
 */
const SQL = ['001_read_model.sql', '007_ticket_machines.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

const SECRET = 'a-machine-secret-that-is-long-enough-to-count';
const APPROVAL = 'the-approval-secret';
const JOHN = 'john@bruntsfield.capital';
const T0 = Date.parse('2026-10-02T09:00:00Z');

const ENV = {
  TICKET_MACHINES: 'on',
  TICKET_MACHINE_SECRET: SECRET,
  FOUNDRY_APPROVAL_SECRET: APPROVAL,
  STUDIO_ADMIN_EMAILS: `${JOHN}, ops@bruntsfield.capital`,
  STUDIO_PUBLIC_URL: 'https://studio.example',
  GITHUB_ORG: 'wealthcx01',
  TICKET_MACHINE_GITHUB_TOKEN_ARCA: 'gh-token-arca-only',
  TICKET_MACHINE_CLAUDE_TOKEN_ARCA: 'claude-token-arca-only',
  TICKET_MACHINE_GITHUB_TOKEN_THE_RESET: 'gh-token-reset-only',
  TICKET_MACHINE_CLAUDE_TOKEN_THE_RESET: 'claude-token-reset-only',
};

const venture = (id: string, repos: string[], deptRepo?: string) => ({
  id, name: id, description: null, status: 'active', founderName: null, founderEmail: null, repos,
  approvalMatrix: [], vpsHost: null,
  departments: deptRepo ? [{ id: 'sell', name: 'Sell', repo: deptRepo, queuePath: 'docs/tickets', gate: 'activegraph', provisioned: true, launch: null, connectors: [] }] : [],
}) as unknown as VentureSummary;

const VENTURES = [venture('arca', ['arca'], 'arca-sell'), venture('the-reset', ['the-reset'])];
const TICKETS = new Set([
  'wealthcx01/arca:docs/tickets/ARCA-061-price-feed.md',
  'wealthcx01/arca-sell:docs/tickets/SELL-002-outreach.md',
  'wealthcx01/the-reset:docs/tickets/RESET-007-onboarding.md',
]);

function fakeProvider() {
  const machines = new Map<string, Machine>();
  const specs: MachineSpec[] = [];
  const removed: string[] = [];
  let next = 1;
  const o = {
    machines, specs, removed,
    failAfterMaking: false,
    failOutright: false,
    stateOf: new Map<string, MachineState>(),
    created: 0,
  };
  const provider: MachineProvider = {
    name: 'railway',
    async create(spec) {
      if (o.failOutright) throw new Error('no capacity');
      o.created += 1;
      const m: Machine = { id: `env-${next++}`, name: spec.name, createdAt: new Date(now).toISOString(), ref: { serviceId: 'svc' } };
      machines.set(m.id, m);
      specs.push(spec);
      if (o.failAfterMaking) throw new Error('connection reset');
      return m;
    },
    async state(m) { return o.stateOf.get(m.id) ?? (machines.has(m.id) ? 'running' : 'gone'); },
    async list() { return [...machines.values()]; },
    async destroy(m) { machines.delete(m.id); removed.push(m.id); },
  };
  return Object.assign(o, { provider });
}

let db: PGlite;
let now = T0;
let fake: ReturnType<typeof fakeProvider>;
let ids: string[];
let deps: MachineDeps;

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
  now = T0;
  fake = fakeProvider();
  ids = ['aaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaa3', 'aaaaaaaaaaaaaaa4'];
  deps = {
    env: { ...ENV },
    ventures: VENTURES,
    provider: fake.provider,
    withVenture: as,
    ticketExists: async (repo, path) => TICKETS.has(`${repo}:${path}`),
    now: () => now,
    newRunId: () => ids.shift()!,
  };
});

async function approve(v: string, cents: number, approver = JOHN, secret = APPROVAL) {
  const approvedAt = new Date(now).toISOString();
  await as(v, (q) => recordBudget(q, {
    venture_id: v, monthly_cents: cents, approver, approved_at: approvedAt,
    attestation: machineBudgetAttestationFor(v, cents, approver, approvedAt, secret),
  }));
}

const lane = (v: string) => `Bearer ${laneKeyFor(SECRET, v)}`;
const run = (v: string, id: string) => `Bearer ${runTokenFor(SECRET, v, id)}`;
const arcaTicket = { venture: 'arca', repo: 'arca', baseBranch: 'main', ticketPath: 'docs/tickets/ARCA-061-price-feed.md', slug: 'ARCA-061-price-feed' };
const resetTicket = { venture: 'the-reset', repo: 'the-reset', baseBranch: 'main', ticketPath: 'docs/tickets/RESET-007-onboarding.md', slug: 'RESET-007-onboarding' };
const TWENTY_DOLLARS = 2_000;

describe('one ticket, start to finish', () => {
  it('makes a machine, hands it this venture\'s work once, records the end, removes it and charges what it ran', async () => {
    await approve('arca', TWENTY_DOLLARS);
    const r = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ created: true, runId: 'aaaaaaaaaaaaaaa1' });
    expect(fake.machines.size).toBe(1);

    // What the provider keeps: how to reach the studio and this run's token. No venture credential.
    const stored = JSON.stringify(fake.specs[0].variables);
    for (const secret of Object.values(ENV).filter((v) => /token/.test(v))) expect(stored).not.toContain(secret);
    expect(fake.specs[0].variables).toMatchObject({ FOUNDRY_VENTURE: 'arca', FOUNDRY_RUN_ID: 'aaaaaaaaaaaaaaa1', FOUNDRY_STUDIO_URL: 'https://studio.example' });

    expect(await as('arca', (q) => spentIn(q, monthOf(T0)))).toBe(worstCaseMicroUsd());

    const start = await startRun(deps, run('arca', 'aaaaaaaaaaaaaaa1'), 'arca', 'aaaaaaaaaaaaaaa1');
    expect(start.status).toBe(200);
    expect(start.body.env).toMatchObject({
      REPO: 'wealthcx01/arca', TICKET_PATH: 'docs/tickets/ARCA-061-price-feed.md', LANE_ID: 'arca',
      TICKET_GITHUB_TOKEN: 'gh-token-arca-only', CLAUDE_CODE_OAUTH_TOKEN: 'claude-token-arca-only',
    });
    // A run token collects the work exactly once.
    expect((await startRun(deps, run('arca', 'aaaaaaaaaaaaaaa1'), 'arca', 'aaaaaaaaaaaaaaa1')).status).toBe(409);

    now = T0 + 42 * 60_000;
    const fin = await finishRun(deps, run('arca', 'aaaaaaaaaaaaaaa1'), 'arca', 'aaaaaaaaaaaaaaa1',
      { venture: 'arca', exit: 0, stage: 'done', skills: 'write-tests review', sessions: '{"session":"s1"}\n', log: '' });
    expect(fin.status).toBe(200);
    await removeAfterFinish(deps, 'arca', 'aaaaaaaaaaaaaaa1');
    expect(fake.machines.size).toBe(0);

    const s = await runStatus(deps, lane('arca'), 'arca', 'aaaaaaaaaaaaaaa1');
    expect(s.body).toMatchObject({ done: true, ok: true, removed: true, skills: ['write-tests', 'review'], sessions: '{"session":"s1"}\n' });
    // The month is charged for the 42 minutes it ran, not the worst case it was counted at.
    expect(await as('arca', (q) => spentIn(q, monthOf(T0)))).toBe(costForMicroUsd(T0, T0 + 42 * 60_000));
  });
});

describe('D11: one venture can never get a machine with another venture\'s credentials or for its ticket', () => {
  beforeEach(async () => {
    await approve('arca', TWENTY_DOLLARS);
    await approve('the-reset', TWENTY_DOLLARS);
  });

  it('a lane key opens only its own venture', async () => {
    expect((await requestMachine(deps, lane('arca'), resetTicket)).status).toBe(401);
    expect((await requestMachine(deps, lane('the-reset'), arcaTicket)).status).toBe(401);
    expect((await requestMachine(deps, null, arcaTicket)).status).toBe(401);
    expect(fake.created).toBe(0);
  });

  it('a venture cannot name another venture\'s repository or ticket', async () => {
    const otherRepo = await requestMachine(deps, lane('arca'), { ...resetTicket, venture: 'arca' });
    expect(otherRepo.status).toBe(400);
    // Its own repository, but a ticket that only exists in the other venture's.
    const otherTicket = await requestMachine(deps, lane('arca'), { ...resetTicket, venture: 'arca', repo: 'arca' });
    expect(otherTicket.status).toBe(404);
    expect(fake.created).toBe(0);
  });

  it('may use its own department\'s repository', async () => {
    const r = await requestMachine(deps, lane('arca'), {
      venture: 'arca', repo: 'arca-sell', ticketPath: 'docs/tickets/SELL-002-outreach.md', slug: 'SELL-002-outreach', department: 'sell', gate: 'activegraph',
    });
    expect(r.status).toBe(201);
  });

  it('two ventures\' machines at once: each collects only its own credentials, and neither token opens the other run', async () => {
    const a = await requestMachine(deps, lane('arca'), arcaTicket);
    const b = await requestMachine(deps, lane('the-reset'), resetTicket);
    const aRun = String(a.body.runId);
    const bRun = String(b.body.runId);

    // Arca's run token, pointed at the-reset's run, either way round.
    expect((await startRun(deps, run('arca', aRun), 'the-reset', bRun)).status).toBe(401);
    expect((await startRun(deps, run('arca', aRun), 'arca', bRun)).status).toBe(401);
    // A token minted for arca naming the-reset's run id — the run does not exist under arca.
    expect((await startRun(deps, run('arca', bRun), 'arca', bRun)).status).toBe(410);

    const aEnv = JSON.stringify((await startRun(deps, run('arca', aRun), 'arca', aRun)).body.env);
    const bEnv = JSON.stringify((await startRun(deps, run('the-reset', bRun), 'the-reset', bRun)).body.env);
    expect(aEnv).toContain('gh-token-arca-only');
    expect(bEnv).toContain('gh-token-reset-only');
    for (const t of ['gh-token-reset-only', 'claude-token-reset-only', 'wealthcx01/the-reset']) expect(aEnv).not.toContain(t);
    for (const t of ['gh-token-arca-only', 'claude-token-arca-only', 'wealthcx01/arca']) expect(bEnv).not.toContain(t);

    // Nor can one venture's lane read or end the other's run.
    expect((await runStatus(deps, lane('arca'), 'the-reset', bRun)).status).toBe(401);
    expect((await runStatus(deps, lane('arca'), 'arca', bRun)).status).toBe(404);
    expect((await finishRun(deps, run('arca', aRun), 'the-reset', bRun, { exit: 0, stage: 'done' })).status).toBe(401);
  });

  it('one venture\'s budget is never spent by another, and never lets another make a machine', async () => {
    const third = venture('scale-co', ['scale-co']);
    deps.ventures = [...VENTURES, third];
    deps.env = { ...deps.env, TICKET_MACHINE_GITHUB_TOKEN_SCALE_CO: 'x', TICKET_MACHINE_CLAUDE_TOKEN_SCALE_CO: 'y' };
    TICKETS.add('wealthcx01/scale-co:docs/tickets/S-1-x.md');
    const r = await requestMachine(deps, lane('scale-co'), { venture: 'scale-co', repo: 'scale-co', ticketPath: 'docs/tickets/S-1-x.md', slug: 'S-1-x' });
    expect(r.status).toBe(402);
    await requestMachine(deps, lane('arca'), arcaTicket);
    expect(await as('the-reset', (q) => spentIn(q, monthOf(T0)))).toBe(0);
  });
});

describe('the monthly budget John approves', () => {
  it('no budget: no machine, and the founder is told why', async () => {
    const r = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(r.status).toBe(402);
    expect(r.body.reason).toMatch(/No monthly budget .* has been approved/);
    expect(fake.created).toBe(0);
  });

  it('a budget a lane wrote itself, without the approval secret, is worth nothing', async () => {
    await approve('arca', TWENTY_DOLLARS, JOHN, 'a-guess-at-the-secret');
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(402);
  });

  it('a budget signed for someone who is not a studio admin is worth nothing', async () => {
    await approve('arca', TWENTY_DOLLARS, 'founder@arca.example');
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(402);
  });

  it('a budget moved from one venture to another does not verify', async () => {
    const approvedAt = new Date(now).toISOString();
    await as('arca', (q) => recordBudget(q, {
      venture_id: 'arca', monthly_cents: TWENTY_DOLLARS, approver: JOHN, approved_at: approvedAt,
      attestation: machineBudgetAttestationFor('the-reset', TWENTY_DOLLARS, JOHN, approvedAt, APPROVAL),
    }));
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(402);
  });

  it('the newest approval wins, and zero withdraws it', async () => {
    await approve('arca', TWENTY_DOLLARS);
    now += 1000;
    await approve('arca', 0);
    const r = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(r.status).toBe(402);
    expect(r.body.reason).toMatch(/withdrawn/);
  });

  it('at the cap no machine is made, and the reason names the budget; a finished run gives back what it did not use', async () => {
    // Room for one worst-case machine and a half.
    const cents = Math.ceil((worstCaseMicroUsd() * 1.5) / 10_000);
    await approve('arca', cents);
    const first = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(first.status).toBe(201);

    const second = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(second.status).toBe(402);
    expect(second.body.reason).toMatch(/This month's budget for temporary machines \(\$\d+\.\d\d\) is used/);
    expect(fake.created).toBe(1);

    // The first finishes after ten minutes; its charge drops to ten minutes, and there is room again.
    const id = String(first.body.runId);
    await startRun(deps, run('arca', id), 'arca', id);
    now += 10 * 60_000;
    await finishRun(deps, run('arca', id), 'arca', id, { venture: 'arca', exit: 0, stage: 'done' });
    await removeAfterFinish(deps, 'arca', id);
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(201);
  });

  it('a new month starts again', async () => {
    const cents = Math.ceil(worstCaseMicroUsd() / 10_000);
    await approve('arca', cents);
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(201);
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(402);
    now = Date.parse('2026-11-01T00:30:00Z');
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(201);
  });
});

describe('a machine that fails is reported as a failure, never a success', () => {
  beforeEach(() => approve('arca', TWENTY_DOLLARS));

  it('a machine that broke while setting itself up: failed, with where and why, and removed', async () => {
    const id = String((await requestMachine(deps, lane('arca'), arcaTicket)).body.runId);
    await startRun(deps, run('arca', id), 'arca', id);
    await finishRun(deps, run('arca', id), 'arca', id, {
      venture: 'arca', exit: 128, stage: 'setup', skills: '', log: 'Cloning…\nfatal: repository not found',
    });
    const s = await runStatus(deps, lane('arca'), 'arca', id);
    expect(s.body).toMatchObject({ done: true, ok: false, removed: true, exit: 128 });
    expect(s.body.summary).toMatch(/setting itself up/);
    expect(s.body.summary).toMatch(/fatal: repository not found/);
    expect(fake.machines.size).toBe(0);
  });

  it('a log line carrying a credential is withheld, not stored', async () => {
    const id = String((await requestMachine(deps, lane('arca'), arcaTicket)).body.runId);
    await startRun(deps, run('arca', id), 'arca', id);
    await finishRun(deps, run('arca', id), 'arca', id, {
      venture: 'arca', exit: 128, stage: 'setup', log: `fatal: https://x-access-token:ghp_${'a'.repeat(36)}@github.com/x`,
    });
    const s = await runStatus(deps, lane('arca'), 'arca', id);
    expect(String(s.body.summary)).not.toContain('ghp_');
    expect(s.body.summary).toMatch(/withheld/);
  });

  it('a machine that stopped before collecting its work is failed and removed', async () => {
    const id = String((await requestMachine(deps, lane('arca'), arcaTicket)).body.runId);
    fake.stateOf.set([...fake.machines.keys()][0], 'failed');
    const s = await runStatus(deps, lane('arca'), 'arca', id);
    expect(s.body).toMatchObject({ done: true, ok: false, removed: true });
    expect(s.body.summary).toMatch(/stopped before it could start/);
  });

  it('a machine that never reports is failed and removed once past its deadline, and not before', async () => {
    const id = String((await requestMachine(deps, lane('arca'), arcaTicket)).body.runId);
    await startRun(deps, run('arca', id), 'arca', id);
    now = T0 + (MACHINE.lifetimeMinutes + MACHINE.graceMinutes - 1) * 60_000;
    expect((await runStatus(deps, lane('arca'), 'arca', id)).body).toMatchObject({ done: false });
    expect(fake.machines.size).toBe(1);
    now = T0 + (MACHINE.lifetimeMinutes + MACHINE.graceMinutes + 1) * 60_000;
    const s = await runStatus(deps, lane('arca'), 'arca', id);
    expect(s.body).toMatchObject({ done: true, ok: false, removed: true });
    expect(s.body.summary).toMatch(/ran out of time/);
  });
});

describe('a create that fails', () => {
  beforeEach(() => approve('arca', TWENTY_DOLLARS));

  it('whose reply was lost: removes this run\'s machine and only this run\'s', async () => {
    // Another run's machine, working, in the same provider account.
    const other = { id: 'env-other', name: 'fw-the-reset-reset-007-onboarding-bbbbbbbbbbbbbbbb', createdAt: new Date(T0).toISOString(), ref: {} };
    fake.machines.set(other.id, other);
    fake.failAfterMaking = true;
    const r = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(r.status).toBe(502);
    expect(r.body.created).toBe(false);
    expect(fake.removed).toEqual(['env-1']);
    expect([...fake.machines.keys()]).toEqual(['env-other']);
  });

  it('that made nothing: the money is given back, and nothing is left counted as running', async () => {
    fake.failOutright = true;
    const r = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(r.status).toBe(502);
    expect(await as('arca', (q) => spentIn(q, monthOf(T0)))).toBe(0);
    fake.failOutright = false;
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(201);
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(201);
    // Two working now, which is the most at once — the failed one is not counted among them.
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(429);
  });
});

describe('the switch and the studio\'s own set-up', () => {
  beforeEach(() => approve('arca', TWENTY_DOLLARS));

  it('off: nothing is made, and it says so', async () => {
    deps.env = { ...deps.env, TICKET_MACHINES: 'off' };
    const r = await requestMachine(deps, lane('arca'), arcaTicket);
    expect(r.status).toBe(503);
    expect(r.body.reason).toMatch(/switched off/);
    expect(fake.created).toBe(0);
  });

  it('no credentials held for this venture: nothing is made', async () => {
    deps.env = { ...deps.env, TICKET_MACHINE_CLAUDE_TOKEN_ARCA: '' };
    expect((await requestMachine(deps, lane('arca'), arcaTicket)).status).toBe(503);
    expect(fake.created).toBe(0);
  });

  it('a short machine secret opens nothing', async () => {
    deps.env = { ...deps.env, TICKET_MACHINE_SECRET: 'short' };
    expect((await requestMachine(deps, `Bearer ${laneKeyFor('short', 'arca')}`, arcaTicket)).status).toBe(401);
  });
});

describe('the clean-up', () => {
  beforeEach(() => approve('arca', TWENTY_DOLLARS));

  it('opens only with the reap key', async () => {
    expect((await reapAll(deps, lane('arca'))).status).toBe(401);
    expect((await reapAll(deps, null)).status).toBe(401);
  });

  it('removes overdue and unaccounted machines, keeps working ones and young strangers', async () => {
    const working = String((await requestMachine(deps, lane('arca'), arcaTicket)).body.runId);
    now = T0 + 60 * 60_000;
    const late = String((await requestMachine(deps, lane('arca'), arcaTicket)).body.runId);
    // A machine no record knows about, made long ago — say its record was lost.
    fake.machines.set('env-lost', { id: 'env-lost', name: 'fw-x', createdAt: new Date(T0 - 6 * 3600_000).toISOString(), ref: {} });
    // One no record knows about yet, because it is being made right now.
    fake.machines.set('env-new', { id: 'env-new', name: 'fw-y', createdAt: new Date(T0 + 60 * 60_000).toISOString(), ref: {} });

    now = T0 + (MACHINE.lifetimeMinutes + MACHINE.graceMinutes + 1) * 60_000; // the first is now overdue
    const r = await reapAll(deps, `Bearer ${reapKeyFor(SECRET)}`);
    expect(r.status).toBe(200);
    expect(fake.removed.sort()).toEqual(['env-1', 'env-lost']);
    expect([...fake.machines.keys()].sort()).toEqual(['env-2', 'env-new']);
    expect((await runStatus(deps, lane('arca'), 'arca', working)).body).toMatchObject({ done: true, ok: false });
    expect((await runStatus(deps, lane('arca'), 'arca', late)).body).toMatchObject({ done: false });
  });
});
