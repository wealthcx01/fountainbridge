/**
 * What a ticket-machine provider must do (FB-239). Two exist: Railway, the one in use (John's ruling,
 * 2026-10-02, and D11), and Hetzner, kept behind the same four calls and used only when chosen.
 *
 * Only the studio ever constructs one. The provider token lives in the studio's environment and in
 * no other place, so no venture's machine or lane can make, list or remove a machine (D1 as amended
 * by D11, CLAUDE.md #6).
 */
import { MACHINE, type MachineShape } from './ticket-machines';
import { railwayProvider } from './machine-railway';
import { hetznerProvider } from './machine-hetzner';

export interface MachineSpec {
  /** Unique per run; also how a machine whose create reply was lost is found again. */
  name: string;
  ventureId: string;
  runId: string;
  expiresAtMs: number;
  /** Stored by the provider and visible to the machine. Never a venture credential. */
  variables: Record<string, string>;
  bootCommand: string;
  shape: MachineShape;
}

export interface Machine {
  id: string;
  name: string;
  createdAt: string | null;
  /** Provider-specific ids needed to remove it. Ids only. */
  ref: Record<string, string>;
}

/** `failed` and `stopped` mean nothing is working there any more; `gone` means it no longer exists. */
export type MachineState = 'starting' | 'running' | 'stopped' | 'failed' | 'gone';

export interface MachineProvider {
  readonly name: 'railway' | 'hetzner';
  create(spec: MachineSpec): Promise<Machine>;
  state(machine: Pick<Machine, 'id' | 'ref'>): Promise<MachineState>;
  /** Every ticket machine the provider holds, whichever venture it is for. Asked of the provider, never remembered. */
  list(): Promise<Machine[]>;
  /** Remove it. Removing one that is already gone is success. */
  destroy(machine: Pick<Machine, 'id' | 'ref'>): Promise<void>;
}

/**
 * The provider this studio is set up for, or null when it is not set up. Railway unless
 * `TICKET_MACHINE_PROVIDER=hetzner`.
 */
export function providerFromEnv(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = globalThis.fetch,
): MachineProvider | null {
  const which = (env.TICKET_MACHINE_PROVIDER?.trim() || 'railway').toLowerCase();
  if (which === 'railway') {
    const token = env.RAILWAY_TICKET_MACHINE_TOKEN?.trim();
    const projectId = env.TICKET_MACHINE_RAILWAY_PROJECT?.trim();
    if (!token || !projectId) return null;
    return railwayProvider({ token, projectId, fetchImpl, region: env.TICKET_MACHINE_REGION?.trim() || undefined });
  }
  if (which === 'hetzner') {
    const token = env.HCLOUD_TOKEN?.trim();
    if (!token) return null;
    return hetznerProvider({ token, fetchImpl, location: env.TICKET_MACHINE_LOCATION?.trim() || undefined });
  }
  return null;
}

export { MACHINE };
