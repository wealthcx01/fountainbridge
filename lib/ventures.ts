/**
 * Venture manifest loader (FB-005). Reads `ventures/*.yaml` (created in FB-003, validated against
 * the bcap-contracts Venture schema) into a small summary the studio renders and scopes against.
 * Server-only — touches the filesystem. The full contract-typed load lands with the generated TS
 * types in a later ticket; this reads the fields the shell needs.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { VentureRef } from './authz';

export interface VentureSummary extends VentureRef {
  id: string;
  name: string;
  status: string;
  founderName: string | null;
  founderEmail: string | null;
  repos: string[];
  /** The venture box's hostname (`vps.host`), or null until provisioned. Drives the chat URL (FB-025). */
  vpsHost: string | null;
}

const DEFAULT_DIR = join(process.cwd(), 'ventures');

/**
 * The venture's conversational-composer (LibreChat) URL, by convention `chat.<box host>` — the box's
 * Caddy proxies it to LibreChat (FB-025). Null until the venture has a provisioned box, so the studio
 * shows a "coming with your box" state rather than a dead link.
 */
export function ventureChatUrl(vpsHost: string | null): string | null {
  return vpsHost ? `https://chat.${vpsHost}` : null;
}

interface RawManifest {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  founder?: { name?: unknown; workspace_email?: unknown };
  repos?: unknown;
  vps?: { host?: unknown };
}

function toSummary(raw: RawManifest): VentureSummary | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    status: typeof raw.status === 'string' ? raw.status : 'unknown',
    founderName: typeof raw.founder?.name === 'string' ? raw.founder.name : null,
    founderEmail:
      typeof raw.founder?.workspace_email === 'string' ? raw.founder.workspace_email : null,
    repos: Array.isArray(raw.repos) ? raw.repos.filter((r): r is string => typeof r === 'string') : [],
    vpsHost: typeof raw.vps?.host === 'string' ? raw.vps.host : null,
  };
}

/**
 * Load every venture manifest under `dir` (defaults to `<cwd>/ventures`). The `example-*.yaml`
 * template is skipped. A malformed file is skipped, not fatal — one bad manifest never blanks the
 * whole studio (fail loud per file happens at manifest-validate / CI time, FB-003).
 */
export function loadVentures(dir: string = DEFAULT_DIR): VentureSummary[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.yaml') && !f.startsWith('example'));
  } catch {
    return [];
  }
  const out: VentureSummary[] = [];
  for (const file of files) {
    try {
      const summary = toSummary(yaml.load(readFileSync(join(dir, file), 'utf8')) as RawManifest);
      if (summary) out.push(summary);
    } catch {
      // skip a manifest that fails to parse; CI's manifest-validate is the gate that fails loud
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
