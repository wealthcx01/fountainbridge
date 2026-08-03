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

/**
 * A venture department — one of the three surfaces a founder manages and owns (FB-048): Build
 * (product), Sell (go-to-market), Scale (growth/ops). Each has its own repo/queue + gate, so the
 * studio can present product-building, selling, and scaling as distinct queues (parity with — and
 * a cleaner split than — Cofounder's departments). `gate` ∈ `pr` | `activegraph` | `tbd-fb012`.
 * `provisioned` is false when the department's repo isn't in the venture's `repos` yet (declared,
 * coming) — so Sell/Scale can be surfaced as "coming with your repo" without a dead board.
 */
export interface DepartmentSummary {
  id: string;
  name: string;
  repo: string | null;
  queuePath: string;
  gate: string;
  provisioned: boolean;
  /**
   * Where this surface's running product/service opens from the studio (FB-093) — the manifest's
   * `launch:` block. Null until the venture defines it; the board shows an honest "nowhere to open
   * yet" state meanwhile. The URL is accepted only when it is http(s): the manifest is
   * repo-controlled, but this string becomes an href, and a loader that would pass `javascript:`
   * through is one copied manifest away from an XSS.
   */
  launch: { label: string | null; url: string } | null;
}

/** A D7 approval-matrix row: who approves a class of change (FB-046 routing). */
export interface ApprovalMatrixRow {
  changeClass: string; // product-visible | platform-infra | high-blast-radius
  approver: 'founder' | 'bruntsfield' | 'dual';
}

export interface VentureSummary extends VentureRef {
  id: string;
  name: string;
  status: string;
  founderName: string | null;
  founderEmail: string | null;
  repos: string[];
  /** D7 governance rows (FB-046). Empty if the manifest declares none. */
  approvalMatrix: ApprovalMatrixRow[];
  /** The venture box's hostname (`vps.host`), or null until provisioned. Drives the chat URL (FB-025). */
  vpsHost: string | null;
  /** Build / Sell / Scale surfaces (FB-048). Empty for a manifest that declares none. */
  departments: DepartmentSummary[];
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

interface RawDepartment {
  id?: unknown;
  name?: unknown;
  repo?: unknown;
  queue_path?: unknown;
  gate?: unknown;
  launch?: unknown;
}

function toLaunch(raw: unknown): DepartmentSummary['launch'] {
  if (!raw || typeof raw !== 'object') return null;
  const { url, label } = raw as { url?: unknown; label?: unknown };
  // http(s) only — same rule as the schema's pattern, enforced again where the href is built.
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
  return { url, label: typeof label === 'string' && label ? label : null };
}

interface RawManifest {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  founder?: { name?: unknown; workspace_email?: unknown };
  repos?: unknown;
  vps?: { host?: unknown };
  departments?: unknown;
  approval_matrix?: unknown;
}

const VALID_APPROVERS = new Set(['founder', 'bruntsfield', 'dual']);
function toApprovalMatrix(raw: unknown): ApprovalMatrixRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ApprovalMatrixRow[] = [];
  for (const r of raw as Array<{ change_class?: unknown; approver?: unknown }>) {
    if (!r || typeof r !== 'object') continue;
    const changeClass = typeof r.change_class === 'string' ? r.change_class : null;
    const approver = typeof r.approver === 'string' && VALID_APPROVERS.has(r.approver) ? r.approver : null;
    if (changeClass && approver) out.push({ changeClass, approver: approver as ApprovalMatrixRow['approver'] });
  }
  return out;
}

function toDepartments(raw: unknown, repos: string[]): DepartmentSummary[] {
  if (!Array.isArray(raw)) return [];
  const out: DepartmentSummary[] = [];
  for (const d of raw as RawDepartment[]) {
    if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !d.id) continue;
    const repo = typeof d.repo === 'string' ? d.repo : null;
    out.push({
      id: d.id,
      name: typeof d.name === 'string' ? d.name : d.id,
      repo,
      queuePath: typeof d.queue_path === 'string' ? d.queue_path : 'docs/tickets',
      gate: typeof d.gate === 'string' ? d.gate : 'pr',
      launch: toLaunch(d.launch),
      // Declared but not yet real until its repo is one the venture actually owns.
      provisioned: repo !== null && repos.includes(repo),
    });
  }
  return out;
}

function toSummary(raw: RawManifest): VentureSummary | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const repos = Array.isArray(raw.repos)
    ? raw.repos.filter((r): r is string => typeof r === 'string')
    : [];
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    status: typeof raw.status === 'string' ? raw.status : 'unknown',
    founderName: typeof raw.founder?.name === 'string' ? raw.founder.name : null,
    founderEmail:
      typeof raw.founder?.workspace_email === 'string' ? raw.founder.workspace_email : null,
    repos,
    vpsHost: typeof raw.vps?.host === 'string' ? raw.vps.host : null,
    departments: toDepartments(raw.departments, repos),
    approvalMatrix: toApprovalMatrix(raw.approval_matrix),
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
