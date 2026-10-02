import { describe, it, expect } from 'vitest';
import { RAILWAY_API, WORKER_IMAGE, deploymentState, railwayProvider } from '../machine-railway';
import { hetznerProvider, unusableSshKey, userData } from '../machine-hetzner';
import { providerFromEnv, type MachineSpec } from '../machine-provider';
import { BOOT_COMMAND, MACHINE } from '../ticket-machines';

/**
 * The Railway provider, against a stand-in for `fetch` that answers like Railway's GraphQL API and
 * records every request. No real API is ever called (FB-239).
 */
type Call = { url: string; auth: string | null; query: string; variables: Record<string, unknown> };

function fakeRailway(opts: { failAt?: string; deploymentStatus?: string | null; environments?: Array<{ id: string; name: string; createdAt: string }> } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const op = /(?:mutation|query) (\w+)/.exec(body.query)?.[1] ?? '';
    calls.push({ url, auth: (init.headers as Record<string, string>).Authorization ?? null, query: body.query, variables: body.variables });
    const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
    if (opts.failAt === op) return new Response(JSON.stringify({ errors: [{ message: `${op} broke` }] }), { status: 200 });
    switch (op) {
      case 'environmentCreate': return ok({ environmentCreate: { id: 'env-1', name: body.variables.input.name, createdAt: '2026-10-02T09:00:00Z' } });
      case 'serviceCreate': return ok({ serviceCreate: { id: 'svc-1' } });
      case 'variableCollectionUpsert': return ok({ variableCollectionUpsert: true });
      case 'serviceInstanceUpdate': return ok({ serviceInstanceUpdate: true });
      case 'serviceInstanceLimitsUpdate': return ok({ serviceInstanceLimitsUpdate: true });
      case 'serviceInstanceDeployV2': return ok({ serviceInstanceDeployV2: 'dep-1' });
      case 'environmentDelete': return ok({ environmentDelete: true });
      case 'deployment': return ok({ deployment: opts.deploymentStatus === null ? null : { id: 'dep-1', status: opts.deploymentStatus ?? 'SUCCESS' } });
      case 'environments': return ok({ environments: { edges: (opts.environments ?? []).map((node) => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } } });
      default: return new Response('unknown', { status: 400 });
    }
  }) as unknown as typeof fetch;
  return { calls, fetchImpl, ops: () => calls.map((c) => /(?:mutation|query) (\w+)/.exec(c.query)?.[1]) };
}

const SPEC: MachineSpec = {
  name: 'fw-arca-arca-061-aaaaaaaaaaaaaaa1', ventureId: 'arca', runId: 'aaaaaaaaaaaaaaa1', expiresAtMs: Date.parse('2026-10-02T11:30:00Z'),
  variables: { FOUNDRY_RUN_TOKEN: 'run-token', FOUNDRY_VENTURE: 'arca' }, bootCommand: BOOT_COMMAND, shape: MACHINE,
};

describe('making a machine on Railway', () => {
  it('makes an empty environment, one service, its variables, its limits, and starts it — in that order', async () => {
    const f = fakeRailway();
    const m = await railwayProvider({ token: 'rw-token', projectId: 'proj-1', fetchImpl: f.fetchImpl }).create(SPEC);
    expect(f.ops()).toEqual(['environmentCreate', 'serviceCreate', 'variableCollectionUpsert', 'serviceInstanceUpdate', 'serviceInstanceLimitsUpdate', 'serviceInstanceDeployV2']);
    expect(m).toEqual({ id: 'env-1', name: SPEC.name, createdAt: '2026-10-02T09:00:00Z', ref: { serviceId: 'svc-1', deploymentId: 'dep-1' } });
    for (const c of f.calls) {
      expect(c.url).toBe(RAILWAY_API);
      expect(c.auth).toBe('Bearer rw-token');
      expect(JSON.stringify(c)).not.toMatch(/rw-token.*rw-token/); // the token is in the header, and nowhere in the request
      expect(JSON.stringify(c.variables)).not.toContain('rw-token');
    }
  });

  it('never copies another environment — that would copy its variables', async () => {
    const f = fakeRailway();
    await railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).create(SPEC);
    const input = f.calls[0].variables.input as Record<string, unknown>;
    expect(input).toEqual({ projectId: 'p', name: SPEC.name, skipInitialDeploys: true });
    expect(input).not.toHaveProperty('sourceEnvironmentId');
  });

  it('sets the variables on this environment and service only, replacing anything there', async () => {
    const f = fakeRailway();
    await railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).create(SPEC);
    expect(f.calls[2].variables.input).toEqual({
      projectId: 'p', environmentId: 'env-1', serviceId: 'svc-1', variables: SPEC.variables, replace: true, skipDeploys: true,
    });
  });

  it('runs once and is never restarted, from Node 20, at a fixed size', async () => {
    const f = fakeRailway();
    await railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).create(SPEC);
    expect(f.calls[1].variables.input).toMatchObject({ source: { image: WORKER_IMAGE }, environmentId: 'env-1' });
    expect(WORKER_IMAGE).toMatch(/^node:20/);
    expect(f.calls[3].variables.input).toMatchObject({ restartPolicyType: 'NEVER', startCommand: `bash -c '${BOOT_COMMAND}'` });
    expect(f.calls[4].variables.input).toEqual({ serviceId: 'svc-1', environmentId: 'env-1', vCPUs: 4, memoryGB: 8 });
  });

  it.each(['serviceCreate', 'variableCollectionUpsert', 'serviceInstanceUpdate', 'serviceInstanceLimitsUpdate', 'serviceInstanceDeployV2'])(
    'a failure at %s leaves nothing behind: the environment is removed and the error is passed on',
    async (op) => {
      const f = fakeRailway({ failAt: op });
      await expect(railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).create(SPEC)).rejects.toThrow(`${op} broke`);
      expect(f.ops().at(-1)).toBe('environmentDelete');
      expect(f.calls.at(-1)!.variables).toEqual({ id: 'env-1' });
    },
  );
});

describe('finding, reading and removing machines on Railway', () => {
  it('lists only ticket machines — never the project\'s own environments', async () => {
    const f = fakeRailway({ environments: [
      { id: 'e1', name: 'production', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'e2', name: 'fw-arca-x-1', createdAt: '2026-10-02T09:00:00Z' },
    ] });
    expect(await railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).list()).toEqual([
      { id: 'e2', name: 'fw-arca-x-1', createdAt: '2026-10-02T09:00:00Z', ref: {} },
    ]);
  });

  it('removes a machine by removing its environment, and an already-gone one is success', async () => {
    const f = fakeRailway();
    await railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).destroy({ id: 'env-9', ref: {} });
    expect(f.calls[0].variables).toEqual({ id: 'env-9' });
    const gone = fakeRailway({ failAt: 'environmentDelete' });
    // "broke" is not "not found", so it is passed on…
    await expect(railwayProvider({ token: 't', projectId: 'p', fetchImpl: gone.fetchImpl }).destroy({ id: 'env-9', ref: {} })).rejects.toThrow();
    // …while "not found" is what we wanted.
    const notFound = (async () => new Response(JSON.stringify({ errors: [{ message: 'Environment not found' }] }), { status: 200 })) as unknown as typeof fetch;
    await expect(railwayProvider({ token: 't', projectId: 'p', fetchImpl: notFound }).destroy({ id: 'env-9', ref: {} })).resolves.toBeUndefined();
  });

  it('reads a deployment\'s status in four words', async () => {
    expect(deploymentState('CRASHED')).toBe('failed');
    expect(deploymentState('FAILED')).toBe('failed');
    expect(deploymentState('SUCCESS')).toBe('running');
    expect(deploymentState('BUILDING')).toBe('starting');
    expect(deploymentState('REMOVED')).toBe('stopped');
    expect(deploymentState(null)).toBe('gone');
    const f = fakeRailway({ deploymentStatus: 'CRASHED' });
    expect(await railwayProvider({ token: 't', projectId: 'p', fetchImpl: f.fetchImpl }).state({ id: 'env-1', ref: { deploymentId: 'dep-1' } })).toBe('failed');
  });
});

describe('which provider the studio uses', () => {
  it('Railway by default, and none at all without its token and project', () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ RAILWAY_TICKET_MACHINE_TOKEN: 't' })).toBeNull();
    expect(providerFromEnv({ RAILWAY_TICKET_MACHINE_TOKEN: 't', TICKET_MACHINE_RAILWAY_PROJECT: 'p' })?.name).toBe('railway');
  });

  it('Hetzner only when chosen, and only with its token', () => {
    expect(providerFromEnv({ HCLOUD_TOKEN: 'h' })).toBeNull();
    expect(providerFromEnv({ TICKET_MACHINE_PROVIDER: 'hetzner' })).toBeNull();
    expect(providerFromEnv({ TICKET_MACHINE_PROVIDER: 'hetzner', HCLOUD_TOKEN: 'h' })?.name).toBe('hetzner');
  });
});

describe('the Hetzner provider, kept behind the same interface', () => {
  it('its start-up script carries only the boot variables, and refuses a value that could break out', () => {
    const ud = userData(SPEC);
    expect(ud).toContain("FOUNDRY_RUN_TOKEN='run-token'");
    expect(ud).toContain('shutdown -P +');
    expect(() => userData({ ...SPEC, variables: { X: "a'; rm -rf /" } })).toThrow(/safely/);
    expect(() => userData({ ...SPEC, variables: { X: 'a\nY=b' } })).toThrow(/safely/);
  });

  it('makes a key nobody can log in with, so Hetzner emails no root password', () => {
    expect(unusableSshKey()).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ foundry-no-login$/);
  });

  it('lists only servers carrying the ticket-machine label, even if the API returns others', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ servers: [
      { id: 1, name: 'arca-box', created: '2026-01-01T00:00:00Z', status: 'running', labels: {} },
      { id: 2, name: 'fw-arca-x', created: '2026-10-02T09:00:00Z', status: 'running', labels: { 'foundry-role': 'ticket-worker' } },
    ], meta: { pagination: { next_page: null } } }), { status: 200 })) as unknown as typeof fetch;
    expect((await hetznerProvider({ token: 'h', fetchImpl }).list()).map((m) => m.id)).toEqual(['2']);
  });
});
