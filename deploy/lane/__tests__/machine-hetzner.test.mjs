import { describe, it, expect } from 'vitest';
import { hetznerProvider } from '../machine-hetzner.mjs';

/**
 * A stand-in for `fetch` that answers like Hetzner's API and records every request. Nothing here
 * reaches the network: making a real machine costs money and is an external action.
 */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const key = `${init.method} ${url.replace('https://api.hetzner.cloud/v1', '')}`;
    const route = routes.find(([pattern]) => (pattern instanceof RegExp ? pattern.test(key) : pattern === key));
    const [status, body] = route ? route[1](calls.at(-1)) : [500, { error: { message: `no route for ${key}` } }];
    return { status, ok: status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
  };
  return { impl, calls };
}

const server = (over = {}) => ({
  id: 42, name: 'fw-arca-arca-61-run1', status: 'running', created: '2026-10-02T09:00:00+00:00',
  labels: { 'foundry-role': 'ticket-worker' }, public_net: { ipv4: { ip: '192.0.2.10' } }, ...over,
});

describe('the Hetzner provider, against a stand-in API', () => {
  it('refuses to start without a token', () => {
    expect(() => hetznerProvider({ token: '' })).toThrow(/HCLOUD_TOKEN/);
  });

  it('creates with the run key, the labels and the start-up script, then removes the key from the account', async () => {
    const { impl, calls } = fakeFetch([
      ['POST /ssh_keys', () => [201, { ssh_key: { id: 9 } }]],
      ['POST /servers', () => [201, { server: server({ status: 'initializing' }) }]],
      ['DELETE /ssh_keys/9', () => [204]],
    ]);
    const p = hetznerProvider({ token: 't0k', fetchImpl: impl });
    const m = await p.create({ name: 'fw-x', labels: { 'foundry-role': 'ticket-worker' }, userData: '#cloud-config', publicKey: 'ssh-ed25519 AAAA' });
    expect(m).toMatchObject({ id: 42, labels: { 'foundry-role': 'ticket-worker' } });
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/servers'));
    expect(create.body).toMatchObject({ ssh_keys: [9], user_data: '#cloud-config', server_type: 'cx33', labels: { 'foundry-role': 'ticket-worker' } });
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE' });
    expect(calls.at(-1).url).toMatch(/\/ssh_keys\/9$/);
    // The token travels in the header and never in a URL.
    for (const c of calls) {
      expect(c.url).not.toContain('t0k');
      expect(c.headers.Authorization).toBe('Bearer t0k');
    }
  });

  it('removes the key from the account even when the create fails', async () => {
    const { impl, calls } = fakeFetch([
      ['POST /ssh_keys', () => [201, { ssh_key: { id: 9 } }]],
      ['POST /servers', () => [403, { error: { message: 'limit reached' } }]],
      ['DELETE /ssh_keys/9', () => [204]],
    ]);
    const p = hetznerProvider({ token: 't', fetchImpl: impl });
    await expect(p.create({ name: 'n', labels: {}, userData: '', publicKey: 'k' })).rejects.toThrow(/403.*limit reached/);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/ssh_keys/9'))).toBe(true);
  });

  it('lists only machines carrying the ticket-worker label, across pages', async () => {
    const { impl, calls } = fakeFetch([
      [/^GET \/servers\?.*page=1$/, () => [200, { servers: [server({ id: 1 })], meta: { pagination: { next_page: 2 } } }]],
      [/^GET \/servers\?.*page=2$/, () => [200, { servers: [server({ id: 2 })], meta: { pagination: { next_page: null } } }]],
    ]);
    const p = hetznerProvider({ token: 't', fetchImpl: impl });
    expect((await p.list()).map((m) => m.id)).toEqual([1, 2]);
    expect(decodeURIComponent(calls[0].url)).toContain('label_selector=foundry-role==ticket-worker');
  });

  it('treats a machine that is already gone as destroyed', async () => {
    const { impl } = fakeFetch([['DELETE /servers/42', () => [404, { error: { message: 'not found' } }]]]);
    await expect(hetznerProvider({ token: 't', fetchImpl: impl }).destroy(42)).resolves.toBeUndefined();
  });

  it('reports a failed destroy, so the lifecycle retries and the reaper still has it', async () => {
    const { impl } = fakeFetch([['DELETE /servers/42', () => [503, { error: { message: 'unavailable' } }]]]);
    await expect(hetznerProvider({ token: 't', fetchImpl: impl }).destroy(42)).rejects.toThrow(/503/);
  });

  it('waits until the machine is running with an address, and gives up at the deadline', async () => {
    let polls = 0;
    const { impl } = fakeFetch([['GET /servers/42', () => {
      polls += 1;
      return [200, { server: server({ status: polls < 3 ? 'initializing' : 'running' }) }];
    }]]);
    let t = 0;
    const p = hetznerProvider({ token: 't', fetchImpl: impl, sleep: async () => { t += 5000; }, now: () => t });
    expect((await p.waitReady({ id: 42 }, { timeoutMs: 60_000 })).ip).toBe('192.0.2.10');

    const stuck = fakeFetch([['GET /servers/42', () => [200, { server: server({ status: 'starting' }) }]]]);
    t = 0;
    const q = hetznerProvider({ token: 't', fetchImpl: stuck.impl, sleep: async () => { t += 5000; }, now: () => t });
    await expect(q.waitReady({ id: 42, name: 'm' }, { timeoutMs: 20_000 })).rejects.toThrow(/still "starting"/);
  });
});
