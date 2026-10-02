import { describe, it, expect } from 'vitest';
import {
  DEFAULTS, ROLE_LABEL, ROLE_VALUE, RESULT_PATH, SESSIONS_PATH, budgetCheck, bundleFor, deadlineOf,
  labelsFor, machineName, overdue, reap, runTicketOnMachine, safeTicketPath, settingsFrom,
  workerEnvFile, workerUserData, worstCaseEur,
} from '../machine-lib.mjs';

/**
 * A provider that behaves like a cloud account: machines exist until destroyed, and it remembers
 * every one it ever made. Nothing here touches a network.
 */
function fakeProvider({ failCreateAfterMaking = false, failDestroy = 0, preexisting = [] } = {}) {
  const machines = new Map(preexisting.map((m) => [m.id, m]));
  let next = 100;
  let destroyFailures = failDestroy;
  const made = [];
  return {
    made,
    machines,
    async create({ name, labels, userData }) {
      const m = { id: next++, name, labels: { ...labels }, userData, createdAt: new Date(NOW).toISOString() };
      machines.set(m.id, m);
      made.push(m);
      // The reply is lost after the provider has made the machine: the caller never learns its id.
      if (failCreateAfterMaking) throw new Error('connection reset');
      return { id: m.id, name };
    },
    async waitReady(m) { return { ...m, ip: '192.0.2.10' }; },
    async list() { return [...machines.values()]; },
    async destroy(id) {
      if (destroyFailures > 0) { destroyFailures -= 1; throw new Error('provider busy'); }
      machines.delete(id);
    },
  };
}

/** A transport that records what each machine received, and can be told to break. */
function fakeTransport({ breakAt, result = { exit: 0, stage: 'done', skills: 'write-tests review' } } = {}) {
  const received = new Map();
  const ran = [];
  return {
    received,
    ran,
    async send(m, files) {
      if (breakAt === 'deliver') throw new Error('ssh: connection refused');
      received.set(m.id, files);
    },
    async run(m, command) {
      ran.push({ id: m.id, command });
      if (breakAt === 'work') throw new Error('worker crashed');
    },
    async fetch(m, path) {
      if (path === RESULT_PATH) return breakAt === 'no-result' ? null : JSON.stringify(result);
      if (path === SESSIONS_PATH) return '{"session":"s1","ticket":"ARCA-61","stage":"plan"}\n';
      return null;
    },
  };
}

const NOW = Date.parse('2026-10-02T09:00:00Z');
const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleOnlyKeyForTests run-1';
const ENV = {
  REPO: 'wealthcx01/arca', BASE_BRANCH: 'master', TICKET_GITHUB_TOKEN: 'ghp_arca_only',
  CLAUDE_CODE_OAUTH_TOKEN: 'claude-token', HCLOUD_TOKEN: 'provider-token-must-stay-home',
  APPROVAL_SIGNING_KEY: 'never-leaves-the-persistent-box',
};

const runArgs = (over = {}) => ({
  venture: 'arca', ticket: 'ARCA-61', slug: 'arca-61-grading-history',
  ticketPath: 'docs/tickets/arca-61-grading-history.md', env: ENV,
  laneFiles: [{ name: 'supervisor.sh', content: '#!/bin/bash\n' }], workerScript: '#!/bin/bash\n',
  runId: 'run1', publicKey: KEY, now: () => NOW, ...over,
});

describe('a ticket is worked on a machine that did not exist before and does not exist after', () => {
  it('makes one machine, runs the lane on it, and destroys it', async () => {
    const provider = fakeProvider();
    const transport = fakeTransport();
    const out = await runTicketOnMachine({ provider, transport, ...runArgs() });
    expect(provider.made).toHaveLength(1);
    expect(transport.ran).toEqual([{ id: provider.made[0].id, command: 'bash /opt/foundry/run/worker-run.sh' }]);
    expect(provider.machines.size).toBe(0);
    expect(out).toMatchObject({ ok: true, destroyed: true, skills: ['write-tests', 'review'] });
    expect(out.summary).toMatch(/has been removed/);
    expect(out.sessions).toContain('ARCA-61');
  });

  it('still destroys the machine when the run crashes part way through', async () => {
    const provider = fakeProvider();
    const out = await runTicketOnMachine({ provider, transport: fakeTransport({ breakAt: 'work' }), ...runArgs() });
    expect(provider.made).toHaveLength(1);
    expect(provider.machines.size).toBe(0);
    expect(out).toMatchObject({ ok: false, destroyed: true, failedAt: 'work' });
    expect(out.summary).toMatch(/broke off/);
  });

  it('still destroys the machine when delivery fails', async () => {
    const provider = fakeProvider();
    const out = await runTicketOnMachine({ provider, transport: fakeTransport({ breakAt: 'deliver' }), ...runArgs() });
    expect(provider.machines.size).toBe(0);
    expect(out).toMatchObject({ ok: false, destroyed: true, failedAt: 'deliver' });
  });

  it('says so, and does not claim success, when the worker left no result', async () => {
    const provider = fakeProvider();
    const out = await runTicketOnMachine({ provider, transport: fakeTransport({ breakAt: 'no-result' }), ...runArgs() });
    expect(out.ok).toBe(false);
    expect(out.summary).toMatch(/left no record/);
    expect(provider.machines.size).toBe(0);
  });

  it('finds and destroys a machine whose create reply was lost', async () => {
    // The provider made it; we never learned its id. Without the run label this machine would run
    // until the reaper found it — or forever, if the reaper were not installed.
    const provider = fakeProvider({ failCreateAfterMaking: true });
    const out = await runTicketOnMachine({ provider, transport: fakeTransport(), ...runArgs() });
    expect(provider.made).toHaveLength(1);
    expect(provider.machines.size).toBe(0);
    expect(out).toMatchObject({ ok: false, destroyed: true, failedAt: 'create' });
  });

  it('retries a destroy that fails, and says plainly when it could not', async () => {
    const retried = fakeProvider({ failDestroy: 2 });
    const ok = await runTicketOnMachine({ provider: retried, transport: fakeTransport(), ...runArgs() });
    expect(retried.machines.size).toBe(0);
    expect(ok.destroyed).toBe(true);

    const stuck = fakeProvider({ failDestroy: 99 });
    const out = await runTicketOnMachine({ provider: stuck, transport: fakeTransport(), ...runArgs() });
    expect(out.destroyed).toBe(false);
    expect(out.summary).toMatch(/clean-up job will remove it by 11:40 UTC/);
    expect(out.summary).not.toMatch(/has been removed/);
  });

  it('makes nothing at all when the ticket path could climb out of the repository', async () => {
    const provider = fakeProvider();
    const out = await runTicketOnMachine({ provider, transport: fakeTransport(), ...runArgs({ ticketPath: '../../etc/passwd' }) });
    expect(provider.made).toHaveLength(0);
    expect(out).toMatchObject({ ok: false, failedAt: 'start' });
  });
});

describe('the machine is given only what this one ticket needs', () => {
  it('sends this venture’s credentials and nothing from the persistent machine’s other secrets', async () => {
    const provider = fakeProvider();
    const transport = fakeTransport();
    await runTicketOnMachine({ provider, transport, ...runArgs() });
    const files = transport.received.get(provider.made[0].id);
    const envFile = files.find((f) => f.path.endsWith('/run.env'));
    expect(envFile.mode).toBe(0o600);
    expect(envFile.content).toContain("TICKET_GITHUB_TOKEN='ghp_arca_only'");
    const everything = files.map((f) => f.content).join('\n');
    expect(everything).not.toContain('provider-token-must-stay-home');
    expect(everything).not.toContain('never-leaves-the-persistent-box');
  });

  it('puts no secret in the start-up script, which the provider keeps and shows', async () => {
    const provider = fakeProvider();
    await runTicketOnMachine({ provider, transport: fakeTransport(), ...runArgs() });
    const { userData } = provider.made[0];
    for (const secret of ['ghp_arca_only', 'claude-token', 'provider-token-must-stay-home']) {
      expect(userData).not.toContain(secret);
    }
    expect(userData).toContain(KEY);
    expect(userData).toMatch(/shutdown -P \+150/);
  });

  it('two tickets at once get two machines, and neither receives the other’s files or token', async () => {
    const provider = fakeProvider();
    const transport = fakeTransport();
    const reset = { ...ENV, REPO: 'wealthcx01/the-reset', TICKET_GITHUB_TOKEN: 'ghp_reset_only' };
    await Promise.all([
      runTicketOnMachine({ provider, transport, ...runArgs() }),
      runTicketOnMachine({
        provider, transport,
        ...runArgs({ venture: 'the-reset', ticket: 'RESET-4', slug: 'reset-4-onboarding', ticketPath: 'docs/tickets/reset-4-onboarding.md', env: reset, runId: 'run2' }),
      }),
    ]);
    const [a, b] = provider.made;
    expect(a.id).not.toBe(b.id);
    const sent = (m) => transport.received.get(m.id).map((f) => f.content).join('\n');
    expect(sent(a)).toContain('ghp_arca_only');
    expect(sent(a)).not.toContain('ghp_reset_only');
    expect(sent(a)).not.toContain('reset-4-onboarding');
    expect(sent(b)).toContain('ghp_reset_only');
    expect(sent(b)).not.toContain('ghp_arca_only');
    expect(sent(b)).not.toContain('arca-61');
    expect(provider.machines.size).toBe(0);
  });

  it('refuses a value with a line break rather than letting it write a second variable', () => {
    expect(() => workerEnvFile({ env: { REPO: "x\nTICKET_GITHUB_TOKEN=stolen" }, slug: 's', ticketPath: 'docs/tickets/s.md' }))
      .toThrow(/line break/);
  });

  it('quotes a value so the shell reads it as one word', () => {
    const text = workerEnvFile({ env: { REPO: "it's; rm -rf /" }, slug: 's', ticketPath: 'docs/tickets/s.md' });
    expect(text).toContain(`REPO='it'\\''s; rm -rf /'`);
  });

  it('accepts only a ticket file inside docs/tickets', () => {
    expect(safeTicketPath('docs/tickets/ARCA-61-x.md')).toBe('docs/tickets/ARCA-61-x.md');
    for (const bad of ['docs/tickets/../../x.md', '/etc/passwd', 'docs/tickets/a b.md', 'docs/tickets/x.sh']) {
      expect(() => safeTicketPath(bad)).toThrow();
    }
  });

  it('refuses a start-up script whose key could carry extra lines', () => {
    expect(() => workerUserData({ hostname: 'h', publicKey: `${KEY}\nruncmd: [rm -rf /]`, lifetimeMinutes: 10 })).toThrow();
  });

  it('marks shell scripts runnable and everything else not', () => {
    const { files } = bundleFor({
      env: {}, slug: 's', ticketPath: 'docs/tickets/s.md', workerScript: '',
      laneFiles: [{ name: 'supervisor.sh', content: '' }, { name: 'skills-lib.mjs', content: '' }],
    });
    expect(files.find((f) => f.path.endsWith('supervisor.sh')).mode).toBe(0o755);
    expect(files.find((f) => f.path.endsWith('skills-lib.mjs')).mode).toBe(0o644);
  });
});

describe('the reaper', () => {
  const m = (id, labels, createdAt = '2026-10-02T06:00:00Z') => ({ id, name: `m${id}`, labels, createdAt });
  const ours = (expiresIso) => ({ [ROLE_LABEL]: ROLE_VALUE, 'foundry-expires': String(Date.parse(expiresIso) / 1000) });

  it('destroys a ticket machine past its deadline and keeps one that is not', async () => {
    const provider = fakeProvider({
      preexisting: [m(1, ours('2026-10-02T08:00:00Z')), m(2, ours('2026-10-02T10:00:00Z'))],
    });
    const out = await reap({ provider, now: () => NOW });
    expect(out).toEqual({ destroyed: ['m1'], failed: [], kept: ['m2'] });
    expect([...provider.machines.keys()]).toEqual([2]);
  });

  it('waits out the grace period so it never races a run’s own clean-up', async () => {
    const provider = fakeProvider({ preexisting: [m(1, ours('2026-10-02T08:55:00Z'))] });
    expect((await reap({ provider, now: () => NOW })).destroyed).toEqual([]);
    expect((await reap({ provider, now: () => NOW + 6 * 60_000 })).destroyed).toEqual(['m1']);
  });

  it('never touches a machine without the ticket-worker label — a venture’s own box', async () => {
    const venture = m(7, { venture: 'arca' }, '2025-01-01T00:00:00Z');
    const provider = fakeProvider({ preexisting: [venture] });
    const out = await reap({ provider, now: () => NOW });
    expect(out.destroyed).toEqual([]);
    expect(provider.machines.has(7)).toBe(true);
  });

  it('does not count a machine without the label as overdue, however old', () => {
    expect(overdue([m(8, {}, '2020-01-01T00:00:00Z')], NOW)).toEqual([]);
  });

  it('catches a run that was killed outright and never reached its own clean-up', async () => {
    // The run made its machine and then the whole process died: no finally, nothing destroyed.
    const provider = fakeProvider();
    const transport = fakeTransport();
    transport.run = () => new Promise(() => {}); // hangs forever, as a killed process does
    runTicketOnMachine({ provider, transport, ...runArgs() });
    await new Promise((r) => setTimeout(r, 0));
    expect(provider.machines.size).toBe(1);

    // An hour later the machine is still within its lifetime, so the reaper leaves it.
    expect((await reap({ provider, now: () => NOW + 60 * 60_000 })).destroyed).toEqual([]);
    // Past lifetime and grace, it is gone.
    const late = NOW + (DEFAULTS.lifetimeMinutes + DEFAULTS.graceMinutes + 1) * 60_000;
    expect((await reap({ provider, now: () => late })).destroyed).toHaveLength(1);
    expect(provider.machines.size).toBe(0);
  });

  it('treats a ticket machine whose deadline cannot be read as overdue once old enough', () => {
    const unreadable = m(3, { [ROLE_LABEL]: ROLE_VALUE, 'foundry-expires': 'soon' }, '2026-10-02T06:00:00Z');
    expect(deadlineOf(unreadable)).toBe(Date.parse('2026-10-02T08:30:00Z'));
    const nothing = m(4, { [ROLE_LABEL]: ROLE_VALUE }, 'not a date');
    expect(overdue([nothing], NOW)).toHaveLength(1);
  });

  it('reports a machine it could not destroy rather than hiding it', async () => {
    const provider = fakeProvider({ preexisting: [m(1, ours('2026-10-02T08:00:00Z'))], failDestroy: 99 });
    expect(await reap({ provider, now: () => NOW })).toEqual({ destroyed: [], failed: ['m1'], kept: [] });
  });
});

describe('the money cap', () => {
  it('counts every started hour of the worst case', () => {
    // 150 minutes of life plus 10 of grace is 3 started hours.
    expect(worstCaseEur({ ...DEFAULTS, hourlyEur: 0.02 })).toBe(0.06);
  });

  it('refuses a machine that would pass the day’s cap, in a sentence', () => {
    const check = budgetCheck({ running: 0, spentTodayEur: 0.96, settings: DEFAULTS });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/spending cap .*€1\.00/);
    expect(budgetCheck({ running: 0, spentTodayEur: 0.94, settings: DEFAULTS }).ok).toBe(true);
  });

  it('refuses a machine when the most allowed at once already exist', () => {
    const check = budgetCheck({ running: 2, spentTodayEur: 0, settings: DEFAULTS });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/2 temporary machines working/);
  });

  it('reads its settings from the environment and ignores nonsense', () => {
    const s = settingsFrom({ TICKET_MACHINE_DAILY_CAP_EUR: '3', TICKET_MACHINE_MAX: 'lots', TICKET_MACHINE_HOURLY_EUR: '-1' });
    expect(s.dailyCapEur).toBe(3);
    expect(s.maxMachines).toBe(DEFAULTS.maxMachines);
    expect(s.hourlyEur).toBe(DEFAULTS.hourlyEur);
  });
});

describe('names and labels the provider accepts', () => {
  it('builds a hostname-safe name of at most 63 characters', () => {
    const name = machineName({ venture: 'ARCA', ticket: 'ARCA-061 — A very long title that goes on and on and on', runId: 'Ab12Cd34Ef56' });
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
    expect(name.length).toBeLessThanOrEqual(63);
  });

  it('carries the deadline on the machine itself, in seconds', () => {
    const labels = labelsFor({ venture: 'arca', ticket: 'ARCA-61', runId: 'r', expiresAtMs: NOW });
    expect(labels['foundry-expires']).toBe(String(NOW / 1000));
    expect(labels[ROLE_LABEL]).toBe(ROLE_VALUE);
  });
});
