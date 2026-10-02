/**
 * The Hetzner Cloud provider for ticket machines (FB-239).
 *
 * Hetzner because the venture machines are already there (D1, `scripts/provision-venture.sh`), so a
 * ticket machine is the same kind of thing in the same account, billed the same way: by the hour,
 * stopped the moment it is deleted. The reasoning and the cost are in `docs/ticket-machines.md`.
 *
 * **This file has never been run against the real API.** Creating a machine costs money and is an
 * external action (non-negotiable 4), so it is tested only against a stand-in for `fetch` that checks
 * the requests it would send. It refuses to start without a token, and the token is only ever sent in
 * the Authorization header — never in a URL, where it would end up in logs.
 *
 * The four calls the lifecycle needs: create, wait until running, list ours, destroy.
 */
import { ROLE_LABEL, ROLE_VALUE } from './machine-lib.mjs';

const API = 'https://api.hetzner.cloud/v1';

export function hetznerProvider({
  token, fetchImpl = globalThis.fetch, serverType = 'cx33', location = 'nbg1', image = 'ubuntu-24.04',
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now,
}) {
  if (!token) throw new Error('HCLOUD_TOKEN is not set, so no machine can be made');

  async function call(method, path, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404 && method === 'DELETE') return null; // already gone is what we wanted
    const text = await res.text();
    if (!res.ok) {
      let message = text.slice(0, 200);
      try { message = JSON.parse(text)?.error?.message ?? message; } catch { /* keep the raw text */ }
      throw new Error(`Hetzner said ${res.status} to ${method} ${path}: ${message}`);
    }
    return text ? JSON.parse(text) : null;
  }

  const shape = (s) => ({
    id: s.id,
    name: s.name,
    labels: s.labels ?? {},
    createdAt: s.created,
    status: s.status,
    ip: s.public_net?.ipv4?.ip ?? null,
  });

  return {
    name: 'hetzner',

    /**
     * The run's public key is registered for this one create and removed straight after. Without a
     * key Hetzner sets a root password and emails it to the account owner — a password nobody needs,
     * in an inbox, for a machine that will not exist in two hours.
     */
    async create({ name, labels, userData, publicKey }) {
      const key = await call('POST', '/ssh_keys', { name, public_key: publicKey, labels });
      try {
        const out = await call('POST', '/servers', {
          name,
          server_type: serverType,
          location,
          image,
          ssh_keys: [key.ssh_key.id],
          user_data: userData,
          labels,
          start_after_create: true,
        });
        return shape(out.server);
      } finally {
        // The server keeps the key it was made with; the account does not need to.
        await call('DELETE', `/ssh_keys/${key.ssh_key.id}`).catch(() => {});
      }
    },

    async waitReady(machine, { timeoutMs }) {
      const until = now() + timeoutMs;
      for (;;) {
        const { server } = await call('GET', `/servers/${machine.id}`);
        if (server.status === 'running' && server.public_net?.ipv4?.ip) return shape(server);
        if (now() > until) throw new Error(`machine ${machine.name} was still "${server.status}" after ${Math.round(timeoutMs / 1000)}s`);
        await sleep(5000);
      }
    },

    /** Every machine carrying our role label, across every page. */
    async list() {
      const out = [];
      const selector = encodeURIComponent(`${ROLE_LABEL}==${ROLE_VALUE}`);
      for (let page = 1; page; ) {
        const body = await call('GET', `/servers?label_selector=${selector}&per_page=50&page=${page}`);
        out.push(...(body.servers ?? []).map(shape));
        page = body.meta?.pagination?.next_page ?? null;
      }
      return out;
    },

    async destroy(id) {
      await call('DELETE', `/servers/${id}`);
    },
  };
}
