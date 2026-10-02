/**
 * Ticket machines on Hetzner Cloud — the second provider, off unless `TICKET_MACHINE_PROVIDER=hetzner`
 * (FB-239).
 *
 * John ruled on 2026-10-02 that ticket machines run on Railway. This is the Hetzner code the first
 * version of this ticket built, kept behind the same four calls so the choice can be changed in one
 * setting. Like Railway, only the studio holds its token: a venture's own machine never does.
 *
 * The machine's start-up script (cloud-init) is kept by Hetzner and readable by anyone on the
 * account, so it carries only the boot variables — the studio's address and a run token that is
 * spent the moment the machine collects its work. No venture credential is ever in it.
 *
 * **Never run against the real API.** Tested against a stand-in for `fetch`.
 */
import { generateKeyPairSync } from 'node:crypto';
import type { Machine, MachineProvider, MachineSpec, MachineState } from './machine-provider';

const API = 'https://api.hetzner.cloud/v1';
export const ROLE_LABEL = 'foundry-role';
export const ROLE_VALUE = 'ticket-worker';

/**
 * A public key nobody holds the private half of. Hetzner emails a root password for a server made
 * without a key; this stops that, and since the private half is thrown away, nobody can log in.
 */
export function unusableSshKey(): string {
  const { publicKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from((publicKey.export({ format: 'jwk' }) as { x: string }).x, 'base64url');
  const part = (b: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(b.length); return Buffer.concat([len, b]); };
  return `ssh-ed25519 ${Buffer.concat([part(Buffer.from('ssh-ed25519')), part(raw)]).toString('base64')} foundry-no-login`;
}

/** Hetzner label values: letters, digits, dot, dash, underscore; at most 63; alphanumeric at each end. */
export function labelValue(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 63).replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '');
}

/** The cloud-init script. Variables only from the spec; each must be one line with no quote in it. */
export function userData(spec: MachineSpec): string {
  const envLines = Object.entries(spec.variables).map(([k, v]) => {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k) || /['\r\n]/.test(v)) throw new Error(`${k} cannot be written into a start-up script safely`);
    return `      ${k}='${v}'`;
  });
  const minutes = Math.max(1, Math.ceil((spec.expiresAtMs - Date.now()) / 60_000));
  return [
    '#cloud-config',
    '# A Foundry ticket machine (FB-239). Exists for one ticket, then is removed.',
    'package_update: true',
    'packages: [git, curl, ca-certificates]',
    'write_files:',
    '  - path: /etc/foundry-run.env',
    "    permissions: '0600'",
    '    content: |',
    ...envLines,
    'runcmd:',
    // The machine's own deadline: work stops even if the studio never reaches it again.
    `  - shutdown -P +${minutes} "Foundry ticket machine: lifetime reached"`,
    `  - [bash, -c, "set -a; . /etc/foundry-run.env; set +a; ${spec.bootCommand.replace(/"/g, '\\"')}"]`,
    '',
  ].join('\n');
}

export function hetznerProvider(o: {
  token: string;
  fetchImpl?: typeof fetch;
  serverType?: string;
  location?: string;
  image?: string;
}): MachineProvider {
  if (!o.token) throw new Error('HCLOUD_TOKEN is not set, so no machine can be made.');
  const doFetch = o.fetchImpl ?? globalThis.fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await doFetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404 && (method === 'DELETE' || method === 'GET')) return null;
    const text = await res.text();
    if (!res.ok) {
      let message = text.slice(0, 200);
      try { message = JSON.parse(text)?.error?.message ?? message; } catch { /* keep the raw text */ }
      throw new Error(`Hetzner said ${res.status} to ${method} ${path}: ${message}`);
    }
    return text ? (JSON.parse(text) as T) : null;
  }

  type Server = { id: number; name: string; created: string; status: string; labels?: Record<string, string> };
  const shape = (s: Server): Machine => ({ id: String(s.id), name: s.name, createdAt: s.created ?? null, ref: {} });

  return {
    name: 'hetzner',

    async create(spec) {
      const labels = {
        [ROLE_LABEL]: ROLE_VALUE,
        'foundry-venture': labelValue(spec.ventureId),
        'foundry-run': labelValue(spec.runId),
        'foundry-expires': String(Math.floor(spec.expiresAtMs / 1000)),
      };
      const key = await call<{ ssh_key: { id: number } }>('POST', '/ssh_keys', { name: spec.name, public_key: unusableSshKey(), labels });
      try {
        const out = await call<{ server: Server }>('POST', '/servers', {
          name: spec.name,
          server_type: o.serverType ?? 'cx33',
          location: o.location ?? 'nbg1',
          image: o.image ?? 'ubuntu-24.04',
          ssh_keys: [key!.ssh_key.id],
          user_data: userData(spec),
          labels,
          start_after_create: true,
        });
        return shape(out!.server);
      } finally {
        await call('DELETE', `/ssh_keys/${key!.ssh_key.id}`).catch(() => {});
      }
    },

    async state(machine): Promise<MachineState> {
      const r = await call<{ server: Server }>('GET', `/servers/${encodeURIComponent(machine.id)}`);
      if (!r) return 'gone';
      if (r.server.status === 'running') return 'running';
      if (r.server.status === 'off' || r.server.status === 'stopping') return 'stopped';
      return 'starting';
    },

    async list() {
      const out: Machine[] = [];
      const selector = encodeURIComponent(`${ROLE_LABEL}==${ROLE_VALUE}`);
      for (let page: number | null = 1; page; ) {
        const body: { servers?: Server[]; meta?: { pagination?: { next_page: number | null } } } | null =
          await call('GET', `/servers?label_selector=${selector}&per_page=50&page=${page}`);
        // Checked again here, not only trusted to the selector: a server without our label is never ours.
        out.push(...(body?.servers ?? []).filter((s) => s.labels?.[ROLE_LABEL] === ROLE_VALUE).map(shape));
        page = body?.meta?.pagination?.next_page ?? null;
      }
      return out;
    },

    async destroy(machine) {
      await call('DELETE', `/servers/${encodeURIComponent(machine.id)}`);
    },
  };
}
